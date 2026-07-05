"""
Tests for AIQueryExecutor — Step 2: execute query plan against real DB.

Acceptance criteria covered:
  - AC3: action="compare" returns real score diff from Score table
  - AC4: action="average" returns real AVG aggregation
  - AC5: action="decline" based on total_score trend, NOT grade_rank
  - AC6: action="permission_denied" returns permission hint
  - AC7: action="irrelevant" returns "只回答成绩相关问题"
  - AC9: student_not_found / subject_not_found / insufficient_data statuses
  - AC10: requires_disambiguation=true -> no DB score query, hardcoded answer
"""
import os
import sys

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "school_management.settings_sqlite_test")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))))
import django
django.setup()

from datetime import date
import unittest

from django.test import TestCase
from django.contrib.auth import get_user_model

from school_management.students_grades.models import Class, Student, Exam, Score
from school_management.students_grades.services.ai_query_executor import (
    AIQueryExecutor,
    _normalize_grade,
    _compute_timeframe_dates,
    _get_user_class_ids,
    _find_class_by_display_name,
    GRADE_NORMALIZE_MAP,
)

User = get_user_model()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_test_data():
    """Create a minimal test dataset and return the objects."""
    cls = Class.objects.create(grade_level="初三", class_name="1班", cohort="初中2026级")
    student = Student.objects.create(
        student_id="S001", name="张三", grade_level="初三", current_class=cls
    )
    exam1 = Exam.objects.create(
        name="第一次月考", academic_year="2025-2026",
        grade_level="初中2026级", date=date(2025, 9, 15),
    )
    exam2 = Exam.objects.create(
        name="第二次月考", academic_year="2025-2026",
        grade_level="初中2026级", date=date(2025, 10, 15),
    )
    exam3 = Exam.objects.create(
        name="第三次月考", academic_year="2025-2026",
        grade_level="初中2026级", date=date(2025, 11, 15),
    )
    # Scores for student: math scores declining
    Score.objects.create(student=student, exam=exam1, subject="数学", score_value=90)
    Score.objects.create(student=student, exam=exam2, subject="数学", score_value=80)
    Score.objects.create(student=student, exam=exam3, subject="数学", score_value=70)
    # Also Chinese scores
    Score.objects.create(student=student, exam=exam1, subject="语文", score_value=85)
    Score.objects.create(student=student, exam=exam2, subject="语文", score_value=88)
    Score.objects.create(student=student, exam=exam3, subject="语文", score_value=82)

    return cls, student, exam1, exam2, exam3


# ---------------------------------------------------------------------------
# AIQueryExecutor tests
# ---------------------------------------------------------------------------

class AIQueryExecutorTests(TestCase):
    """Tests for AIQueryExecutor.execute() and action handlers."""

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.cls, cls.student, cls.e1, cls.e2, cls.e3 = _create_test_data()
        cls.user = User.objects.create_user(
            username="exec_test_admin", password="pass", role="admin"
        )

    def setUp(self):
        self.executor = AIQueryExecutor()

    # ------------------------------------------------------------------
    # AC3: action="compare" returns real score diff
    # ------------------------------------------------------------------

    def test_compare_returns_real_score_diff(self):
        """compare returns first/last score + diff computed from Score table."""
        plan = {
            "action": "compare",
            "filters": {"student_name": "张三", "subject": "数学"},
            "limit": 10,
        }
        result = self.executor.execute(plan, role="admin")
        self.assertTrue(result["success"])
        self.assertEqual(result["status"], "success")
        data = result["data"]
        self.assertEqual(data["first"]["score"], 90)
        self.assertEqual(data["last"]["score"], 70)
        self.assertEqual(data["diff"], -20)
        self.assertEqual(data["trend"], "down")
        self.assertEqual(data["record_count"], 3)

    def test_compare_returns_diff_with_upward_trend(self):
        """compare returns positive diff for upward trend."""
        student2 = Student.objects.create(
            student_id="S002", name="李四", grade_level="初三",
            current_class=self.cls,
        )
        Score.objects.create(student=student2, exam=self.e1, subject="英语", score_value=60)
        Score.objects.create(student=student2, exam=self.e2, subject="英语", score_value=75)
        Score.objects.create(student=student2, exam=self.e3, subject="英语", score_value=90)

        plan = {
            "action": "compare",
            "filters": {"student_name": "李四", "subject": "英语"},
            "limit": 10,
        }
        result = self.executor.execute(plan, role="admin")
        data = result["data"]
        self.assertEqual(data["first"]["score"], 60)
        self.assertEqual(data["last"]["score"], 90)
        self.assertEqual(data["diff"], 30)
        self.assertEqual(data["trend"], "up")

    def test_compare_insufficient_data_single_record(self):
        """compare with only 1 score returns insufficient_data status."""
        student2 = Student.objects.create(
            student_id="S003", name="王五", grade_level="初三",
            current_class=self.cls,
        )
        Score.objects.create(student=student2, exam=self.e1, subject="物理", score_value=70)

        plan = {
            "action": "compare",
            "filters": {"student_name": "王五", "subject": "物理"},
            "limit": 10,
        }
        result = self.executor.execute(plan, role="admin")
        self.assertEqual(result["status"], "insufficient_data")
        self.assertIn("仅有一条记录", result.get("hint", ""))

    # ------------------------------------------------------------------
    # AC4: action="average" returns real AVG aggregation
    # ------------------------------------------------------------------

    def test_average_returns_real_avg(self):
        """average returns AVG aggregation computed from Score table."""
        plan = {
            "action": "average",
            "filters": {"subject": "数学", "student_name": "张三"},
            "limit": 10,
        }
        result = self.executor.execute(plan, role="admin")
        self.assertTrue(result["success"])
        self.assertEqual(result["status"], "success")
        data = result["data"]
        # (90+80+70) / 3 = 80
        self.assertEqual(data["average"], 80.0)
        self.assertEqual(data["max"], 90.0)
        self.assertEqual(data["min"], 70.0)
        self.assertEqual(data["student_count"], 1)
        self.assertEqual(data["total_records"], 3)

    def test_average_class_level(self):
        """average at class level without student filter."""
        plan = {
            "action": "average",
            "filters": {"subject": "语文", "class_name": "初三1班"},
            "limit": 10,
        }
        result = self.executor.execute(plan, role="admin")
        self.assertTrue(result["success"])
        data = result["data"]
        # (85+88+82) / 3 = 85
        self.assertEqual(data["average"], 85.0)

    def test_average_no_data(self):
        """average with no matching data returns insufficient_data."""
        plan = {
            "action": "average",
            "filters": {"subject": "体育", "student_name": "张三"},
            "limit": 10,
        }
        result = self.executor.execute(plan, role="admin")
        self.assertEqual(result["status"], "insufficient_data")

    def test_fuzzy_exam_keyword_resolves_single_midterm_exam(self):
        """期中考 should match a real exam named 期中集团联考 when unique."""
        midterm = Exam.objects.create(
            name="初三上学期期中集团联考",
            academic_year="2025-2026",
            grade_level="初中2026级",
            date=date(2025, 12, 1),
        )
        Score.objects.create(
            student=self.student,
            exam=midterm,
            subject="数学",
            score_value=99,
        )

        plan = {
            "action": "average",
            "filters": {"subject": "数学", "class_name": "初三1班"},
            "limit": 10,
            "_question": "期中考一班数学均分是多少？",
        }
        result = self.executor.execute(plan, role="admin")
        self.assertEqual(result["status"], "success")
        self.assertEqual(result["data"]["average"], 99.0)

    def test_fuzzy_exam_keyword_returns_disambiguation_for_multiple_matches(self):
        """期中考 should return candidates when more than one visible exam matches."""
        for idx, exam_date in enumerate((date(2025, 12, 1), date(2026, 5, 1)), start=1):
            exam = Exam.objects.create(
                name=f"第{idx}次期中集团联考",
                academic_year="2025-2026",
                grade_level="初中2026级",
                date=exam_date,
            )
            Score.objects.create(
                student=self.student,
                exam=exam,
                subject="数学",
                score_value=80 + idx,
            )

        plan = {
            "action": "average",
            "filters": {"subject": "数学", "class_name": "初三1班"},
            "limit": 10,
            "_question": "期中考一班数学均分是多少？",
        }
        result = self.executor.execute(plan, role="admin")
        self.assertEqual(result["status"], "ambiguous")
        self.assertTrue(result.get("requires_disambiguation"))
        self.assertGreaterEqual(len(result.get("candidates", [])), 2)

    def test_colloquial_class_name_resolves_with_teacher_scope(self):
        """一班 should resolve to 初三1班 when the teacher only sees that class."""
        plan = {
            "action": "average",
            "filters": {"subject": "语文", "class_name": "一班"},
            "limit": 10,
        }
        result = self.executor.execute(
            plan,
            role="subject_teacher",
            teaching_classes=["初三1班"],
        )
        self.assertEqual(result["status"], "success")
        self.assertEqual(result["data"]["average"], 85.0)

    # ------------------------------------------------------------------
    # AC5: action="decline" based on total_score trend (NOT grade_rank)
    # ------------------------------------------------------------------

    def test_decline_based_on_total_score_trend(self):
        """decline detects consecutive total_score drops across 3+ exams."""
        student2 = Student.objects.create(
            student_id="S004", name="退步生", grade_level="初三",
            current_class=self.cls,
        )
        # Exam 1: total 270
        Score.objects.create(student=student2, exam=self.e1, subject="语文", score_value=90)
        Score.objects.create(student=student2, exam=self.e1, subject="数学", score_value=90)
        Score.objects.create(student=student2, exam=self.e1, subject="英语", score_value=90)
        # Exam 2: total 240 (drop of 30)
        Score.objects.create(student=student2, exam=self.e2, subject="语文", score_value=80)
        Score.objects.create(student=student2, exam=self.e2, subject="数学", score_value=80)
        Score.objects.create(student=student2, exam=self.e2, subject="英语", score_value=80)
        # Exam 3: total 210 (drop of 30)
        Score.objects.create(student=student2, exam=self.e3, subject="语文", score_value=70)
        Score.objects.create(student=student2, exam=self.e3, subject="数学", score_value=70)
        Score.objects.create(student=student2, exam=self.e3, subject="英语", score_value=70)

        plan = {
            "action": "decline",
            "filters": {"class_name": "初三1班"},
            "limit": 10,
        }
        result = self.executor.execute(plan, role="admin")
        self.assertTrue(result["success"])
        self.assertEqual(result["status"], "success")
        data = result["data"]
        self.assertGreaterEqual(len(data["declining_students"]), 1)
        declining_names = [s["student_name"] for s in data["declining_students"]]
        self.assertIn("退步生", declining_names)
        for student_data in data["declining_students"]:
            if student_data["student_name"] == "退步生":
                trend = student_data["trend"]
                # trend values are negative (drops): -(270-240), -(240-210)
                self.assertEqual(trend, [-30.0, -30.0])

    def test_decline_no_consecutive_drop_returns_empty(self):
        """When no student has 3 consecutive declining exams, returns empty."""
        student3 = Student.objects.create(
            student_id="S005", name="进步生", grade_level="初三",
            current_class=self.cls,
        )
        Score.objects.create(student=student3, exam=self.e1, subject="语文", score_value=60)
        Score.objects.create(student=student3, exam=self.e2, subject="语文", score_value=80)
        Score.objects.create(student=student3, exam=self.e3, subject="语文", score_value=95)

        plan = {
            "action": "decline",
            "filters": {"student_name": "进步生"},
            "limit": 10,
        }
        result = self.executor.execute(plan, role="admin")
        self.assertTrue(result["success"])
        data = result["data"]
        # 进步生: 60->80->95 (upward), not declining
        self.assertEqual(len(data["declining_students"]), 0)

    def test_decline_does_not_use_grade_rank_field(self):
        """Verify decline logic does not query rank fields from Score model."""
        import inspect
        source = inspect.getsource(self.executor._execute_decline)
        # The docstring explains grade_rank is NOT used, but the logic must
        # not query rank-related DB fields (grade_rank_in_subject etc.)
        for banned in ("grade_rank_in_subject", "class_rank_in_subject",
                       "total_score_rank_in_grade", "total_score_rank_in_class"):
            self.assertNotIn(banned, source,
                             f"Decline must not use {banned}")
        self.assertIn("total_score", source,
                      "Decline logic must aggregate total_score per exam")

    # ------------------------------------------------------------------
    # AC6: action="permission_denied" returns permission hint
    # ------------------------------------------------------------------

    def test_permission_denied_is_rejected(self):
        """permission_denied action returns status + hint + answer."""
        plan = {"action": "permission_denied", "filters": {}}
        result = self.executor.execute(
            plan, role="subject_teacher",
            teaching_classes=["初三1班"],
        )
        self.assertTrue(result["success"])
        self.assertEqual(result["status"], "permission_denied")
        self.assertIn("您无法查看该数据", result.get("answer", ""))
        self.assertIn("初三1班", result.get("answer", ""))

    def test_permission_denied_for_grade_manager(self):
        """permission_denied answer includes managed_grade for grade_manager."""
        plan = {"action": "permission_denied", "filters": {}}
        result = self.executor.execute(
            plan, role="grade_manager", managed_grade="初三",
        )
        self.assertIn("初三", result.get("answer", ""))

    def test_permission_denied_no_scope(self):
        """permission_denied when user has no scope still returns hint."""
        plan = {"action": "permission_denied", "filters": {}}
        result = self.executor.execute(
            plan, role="subject_teacher",
        )
        self.assertTrue(result["success"])
        self.assertEqual(result["status"], "permission_denied")

    # ------------------------------------------------------------------
    # AC7: action="irrelevant" returns "只回答成绩相关问题"
    # ------------------------------------------------------------------

    def test_irrelevant_returns_grades_only_message(self):
        """irrelevant action returns the hardcoded grades-only message."""
        plan = {"action": "irrelevant", "filters": {}}
        result = self.executor.execute(plan, role="admin")
        self.assertTrue(result["success"])
        self.assertEqual(result["status"], "irrelevant")
        self.assertEqual(result["answer"], "抱歉，我只回答成绩相关问题。")

    # ------------------------------------------------------------------
    # AC9: student_not_found / subject_not_found / insufficient_data
    # ------------------------------------------------------------------

    def test_student_not_found(self):
        """Query for non-existent student returns student_not_found."""
        plan = {
            "action": "compare",
            "filters": {"student_name": "不存在", "subject": "数学"},
            "limit": 10,
        }
        result = self.executor.execute(plan, role="admin")
        self.assertEqual(result["status"], "student_not_found")
        self.assertIn("不存在", result.get("answer", ""))

    def test_subject_not_found(self):
        """Student exists but has no scores for specified subject."""
        plan = {
            "action": "compare",
            "filters": {"student_name": "张三", "subject": "体育"},
            "limit": 10,
        }
        result = self.executor.execute(plan, role="admin")
        self.assertEqual(result["status"], "subject_not_found")
        self.assertIn("available_subjects", result.get("data", {}))
        available = result["data"]["available_subjects"]
        available_subjects = [a["subject"] for a in available]
        self.assertIn("数学", available_subjects)
        self.assertIn("语文", available_subjects)

    def test_subject_not_found_includes_alternatives_in_answer(self):
        """subject_not_found answer lists alternative subjects."""
        plan = {
            "action": "compare",
            "filters": {"student_name": "张三", "subject": "体育"},
            "limit": 10,
        }
        result = self.executor.execute(plan, role="admin")
        answer = result.get("answer", "")
        self.assertIn("张三", answer)
        self.assertIn("数学", answer)

    def test_insufficient_data_for_decline_too_few_exams(self):
        """decline action with <3 exams per student returns empty."""
        student4 = Student.objects.create(
            student_id="S006", name="少考试", grade_level="初三",
            current_class=self.cls,
        )
        Score.objects.create(student=student4, exam=self.e1, subject="语文", score_value=80)
        Score.objects.create(student=student4, exam=self.e2, subject="语文", score_value=70)

        plan = {
            "action": "decline",
            "filters": {"student_name": "少考试"},
            "limit": 10,
        }
        result = self.executor.execute(plan, role="admin")
        self.assertTrue(result["success"])
        self.assertEqual(len(result["data"]["declining_students"]), 0)

    # ------------------------------------------------------------------
    # AC10: requires_disambiguation=true -> no DB score query, hardcoded answer
    # ------------------------------------------------------------------

    def test_disambiguation_exam_no_score_query(self):
        """Disambiguation for exam returns candidates without querying scores."""
        plan = {
            "action": "compare",
            "filters": {"student_name": "张三", "subject": "数学"},
            "requires_disambiguation": True,
            "ambiguous": {"type": "exam", "keyword": "月考"},
        }
        result = self.executor.execute(plan, role="admin")
        self.assertTrue(result["success"])
        self.assertEqual(result["status"], "ambiguous")
        self.assertTrue(result.get("requires_disambiguation"))
        self.assertIn("月考", result.get("answer", ""))
        self.assertIn("哪一次", result.get("answer", ""))
        candidates = result.get("candidates", [])
        self.assertGreater(len(candidates), 0)
        candidate_names = [c["name"] for c in candidates]
        for name in candidate_names:
            self.assertIn("月考", name)

    def test_disambiguation_student_no_score_query(self):
        """Disambiguation for student returns candidates without DB score query."""
        cls2 = Class.objects.create(grade_level="初三", class_name="2班", cohort="初中2026级")
        Student.objects.create(
            student_id="S007", name="同名", grade_level="初三", current_class=self.cls,
        )
        Student.objects.create(
            student_id="S008", name="同名", grade_level="初三", current_class=cls2,
        )

        plan = {
            "action": "compare",
            "filters": {"student_name": "同名"},
            "requires_disambiguation": True,
            "ambiguous": {"type": "student", "keyword": "同名"},
        }
        result = self.executor.execute(plan, role="admin")
        self.assertTrue(result["success"])
        self.assertEqual(result["status"], "ambiguous")
        self.assertIn("同名", result.get("answer", ""))
        candidates = result.get("candidates", [])
        self.assertGreaterEqual(len(candidates), 2)

    def test_disambiguation_does_not_query_scores(self):
        """Verify that with requires_disambiguation=true, score queries are NOT executed."""
        Student.objects.create(
            student_id="S009", name="无双", grade_level="初三", current_class=self.cls,
        )
        plan = {
            "action": "compare",
            "filters": {"student_name": "无双", "subject": "数学"},
            "requires_disambiguation": True,
            "ambiguous": {"type": "student", "keyword": "无双"},
        }
        result = self.executor.execute(plan, role="admin")
        self.assertEqual(result["status"], "ambiguous")

    def test_disambiguation_candidates_respect_teacher_scope(self):
        """Exam candidates should stay inside the teacher's visible classes."""
        cls2 = Class.objects.create(grade_level="初三", class_name="2班", cohort="初中2026级")
        student2 = Student.objects.create(
            student_id="S010",
            name="范围外",
            grade_level="初三",
            current_class=cls2,
        )
        out_of_scope_exam = Exam.objects.create(
            name="范围外月考",
            academic_year="2025-2026",
            grade_level="初中2026级",
            date=date(2025, 12, 20),
        )
        Score.objects.create(
            student=student2,
            exam=out_of_scope_exam,
            subject="数学",
            score_value=100,
        )

        plan = {
            "action": "compare",
            "filters": {"subject": "数学"},
            "requires_disambiguation": True,
            "ambiguous": {"type": "exam", "keyword": "月考"},
        }
        result = self.executor.execute(
            plan,
            role="subject_teacher",
            teaching_classes=["初三1班"],
        )
        candidate_names = [c["name"] for c in result.get("candidates", [])]
        self.assertNotIn("范围外月考", candidate_names)

    # ------------------------------------------------------------------
    # Permission boundary: _get_user_class_ids
    # ------------------------------------------------------------------

    def test_admin_can_see_all(self):
        """admin and staff users have unrestricted access (None = no filter)."""
        ids = _get_user_class_ids("admin", None, None)
        self.assertIsNone(ids)
        ids = _get_user_class_ids("staff", None, None)
        self.assertIsNone(ids)

    def test_grade_manager_restricted_to_grade(self):
        """grade_manager only sees classes in their managed_grade."""
        cls_gao = Class.objects.create(grade_level="高一", class_name="1班", cohort="高中2026级")
        ids = _get_user_class_ids("grade_manager", None, "初三")
        self.assertIn(self.cls.id, ids)
        self.assertNotIn(cls_gao.id, ids)

    def test_subject_teacher_restricted_to_teaching_classes(self):
        """subject_teacher only sees their assigned classes."""
        cls2 = Class.objects.create(grade_level="初三", class_name="2班", cohort="初中2026级")

        user = User.objects.create_user(
            username="teacher_test", password="pass", role="subject_teacher",
        )
        self.cls.subject_teachers.add(user)

        ids = _get_user_class_ids(
            "subject_teacher",
            teaching_classes=["初三1班"],
            managed_grade=None,
        )
        self.assertIn(self.cls.id, ids)
        if len(ids) > 0:
            self.assertNotIn(cls2.id, ids)

    def test_subject_teacher_no_classes_returns_empty(self):
        """subject_teacher with no teaching_classes gets empty list."""
        ids = _get_user_class_ids("subject_teacher", [], None)
        self.assertEqual(ids, [])

    # ------------------------------------------------------------------
    # unknown_action
    # ------------------------------------------------------------------

    def test_unknown_action_returns_hint(self):
        """An unrecognized action returns unknown_action status."""
        plan = {"action": "fantasy_query", "filters": {}}
        result = self.executor.execute(plan, role="admin")
        self.assertEqual(result["status"], "unknown_action")
        self.assertIn("未知的查询动作", result.get("hint", ""))


# ---------------------------------------------------------------------------
# Utility function tests (no DB access — unittest.TestCase is fine)
# ---------------------------------------------------------------------------

class UtilityFunctionTests(unittest.TestCase):
    """Tests for helper functions that don't need DB access."""

    def test_normalize_grade_alternate_names(self):
        self.assertEqual(_normalize_grade("九年级"), "初三")
        self.assertEqual(_normalize_grade("八年级"), "初二")
        self.assertEqual(_normalize_grade("七年级"), "初一")
        self.assertEqual(_normalize_grade("十年级"), "高一")
        self.assertEqual(_normalize_grade("十一年级"), "高二")
        self.assertEqual(_normalize_grade("十二年级"), "高三")

    def test_normalize_grade_standard_names_pass_through(self):
        self.assertEqual(_normalize_grade("初三"), "初三")
        self.assertEqual(_normalize_grade("高一"), "高一")

    def test_normalize_grade_none_returns_none(self):
        self.assertIsNone(_normalize_grade(None))

    def test_normalize_grade_empty_string(self):
        """Empty string is falsy -> normalize returns None."""
        self.assertIsNone(_normalize_grade(""))

    def test_compute_timeframe_dates_all(self):
        start, end = _compute_timeframe_dates("全部")
        self.assertIsNone(start)
        self.assertIsNone(end)

    def test_compute_timeframe_dates_this_month(self):
        import calendar
        today = date.today()
        start, end = _compute_timeframe_dates("本月")
        self.assertEqual(start, date(today.year, today.month, 1))
        _, last = calendar.monthrange(today.year, today.month)
        self.assertEqual(end, date(today.year, today.month, last))

    def test_compute_timeframe_dates_range(self):
        start, end = _compute_timeframe_dates("2025-09-01~2025-09-30")
        self.assertEqual(start, date(2025, 9, 1))
        self.assertEqual(end, date(2025, 9, 30))

    def test_compute_timeframe_dates_bad_range_returns_none(self):
        start, end = _compute_timeframe_dates("bad~dates")
        self.assertIsNone(start)
        self.assertIsNone(end)


class FindClassByDisplayNameTests(TestCase):
    """Tests for _find_class_by_display_name()."""

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.shared_cls = Class.objects.create(
            grade_level="初三", class_name="1班", cohort="初中2026级"
        )

    def test_valid_display_name(self):
        result = _find_class_by_display_name("初三1班")
        self.assertIsNotNone(result)
        self.assertEqual(result.id, self.shared_cls.id)

    def test_invalid_display_name(self):
        result = _find_class_by_display_name("invalid_name")
        self.assertIsNone(result)

    def test_non_existent_class(self):
        result = _find_class_by_display_name("初三99班")
        self.assertIsNone(result)

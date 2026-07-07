from decimal import Decimal

from django.test import TestCase

from school_management.students_grades.ai_agent.service import ScoreAgentService
from school_management.students_grades.models.exam import Exam, ExamSubject
from school_management.students_grades.models.score import Score
from school_management.students_grades.models.student import Class, Student


class ScoreAgentAcceptanceTests(TestCase):
    """QA acceptance coverage for the MVP score Agent paths."""

    @classmethod
    def setUpTestData(cls):
        cls.cohort = "初中2024级"
        cls.service = ScoreAgentService()
        cls.classes = {
            f"{index}班": Class.objects.create(
                grade_level="初二",
                cohort=cls.cohort,
                class_name=f"{index}班",
            )
            for index in range(1, 14)
        }
        Class.objects.create(grade_level="初二", cohort="初中2025级", class_name="1班")
        Student.objects.create(
            student_id="QA999",
            name="候选学生",
            grade_level="初二",
            cohort="初中2025级",
            current_class=Class.objects.get(cohort="初中2025级", class_name="1班"),
        )

        cls.exams = []
        exam_specs = [
            ("第一次月考", "2025-09-20", ["语文", "数学", "英语"]),
            ("第二次月考", "2025-10-20", ["语文", "数学", "英语"]),
            ("上学期期中", "2025-11-20", ["语文", "数学", "英语"]),
            ("第三次月考", "2025-12-20", ["语文", "数学", "英语"]),
            ("上学期期末", "2026-01-20", ["语文", "数学", "英语"]),
        ]
        for name, date, subjects in exam_specs:
            cls.exams.append(cls._create_exam(name, date, subjects))
        cls.exam_month_1, cls.exam_month_2, cls.exam_mid, cls.exam_month_3, cls.exam_final = cls.exams
        cls.exam_mismatch = cls._create_exam("下学期期中", "2026-04-20", ["语文", "数学", "物理"])

        cls.students = []
        cls._create_student_with_scores("QA001", "张三", "1班", [80, 82, 86, 88, 90], [86, 88, 92, 94, 100], [78, 80, 82, 84, 80])
        cls._create_student_with_scores("QA002", "李四", "2班", [75, 78, 84, 88, 100], [80, 84, 88, 91, 90], [70, 74, 78, 80, 80])
        cls._create_student_with_scores("QA003", "王五", "3班", [90, 92, 95, 93, 95], [96, 98, 100, 96, 90], [88, 90, 95, 92, 80])
        cls._create_student_with_scores("QA004", "赵六", "4班", [70, 72, 74, 76, 80], [0, 60, 62, 64, 0], [66, 68, 70, 72, 70])
        cls._create_student_with_scores("QA005", "缺分学生", "5班", [60, 62, 64, 66, 70], [60, 62, 64, 66, None], [60, 62, 64, 66, 60])
        cls._create_student_with_scores("QA006", "末位学生", "6班", [50, 52, 54, 56, 60], [50, 52, 54, 56, 60], [50, 52, 54, 56, 60])
        cls._create_student_with_scores("QA016", "洪嘉禧", "1班", [82, 83, 84, 85, 86], [83, 84, 85, 86, 87], [84, 85, 86, 87, 88])

        for index in range(7, 14):
            score = 70 + index
            cls._create_student_with_scores(
                f"QA{index:03d}",
                f"南山{index}",
                f"{index}班",
                [score, score, score, score, score],
                [score, score, score, score, score],
                [score, score, score, score, score],
            )

        for student in cls.students:
            cls._score(cls.exam_mismatch, student, "语文", 80)
            cls._score(cls.exam_mismatch, student, "数学", 80)
            cls._score(cls.exam_mismatch, student, "物理", 80)

    @classmethod
    def _create_exam(cls, name, date, subjects):
        exam = Exam.objects.create(
            name=name,
            academic_year="2025-2026",
            date=date,
            grade_level=cls.cohort,
        )
        for subject in subjects:
            ExamSubject.objects.create(
                exam=exam,
                subject_code=subject,
                subject_name=subject,
                max_score=150,
            )
        return exam

    @classmethod
    def _create_student_with_scores(cls, student_id, name, class_name, chinese_scores, math_scores, english_scores):
        student = Student.objects.create(
            student_id=student_id,
            name=name,
            grade_level="初二",
            cohort=cls.cohort,
            current_class=cls.classes[class_name],
        )
        cls.students.append(student)
        for exam, chinese, math, english in zip(cls.exams, chinese_scores, math_scores, english_scores):
            cls._score(exam, student, "语文", chinese)
            cls._score(exam, student, "数学", math)
            cls._score(exam, student, "英语", english)
        return student

    @classmethod
    def _score(cls, exam, student, subject, value):
        if value is None:
            return None
        return Score.objects.create(
            exam=exam,
            student=student,
            subject=subject,
            score_value=Decimal(str(value)),
        )

    def ask(self, message, context=None, clarification_reply=None):
        return self.service.handle(
            message=message,
            context=context or {},
            clarification_reply=clarification_reply,
        )

    def test_business_group_ranking_uses_config_and_competition_rank(self):
        response = self.ask(
            "初二格致班期末前三",
            context={"cohort": self.cohort, "exam_ids": [self.exam_final.id]},
        )

        self.assertEqual(response["type"], "answer")
        table = response["tables"][0]
        self.assertEqual([column["key"] for column in table["columns"]], ["rank", "student_name", "student_id", "class_name", "score", "note"])
        self.assertEqual([row["rank"] for row in table["rows"]], [1, 1, 3])
        self.assertEqual({row["class_name"] for row in table["rows"]}, {"1班", "2班", "3班"})
        self.assertTrue(response["evidence"]["collapsed_by_default"])
        self.assertIn("初中2024级格致班", response["evidence"]["items"][1])
        self.assertFalse(response["fallback"]["available"])

    def test_weighted_analysis_requires_weight_and_outputs_required_columns(self):
        clarification = self.ask(
            "初二格致班期中期末加权前三",
            context={"cohort": self.cohort, "exam_ids": [self.exam_mid.id, self.exam_final.id]},
        )
        self.assertEqual(clarification["type"], "clarification")
        self.assertEqual(clarification["clarification_type"], "weight")

        response = self.ask(
            "初二格致班期中期末 6:4 加权前三",
            context={"cohort": self.cohort, "exam_ids": [self.exam_mid.id, self.exam_final.id]},
        )
        self.assertEqual(response["type"], "answer")
        keys = [column["key"] for column in response["tables"][0]["columns"]]
        self.assertEqual(
            keys,
            [
                "rank",
                "student_name",
                "class_name",
                "exam_a_score",
                "exam_a_weight",
                "exam_b_score",
                "exam_b_weight",
                "weighted_score",
                "note",
            ],
        )
        self.assertIn("权重", "\n".join(response["evidence"]["items"]))
        self.assertFalse(response["fallback"]["available"])

    def test_subject_mismatch_clarifies_and_does_not_downgrade(self):
        response = self.ask(
            "初二格致班期中期末 6:4 加权前三",
            context={"cohort": self.cohort, "exam_ids": [self.exam_final.id, self.exam_mismatch.id]},
        )

        self.assertEqual(response["type"], "clarification")
        self.assertEqual(response["clarification_type"], "subject_mismatch")
        self.assertEqual(response["details"]["common_subjects"], ["数学", "语文"])
        self.assertEqual(response["details"]["only_exam_a"], ["英语"])
        self.assertEqual(response["details"]["only_exam_b"], ["物理"])
        self.assertFalse(response["fallback"]["available"])

    def test_single_student_trend_and_rank_scope_clarification(self):
        response = self.ask("张三数学最近 5 次变化", context={"cohort": self.cohort})

        self.assertEqual(response["type"], "answer")
        rows = response["tables"][0]["rows"]
        self.assertEqual(len(rows), 5)
        self.assertEqual([row["score"] for row in rows], [86, 88, 92, 94, 100])
        self.assertEqual(rows[0]["score_change"], "-")
        self.assertEqual(rows[-1]["score_change"], 6)
        self.assertTrue(response["evidence"]["collapsed_by_default"])

        clarification = self.ask("张三历次考试排名变化", context={"cohort": self.cohort})
        self.assertEqual(clarification["type"], "clarification")
        self.assertEqual(clarification["status"], "need_rank_scope")
        self.assertEqual(clarification["clarification_type"], "rank_scope")
        self.assertFalse(clarification["fallback"]["available"])

    def test_class_group_trend_is_unsupported_and_does_not_enter_student_lookup(self):
        response = self.ask("初二10班在南山班中，最近5次考试总分均分排名变化如何？", context={"cohort": self.cohort})

        self.assertEqual(response["type"], "unsupported")
        self.assertEqual(response["status"], "unsupported_class_trend")
        self.assertIn("暂不支持班级在业务分组内的多次考试排名趋势分析", response["message"])
        self.assertEqual(response["fallback"]["reason"], "class_group_trend_not_supported")
        self.assertNotIn("学生", response["message"])

    def test_ambiguous_class_alias_is_not_treated_as_student_and_never_exposes_none(self):
        response = self.ask("810班在格致班里面排名变化如何？")

        self.assertEqual(response["type"], "clarification")
        self.assertEqual(response["status"], "need_class_normalization")
        self.assertEqual(response["clarification_type"], "class_normalization")
        serialized = str(response)
        self.assertNotIn("None", serialized)
        self.assertNotIn("null", serialized)
        self.assertNotIn("undefined", serialized)

    def test_student_rank_trend_resolves_student_before_rank_scope_clarification(self):
        response = self.ask("洪嘉禧最近5次考试排名的变化？")

        self.assertEqual(response["type"], "clarification")
        self.assertEqual(response["status"], "need_rank_scope")
        self.assertEqual(response["clarification_type"], "rank_scope")
        self.assertEqual(response["context"]["student_name"], "洪嘉禧")
        self.assertEqual(response["context"]["analysis_type"], "trend")
        self.assertEqual(response["context"]["time_range"], "recent_5")
        self.assertEqual(response["context"]["pending_question"], "rank_scope")
        self.assertEqual([option["value"] for option in response["options"]], ["class", "grade", "group"])
        self.assertNotIn("请先说明要查询的年级、班级或业务分组", response["message"])
        self.assertEqual(response["fallback"]["reason"], "rank_scope_required")

    def test_rank_scope_clarification_reply_continues_original_student_trend(self):
        clarification = self.ask("洪嘉禧最近5次考试排名的变化？")

        response = self.ask(
            "已选择：grade",
            context=clarification["context"],
            clarification_reply={
                "question_id": clarification["question_id"],
                "value": "grade",
                "label": "年级排名",
            },
        )

        self.assertEqual(response["type"], "answer")
        self.assertIn("洪嘉禧", response["summary"])
        rows = response["tables"][0]["rows"]
        self.assertEqual(len(rows), 5)
        self.assertTrue(all(row["rank"] != "-" for row in rows))
        self.assertNotIn("已选择", str(response))

    def test_class_rank_scope_clarification_reply_continues_original_student_trend(self):
        clarification = self.ask("洪嘉禧最近5次考试排名的变化？")

        response = self.ask(
            "已选择：class",
            context=clarification["context"],
            clarification_reply={
                "question_id": clarification["question_id"],
                "value": "class",
                "label": "班内排名",
            },
        )

        self.assertEqual(response["type"], "answer")
        self.assertIn("洪嘉禧", response["summary"])
        self.assertTrue(all(row["rank"] != "-" for row in response["tables"][0]["rows"]))

    def test_group_rank_scope_clarification_asks_group_when_missing(self):
        clarification = self.ask("洪嘉禧最近5次考试排名的变化？")

        response = self.ask(
            "已选择：group",
            context=clarification["context"],
            clarification_reply={
                "question_id": clarification["question_id"],
                "value": "group",
                "label": "分组内排名",
            },
        )

        self.assertEqual(response["type"], "clarification")
        self.assertEqual(response["status"], "need_group_scope")
        self.assertEqual(response["clarification_type"], "group_scope")
        self.assertEqual([option["value"] for option in response["options"]], ["格致", "南山", "创新"])

    def test_cancel_rank_scope_clarification_clears_pending_context(self):
        clarification = self.ask("洪嘉禧最近5次考试排名的变化？")

        response = self.ask(
            "已选择：取消",
            context=clarification["context"],
            clarification_reply={
                "question_id": clarification["question_id"],
                "value": "取消",
                "label": "取消当前追问",
            },
        )

        self.assertEqual(response["type"], "cancelled")
        self.assertEqual(response["context"], {})
        self.assertFalse(response["fallback"]["available"])

    def test_student_rank_trend_asks_identity_when_student_is_not_unique(self):
        response = self.ask("不存在学生最近5次考试排名的变化？")

        self.assertEqual(response["type"], "clarification")
        self.assertEqual(response["status"], "need_student_identity")
        self.assertEqual(response["clarification_type"], "student_identity")
        self.assertIn("请补充学号、班级或更完整姓名", response["message"])
        self.assertEqual(response["fallback"]["reason"], "student_not_unique")

    def test_student_grade_rank_trend_runs_without_scope_clarification(self):
        response = self.ask("张三年级排名变化如何？", context={"cohort": self.cohort})

        self.assertEqual(response["type"], "answer")
        rows = response["tables"][0]["rows"]
        self.assertEqual(len(rows), 5)
        self.assertTrue(all(row["rank"] != "-" for row in rows))

    def test_latest_single_exam_group_comparison_is_not_misclassified_as_trend(self):
        response = self.ask(
            "初二10班和初二南山班，最近一次考试总分均分对比如何？",
            context={"cohort": self.cohort, "exam_ids": [self.exam_final.id]},
        )

        self.assertEqual(response["type"], "answer")
        self.assertIn("跨群体对比结果", response["tables"][0]["title"])

    def test_group_comparison_class_against_business_group(self):
        response = self.ask(
            "初二10班数学在南山班排第几",
            context={"cohort": self.cohort, "exam_ids": [self.exam_final.id]},
        )

        self.assertEqual(response["type"], "answer")
        row = response["tables"][0]["rows"][0]
        self.assertEqual(row["object_name"], "10班")
        self.assertEqual(row["reference_name"], "初中2024级南山班")
        self.assertEqual(row["metric"], "数学均分")
        self.assertEqual(row["rank_in_reference"], 4)
        self.assertEqual(row["valid_count"], 1)
        self.assertFalse(response["fallback"]["available"])

    def test_cohort_ambiguity_and_cancel_flow(self):
        response = self.ask("初二格致班期末前三")
        self.assertEqual(response["type"], "clarification")
        self.assertEqual(response["clarification_type"], "cohort")
        self.assertIn("初中2024级", [option["value"] for option in response["options"]])
        self.assertIn("初中2025级", [option["value"] for option in response["options"]])

        cancelled = self.ask("取消", context=response["context"])
        self.assertEqual(cancelled["type"], "cancelled")
        self.assertFalse(cancelled["fallback"]["available"])


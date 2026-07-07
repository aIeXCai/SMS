"""V3 Tool Registry Unit Tests — 测试部执行"""

from django.test import TestCase

from school_management.students_grades.models.exam import Exam, ExamSubject
from school_management.students_grades.models.score import Score
from school_management.students_grades.models.student import Class, Student
from school_management.students_grades.ai_agent.tools.registry import (
    TOOL_REGISTRY,
    as_openai_schema,
    compute_comparison,
    get_student_rank,
    get_top_n,
    compute_trend,
    compute_weighted,
    execute,
    get_scores,
    search_exam,
    search_student,
)


class TestToolRegistry(TestCase):
    """T-R 系列：工具注册表"""

    def test_tr01_all_7_tools_registered(self):
        """T-R-01：7 个 tool 全部注册成功"""
        self.assertEqual(len(TOOL_REGISTRY), 8)
        expected_names = {
            "search_student", "search_exam", "get_scores",
            "get_student_rank", "get_top_n", "compute_trend", "compute_weighted", "compute_comparison",
        }
        self.assertEqual(set(TOOL_REGISTRY.keys()), expected_names)

    def test_tr02_openai_schema_format(self):
        """T-R-02：OpenAI schema 生成格式正确"""
        schemas = as_openai_schema()
        self.assertEqual(len(schemas), 8)
        for s in schemas:
            self.assertEqual(s["type"], "function")
            self.assertIn("name", s["function"])
            self.assertIn("description", s["function"])
            self.assertIn("parameters", s["function"])

    def test_tr03_search_student_schema(self):
        """T-R-03：search_student 参数 schema 正确"""
        schema = TOOL_REGISTRY["search_student"]["schema"]
        params = schema["parameters"]
        self.assertIn("keyword", params["properties"])
        self.assertIn("grade_level", params["properties"])
        self.assertIn("class_name", params["properties"])
        self.assertIn("keyword", params["required"])

    def test_tr04_execute_dispatch(self):
        """T-R-04：execute 分发正确"""
        result = execute("search_student", {"keyword": "张三"})
        self.assertIsInstance(result, dict)
        self.assertIn("found", result)

    def test_tr05_unknown_tool(self):
        """T-R-05：未知 tool 名报错"""
        result = execute("nonexistent", {})
        self.assertIn("error", result)
        self.assertIn("未知工具", result["error"])

    def test_tr06_missing_required_param(self):
        """T-R-06：必填参数缺失"""
        result = execute("search_student", {})
        self.assertIn("error", result)

    def test_tr08_empty_result_not_crash(self):
        """T-R-08：空结果不崩溃"""
        result = execute("search_student", {"keyword": "xyz123不存在"})
        self.assertEqual(result["found"], False)
        self.assertEqual(result["total_count"], 0)


class TestSearchStudentTool(TestCase):
    """T-SS 系列：search_student"""

    @classmethod
    def setUpTestData(cls):
        cls.cohort = "初中2024级"
        cls.c14 = Class.objects.create(grade_level="初二", cohort=cls.cohort, class_name="14班")
        cls.c1 = Class.objects.create(grade_level="初二", cohort=cls.cohort, class_name="1班")
        cls.s1 = Student.objects.create(
            student_id="001", name="黄晨田", grade_level="初二", cohort=cls.cohort,
            current_class=cls.c14, status="在读",
        )
        cls.s2 = Student.objects.create(
            student_id="002", name="黄子轩", grade_level="初二", cohort=cls.cohort,
            current_class=cls.c1, status="在读",
        )
        cls.s3 = Student.objects.create(
            student_id="003", name="刘畅", grade_level="初二", cohort=cls.cohort,
            current_class=cls.c14, status="在读",
        )

    def test_tss01_exact_match_one(self):
        """T-SS-01：精确命中 1 人"""
        result = search_student(keyword="黄晨田")
        self.assertTrue(result["found"])
        self.assertEqual(result["total_count"], 1)
        self.assertEqual(result["students"][0]["name"], "黄晨田")

    def test_tss02_multi_match(self):
        """T-SS-02：命中多人"""
        result = search_student(keyword="黄")
        self.assertTrue(result["found"])
        self.assertGreaterEqual(result["total_count"], 2)

    def test_tss03_no_match(self):
        """T-SS-03：无匹配"""
        result = search_student(keyword="不存在的名字XYZ")
        self.assertFalse(result["found"])
        self.assertEqual(result["total_count"], 0)

    def test_tss04_grade_filter(self):
        """T-SS-04：年级限定"""
        result = search_student(keyword="黄晨田", grade_level="初三")
        self.assertFalse(result["found"])

    def test_tss05_class_filter(self):
        """T-SS-05：班级限定"""
        result = search_student(keyword="黄晨田", class_name="14班")
        self.assertTrue(result["found"])
        self.assertEqual(result["students"][0]["class_name"], "14班")

    def test_tss06_empty_keyword(self):
        """T-SS-06：空字符串"""
        result = search_student(keyword="")
        self.assertIn("error", result)


class TestSearchExamTool(TestCase):
    """T-SE 系列：search_exam"""

    @classmethod
    def setUpTestData(cls):
        from datetime import date
        cls.e1 = Exam.objects.create(name="初二下学期期末模拟考", grade_level="初中2024级", date=date(2025, 6, 15))
        cls.e2 = Exam.objects.create(name="初二上学期期末模拟考", grade_level="初中2024级", date=date(2025, 1, 10))
        cls.e3 = Exam.objects.create(name="初二上期中考试", grade_level="初中2024级", date=date(2024, 11, 1))

    def test_tse01_exact(self):
        """T-SE-01：精确命中 1 场"""
        result = search_exam(keyword="初二下学期期末模拟考")
        self.assertTrue(result["found"])
        self.assertEqual(result["total_count"], 1)

    def test_tse02_fuzzy_multi(self):
        """T-SE-02：模糊匹配多场"""
        result = search_exam(keyword="期末")
        self.assertTrue(result["found"])
        self.assertGreaterEqual(result["total_count"], 2)

    def test_tse03_no_match(self):
        """T-SE-03：无匹配"""
        result = search_exam(keyword="不存在的考试")
        self.assertFalse(result["found"])

    def test_tse04_grade_filter(self):
        """T-SE-04：年级限定不匹配"""
        result = search_exam(keyword="期末", grade_level="初三")
        self.assertFalse(result["found"])

    def test_tse05_empty_keyword(self):
        """T-SE-05：空关键字"""
        result = search_exam(keyword="")
        self.assertIn("error", result)


class TestGetScoresTool(TestCase):
    """T-GS 系列：get_scores"""

    @classmethod
    def setUpTestData(cls):
        from datetime import date
        cls.cohort = "初中2024级"
        cls.c14 = Class.objects.create(grade_level="初二", cohort=cls.cohort, class_name="14班")
        cls.s1 = Student.objects.create(
            student_id="001", name="黄晨田", grade_level="初二", cohort=cls.cohort,
            current_class=cls.c14, status="在读",
        )
        cls.s2 = Student.objects.create(
            student_id="002", name="刘畅", grade_level="初二", cohort=cls.cohort,
            current_class=cls.c14, status="在读",
        )
        cls.exam = Exam.objects.create(name="期末考", grade_level=cls.cohort, date=date(2025, 6, 15))
        cls.e_subj = ExamSubject.objects.create(exam=cls.exam, subject_code="数学", subject_name="数学", max_score=120)
        cls.e_subj2 = ExamSubject.objects.create(exam=cls.exam, subject_code="语文", subject_name="语文", max_score=120)
        Score.objects.create(student=cls.s1, exam=cls.exam, subject="数学", score_value=92)
        Score.objects.create(student=cls.s1, exam=cls.exam, subject="语文", score_value=85)

    def test_tgs01_single_student_all(self):
        """T-GS-01：单学生全科"""
        result = get_scores(exam_id=self.exam.id, student_ids=[self.s1.id])
        self.assertEqual(result["exam_name"], "期末考")
        self.assertEqual(len(result["students"]), 1)

    def test_tgs02_specified_subject(self):
        """T-GS-02：指定科目"""
        result = get_scores(exam_id=self.exam.id, student_ids=[self.s1.id], subjects=["数学"])
        self.assertEqual(len(result["students"]), 1)

    def test_tgs03_no_scores(self):
        """T-GS-03：无成绩数据"""
        result = get_scores(exam_id=self.exam.id, student_ids=[self.s2.id])
        self.assertEqual(result["data_completeness"], "empty")

    def test_tgs04_invalid_exam_id(self):
        """T-GS-04：不存在的 exam_id"""
        result = get_scores(exam_id=99999, student_ids=[self.s1.id])
        self.assertIn("error", result)

    def test_tgs05_empty_student_ids(self):
        """T-GS-05：空 student_ids"""
        result = get_scores(exam_id=self.exam.id, student_ids=[])
        self.assertIn("error", result)


class TestComputeRankTool(TestCase):
    """T-CR 系列：get_student_rank"""

    @classmethod
    def setUpTestData(cls):
        from datetime import date
        cls.cohort = "初中2024级"
        cls.c14 = Class.objects.create(grade_level="初二", cohort=cls.cohort, class_name="14班")
        cls.c1 = Class.objects.create(grade_level="初二", cohort=cls.cohort, class_name="1班")
        cls.s_hct = Student.objects.create(
            student_id="001", name="黄晨田", grade_level="初二", cohort=cls.cohort,
            current_class=cls.c14, status="在读",
        )
        cls.s_liu = Student.objects.create(
            student_id="002", name="刘畅", grade_level="初二", cohort=cls.cohort,
            current_class=cls.c1, status="在读",
        )
        cls.exam = Exam.objects.create(name="期末考", grade_level=cls.cohort, date=date(2025, 6, 15))
        ExamSubject.objects.create(exam=cls.exam, subject_code="总分", subject_name="总分", max_score=760)
        ExamSubject.objects.create(exam=cls.exam, subject_code="数学", subject_name="数学", max_score=120)
        Score.objects.create(student=cls.s_hct, exam=cls.exam, subject="数学", score_value=92)
        Score.objects.create(student=cls.s_hct, exam=cls.exam, subject="语文", score_value=85)
        Score.objects.create(student=cls.s_liu, exam=cls.exam, subject="数学", score_value=88)
        Score.objects.create(student=cls.s_liu, exam=cls.exam, subject="语文", score_value=80)

    def test_tcr01_single_grade_rank(self):
        """T-CR-01：单人年级排名"""
        result = get_student_rank(exam_id=self.exam.id, student_name="黄晨田", scope_type="grade")
        self.assertIn("total_valid", result)

    def test_tcr02_single_subject_rank(self):
        """T-CR-02：单科排名"""
        result = get_student_rank(exam_id=self.exam.id, student_name="黄晨田", scope_type="grade", subject="数学")
        self.assertIn("rows", result)

    def test_tcr03_invalid_exam(self):
        """T-CR-03：不存在的 exam_id"""
        result = get_student_rank(exam_id=99999, student_name="黄晨田")
        self.assertIn("error", result)

    def test_tcr04_no_student(self):
        """T-CR-04：不存在的学生"""
        result = get_student_rank(exam_id=self.exam.id, student_name="不存在")
        self.assertIn("error", result)


class TestComputeTrendTool(TestCase):
    """T-CT 系列：compute_trend"""

    @classmethod
    def setUpTestData(cls):
        from datetime import date
        cls.cohort = "初中2024级"
        cls.c14 = Class.objects.create(grade_level="初二", cohort=cls.cohort, class_name="14班")
        cls.s_zs = Student.objects.create(
            student_id="003", name="张三", grade_level="初二", cohort=cls.cohort,
            current_class=cls.c14, status="在读",
        )
        cls.e1 = Exam.objects.create(name="期中", grade_level=cls.cohort, date=date(2024, 11, 1))
        cls.e2 = Exam.objects.create(name="期末", grade_level=cls.cohort, date=date(2025, 1, 10))
        for e in [cls.e1, cls.e2]:
            ExamSubject.objects.create(exam=e, subject_code="数学", subject_name="数学", max_score=120)
        Score.objects.create(student=cls.s_zs, exam=cls.e1, subject="数学", score_value=78)
        Score.objects.create(student=cls.s_zs, exam=cls.e2, subject="数学", score_value=82)

    def test_tct01_trend(self):
        """T-CT-01：趋势计算不报错"""
        result = compute_trend(student_name="张三", exam_ids=[self.e1.id, self.e2.id], subject="数学")
        self.assertIn("student_name", result)
        self.assertEqual(result["student_name"], "张三")

    def test_tct02_no_student(self):
        """T-CT-02：不存在的学生"""
        result = compute_trend(student_name="不存在", exam_ids=[self.e1.id])
        self.assertIn("error", result)

    def test_tct03_no_exam_ids(self):
        """T-CT-03：空 exam_ids"""
        result = compute_trend(student_name="张三", exam_ids=[])
        self.assertIn("error", result)

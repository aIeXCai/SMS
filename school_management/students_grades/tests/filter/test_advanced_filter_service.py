from django.test import TestCase

from school_management.students_grades.models import Class, Exam, Score, Student
from school_management.students_grades.services.advanced_filter import AdvancedFilterService


class AdvancedFilterServiceTest(TestCase):
    def setUp(self):
        self.class1 = Class.objects.create(grade_level="初二", cohort="初中2026级", class_name="1班")
        self.class2 = Class.objects.create(grade_level="初二", cohort="初中2026级", class_name="2班")

        self.s1 = Student.objects.create(student_id="S001", name="张三", grade_level="初二", cohort="初中2026级", current_class=self.class1)
        self.s2 = Student.objects.create(student_id="S002", name="李四", grade_level="初二", cohort="初中2026级", current_class=self.class1)
        self.s3 = Student.objects.create(student_id="S003", name="王五", grade_level="初二", cohort="初中2026级", current_class=self.class1)
        self.s4 = Student.objects.create(student_id="S004", name="赵六", grade_level="初二", cohort="初中2026级", current_class=self.class2)

        self.exam = Exam.objects.create(
            name="期中考试",
            academic_year="2025-2026",
            date="2026-04-01",
            grade_level="初中2026级",
        )

        # 为每个学生创建同一考试的数学成绩（带总分排名和数学排名）
        self._create_math_score(self.s1, 98, total_grade_rank=1, total_class_rank=1, math_grade_rank=2, math_class_rank=2)
        self._create_math_score(self.s2, 99, total_grade_rank=2, total_class_rank=2, math_grade_rank=1, math_class_rank=1)
        self._create_math_score(self.s3, 95, total_grade_rank=3, total_class_rank=3, math_grade_rank=3, math_class_rank=3)
        self._create_math_score(self.s4, 90, total_grade_rank=4, total_class_rank=1, math_grade_rank=4, math_class_rank=1)

    def _create_math_score(self, student, score, total_grade_rank, total_class_rank, math_grade_rank, math_class_rank):
        Score.objects.create(
            student=student,
            exam=self.exam,
            subject="数学",
            score_value=score,
            total_score_rank_in_grade=total_grade_rank,
            total_score_rank_in_class=total_class_rank,
            grade_rank_in_subject=math_grade_rank,
            class_rank_in_subject=math_class_rank,
        )

    def test_single_condition_top_n(self):
        result = AdvancedFilterService.apply_filter(
            exam_id=self.exam.id,
            logic="AND",
            conditions=[{"subject": "total", "dimension": "grade", "operator": "top_n", "value": 2}],
        )
        self.assertEqual(result, [self.s1.id, self.s2.id])

    def test_multiple_conditions_and(self):
        result = AdvancedFilterService.apply_filter(
            exam_id=self.exam.id,
            logic="AND",
            conditions=[
                {"subject": "total", "dimension": "grade", "operator": "top_n", "value": 2},
                {"subject": "math", "dimension": "grade", "operator": "top_n", "value": 1},
            ],
        )
        self.assertEqual(result, [self.s2.id])

    def test_multiple_conditions_or(self):
        result = AdvancedFilterService.apply_filter(
            exam_id=self.exam.id,
            logic="OR",
            conditions=[
                {"subject": "total", "dimension": "grade", "operator": "top_n", "value": 1},
                {"subject": "math", "dimension": "grade", "operator": "top_n", "value": 1},
            ],
        )
        self.assertEqual(result, [self.s1.id, self.s2.id])

    def test_range_condition(self):
        result = AdvancedFilterService.apply_filter(
            exam_id=self.exam.id,
            logic="AND",
            conditions=[{"subject": "total", "dimension": "grade", "operator": "range", "value": [2, 3]}],
        )
        self.assertEqual(result, [self.s2.id, self.s3.id])

    def test_bottom_n_condition(self):
        result = AdvancedFilterService.apply_filter(
            exam_id=self.exam.id,
            logic="AND",
            conditions=[{"subject": "total", "dimension": "grade", "operator": "bottom_n", "value": 2}],
        )
        self.assertEqual(result, [self.s3.id, self.s4.id])

    def test_class_filter(self):
        result = AdvancedFilterService.apply_filter(
            exam_id=self.exam.id,
            logic="AND",
            conditions=[{"subject": "total", "dimension": "grade", "operator": "top_n", "value": 4}],
            class_id=self.class1.id,
        )
        self.assertEqual(result, [self.s1.id, self.s2.id, self.s3.id])

    def test_validate_condition(self):
        self.assertTrue(
            AdvancedFilterService.validate_condition(
                {"subject": "math", "dimension": "grade", "operator": "top_n", "value": 10}
            )
        )
        self.assertFalse(
            AdvancedFilterService.validate_condition(
                {"subject": "invalid", "dimension": "grade", "operator": "top_n", "value": 10}
            )
        )

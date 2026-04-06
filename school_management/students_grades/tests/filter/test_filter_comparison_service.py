from django.contrib.auth import get_user_model
from django.test import TestCase

from school_management.students_grades.models import Class, Exam, FilterResultSnapshot, SavedFilterRule, Score, Student
from school_management.students_grades.services.filter_comparison import FilterComparisonService


User = get_user_model()


class FilterComparisonServiceTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="compare_user", password="secret")
        self.cls = Class.objects.create(grade_level="初二", cohort="初中2026级", class_name="1班")

        self.s1 = Student.objects.create(student_id="S001", name="张三", grade_level="初二", cohort="初中2026级", current_class=self.cls)
        self.s2 = Student.objects.create(student_id="S002", name="李四", grade_level="初二", cohort="初中2026级", current_class=self.cls)
        self.s3 = Student.objects.create(student_id="S003", name="王五", grade_level="初二", cohort="初中2026级", current_class=self.cls)
        self.s4 = Student.objects.create(student_id="S004", name="赵六", grade_level="初二", cohort="初中2026级", current_class=self.cls)

        self.baseline_exam = Exam.objects.create(
            name="期中考试",
            academic_year="2025-2026",
            date="2026-04-01",
            grade_level="初中2026级",
        )
        self.comparison_exam = Exam.objects.create(
            name="期末考试",
            academic_year="2025-2026",
            date="2026-06-20",
            grade_level="初中2026级",
        )

        self.rule = SavedFilterRule.objects.create(
            user=self.user,
            name="总分优生",
            rule_type="advanced",
            rule_config={"logic": "AND", "conditions": []},
        )

        self._create_rank_score(self.baseline_exam, self.s1, 3)
        self._create_rank_score(self.baseline_exam, self.s2, 5)
        self._create_rank_score(self.baseline_exam, self.s3, 8)
        self._create_rank_score(self.baseline_exam, self.s4, 12)

        self._create_rank_score(self.comparison_exam, self.s1, 10)
        self._create_rank_score(self.comparison_exam, self.s2, 2)
        self._create_rank_score(self.comparison_exam, self.s3, 9)
        self._create_rank_score(self.comparison_exam, self.s4, 4)

    def _create_rank_score(self, exam, student, total_rank):
        Score.objects.create(
            student=student,
            exam=exam,
            subject="数学",
            score_value=95,
            total_score_rank_in_grade=total_rank,
            total_score_rank_in_class=total_rank,
            grade_rank_in_subject=total_rank,
            class_rank_in_subject=total_rank,
        )

    def test_compare_snapshots_returns_added_removed_retained(self):
        baseline = FilterResultSnapshot.objects.create(
            user=self.user,
            exam=self.baseline_exam,
            rule=self.rule,
            rule_config_snapshot=self.rule.rule_config,
            result_snapshot={"student_ids": [self.s1.id, self.s2.id, self.s3.id], "count": 3},
            snapshot_name="期中-优生",
        )
        comparison = FilterResultSnapshot.objects.create(
            user=self.user,
            exam=self.comparison_exam,
            rule=self.rule,
            rule_config_snapshot=self.rule.rule_config,
            result_snapshot={"student_ids": [self.s2.id, self.s3.id, self.s4.id], "count": 3},
            snapshot_name="期末-优生",
        )

        result = FilterComparisonService.compare_snapshots(baseline.id, comparison.id)

        self.assertEqual(result["summary"]["added_count"], 1)
        self.assertEqual(result["summary"]["removed_count"], 1)
        self.assertEqual(result["summary"]["retained_count"], 2)
        self.assertEqual(result["summary"]["retention_rate"], "66.67%")

        self.assertEqual([item["student_id"] for item in result["changes"]["added"]], [self.s4.id])
        self.assertEqual([item["student_id"] for item in result["changes"]["removed"]], [self.s1.id])
        self.assertEqual([item["student_id"] for item in result["changes"]["retained"]], [self.s2.id, self.s3.id])

        added = result["changes"]["added"][0]
        self.assertEqual(added["old_rank"], 12)
        self.assertEqual(added["new_rank"], 4)
        self.assertEqual(added["rank_change"], 8)
        self.assertEqual(added["cohort"], "初中2026级")

    def test_calculate_rank_changes_handles_missing_rank(self):
        # 删除 s4 在 comparison_exam 的成绩，制造缺失排名场景
        Score.objects.filter(student=self.s4, exam=self.comparison_exam).delete()

        changes = FilterComparisonService._calculate_rank_changes(
            [self.s4.id],
            self.baseline_exam.id,
            self.comparison_exam.id,
        )

        self.assertIn(self.s4.id, changes)
        self.assertEqual(changes[self.s4.id]["old_rank"], 12)
        self.assertIsNone(changes[self.s4.id]["new_rank"])
        self.assertIsNone(changes[self.s4.id]["rank_change"])

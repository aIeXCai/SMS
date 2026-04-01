from django.contrib.auth import get_user_model
from django.test import TestCase

from school_management.students_grades.models import Exam, FilterResultSnapshot, SavedFilterRule


User = get_user_model()


class FilterModelsTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="filter_user", password="secret")
        self.exam = Exam.objects.create(
            name="期中考试",
            academic_year="2025-2026",
            date="2026-04-01",
            grade_level="初中2026级",
        )

    def test_saved_filter_rule_create_and_str(self):
        rule = SavedFilterRule.objects.create(
            user=self.user,
            name="数学培优班名单",
            rule_type="advanced",
            rule_config={
                "logic": "AND",
                "conditions": [
                    {"subject": "total", "dimension": "grade", "operator": "top_n", "value": 50}
                ],
            },
        )

        self.assertEqual(rule.usage_count, 0)
        self.assertEqual(str(rule), f"{self.user.username} - 数学培优班名单")

    def test_filter_result_snapshot_create_and_str(self):
        rule = SavedFilterRule.objects.create(
            user=self.user,
            name="总分前50",
            rule_type="advanced",
            rule_config={"logic": "AND", "conditions": []},
        )

        snapshot = FilterResultSnapshot.objects.create(
            user=self.user,
            exam=self.exam,
            rule=rule,
            rule_config_snapshot=rule.rule_config,
            result_snapshot={"student_ids": [1, 2, 3], "count": 3},
            snapshot_name="期中-总分前50",
        )

        self.assertEqual(snapshot.result_snapshot["count"], 3)
        self.assertIn("期中-总分前50", str(snapshot))

    def test_saved_filter_rule_indexes_defined(self):
        index_fields = [tuple(index.fields) for index in SavedFilterRule._meta.indexes]
        self.assertIn(("user", "-last_used_at"), index_fields)
        self.assertIn(("rule_type",), index_fields)

    def test_filter_result_snapshot_indexes_defined(self):
        index_fields = [tuple(index.fields) for index in FilterResultSnapshot._meta.indexes]
        self.assertIn(("user", "-created_at"), index_fields)
        self.assertIn(("exam", "-created_at"), index_fields)
        self.assertIn(("rule", "-created_at"), index_fields)

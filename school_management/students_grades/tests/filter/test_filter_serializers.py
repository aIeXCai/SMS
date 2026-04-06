from django.contrib.auth import get_user_model
from django.test import RequestFactory, TestCase

from school_management.students_grades.models import Exam, FilterResultSnapshot, SavedFilterRule
from school_management.students_grades.serializers import (
    FilterResultSnapshotSerializer,
    SavedFilterRuleSerializer,
)


User = get_user_model()


class FilterSerializersTest(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.user = User.objects.create_user(username="serializer_user", password="secret")
        self.other_user = User.objects.create_user(username="serializer_other", password="secret")

        self.exam = Exam.objects.create(
            name="期中考试",
            academic_year="2025-2026",
            date="2026-04-01",
            grade_level="初中2026级",
        )

        self.rule = SavedFilterRule.objects.create(
            user=self.user,
            name="总分前50",
            rule_type="advanced",
            rule_config={
                "logic": "AND",
                "conditions": [
                    {"subject": "total", "dimension": "grade", "operator": "top_n", "value": 50}
                ],
            },
        )
        self.other_rule = SavedFilterRule.objects.create(
            user=self.other_user,
            name="他人规则",
            rule_type="advanced",
            rule_config={
                "logic": "AND",
                "conditions": [
                    {"subject": "total", "dimension": "grade", "operator": "top_n", "value": 10}
                ],
            },
        )

    def _request_context(self, user):
        request = self.factory.post("/api/filter-snapshots/")
        request.user = user
        return {"request": request}

    def test_saved_filter_rule_serializer_validation(self):
        serializer = SavedFilterRuleSerializer(
            data={
                "name": "数学前30",
                "rule_type": "advanced",
                "rule_config": {
                    "logic": "and",
                    "conditions": [
                        {"subject": "math", "dimension": "grade", "operator": "top_n", "value": 30}
                    ],
                },
            }
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data["rule_config"]["logic"], "AND")

    def test_snapshot_serializer_maps_exam_id_and_rule_id(self):
        serializer = FilterResultSnapshotSerializer(
            data={
                "snapshot_name": "期中快照",
                "exam_id": self.exam.id,
                "rule_id": self.rule.id,
                "rule_config_snapshot": self.rule.rule_config,
                "result_snapshot": {"student_ids": [1, 2, 3], "count": 3},
            },
            context=self._request_context(self.user),
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data["exam"].id, self.exam.id)
        self.assertEqual(serializer.validated_data["rule"].id, self.rule.id)

    def test_snapshot_serializer_rejects_other_user_rule(self):
        serializer = FilterResultSnapshotSerializer(
            data={
                "snapshot_name": "非法规则快照",
                "exam_id": self.exam.id,
                "rule_id": self.other_rule.id,
                "rule_config_snapshot": self.other_rule.rule_config,
                "result_snapshot": {"student_ids": [1], "count": 1},
            },
            context=self._request_context(self.user),
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("rule_id", serializer.errors)

    def test_snapshot_serializer_validates_result_snapshot_count(self):
        serializer = FilterResultSnapshotSerializer(
            data={
                "snapshot_name": "计数不一致快照",
                "exam_id": self.exam.id,
                "rule_config_snapshot": self.rule.rule_config,
                "result_snapshot": {"student_ids": [1, 2], "count": 1},
            },
            context=self._request_context(self.user),
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("result_snapshot", serializer.errors)

    def test_snapshot_serializer_includes_exam_academic_year(self):
        snapshot = FilterResultSnapshot.objects.create(
            user=self.user,
            exam=self.exam,
            rule=self.rule,
            rule_config_snapshot=self.rule.rule_config,
            result_snapshot={"student_ids": [1], "count": 1},
            snapshot_name="学年字段校验快照",
        )

        serializer = FilterResultSnapshotSerializer(snapshot)
        self.assertEqual(serializer.data["exam_name"], "期中考试")
        self.assertEqual(serializer.data["exam_academic_year"], "2025-2026")

import json
import time
from datetime import date

from django.contrib.auth import get_user_model
from django.test import Client, TestCase

from school_management.students_grades.models import Class, Exam, FilterResultSnapshot, SavedFilterRule, Score, Student


User = get_user_model()


class FilterNonFunctionalTest(TestCase):
    def setUp(self):
        self.client = Client()

        self.staff_user = User.objects.create_user(
            username="nf_staff",
            password="test-pass-123",
            role="staff",
        )

        self.class_1 = Class.objects.create(grade_level="初二", cohort="初中2026级", class_name="1班")
        self.s1 = Student.objects.create(student_id="NF001", name="甲同学", grade_level="初二", cohort="初中2026级", current_class=self.class_1)
        self.s2 = Student.objects.create(student_id="NF002", name="乙同学", grade_level="初二", cohort="初中2026级", current_class=self.class_1)
        self.s3 = Student.objects.create(student_id="NF003", name="丙同学", grade_level="初二", cohort="初中2026级", current_class=self.class_1)

        self.exam1 = Exam.objects.create(name="期中考试", academic_year="2025-2026", grade_level="初中2026级", date=date(2026, 4, 1))
        self.exam2 = Exam.objects.create(name="期末考试", academic_year="2025-2026", grade_level="初中2026级", date=date(2026, 6, 20))

        self._create_score(self.exam1, self.s1, 1)
        self._create_score(self.exam1, self.s2, 2)
        self._create_score(self.exam1, self.s3, 3)
        self._create_score(self.exam2, self.s1, 3)
        self._create_score(self.exam2, self.s2, 1)
        self._create_score(self.exam2, self.s3, 2)

        self.rule = SavedFilterRule.objects.create(
            user=self.staff_user,
            name="总分前2",
            rule_type="advanced",
            rule_config={
                "logic": "AND",
                "conditions": [
                    {"subject": "total", "dimension": "grade", "operator": "top_n", "value": 2}
                ],
            },
        )

    def _create_score(self, exam, student, rank):
        Score.objects.create(
            student=student,
            exam=exam,
            subject="数学",
            score_value=100,
            total_score_rank_in_grade=rank,
            total_score_rank_in_class=rank,
            grade_rank_in_subject=rank,
            class_rank_in_subject=rank,
        )

    def test_end_to_end_workflow_from_filter_to_compare(self):
        """端到端流程：高级筛选 -> 保存两次快照 -> 对比。"""
        self.client.force_login(self.staff_user)

        filter_resp = self.client.post(
            "/api/students/advanced-filter/",
            data=json.dumps(
                {
                    "exam_id": self.exam1.id,
                    "logic": "AND",
                    "conditions": [
                        {"subject": "total", "dimension": "grade", "operator": "top_n", "value": 2}
                    ],
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(filter_resp.status_code, 200)
        body = filter_resp.json()
        self.assertEqual(body["count"], 2)
        student_ids = [item["student_id"] for item in body["students"]]

        baseline_create = self.client.post(
            "/api/filter-snapshots/",
            data=json.dumps(
                {
                    "snapshot_name": "E2E-基准",
                    "exam_id": self.exam1.id,
                    "rule_id": self.rule.id,
                    "rule_config_snapshot": self.rule.rule_config,
                    "result_snapshot": {"student_ids": student_ids, "count": len(student_ids)},
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(baseline_create.status_code, 201)
        baseline_id = baseline_create.json()["id"]

        comparison_create = self.client.post(
            "/api/filter-snapshots/",
            data=json.dumps(
                {
                    "snapshot_name": "E2E-对比",
                    "exam_id": self.exam2.id,
                    "rule_id": self.rule.id,
                    "rule_config_snapshot": self.rule.rule_config,
                    "result_snapshot": {"student_ids": [self.s2.id, self.s3.id], "count": 2},
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(comparison_create.status_code, 201)
        comparison_id = comparison_create.json()["id"]

        compare_resp = self.client.post(
            "/api/filter-snapshots/compare/",
            data=json.dumps(
                {
                    "baseline_snapshot_id": baseline_id,
                    "comparison_snapshot_id": comparison_id,
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(compare_resp.status_code, 200)
        compare_body = compare_resp.json()
        self.assertIn("summary", compare_body)
        self.assertIn("changes", compare_body)

    def test_advanced_filter_performance_under_two_seconds(self):
        """性能基线：高级筛选接口在测试数据下应小于2秒。"""
        perf_exam = Exam.objects.create(
            name="性能测试考试",
            academic_year="2025-2026",
            grade_level="初中2026级",
            date=date(2026, 7, 1),
        )

        students = []
        for idx in range(1, 401):
            students.append(
                Student(
                    student_id=f"PERF{idx:04d}",
                    name=f"性能学生{idx}",
                    grade_level="初二",
                    cohort="初中2026级",
                    current_class=self.class_1,
                )
            )
        Student.objects.bulk_create(students)
        created_students = list(Student.objects.filter(student_id__startswith="PERF").order_by("student_id"))

        scores = []
        for rank, student in enumerate(created_students, start=1):
            scores.append(
                Score(
                    student=student,
                    exam=perf_exam,
                    subject="数学",
                    score_value=100,
                    total_score_rank_in_grade=rank,
                    total_score_rank_in_class=rank,
                    grade_rank_in_subject=rank,
                    class_rank_in_subject=rank,
                )
            )
        Score.objects.bulk_create(scores)

        self.client.force_login(self.staff_user)
        payload = {
            "exam_id": perf_exam.id,
            "logic": "AND",
            "conditions": [
                {"subject": "total", "dimension": "grade", "operator": "top_n", "value": 120}
            ],
        }

        start = time.perf_counter()
        resp = self.client.post("/api/students/advanced-filter/", data=json.dumps(payload), content_type="application/json")
        elapsed = time.perf_counter() - start

        self.assertEqual(resp.status_code, 200)
        self.assertLess(elapsed, 2.0, f"advanced-filter 接口耗时 {elapsed:.3f}s，超过2秒阈值")
        self.assertEqual(resp.json()["count"], 120)

    def test_browser_compatibility_data_contract_stable(self):
        """兼容性基线：前端依赖字段在对比接口中稳定返回。"""
        baseline = FilterResultSnapshot.objects.create(
            user=self.staff_user,
            exam=self.exam1,
            rule=self.rule,
            rule_config_snapshot=self.rule.rule_config,
            result_snapshot={"student_ids": [self.s1.id, self.s2.id], "count": 2},
            snapshot_name="兼容性-基准",
        )
        comparison = FilterResultSnapshot.objects.create(
            user=self.staff_user,
            exam=self.exam2,
            rule=self.rule,
            rule_config_snapshot=self.rule.rule_config,
            result_snapshot={"student_ids": [self.s2.id, self.s3.id], "count": 2},
            snapshot_name="兼容性-对比",
        )

        self.client.force_login(self.staff_user)
        resp = self.client.post(
            "/api/filter-snapshots/compare/",
            data=json.dumps(
                {
                    "baseline_snapshot_id": baseline.id,
                    "comparison_snapshot_id": comparison.id,
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertIn("baseline", body)
        self.assertIn("comparison", body)
        self.assertIn("changes", body)
        self.assertIn("summary", body)

        # 前端跨浏览器展示依赖的核心字段
        self.assertIn("snapshot_name", body["baseline"])
        self.assertIn("exam_name", body["baseline"])
        self.assertIn("created_at", body["baseline"])

        retained = body["changes"].get("retained", [])
        if retained:
            sample = retained[0]
            self.assertIn("name", sample)
            self.assertIn("cohort", sample)
            self.assertIn("class_name", sample)
            self.assertIn("old_rank", sample)
            self.assertIn("new_rank", sample)
            self.assertIn("rank_change", sample)

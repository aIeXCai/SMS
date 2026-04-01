import json
from datetime import date

from django.contrib.auth import get_user_model
from django.test import Client, TestCase

from school_management.students_grades.models import (
    Class,
    Exam,
    FilterResultSnapshot,
    SavedFilterRule,
    Score,
    Student,
)


User = get_user_model()


class FilterApiViewsTest(TestCase):
    def setUp(self):
        self.client = Client()

        self.staff_user = User.objects.create_user(username='filter_staff', password='test-pass-123', role='staff')
        self.teacher_user = User.objects.create_user(username='filter_teacher', password='test-pass-123', role='subject_teacher')
        self.other_user = User.objects.create_user(username='filter_other', password='test-pass-123', role='staff')

        self.class_1 = Class.objects.create(grade_level='初二', cohort='初中2026级', class_name='1班')
        self.s1 = Student.objects.create(student_id='F001', name='甲同学', grade_level='初二', cohort='初中2026级', current_class=self.class_1)
        self.s2 = Student.objects.create(student_id='F002', name='乙同学', grade_level='初二', cohort='初中2026级', current_class=self.class_1)
        self.s3 = Student.objects.create(student_id='F003', name='丙同学', grade_level='初二', cohort='初中2026级', current_class=self.class_1)

        self.exam1 = Exam.objects.create(name='期中考试', academic_year='2025-2026', grade_level='初中2026级', date=date(2026, 4, 1))
        self.exam2 = Exam.objects.create(name='期末考试', academic_year='2025-2026', grade_level='初中2026级', date=date(2026, 6, 20))

        self._create_score(self.exam1, self.s1, 1)
        self._create_score(self.exam1, self.s2, 2)
        self._create_score(self.exam1, self.s3, 3)
        self._create_score(self.exam2, self.s1, 3)
        self._create_score(self.exam2, self.s2, 1)
        self._create_score(self.exam2, self.s3, 2)

        self.rule = SavedFilterRule.objects.create(
            user=self.staff_user,
            name='总分前2',
            rule_type='advanced',
            rule_config={
                'logic': 'AND',
                'conditions': [
                    {'subject': 'total', 'dimension': 'grade', 'operator': 'top_n', 'value': 2}
                ],
            },
        )

    def _create_score(self, exam, student, rank):
        Score.objects.create(
            student=student,
            exam=exam,
            subject='数学',
            score_value=100,
            total_score_rank_in_grade=rank,
            total_score_rank_in_class=rank,
            grade_rank_in_subject=rank,
            class_rank_in_subject=rank,
        )

    def test_advanced_filter_api(self):
        self.client.force_login(self.staff_user)

        response = self.client.post(
            '/api/students/advanced-filter/',
            data=json.dumps(
                {
                    'exam_id': self.exam1.id,
                    'logic': 'AND',
                    'conditions': [
                        {'subject': 'total', 'dimension': 'grade', 'operator': 'top_n', 'value': 2}
                    ],
                }
            ),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body['count'], 2)
        numbers = [item['student_number'] for item in body['students']]
        self.assertEqual(numbers, ['F001', 'F002'])

    def test_filter_rule_create_requires_write_permission(self):
        self.client.force_login(self.teacher_user)
        denied = self.client.post(
            '/api/filter-rules/',
            data=json.dumps(
                {
                    'name': '教师规则',
                    'rule_type': 'advanced',
                    'rule_config': {
                        'logic': 'AND',
                        'conditions': [
                            {'subject': 'total', 'dimension': 'grade', 'operator': 'top_n', 'value': 5}
                        ],
                    },
                }
            ),
            content_type='application/json',
        )
        self.assertEqual(denied.status_code, 403)

        self.client.force_login(self.staff_user)
        ok = self.client.post(
            '/api/filter-rules/',
            data=json.dumps(
                {
                    'name': '教辅规则',
                    'rule_type': 'advanced',
                    'rule_config': {
                        'logic': 'AND',
                        'conditions': [
                            {'subject': 'total', 'dimension': 'grade', 'operator': 'top_n', 'value': 5}
                        ],
                    },
                }
            ),
            content_type='application/json',
        )
        self.assertEqual(ok.status_code, 201)

    def test_filter_rule_list_only_returns_self(self):
        SavedFilterRule.objects.create(
            user=self.other_user,
            name='他人规则',
            rule_type='advanced',
            rule_config={
                'logic': 'AND',
                'conditions': [
                    {'subject': 'total', 'dimension': 'grade', 'operator': 'top_n', 'value': 3}
                ],
            },
        )

        self.client.force_login(self.staff_user)
        response = self.client.get('/api/filter-rules/')
        self.assertEqual(response.status_code, 200)

        names = {item['name'] for item in response.json()}
        self.assertIn('总分前2', names)
        self.assertNotIn('他人规则', names)

    def test_snapshot_delete_returns_custom_message(self):
        snapshot = FilterResultSnapshot.objects.create(
            user=self.staff_user,
            exam=self.exam1,
            rule=self.rule,
            rule_config_snapshot=self.rule.rule_config,
            result_snapshot={'student_ids': [self.s1.id, self.s2.id], 'count': 2},
            snapshot_name='期中快照',
        )

        self.client.force_login(self.staff_user)
        response = self.client.delete(f'/api/filter-snapshots/{snapshot.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['message'], '快照删除成功')

    def test_compare_snapshots_api(self):
        baseline = FilterResultSnapshot.objects.create(
            user=self.staff_user,
            exam=self.exam1,
            rule=self.rule,
            rule_config_snapshot=self.rule.rule_config,
            result_snapshot={'student_ids': [self.s1.id, self.s2.id], 'count': 2},
            snapshot_name='期中快照',
        )
        comparison = FilterResultSnapshot.objects.create(
            user=self.staff_user,
            exam=self.exam2,
            rule=self.rule,
            rule_config_snapshot=self.rule.rule_config,
            result_snapshot={'student_ids': [self.s2.id, self.s3.id], 'count': 2},
            snapshot_name='期末快照',
        )

        self.client.force_login(self.staff_user)
        response = self.client.post(
            '/api/filter-snapshots/compare/',
            data=json.dumps(
                {
                    'baseline_snapshot_id': baseline.id,
                    'comparison_snapshot_id': comparison.id,
                }
            ),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body['summary']['added_count'], 1)
        self.assertEqual(body['summary']['removed_count'], 1)
        self.assertEqual(body['summary']['retained_count'], 1)

    def test_write_endpoints_forbidden_for_subject_teacher(self):
        self.client.force_login(self.teacher_user)

        advanced_resp = self.client.post(
            '/api/students/advanced-filter/',
            data=json.dumps(
                {
                    'exam_id': self.exam1.id,
                    'logic': 'AND',
                    'conditions': [
                        {'subject': 'total', 'dimension': 'grade', 'operator': 'top_n', 'value': 2}
                    ],
                }
            ),
            content_type='application/json',
        )
        self.assertEqual(advanced_resp.status_code, 403)

        create_snapshot_resp = self.client.post(
            '/api/filter-snapshots/',
            data=json.dumps(
                {
                    'snapshot_name': '教师快照',
                    'exam_id': self.exam1.id,
                    'rule_id': self.rule.id,
                    'rule_config_snapshot': self.rule.rule_config,
                    'result_snapshot': {'student_ids': [self.s1.id], 'count': 1},
                }
            ),
            content_type='application/json',
        )
        self.assertEqual(create_snapshot_resp.status_code, 403)

        compare_resp = self.client.post(
            '/api/filter-snapshots/compare/',
            data=json.dumps({'baseline_snapshot_id': 1, 'comparison_snapshot_id': 2}),
            content_type='application/json',
        )
        self.assertEqual(compare_resp.status_code, 403)

    def test_object_level_scope_blocks_other_user_rule_and_snapshot(self):
        other_rule = SavedFilterRule.objects.create(
            user=self.other_user,
            name='他人规则',
            rule_type='advanced',
            rule_config={
                'logic': 'AND',
                'conditions': [
                    {'subject': 'total', 'dimension': 'grade', 'operator': 'top_n', 'value': 3}
                ],
            },
        )
        other_snapshot = FilterResultSnapshot.objects.create(
            user=self.other_user,
            exam=self.exam1,
            rule=other_rule,
            rule_config_snapshot=other_rule.rule_config,
            result_snapshot={'student_ids': [self.s1.id], 'count': 1},
            snapshot_name='他人快照',
        )

        self.client.force_login(self.staff_user)

        rule_detail_resp = self.client.get(f'/api/filter-rules/{other_rule.id}/')
        self.assertEqual(rule_detail_resp.status_code, 404)

        rule_delete_resp = self.client.delete(f'/api/filter-rules/{other_rule.id}/')
        self.assertEqual(rule_delete_resp.status_code, 404)

        snapshot_delete_resp = self.client.delete(f'/api/filter-snapshots/{other_snapshot.id}/')
        self.assertEqual(snapshot_delete_resp.status_code, 404)

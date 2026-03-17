"""Core route-contract tests for score module after frontend/API migration."""
import json
from datetime import date

from django.test import TestCase, Client
from django.contrib.auth import get_user_model

from school_management.students_grades.models import Student, Exam, Score, ExamSubject, Class


class ScoreApiSmokeTests(TestCase):
    """Smoke tests for new API endpoints used by migrated frontend pages."""

    def setUp(self):
        self.client = Client()
        User = get_user_model()
        self.user = User.objects.create_user(
            username='score_api_smoke',
            password='test-pass-123',
            role='admin'
        )
        self.client.force_login(self.user)

        self.class1 = Class.objects.create(grade_level='Grade8', class_name='1班')
        self.stu1 = Student.objects.create(student_id='S001', name='张三', grade_level='Grade8', current_class=self.class1)
        self.exam = Exam.objects.create(name='期中考试', academic_year='2024-2025', grade_level='Grade8', date=date(2025, 6, 1))
        ExamSubject.objects.create(exam=self.exam, subject_code='语文', subject_name='语文', max_score=150)
        Score.objects.create(student=self.stu1, exam=self.exam, subject='语文', score_value=90)

    def test_student_search_api_returns_results(self):
        resp = self.client.get('/api/scores/student-search/', {'q': '张三'})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn('results', data)
        self.assertTrue(any(item['student_id'] == 'S001' for item in data['results']))

    def test_scores_list_api_returns_pagination_shape(self):
        resp = self.client.get('/api/scores/')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn('count', data)
        self.assertIn('results', data)


class ScoreWritePermissionMatrixTests(TestCase):
    """Permission matrix checks for score write endpoints."""

    def setUp(self):
        self.client = Client()
        self.User = get_user_model()
        self.cls = Class.objects.create(grade_level='初一', class_name='3班')
        self.exam = Exam.objects.create(
            name='权限成绩考试',
            academic_year='2025-2026',
            grade_level='初一',
            date=date(2026, 1, 20),
        )
        ExamSubject.objects.create(exam=self.exam, subject_code='语文', subject_name='语文', max_score=120)
        self.url = '/api/scores/manual-add/'

    def _login_as(self, role):
        self.client.logout()
        user = self.User.objects.create_user(
            username=f'score_perm_{role}',
            password='test-pass-123',
            role=role,
        )
        self.client.force_login(user)

    def _payload(self, suffix):
        student = Student.objects.create(
            student_id=f'PERM-S-{suffix}',
            name=f'成绩权限-{suffix}',
            grade_level='初一',
            current_class=self.cls,
            status='在读',
        )
        return {
            'student_id': student.pk,
            'exam_id': self.exam.pk,
            'scores': {
                '语文': 98,
            },
        }

    def test_score_write_matrix(self):
        role_expected = {
            'admin': 200,
            'grade_manager': 200,
            'staff': 200,
            'subject_teacher': 403,
        }

        for role, expected_status in role_expected.items():
            with self.subTest(role=role):
                self._login_as(role)
                resp = self.client.post(
                    self.url,
                    data=json.dumps(self._payload(role)),
                    content_type='application/json',
                )
                self.assertEqual(resp.status_code, expected_status)

    def test_score_write_requires_authentication(self):
        self.client.logout()
        resp = self.client.post(
            self.url,
            data=json.dumps(self._payload('anonymous')),
            content_type='application/json',
        )
        self.assertIn(resp.status_code, (401, 403))

"""Core route-contract tests for score module after frontend/API migration."""
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

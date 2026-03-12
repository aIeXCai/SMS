"""Core route-contract tests for score module after frontend/API migration."""
from datetime import date

from django.test import TestCase, Client
from django.urls import reverse
from django.contrib.auth import get_user_model

from school_management.students_grades.models import Student, Exam, Score, ExamSubject, Class


class ScoreRouteRedirectTests(TestCase):
    """Legacy score pages should redirect to frontend pages."""

    def setUp(self):
        self.client = Client()
        self.class1 = Class.objects.create(grade_level='Grade8', class_name='1班')
        self.stu1 = Student.objects.create(student_id='S001', name='张三', grade_level='Grade8', current_class=self.class1)
        self.exam = Exam.objects.create(name='期中考试', academic_year='2024-2025', grade_level='Grade8', date=date(2025, 6, 1))
        self.score = Score.objects.create(student=self.stu1, exam=self.exam, subject='语文', score_value=90)

    def test_score_list_redirects_to_frontend(self):
        resp = self.client.get(reverse('students_grades:score_list'))
        self.assertIn(resp.status_code, (301, 302))
        self.assertIn('/scores', resp['Location'])

    def test_score_add_redirects_to_frontend(self):
        resp = self.client.get(reverse('students_grades:score_add'))
        self.assertIn(resp.status_code, (301, 302))
        self.assertIn('/scores/add', resp['Location'])

    def test_score_edit_redirects_to_frontend(self):
        resp = self.client.get(reverse('students_grades:score_edit', args=[self.score.pk]))
        self.assertIn(resp.status_code, (301, 302))
        self.assertIn('/scores', resp['Location'])

    def test_score_batch_edit_redirects_to_frontend(self):
        resp = self.client.get(reverse('students_grades:score_batch_edit'))
        self.assertIn(resp.status_code, (301, 302))
        self.assertIn('/scores/batch-edit', resp['Location'])

    def test_score_query_redirects_to_frontend(self):
        resp = self.client.get(reverse('students_grades:score_query'))
        self.assertIn(resp.status_code, (301, 302))
        self.assertIn('/scores/query', resp['Location'])


class ScoreRouteApiProxyTests(TestCase):
    """Legacy batch/query ops should proxy to /api/scores/* via 307."""

    def setUp(self):
        self.client = Client()

    def test_batch_export_proxy(self):
        resp = self.client.get(reverse('students_grades:score_batch_export'))
        self.assertEqual(resp.status_code, 307)
        self.assertEqual(resp['Location'], '/api/scores/batch-export/')

    def test_batch_delete_filtered_proxy(self):
        resp = self.client.post(reverse('students_grades:score_batch_delete_filtered'))
        self.assertEqual(resp.status_code, 307)
        self.assertEqual(resp['Location'], '/api/scores/batch-delete-filtered/')

    def test_batch_export_selected_proxy(self):
        resp = self.client.post(reverse('students_grades:score_batch_export_selected'))
        self.assertEqual(resp.status_code, 307)
        self.assertEqual(resp['Location'], '/api/scores/batch-export-selected/')

    def test_batch_delete_selected_proxy(self):
        resp = self.client.post(reverse('students_grades:score_batch_delete_selected'))
        self.assertEqual(resp.status_code, 307)
        self.assertEqual(resp['Location'], '/api/scores/batch-delete-selected/')

    def test_download_template_proxy(self):
        resp = self.client.get(reverse('students_grades:download_score_import_template'))
        self.assertEqual(resp.status_code, 307)
        self.assertEqual(resp['Location'], '/api/scores/download-template/')

    def test_query_export_proxy(self):
        resp = self.client.get(reverse('students_grades:score_query_export'))
        self.assertEqual(resp.status_code, 307)
        self.assertEqual(resp['Location'], '/api/scores/query-export/')


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

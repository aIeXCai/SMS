"""Exam route-contract tests after frontend/API migration."""

import json

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.urls import reverse
from school_management.students_grades.models import Exam, ExamSubject


class ExamRouteRedirectTests(TestCase):
    """Legacy exam pages should redirect to frontend and old ajax endpoint proxies to API."""

    def setUp(self):
        self.client = Client()
        self.exam = Exam.objects.create(
            name='路由重定向考试',
            academic_year='2025-2026',
            grade_level='初一',
            date='2025-09-01',
        )

    def test_exam_list_redirects_to_frontend(self):
        resp = self.client.get(reverse('students_grades:exam_list'))
        self.assertIn(resp.status_code, (301, 302))
        self.assertIn('/exams', resp['Location'])

    def test_exam_create_step1_redirects_to_frontend(self):
        resp = self.client.get(reverse('students_grades:exam_create_step1'))
        self.assertIn(resp.status_code, (301, 302))
        self.assertIn('/exams/create', resp['Location'])

    def test_exam_create_step2_redirects_to_frontend(self):
        resp = self.client.get(reverse('students_grades:exam_create_step2'))
        self.assertIn(resp.status_code, (301, 302))
        self.assertIn('/exams/create', resp['Location'])

    def test_exam_edit_step1_redirects_to_frontend(self):
        resp = self.client.get(reverse('students_grades:exam_edit_step1', args=[self.exam.pk]))
        self.assertIn(resp.status_code, (301, 302))
        self.assertIn(f'/exams/{self.exam.pk}/edit', resp['Location'])

    def test_exam_edit_step2_redirects_to_frontend(self):
        resp = self.client.get(reverse('students_grades:exam_edit_step2', args=[self.exam.pk]))
        self.assertIn(resp.status_code, (301, 302))
        self.assertIn(f'/exams/{self.exam.pk}/edit', resp['Location'])

    def test_exam_delete_redirects_to_frontend(self):
        resp = self.client.post(reverse('students_grades:exam_delete', args=[self.exam.pk]))
        self.assertIn(resp.status_code, (301, 302))
        self.assertIn('/exams', resp['Location'])

    def test_get_default_subjects_proxies_to_api(self):
        resp = self.client.get(reverse('students_grades:get_default_subjects_ajax'), {'grade_level': '初一'})
        self.assertEqual(resp.status_code, 307)
        self.assertIn('/api/exams/default-subjects/', resp['Location'])


class ExamApiContractSmokeTests(TestCase):
    """Smoke tests for /api/exams/* endpoints used by migrated frontend."""

    def setUp(self):
        self.client = Client()
        User = get_user_model()
        self.user = User.objects.create_user(
            username='exam_api_admin',
            password='test-pass-123',
            role='admin',
        )
        self.client.force_login(self.user)

        self.exam = Exam.objects.create(
            name='期中考试',
            academic_year='2025-2026',
            grade_level='初一',
            date='2025-09-01',
            description='初始考试',
        )
        ExamSubject.objects.create(exam=self.exam, subject_code='语文', subject_name='语文', max_score=120)
        ExamSubject.objects.create(exam=self.exam, subject_code='数学', subject_name='数学', max_score=120)

    def test_exams_list_api_returns_collection_shape(self):
        resp = self.client.get('/api/exams/')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()

        if isinstance(data, list):
            self.assertTrue(any(item['name'] == '期中考试' for item in data))
        else:
            self.assertIn('results', data)
            self.assertTrue(any(item['name'] == '期中考试' for item in data['results']))

    def test_exam_options_api(self):
        resp = self.client.get('/api/exams/options/')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn('academic_years', data)
        self.assertIn('grade_levels', data)
        self.assertTrue(len(data['academic_years']) > 0)
        self.assertTrue(len(data['grade_levels']) > 0)

    def test_exam_default_subjects_api(self):
        resp = self.client.get('/api/exams/default-subjects/', {'grade_level': '初一'})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn('subjects', data)
        self.assertIn('all_subjects', data)
        self.assertTrue(any(item['subject_code'] == '语文' for item in data['subjects']))

    def test_create_exam_api_with_subjects(self):
        payload = {
            'name': '期末考试',
            'academic_year': '2025-2026',
            'grade_level': '初二',
            'date': '2026-01-20',
            'description': '新建考试',
            'subjects': [
                {'subject_code': '语文', 'max_score': 120},
                {'subject_code': '数学', 'max_score': 120},
            ],
        }
        resp = self.client.post('/api/exams/', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(resp.status_code, 201)

        created = Exam.objects.get(name='期末考试')
        self.assertEqual(created.grade_level, '初二')
        self.assertEqual(created.exam_subjects.count(), 2)

    def test_patch_exam_api_updates_and_removes_subjects(self):
        payload = {
            'name': '期中考试（已更新）',
            'description': '更新描述',
            'subjects': [
                {'subject_code': '语文', 'max_score': 130},
            ],
        }
        resp = self.client.patch(
            f'/api/exams/{self.exam.pk}/',
            data=json.dumps(payload),
            content_type='application/json',
        )
        self.assertEqual(resp.status_code, 200)

        self.exam.refresh_from_db()
        self.assertEqual(self.exam.name, '期中考试（已更新）')
        self.assertEqual(self.exam.description, '更新描述')

        subject_codes = set(self.exam.exam_subjects.values_list('subject_code', flat=True))
        self.assertEqual(subject_codes, {'语文'})
        self.assertEqual(self.exam.exam_subjects.get(subject_code='语文').max_score, 130)

    def test_delete_exam_api(self):
        resp = self.client.delete(f'/api/exams/{self.exam.pk}/')
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(Exam.objects.filter(pk=self.exam.pk).exists())

"""Student route-contract tests after frontend/API migration."""

import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.urls import reverse
from django.utils import timezone

from school_management.students_grades.models import Class, Exam, ExamSubject, Score, Student


class StudentRouteRedirectTests(TestCase):
    """Legacy student pages should redirect to frontend, and template download proxies to API."""

    def setUp(self):
        self.client = Client()
        self.cls = Class.objects.create(grade_level='初一', class_name='1班')
        self.student = Student.objects.create(
            student_id='RED001',
            name='重定向测试',
            grade_level='初一',
            current_class=self.cls,
            status='在读',
        )

    def test_student_list_redirects_to_frontend(self):
        resp = self.client.get(reverse('students_grades:student_list'))
        self.assertIn(resp.status_code, (301, 302))
        self.assertIn('/students', resp['Location'])

    def test_student_add_redirects_to_frontend(self):
        resp = self.client.get(reverse('students_grades:student_add'))
        self.assertIn(resp.status_code, (301, 302))
        self.assertIn('/students/add', resp['Location'])

    def test_student_edit_redirects_to_frontend(self):
        resp = self.client.get(reverse('students_grades:student_edit', args=[self.student.pk]))
        self.assertIn(resp.status_code, (301, 302))
        self.assertIn(f'/students/{self.student.pk}/edit', resp['Location'])

    def test_student_batch_import_page_redirects_to_frontend(self):
        resp = self.client.get(reverse('students_grades:student_batch_import'))
        self.assertIn(resp.status_code, (301, 302))
        self.assertIn('/students', resp['Location'])

    def test_student_batch_promote_page_redirects_to_frontend(self):
        resp = self.client.get(reverse('students_grades:student_batch_promote_grade'))
        self.assertIn(resp.status_code, (301, 302))
        self.assertIn('/students/batch-promote', resp['Location'])

    def test_download_student_template_proxies_to_api(self):
        resp = self.client.get(reverse('students_grades:download_student_import_template'))
        self.assertEqual(resp.status_code, 307)
        self.assertEqual(resp['Location'], '/api/students/download-template/')

    def test_student_delete_redirects_to_frontend(self):
        resp = self.client.post(reverse('students_grades:student_delete', args=[self.student.pk]))
        self.assertIn(resp.status_code, (301, 302))
        self.assertIn('/students', resp['Location'])

    def test_student_update_status_redirects_to_frontend(self):
        resp = self.client.post(reverse('students_grades:student_update_status', args=[self.student.pk]), {'status': '毕业'})
        self.assertIn(resp.status_code, (301, 302))
        self.assertIn('/students', resp['Location'])

    def test_student_batch_delete_redirects_to_frontend(self):
        resp = self.client.post(reverse('students_grades:student_batch_delete'), {'selected_students': [self.student.pk]})
        self.assertIn(resp.status_code, (301, 302))
        self.assertIn('/students', resp['Location'])

    def test_student_batch_update_status_redirects_to_frontend(self):
        resp = self.client.post(reverse('students_grades:student_batch_update_status'), {'selected_students': [self.student.pk], 'status': '在读'})
        self.assertIn(resp.status_code, (301, 302))
        self.assertIn('/students', resp['Location'])

    def test_student_batch_graduate_redirects_to_frontend(self):
        resp = self.client.post(reverse('students_grades:student_batch_graduate'), {'selected_students': [self.student.pk]})
        self.assertIn(resp.status_code, (301, 302))
        self.assertIn('/students', resp['Location'])


class StudentApiContractSmokeTests(TestCase):
    """Smoke tests for /api/students/* endpoints used by migrated frontend."""

    def setUp(self):
        self.client = Client()
        User = get_user_model()
        self.user = User.objects.create_user(
            username='student_api_admin',
            password='test-pass-123',
            role='admin',
        )
        self.client.force_login(self.user)

        self.cls = Class.objects.create(grade_level='初一', class_name='1班')
        self.stu1 = Student.objects.create(
            student_id='API001',
            name='张三',
            grade_level='初一',
            current_class=self.cls,
            status='在读',
        )
        self.stu2 = Student.objects.create(
            student_id='API002',
            name='李四',
            grade_level='初一',
            current_class=self.cls,
            status='在读',
        )

    def test_students_list_api_returns_collection_shape(self):
        resp = self.client.get('/api/students/')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()

        if isinstance(data, list):
            self.assertTrue(any(item['student_id'] == 'API001' for item in data))
        else:
            self.assertIn('results', data)
            self.assertTrue(any(item['student_id'] == 'API001' for item in data['results']))

    def test_create_student_api_with_nested_current_class(self):
        payload = {
            'student_id': 'API003',
            'name': '王五',
            'gender': '男',
            'status': '在读',
            'current_class': {
                'grade_level': '初二',
                'class_name': '3班',
            },
        }

        resp = self.client.post(
            '/api/students/',
            data=json.dumps(payload),
            content_type='application/json',
        )

        self.assertEqual(resp.status_code, 201)
        created = Student.objects.get(student_id='API003')
        self.assertEqual(created.current_class.grade_level, '初二')
        self.assertEqual(created.current_class.class_name, '3班')

    def test_batch_delete_api_deletes_students(self):
        payload = {'student_ids': [self.stu1.pk, self.stu2.pk]}
        resp = self.client.post(
            '/api/students/batch-delete/',
            data=json.dumps(payload),
            content_type='application/json',
        )

        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data.get('success'))
        self.assertFalse(Student.objects.filter(pk=self.stu1.pk).exists())
        self.assertFalse(Student.objects.filter(pk=self.stu2.pk).exists())

    def test_batch_update_status_api_sets_graduation_date(self):
        payload = {'student_ids': [self.stu1.pk], 'status': '毕业'}
        resp = self.client.post(
            '/api/students/batch-update-status/',
            data=json.dumps(payload),
            content_type='application/json',
        )

        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data.get('success'))

        self.stu1.refresh_from_db()
        self.assertEqual(self.stu1.status, '毕业')
        self.assertIsNotNone(self.stu1.graduation_date)

    def test_batch_promote_api_updates_grade_and_class(self):
        payload = {
            'student_ids': [self.stu1.pk, self.stu2.pk],
            'current_grade_level': '初一',
            'target_grade_level': '初二',
            'auto_create_classes': True,
        }
        resp = self.client.post(
            '/api/students/batch-promote/',
            data=json.dumps(payload),
            content_type='application/json',
        )

        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data.get('success'))
        self.assertEqual(data.get('updated_count'), 2)

        self.stu1.refresh_from_db()
        self.assertEqual(self.stu1.grade_level, '初二')

    def test_delete_student_api_triggers_async_ranking_update(self):
        exam = Exam.objects.create(
            name='期中',
            academic_year='2025-2026',
            date=timezone.now().date(),
            grade_level='初一',
        )
        exam_subject = ExamSubject.objects.create(
            exam=exam,
            subject_code='语文',
            subject_name='语文',
            max_score=120,
        )
        student = Student.objects.create(
            student_id='APIDEL1',
            name='删除触发任务',
            grade_level='初一',
            current_class=self.cls,
            status='在读',
        )
        Score.objects.create(student=student, exam=exam, exam_subject=exam_subject, subject='语文', score_value=95)

        with patch('school_management.students_grades.tasks.update_all_rankings_async.delay') as mocked_delay:
            resp = self.client.delete(f'/api/students/{student.pk}/')
            self.assertEqual(resp.status_code, 204)
            mocked_delay.assert_called()
 
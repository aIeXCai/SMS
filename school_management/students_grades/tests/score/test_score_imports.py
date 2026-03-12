"""Integration tests for /api/scores/batch-import after migration."""
from io import BytesIO
from datetime import date

import openpyxl

from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile

from school_management.students_grades.models import Student, Exam, Score, ExamSubject


def make_excel_bytes(headers, rows):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(headers)
    for row in rows:
        ws.append(list(row))
    bio = BytesIO()
    wb.save(bio)
    bio.seek(0)
    return SimpleUploadedFile(
        'scores.xlsx',
        bio.read(),
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )


class ScoreImportApiTests(TestCase):
    """Verify import API route behavior and database effects."""

    def setUp(self):
        self.client = Client()
        User = get_user_model()
        self.user = User.objects.create_user(
            username='score_import_admin',
            password='test-pass-123',
            role='admin'
        )
        self.client.force_login(self.user)

        self.exam = Exam.objects.create(name='期中考试', academic_year='2024-2025', grade_level='Grade8', date=date(2025, 6, 1))
        ExamSubject.objects.create(exam=self.exam, subject_code='语文', subject_name='语文', max_score=150)
        ExamSubject.objects.create(exam=self.exam, subject_code='数学', subject_name='数学', max_score=150)

        self.stu1 = Student.objects.create(student_id='S001', name='张三')
        self.stu2 = Student.objects.create(student_id='S002', name='李四')

        self.url = '/api/scores/batch-import/'

    def test_import_success_creates_scores(self):
        headers = ['学号', '学生姓名', '语文', '数学']
        rows = [
            ('S001', '张三', 120, 130),
            ('S002', '李四', 110, 115),
        ]
        file_obj = make_excel_bytes(headers, rows)

        resp = self.client.post(self.url, {'exam': self.exam.pk, 'excel_file': file_obj}, format='multipart')
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertTrue(body.get('success'))
        self.assertGreaterEqual(body.get('imported_count', 0), 2)
        self.assertTrue(Score.objects.filter(student=self.stu1, exam=self.exam).exists())

    def test_import_name_mismatch_uses_student_id_as_authoritative_key(self):
        headers = ['学号', '学生姓名', '语文']
        rows = [('S001', '错误姓名', 100)]
        file_obj = make_excel_bytes(headers, rows)

        resp = self.client.post(self.url, {'exam': self.exam.pk, 'excel_file': file_obj}, format='multipart')
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertTrue(body.get('success'))
        self.assertGreaterEqual(body.get('imported_count', 0), 1)
        self.assertTrue(Score.objects.filter(student=self.stu1, exam=self.exam).exists())

    def test_import_requires_admin_or_grade_manager(self):
        self.client.logout()
        User = get_user_model()
        staff_user = User.objects.create_user(
            username='score_import_staff',
            password='test-pass-123',
            role='staff'
        )
        self.client.force_login(staff_user)

        headers = ['学号', '学生姓名', '语文']
        rows = [('S001', '张三', 100)]
        file_obj = make_excel_bytes(headers, rows)

        resp = self.client.post(self.url, {'exam': self.exam.pk, 'excel_file': file_obj}, format='multipart')
        self.assertIn(resp.status_code, (403,))

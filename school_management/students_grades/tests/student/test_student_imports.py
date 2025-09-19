"""
Tests for student import and StudentForm behavior.

This module contains:
- StudentFormTests: unit tests for the StudentForm, focusing on optional date handling and
  validation of id/phone formats.
- StudentImportViewTests: integration tests for the `student_batch_import` view that processes
  uploaded Excel files. Tests create in-memory Excel files (using openpyxl) and POST them
  to the view, then assert on the JSON response and resulting database state.

How to run just these tests locally:

    python3 manage.py test school_management.students_grades.tests.test_imports -v 2

Notes / assumptions:
- The view `student_batch_import` returns a JSON response with keys: success, imported_count,
  failed_count, success_messages, warning_messages, failed_rows. Tests assert these keys.
- The import logic uses header names matching the workbook created in the tests.
- Tests use small in-memory Excel files; they are not performance tests.
"""

from django.test import TestCase, Client
from django.urls import reverse
from io import BytesIO
from django.core.files.uploadedfile import SimpleUploadedFile
import datetime
import openpyxl

from school_management.students_grades.forms import StudentForm
from school_management.students_grades.models import Student, Class


class StudentFormTests(TestCase):
    """Unit tests for `StudentForm`."""
    def test_studentform_handles_optional_dates_missing(self):
        """
        Purpose:
        - Verify that when optional date fields (entry_date, graduation_date) are omitted,
          the form remains valid and saved model fields are None.

        Setup:
        - Build minimal valid form data (student_id, name, grade_level, class_name, status).

        Assertion:
        - form.is_valid() is True
        - saved student's entry_date and graduation_date are None
        """
        data = {
            'student_id': 'UF100',
            'name': '可选日期测试',
            'grade_level': '初一',
            'class_name': '1班',
            'status': '在读',
            # 不提供 date_of_birth/entry_date/graduation_date
            'id_card_number': '',
            'student_enrollment_number': '',
            'home_address': '',
            'guardian_name': '',
            'guardian_contact_phone': '',
        }

        form = StudentForm(data=data)
        self.assertTrue(form.is_valid(), msg=form.errors)
        student = form.save()
        self.assertIsNone(student.entry_date)
        self.assertIsNone(student.graduation_date)

    def test_studentform_rejects_invalid_idcard_or_phone_format(self):
        """
        Purpose:
        - Ensure form validation rejects an invalid ID card or phone format based on model validators.

        Setup:
        - Provide deliberately malformed `id_card_number` and `guardian_contact_phone` values.

        Assertion:
        - form.is_valid() is False and at least one of the error keys corresponds to the
          invalid fields (id_card_number or guardian_contact_phone).
        """
        data = {
            'student_id': 'UF101',
            'name': '验证测试',
            'grade_level': '初一',
            'class_name': '1班',
            'status': '在读',
            'id_card_number': 'bad-id-123',
            'guardian_contact_phone': '12345',
        }
        form = StudentForm(data=data)
        self.assertFalse(form.is_valid())
        # 身份证或手机号任一验证失败会出现在 form.errors 中
        errors = form.errors.as_data()
        self.assertTrue('id_card_number' in errors or 'guardian_contact_phone' in errors)


class StudentImportViewTests(TestCase):
    """Integration tests for the `student_batch_import` view.

    These tests construct small in-memory Excel files and POST them to the view. They then
    assert on the JSON response structure and the persisted Student records.
    """

    def setUp(self):
        # Django test client and the URL under test
        self.client = Client()
        self.url = reverse('students_grades:student_batch_import')

    def make_workbook_bytes(self, rows):
        """Helper: create an in-memory Excel file (BytesIO) with the provided rows.

        - rows: iterable of row values matching the headers used by the import view.
        - returns: BytesIO positioned at start ready for upload.
        """
        wb = openpyxl.Workbook()
        ws = wb.active
        headers = [
            "学号 (必填)", "姓名 (必填)", "性别 (男/女)", "出生日期 (YYYY-MM-DD)",
            "年级 (初一/初二/初三/高一/高二/高三)", "班级名称 (1班-20班)", "在校状态 (在读/转学/休学/复学/毕业)",
            "身份证号码", "学籍号", "家庭地址", "监护人姓名", "监护人联系电话",
            "入学日期 (YYYY-MM-DD)", "毕业日期 (YYYY-MM-DD, 毕业状态必填)",
        ]
        ws.append(headers)
        for row in rows:
            ws.append(row)
        buf = BytesIO()
        wb.save(buf)
        buf.seek(0)
        return buf

    def test_import_view_creates_students_and_reports_invalid_rows(self):
        """
        Purpose:
        - Validate that the import view accepts multiple date formats and imports valid rows,
          while reporting invalid rows in the JSON response.

        Setup:
        - Build three rows: two valid (one with date string, one with date object) and one invalid
          (missing name).

        Assertion:
        - response JSON 'success' True, imported_count == 2, failed_count == 1
        - persisted Student with student_id 'I100' exists and has expected fields
        """
        rows = []
        # valid row - date as string
        rows.append([
            'I100', '导入一', '男', '2025-09-01', '初一', '1班', '在读',
            '110101200605151234', 'EN100', '地址', '监护人', '13800138000', '2024-09-01', ''
        ])
        # valid row - date as datetime.date
        rows.append([
            'I101', '导入二', '女', datetime.date(2025, 9, 2), '初一', '1班', '在读',
            '', '', '', '', '', None, None
        ])
        # invalid row - missing name
        rows.append([
            'I102', None, '男', '2025/09/03', '初一', '1班', '在读', '', '', '', '', '', '', ''
        ])

        buf = self.make_workbook_bytes(rows)
        upload = SimpleUploadedFile(
            'students.xlsx',
            buf.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response = self.client.post(self.url, {'file': upload}, format='multipart')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        # response JSON examined via assertions
        self.assertTrue(data.get('success'))
        self.assertEqual(data.get('imported_count'), 2)
        self.assertEqual(data.get('failed_count'), 1)

        # 检查导入的数据在DB中
        s1 = Student.objects.filter(student_id='I100').first()
        self.assertIsNotNone(s1)
        self.assertEqual(s1.name, '导入一')
        self.assertEqual(s1.grade_level, '初一')
        self.assertEqual(s1.current_class.class_name, '1班')
        self.assertEqual(s1.date_of_birth, datetime.date(2025, 9, 1))

    def test_import_view_updates_existing_student_on_duplicate_student_id(self):
        """
        Purpose:
        - Verify that when a row contains a student_id that already exists, the view will
          update the existing student (using update_or_create) rather than creating a new one.

        Setup:
        - Create an existing Student with student_id 'DUP1'.
        - Upload an Excel file where the row uses student_id 'DUP1' but a different name.

        Assertion:
        - imported_count == 1
        - the original Student object's name has been updated to the new value.
        """
        # 先创建一个学生
        cls_obj, _ = Class.objects.get_or_create(grade_level='初一', class_name='2班')
        student = Student.objects.create(student_id='DUP1', name='原名', grade_level='初一', current_class=cls_obj)

        rows = [
            ['DUP1', '新名', '男', '2025-01-01', '初一', '2班', '在读', '', '', '', '', '', '', '']
        ]
        buf = self.make_workbook_bytes(rows)
        upload = SimpleUploadedFile(
            'students.xlsx',
            buf.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response = self.client.post(self.url, {'file': upload}, format='multipart')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        # response JSON examined via assertions
        self.assertTrue(data.get('success'))
        self.assertEqual(data.get('imported_count'), 1)

        student.refresh_from_db()
        self.assertEqual(student.name, '新名')

    def test_download_student_import_template_returns_excel_and_headers(self):
        """GET the download template endpoint and assert headers and first row content."""
        url = reverse('students_grades:download_student_import_template')
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)
        # Check content-type and content-disposition
        self.assertIn('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', resp['Content-Type'])
        self.assertIn('attachment; filename=', resp['Content-Disposition'])

        # Parse returned bytes with openpyxl and assert header row
        buf = BytesIO(resp.content)
        wb = openpyxl.load_workbook(buf)
        sheet = wb.active
        headers = [cell.value for cell in sheet[1]]

        expected_headers = [
            "学号 (必填)", "姓名 (必填)", "性别 (男/女)", "出生日期 (YYYY-MM-DD)",
            "年级 (初一/初二/初三/高一/高二/高三)", "班级名称 (1班-20班)", "在校状态 (在读/转学/休学/复学/毕业)",
            "身份证号码", "学籍号", "家庭地址", "监护人姓名", "监护人联系电话",
            "入学日期 (YYYY-MM-DD)", "毕业日期 (YYYY-MM-DD, 毕业状态必填)"
        ]
        self.assertEqual(headers, expected_headers)

    def test_import_view_handles_missing_file_and_wrong_extension(self):
        """Test missing file and non-excel extension branches for student_batch_import."""
        # Missing file in POST
        resp = self.client.post(self.url, {}, format='multipart')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertFalse(data.get('success'))
        self.assertIn('error', data)

        # Wrong extension uploaded
        fake = SimpleUploadedFile('notes.txt', b'not an excel', content_type='text/plain')
        resp2 = self.client.post(self.url, {'file': fake}, format='multipart')
        self.assertEqual(resp2.status_code, 200)
        data2 = resp2.json()
        self.assertFalse(data2.get('success'))
        self.assertIn('文件格式不正确', data2.get('error'))

    def test_import_view_handles_corrupted_workbook_and_parsing_warnings(self):
        """Test handling of workbook read errors and date parsing warnings.

        - corrupted workbook -> top-level JSON error
        - date parsing mismatch -> warning_messages contains an entry
        """
        # Corrupted file that raises when openpyxl tries to read it.
        bad_buf = BytesIO(b'not-a-valid-xlsx')
        bad_upload = SimpleUploadedFile('students.xlsx', bad_buf.getvalue(), content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        resp = self.client.post(self.url, {'file': bad_upload}, format='multipart')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        # The view wraps workbook loading in try/except and returns success=False with error
        self.assertFalse(data.get('success'))
        self.assertIn('error', data)

        # Now construct a workbook with an invalid date string for a row to trigger warning_messages
        rows = [
            ['W1', 'WarnDate', '男', '31-12-2025', '初一', '1班', '在读', '', '', '', '', '', '', '']
        ]
        buf = self.make_workbook_bytes(rows)
        upload = SimpleUploadedFile('students.xlsx', buf.getvalue(), content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        resp2 = self.client.post(self.url, {'file': upload}, format='multipart')
        self.assertEqual(resp2.status_code, 200)
        data2 = resp2.json()
        # Should succeed (row may be imported with date None) and warning_messages should include a message
        self.assertTrue(data2.get('success'))
        self.assertTrue(isinstance(data2.get('warning_messages'), list))
        self.assertGreaterEqual(len(data2.get('warning_messages')), 1)

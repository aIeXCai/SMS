"""
Integration tests for student-related views.

These tests exercise the following behaviors:

- `student_add` (POST): accepts form data and redirects to the student list on success; the
  new Student record should exist in the database.
- `student_edit` (POST): updates an existing Student and redirects to the student list; the
  Student's fields should be updated in the DB.
- `student_delete` (POST): removes the Student and redirects to the student list.
- `student_update_status` (POST): updates a single student's status; when setting to
  '毕业' the view should set `graduation_date` if it was empty.
- `student_batch_promote_grade` (AJAX POST): batch-promote students to a target grade;
  supports `auto_create_classes` and returns JSON with `updated_count` and `errors`.
- `student_batch_delete` (POST): deletes multiple students and returns JSON with `deleted_count`.
- `student_batch_graduate` (POST): batch sets students' status to '毕业' and returns JSON
  with `updated_count`.

Each test follows the pattern:
1. Arrange: create minimal DB objects needed (Class, Student)
2. Act: call the view via Django test client (POST). For AJAX endpoints set X-Requested-With.
3. Assert: check response (redirect or JsonResponse) and DB side-effects.
"""

from django.test import TestCase, Client
from django.urls import reverse
from django.utils import timezone

from school_management.students_grades.models.student import Student, Class


class StudentViewsIntegrationTests(TestCase):
    """Integration tests covering student add/edit/delete/status and batch operations.

    Organization and expectations per test are documented in each method's comments.
    """

    def setUp(self):
        # Use a fresh test client and create a baseline Class so StudentForm can find/create classes
        self.client = Client()
        self.cls = Class.objects.create(grade_level='初一', class_name='1班')

    """ Student add view tests """
    def test_student_add_and_redirects(self):
        """POST to student_add should create a Student and redirect to the list.

        Steps:
        - POST minimal required form data to `student_add`.
        - Expect a 302 redirect on success and a Student with given student_id exists.
        """
        url = reverse('students_grades:student_add')
        data = {
            'student_id': 'VADD1',
            'name': '新增生',
            'grade_level': '初一',
            'class_name': '1班',
            'status': '在读'
        }
        resp = self.client.post(url, data)
        # on success redirect to list
        self.assertEqual(resp.status_code, 302)
        self.assertTrue(Student.objects.filter(student_id='VADD1').exists())

    def test_student_add_duplicate_student_id_shows_error(self):
        """Posting a student_add with an existing student_id should not create a duplicate and should show the form with errors."""
        existing = Student.objects.create(student_id='DUP1', name='存在')
        url = reverse('students_grades:student_add')
        data = {'student_id': 'DUP1', 'name': '新名', 'grade_level': '初一', 'class_name': '1班', 'status': '在读'}
        resp = self.client.post(url, data)
        # The view should render the form with errors (status code 200) rather than redirect on success
        self.assertEqual(resp.status_code, 200)
        # Ensure only one student with that id remains
        self.assertEqual(Student.objects.filter(student_id='DUP1').count(), 1)

    """ Student edit view tests """
    def test_student_edit_updates_and_redirects(self):
        """POST to student_edit should update fields and redirect.

        Steps:
        - Create a Student, POST updated data to the edit URL, expect redirect and DB change.
        """
        s = Student.objects.create(student_id='EDIT1', name='原名', grade_level='初一', current_class=self.cls)
        url = reverse('students_grades:student_edit', args=[s.pk])
        data = {'student_id': 'EDIT1', 'name': '新名', 'grade_level': '初一', 'class_name': '1班', 'status': '在读'}
        resp = self.client.post(url, data)
        self.assertEqual(resp.status_code, 302)
        s.refresh_from_db()
        self.assertEqual(s.name, '新名')

    def test_student_edit_invalid_form_shows_errors(self):
        """Submitting an invalid edit (e.g., clearing required field) should re-render form with errors rather than redirect."""
        s = Student.objects.create(student_id='EDIT2', name='Keep', grade_level='初一', current_class=self.cls)
        url = reverse('students_grades:student_edit', args=[s.pk])
        data = {'student_id': 'EDIT2', 'name': '', 'grade_level': '初一', 'class_name': '1班', 'status': '在读'}
        resp = self.client.post(url, data)
        # invalid form should render the same page with status 200 and not redirect
        self.assertEqual(resp.status_code, 200)
        s.refresh_from_db()
        self.assertEqual(s.name, 'Keep')

    """ Student delete view tests """
    def test_student_delete_post_deletes_and_redirects(self):
        """POST to student_delete removes the student and redirects.

        Steps:
        - Create a Student, POST to delete URL, expect redirect and record removal.
        """
        s = Student.objects.create(student_id='DEL1', name='待删', grade_level='初一', current_class=self.cls)
        url = reverse('students_grades:student_delete', args=[s.pk])
        resp = self.client.post(url)
        self.assertEqual(resp.status_code, 302)
        self.assertFalse(Student.objects.filter(pk=s.pk).exists())

    def test_student_batch_delete_no_selection(self):
        """POSTing batch delete with no selected_students should return success=False JSON."""
        url = reverse('students_grades:student_batch_delete')
        resp = self.client.post(url, {}, HTTP_X_REQUESTED_WITH='XMLHttpRequest')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertFalse(data.get('success'))
        self.assertIn('message', data)

    def test_student_delete_triggers_async_ranking_update(self):
        """When deleting a student who has Score records, the view should attempt to enqueue ranking update tasks.

        We patch the task submitter to assert it was called for affected exam ids. The view swallows task submission errors,
        so this test focuses on ensuring the call path is reached (mocked).
        """
        from unittest.mock import patch
        from school_management.students_grades.models.exam import Exam
        from school_management.students_grades.models.score import Score, ExamSubject

        # create an exam + subject + score associated with the student
        exam = Exam.objects.create(name='期中', academic_year='2025-2026', date=timezone.now().date(), grade_level='初一')
        exam_subj = ExamSubject.objects.create(exam=exam, subject_code='语文', subject_name='语文', max_score=120)

        s = Student.objects.create(student_id='DAS1', name='DAS1', current_class=self.cls, grade_level='初一')
        Score.objects.create(student=s, exam=exam, exam_subject=exam_subj, subject='语文', score_value=95)

        url = reverse('students_grades:student_delete', args=[s.pk])

        # Patch the async task sender
        with patch('school_management.students_grades.tasks.update_all_rankings_async.delay') as mocked_delay:
            resp = self.client.post(url)
            # redirect expected
            self.assertEqual(resp.status_code, 302)
            # The mock should have been called at least once with the exam id
            mocked_delay.assert_called()

    def test_student_batch_delete_and_response(self):
        """POST to batch-delete should remove provided students and return JSON.

        Steps:
        - Create two students, POST their PKs to batch-delete, expect JSON success and deleted_count == 2.
        """
        s1 = Student.objects.create(student_id='BD1', name='BD1', current_class=self.cls, grade_level='初一')
        s2 = Student.objects.create(student_id='BD2', name='BD2', current_class=self.cls, grade_level='初一')
        url = reverse('students_grades:student_batch_delete')
        resp = self.client.post(url, {'selected_students': [str(s1.pk), str(s2.pk)]}, HTTP_X_REQUESTED_WITH='XMLHttpRequest')
        # view returns JsonResponse
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data.get('success'))
        self.assertEqual(data.get('deleted_count'), 2)


    """ Student update status view tests """
    def test_student_update_status_post_redirects_and_sets_graduation_date(self):
        """Updating status to '毕业' should set graduation_date when it was empty.

        Steps:
        - Create a student with no graduation_date, POST status='毕业', expect redirect and
          graduation_date to be set to today's date (approx).
        """
        s = Student.objects.create(student_id='STAT1', name='状态生', grade_level='初一', current_class=self.cls)
        url = reverse('students_grades:student_update_status', args=[s.pk])
        resp = self.client.post(url, {'status': '毕业'})
        self.assertEqual(resp.status_code, 302)
        s.refresh_from_db()
        self.assertEqual(s.status, '毕业')
        self.assertIsNotNone(s.graduation_date)

    def test_student_batch_update_status_ajax_and_invalid_form(self):
        """Test batch update status via AJAX: valid form -> JSON success; invalid form -> JSON error."""
        # create students
        s1 = Student.objects.create(student_id='SU1', name='SU1', current_class=self.cls, grade_level='初一')
        s2 = Student.objects.create(student_id='SU2', name='SU2', current_class=self.cls, grade_level='初一')
        url = reverse('students_grades:student_batch_update_status')

        # Valid form (AJAX)
        resp = self.client.post(url, {'selected_students': [str(s1.pk), str(s2.pk)], 'status': '在读'}, HTTP_X_REQUESTED_WITH='XMLHttpRequest')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data.get('success'))
        self.assertEqual(data.get('updated_count'), 2)

        # Invalid form (status not provided)
        resp2 = self.client.post(url, {'selected_students': [str(s1.pk)]}, HTTP_X_REQUESTED_WITH='XMLHttpRequest')
        self.assertEqual(resp2.status_code, 200)
        data2 = resp2.json()
        self.assertFalse(data2.get('success'))
        self.assertIn('message', data2)


    """ Student batch promote grade view tests """
    def test_student_batch_promote_grade_ajax(self):
        """AJAX POST to batch-promote students.

        This test covers the happy path where `auto_create_classes` is enabled and
        students move from 初一 -> 初二, target classes are auto-created.
        """
        # create students in initial class
        s1 = Student.objects.create(student_id='P1', name='升一', current_class=self.cls, grade_level='初一')
        s2 = Student.objects.create(student_id='P2', name='升二', current_class=self.cls, grade_level='初一')
        url = reverse('students_grades:student_batch_promote_grade')
        data = {
            'selected_students': [str(s1.pk), str(s2.pk)],
            'current_grade_level': '初一',
            'target_grade_level': '初二',
            'auto_create_classes': 'on'
        }
        resp = self.client.post(url, data, HTTP_X_REQUESTED_WITH='XMLHttpRequest')
        self.assertEqual(resp.status_code, 200)
        json = resp.json()
        self.assertTrue(json.get('success'))
        self.assertEqual(json.get('updated_count'), 2)
        s1.refresh_from_db(); s2.refresh_from_db()
        self.assertEqual(s1.grade_level, '初二')

    def test_student_batch_promote_grade_errors_and_no_selection(self):
        """Cover promote-grade error branches: no selection, to_grade empty, from==to."""
        url = reverse('students_grades:student_batch_promote_grade')

        # No selected students (AJAX)
        resp = self.client.post(url, {'selected_students': []}, HTTP_X_REQUESTED_WITH='XMLHttpRequest')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertFalse(data.get('success'))
        self.assertIn('error', data)

        # to_grade empty (AJAX) - build minimal valid form values but omit target_grade_level
        s = Student.objects.create(student_id='PROM1', name='PROM1', current_class=self.cls, grade_level='初一')
        resp2 = self.client.post(url, {'selected_students': [str(s.pk)], 'current_grade_level': '初一', 'target_grade_level': ''}, HTTP_X_REQUESTED_WITH='XMLHttpRequest')
        self.assertEqual(resp2.status_code, 200)
        data2 = resp2.json()
        self.assertFalse(data2.get('success'))
        self.assertIn('error', data2)

        # from_grade == to_grade (AJAX)
        resp3 = self.client.post(url, {'selected_students': [str(s.pk)], 'current_grade_level': '初一', 'target_grade_level': '初一'}, HTTP_X_REQUESTED_WITH='XMLHttpRequest')
        self.assertEqual(resp3.status_code, 200)
        data3 = resp3.json()
        self.assertFalse(data3.get('success'))
        self.assertIn('error', data3)


    """ Student batch graduate view tests """
    def test_student_batch_graduate(self):
        """Batch graduate endpoint should set status='毕业' for selected students and return JSON."""
        s1 = Student.objects.create(student_id='G1', name='G1', current_class=self.cls, grade_level='初一')
        s2 = Student.objects.create(student_id='G2', name='G2', current_class=self.cls, grade_level='初一')
        url = reverse('students_grades:student_batch_graduate')
        resp = self.client.post(url, {'selected_students': [str(s1.pk), str(s2.pk)]}, HTTP_X_REQUESTED_WITH='XMLHttpRequest')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data.get('success'))
        self.assertEqual(data.get('updated_count'), 2)
        s1.refresh_from_db(); s2.refresh_from_db()
        self.assertEqual(s1.status, '毕业')
 
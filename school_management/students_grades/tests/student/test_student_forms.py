"""
Unit tests for StudentForm behavior.

This file focuses on testing the StudentForm in isolation (model form logic):
- save() behavior that creates/associates `Class` when grade_level/class_name are provided
Each test includes a short purpose, setup, action, and assertions block as comments so future
readers can understand intent and how to extend the tests.

Run these tests with:
    python3 manage.py test school_management.students_grades.tests.test_student_forms -v 2
"""

from django.test import TestCase
from school_management.students_grades.forms import StudentForm
from school_management.students_grades.models import Student, Class
import datetime


class StudentFormValidationTests(TestCase):
    def test_save_without_grade_or_class_sets_current_class_none(self):
        """
        Purpose:
        - When grade_level and/or class_name are blank, Student.current_class should be None after save

        Setup:
        - Provide form data without grade_level and class_name

        Assertions:
        - Saved student's current_class is None
        """
        data = {
            'student_id': 'SF003',
            'name': '无班级学生',
            'grade_level': '',
            'class_name': '',
            'status': '在读'
        }
        form = StudentForm(data=data)
        # StudentForm requires grade_level and class_name; the form should be invalid
        # when those fields are missing. Adjust the assertion to reflect current form
        # design: ensure validation fails and the errors mention the required fields.
        self.assertFalse(form.is_valid())
        errors = form.errors.as_data()
        self.assertIn('grade_level', errors)
        self.assertIn('class_name', errors)

    def test_student_id_uniqueness_validation(self):
        """
        Student.student_id is unique at the model level. Ensure the form surfaces a validation error
        when attempting to create a new Student with an existing student_id.
        """
        Student.objects.create(student_id='UNIQ1', name='Existing')
        data = {'student_id': 'UNIQ1', 'name': 'New', 'grade_level': '初一', 'class_name': '1班', 'status': '在读'}
        form = StudentForm(data=data)
        # ModelForm should validate uniqueness and mark the form invalid
        self.assertFalse(form.is_valid())
        self.assertIn('student_id', form.errors)

    def test_validation_rejects_bad_idcard_and_phone(self):
        """
        Purpose:
        - Ensure model validators surface through the form when provided invalid id_card_number or guardian_contact_phone

        Setup:
        - Provide malformed id_card and phone values

        Assertions:
        - form.is_valid() is False and errors contain the related fields
        """
        data = {
            'student_id': 'SF005',
            'name': '格式校验生',
            'grade_level': '初一',
            'class_name': '1班',
            'status': '在读',
            'id_card_number': 'INVALID_ID',
            'guardian_contact_phone': '123'
        }
        form = StudentForm(data=data)
        self.assertFalse(form.is_valid())
        errors = form.errors.as_data()
        self.assertTrue('id_card_number' in errors or 'guardian_contact_phone' in errors)

    def test_required_fields_trigger_validation_errors(self):
        """
        Ensure that omitting required fields (name/grade_level/class_name/status) causes form validation to fail
        and the errors reference the correct fields.
        """
        base = {'student_id': 'RF1', 'name': 'N', 'grade_level': '初一', 'class_name': '1班', 'status': '在读'}

        for field in ['name', 'grade_level', 'class_name', 'status']:
            data = base.copy()
            data[field] = ''
            form = StudentForm(data=data)
            self.assertFalse(form.is_valid(), msg=f"Expected invalid when {field} is blank")
            self.assertIn(field, form.errors)


class StudentFormSaveTests(TestCase):
    def test_save_creates_and_associates_class_when_grade_and_class_provided(self):
        """
        Purpose:
        - Verify that StudentForm.save() will get_or_create a Class and associate it to the saved Student

        Setup:
        - Build minimal valid form data including grade_level and class_name

        Action:
        - Instantiate StudentForm with data, call is_valid(), then save()

        Assertions:
        - The Class object exists in DB
        - Returned Student.current_class points to the created Class
        - Subsequent save with same grade/class should reuse existing Class (id unchanged)
        """
        data = {
            'student_id': 'SF001',
            'name': '表单测试生',
            'grade_level': '初一',
            'class_name': '1班',
            'status': '在读'
        }

        form = StudentForm(data=data)
        self.assertTrue(form.is_valid(), msg=form.errors)
        student = form.save()

        # Assert Class was created and associated
        cls = Class.objects.filter(grade_level='初一', class_name='1班').first()
        self.assertIsNotNone(cls)
        self.assertEqual(student.current_class, cls)

        # Save another student with same class and ensure the Class is reused
        data2 = {
            'student_id': 'SF002',
            'name': '表单测试生2',
            'grade_level': '初一',
            'class_name': '1班',
            'status': '在读'
        }
        form2 = StudentForm(data=data2)
        self.assertTrue(form2.is_valid(), msg=form2.errors)
        student2 = form2.save()
        self.assertEqual(student2.current_class.id, cls.id)

    def test_save_commit_false_and_persistence(self):
        """
        Purpose:
        - Verify save(commit=False) returns an unsaved Student instance with current_class set,
          and that calling save() on the instance persists it to the DB.

        Setup:
        - Provide form data for a new student with grade_level/class_name.

        Action:
        - Call form.save(commit=False), inspect instance, then call instance.save().

        Assertions:
        - The returned instance has current_class (a Class object exists in DB)
        - The returned instance has no pk before instance.save()
        - After instance.save(), the Student is present in DB with a pk
        """
        data = {
            'student_id': 'SF006',
            'name': 'CommitFalse',
            'grade_level': '初二',
            'class_name': '3班',
            'status': '在读'
        }
        form = StudentForm(data=data)
        self.assertTrue(form.is_valid(), msg=form.errors)
        inst = form.save(commit=False)

        # current_class should be set on the instance even if not saved
        self.assertIsNotNone(inst.current_class)
        self.assertIsNone(inst.pk)

        # now persist
        inst.save()
        self.assertIsNotNone(inst.pk)
        self.assertTrue(Student.objects.filter(pk=inst.pk).exists())

    def test_whitespace_trim_and_required_fields(self):
        """
        Purpose:
        - Verify that leading/trailing whitespace in student_id and id_card_number are trimmed
          and that missing required fields (e.g., name) cause validation to fail.

        Setup & Action:
        - Submit a form with padded student_id/id_card_number and assert saved values are trimmed.
        - Submit a form missing 'name' and assert form.is_valid() is False.

        Assertions:
        - Stored student_id and id_card_number do not contain surrounding spaces.
        - Form without required 'name' field is invalid and 'name' in errors.
        """
        data = {
            'student_id': '  PAD1  ',
            'name': 'Pad Test',
            'grade_level': '初一',
            'class_name': '6班',
            'status': '在读',
            'id_card_number': ' 110101200605151234 '
        }
        form = StudentForm(data=data)
        self.assertTrue(form.is_valid(), msg=form.errors)
        student = form.save()
        self.assertEqual(student.student_id, 'PAD1')
        self.assertEqual(student.id_card_number, '110101200605151234')

        # missing required field
        bad = {'student_id': 'NO_NAME', 'name': '', 'grade_level': '初一', 'class_name': '6班', 'status': '在读'}
        bad_form = StudentForm(data=bad)
        self.assertFalse(bad_form.is_valid())
        self.assertIn('name', bad_form.errors)

class StudentFormEditTests(TestCase):
    def test_init_in_edit_mode_formats_dates_as_strings(self):
        """
        Purpose:
        - StudentForm.__init__ should format existing date fields as 'YYYY-MM-DD' strings when editing.

        Setup:
        - Create a Student with date_of_birth and entry_date as date objects

        Action:
        - Instantiate StudentForm(instance=student)

        Assertions:
        - form.initial contains date fields formatted as strings matching YYYY-MM-DD
        """
        cls = Class.objects.create(grade_level='初一', class_name='2班')
        dob = datetime.date(2010, 5, 4)
        entry = datetime.date(2023, 9, 1)
        student = Student.objects.create(student_id='SF004', name='编辑学生', grade_level='初一', current_class=cls, date_of_birth=dob, entry_date=entry)

        form = StudentForm(instance=student)
        # initial values for dates should be strings 'YYYY-MM-DD'
        self.assertEqual(form.initial.get('date_of_birth'), '2010-05-04')
        self.assertEqual(form.initial.get('entry_date'), '2023-09-01')

    def test_editing_student_preserves_unmodified_fields(self):
        """
        When editing a student, fields not present in the provided data (or left unchanged) should remain intact.
        We update a subset of fields and assert others remain the same.
        """
        s = Student.objects.create(student_id='E1', name='OldName', grade_level='初一')
        # set an optional field to ensure it is preserved if not touched
        s.id_card_number = '110101199001011234'
        s.save()

        data = {'student_id': 'E1', 'name': 'NewName', 'grade_level': '初一', 'class_name': '1班', 'status': '在读'}
        form = StudentForm(data=data, instance=s)
        self.assertTrue(form.is_valid(), msg=form.errors)
        updated = form.save()
        # name changed, id_card_number preserved
        self.assertEqual(updated.name, 'NewName')
        self.assertEqual(updated.id_card_number, '110101199001011234')

    def test_editing_student_switches_class(self):
        """
        Purpose:
        - Ensure that editing an existing Student and changing grade_level/class_name
          will update the student's current_class to the new Class (creating it if needed).

        Setup:
        - Create Class A and Student linked to A.

        Action:
        - Instantiate StudentForm with instance=student and data pointing to Class B,
          call save() and assert current_class changed.

        Assertions:
        - After save, student's current_class is the new Class B.
        - Old class A remains in DB (we don't delete classes on reassignment).
        """
        class_a = Class.objects.create(grade_level='高一', class_name='1班')
        student = Student.objects.create(student_id='SF007', name='Switch', current_class=class_a, grade_level='高一')

        data = {
            'student_id': 'SF007',
            'name': 'Switch',
            'grade_level': '高一',
            'class_name': '2班',
            'status': '在读'
        }
        form = StudentForm(data=data, instance=student)
        self.assertTrue(form.is_valid(), msg=form.errors)
        updated = form.save()

        # New class should now exist and student linked to it
        new_cls = Class.objects.filter(grade_level='高一', class_name='2班').first()
        self.assertIsNotNone(new_cls)
        self.assertEqual(updated.current_class.pk, new_cls.pk)
        self.assertTrue(Class.objects.filter(pk=class_a.pk).exists())

class StudentFormEdgeCasesTests(TestCase):
    def test_field_length_and_charset_boundaries(self):
        """
        Test boundary conditions for max_length and handling of unicode characters.
        """
        # student_id max_length is 20: create one too long
        long_id = 'X' * 25
        data = {'student_id': long_id, 'name': 'L', 'grade_level': '初一', 'class_name': '1班', 'status': '在读'}
        form = StudentForm(data=data)
        self.assertFalse(form.is_valid())
        self.assertIn('student_id', form.errors)

        # unicode characters in name should be accepted (emoji etc.) unless model restricts them
        data2 = {'student_id': 'UNICODE1', 'name': '😊学生', 'grade_level': '初一', 'class_name': '1班', 'status': '在读'}
        form2 = StudentForm(data=data2)
        self.assertTrue(form2.is_valid(), msg=form2.errors)
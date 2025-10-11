"""
Tests for score-related forms.

This file focuses on form-level validation and behavior for:
- ScoreForm (ModelForm for single score entry)
- ScoreBatchUploadForm (file type validation for Excel uploads)
- ScoreAddForm (bulk single-student multi-subject input form)

Each test is documented with a clear purpose and expected outcome.
"""
from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.exceptions import ValidationError

from school_management.students_grades.forms import ScoreForm, ScoreBatchUploadForm, ScoreAddForm
from school_management.students_grades.models import (
    Class, Student, Exam, ExamSubject, Score
)


class ScoreFormTests(TestCase):
    """Tests for the Score-related forms with focus on validation and initialization."""

    def test_score_batch_upload_form_rejects_non_excel_and_accepts_excel(self):
        """
        验证 `ScoreBatchUploadForm.clean_excel_file` 对文件类型进行简单校验：
        - 非 .xls/.xlsx 文件应被拒绝（表单无效且在 `excel_file` 字段上有错误）
        - 后缀为 .xlsx 的文件应被接受（在提供必需的 exam 字段时表单有效）
        """
        exam = Exam.objects.create(name='上传测', grade_level='初一', date='2025-10-20')

        # 非 Excel 文件
        txt_file = SimpleUploadedFile('not_excel.txt', b'hello world', content_type='text/plain')
        form = ScoreBatchUploadForm(data={'exam': exam.pk}, files={'excel_file': txt_file})
        self.assertFalse(form.is_valid())
        self.assertIn('excel_file', form.errors)

        # 接受 .xlsx 后缀（内容不检验，仅后缀）
        xlsx = SimpleUploadedFile('scores.xlsx', b'PK\x03\x04', content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        form2 = ScoreBatchUploadForm(data={'exam': exam.pk}, files={'excel_file': xlsx})
        self.assertTrue(form2.is_valid())

    def test_score_add_form_requires_at_least_one_score(self):
        """
        验证 `ScoreAddForm.clean()` 要求至少填写一个科目的成绩：
        - 不提供任何 score_* 字段时，表单应无效并提示错误信息
        """
        c = Class.objects.create(grade_level='初一', class_name='1班')
        student = Student.objects.create(student_id='SF001', name='表单生', current_class=c, grade_level='初一')
        exam = Exam.objects.create(name='表单考', grade_level='初一', date='2025-10-21')

        # 提交数据但没有任何 score_ 字段
        data = {
            'student': '表单生',
            'student_id': str(student.pk),
            'exam': str(exam.pk),
        }
        form = ScoreAddForm(data=data)
        self.assertFalse(form.is_valid())
        # 非字段错误（表单级别）应包含提示
        self.assertTrue(any('请至少输入一个科目的成绩' in e for e in form.non_field_errors()))

    def test_score_add_form_detects_existing_scores(self):
        """
        验证 `ScoreAddForm` 在清洗时会检测已有成绩并拒绝重复插入：
        - 如果学生在同一考试已存在某科目的成绩，提交该科目应导致表单级错误
        """
        c = Class.objects.create(grade_level='初一', class_name='2班')
        student = Student.objects.create(student_id='SF002', name='已存在生', current_class=c, grade_level='初一')
        exam = Exam.objects.create(name='现成绩考', grade_level='初一', date='2025-10-22')

        # 先创建一条已有成绩（语文）
        ExamSubject.objects.create(exam=exam, subject_code='语文', subject_name='语文', max_score=120)
        Score.objects.create(student=student, exam=exam, subject='语文', score_value=95)

        # 尝试通过 ScoreAddForm 再次提交语文成绩，应被表单拒绝
        data = {
            'student': '已存在生',
            'student_id': str(student.pk),
            'exam': str(exam.pk),
            'score_语文': '88.00',
        }
        form = ScoreAddForm(data=data)
        self.assertFalse(form.is_valid())
        self.assertTrue(any('以下科目的成绩已存在' in e for e in form.non_field_errors()))

    def test_score_form_initial_populates_fields_when_editing(self):
        """
        验证 `ScoreForm(instance=...)` 在编辑模式下会将实例的值写入 initial，便于前端表单显示。
        """
        c = Class.objects.create(grade_level='初一', class_name='3班')
        student = Student.objects.create(student_id='SF003', name='初始化生', current_class=c, grade_level='初一')
        exam = Exam.objects.create(name='初始化考', grade_level='初一', date='2025-10-23')
        es = ExamSubject.objects.create(exam=exam, subject_code='物理', subject_name='物理', max_score=100)
        score = Score.objects.create(student=student, exam=exam, exam_subject=es, subject='物理', score_value=88)

        form = ScoreForm(instance=score)
        self.assertEqual(form.initial.get('student'), student.pk)
        self.assertEqual(form.initial.get('exam'), exam.pk)
        self.assertEqual(form.initial.get('subject'), '物理')
        self.assertEqual(form.initial.get('score_value'), 88)

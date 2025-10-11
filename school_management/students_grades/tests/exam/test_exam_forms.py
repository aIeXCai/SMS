"""
Exam相关表单测试

覆盖ExamCreateForm、ExamSubjectForm、BaseExamSubjectFormSet的主要功能和约束。
每个测试均有详细注释，便于理解和维护。
"""
from django.test import TestCase
from django.core.exceptions import ValidationError
from school_management.students_grades.forms import ExamCreateForm, ExamSubjectForm, BaseExamSubjectFormSet, SUBJECT_CHOICES, SUBJECT_DEFAULT_MAX_SCORES
from school_management.students_grades.models import Exam, ExamSubject
from django.forms import formset_factory

class ExamFormTests(TestCase):
    def test_exam_create_form_basic_fields_and_unique(self):
        """
        测试ExamCreateForm的基本字段校验和唯一性约束：
        - 所有字段必填，格式正确时表单有效
        - 创建同名考试（同学年、年级）时表单无效
        """
        form_data = {
            'name': '期中考试',
            'academic_year': '2025-2026',
            'date': '2025-09-01',
            'grade_level': '初一',
            'description': '测试考试'
        }
        form = ExamCreateForm(data=form_data)
        self.assertTrue(form.is_valid())
        form.save()
        # 再次创建同名考试，表单应无效
        form2 = ExamCreateForm(data=form_data)
        self.assertFalse(form2.is_valid())
        self.assertIn('学年 2025-2026 的 初一 中已存在名为', str(form2.errors))

    def test_exam_create_form_get_default_subjects(self):
        """
        测试get_default_subjects_for_grade方法：
        - 不同年级应返回正确的科目和满分配置
        """
        form = ExamCreateForm()
        subjects = form.get_default_subjects_for_grade('初一')
        self.assertIsInstance(subjects, list)
        self.assertGreater(len(subjects), 0)
        subject_codes = [s['subject_code'] for s in subjects]
        self.assertIn('语文', subject_codes)
        self.assertEqual(subjects[0]['max_score'], SUBJECT_DEFAULT_MAX_SCORES['初一'][subjects[0]['subject_code']])

    def test_exam_subject_form_max_score_default_and_range(self):
        """
        测试ExamSubjectForm的满分自动填充和范围校验：
        - 初始化时应自动填充默认满分
        - 满分超出范围时表单无效
        """
        form = ExamSubjectForm(initial={'subject_code': '语文'}, grade_level='初一')
        self.assertEqual(form.fields['max_score'].initial, SUBJECT_DEFAULT_MAX_SCORES['初一']['语文'])
        # 测试满分范围
        data = {'subject_code': '语文', 'max_score': 0}
        form2 = ExamSubjectForm(data=data, grade_level='初一')
        self.assertFalse(form2.is_valid())
        data2 = {'subject_code': '语文', 'max_score': 1000}
        form3 = ExamSubjectForm(data=data2, grade_level='初一')
        self.assertFalse(form3.is_valid())

    def test_base_exam_subject_formset_duplicate_and_min_num(self):
        """
        测试BaseExamSubjectFormSet的去重和最小科目数约束：
        - 重复科目时formset无效
        - 没有科目时formset无效
        """
        ExamSubjectFormSet = formset_factory(ExamSubjectForm, formset=BaseExamSubjectFormSet, extra=0)
        # 正常情况
        formset_data = {
            'form-TOTAL_FORMS': '2',
            'form-INITIAL_FORMS': '0',
            'form-MIN_NUM_FORMS': '1',
            'form-MAX_NUM_FORMS': str(len(SUBJECT_CHOICES)),
            'form-0-subject_code': '语文',
            'form-0-max_score': '120',
            'form-1-subject_code': '数学',
            'form-1-max_score': '120',
        }
        formset = ExamSubjectFormSet(formset_data, grade_level='初一')
        self.assertTrue(formset.is_valid())
        # 重复科目
        formset_data['form-1-subject_code'] = '语文'
        formset_dup = ExamSubjectFormSet(formset_data, grade_level='初一')
        self.assertFalse(formset_dup.is_valid())
        self.assertIn('存在重复的科目', str(formset_dup.non_form_errors()))
        # 没有科目
        empty_data = {
            'form-TOTAL_FORMS': '0',
            'form-INITIAL_FORMS': '0',
            'form-MIN_NUM_FORMS': '1',
            'form-MAX_NUM_FORMS': str(len(SUBJECT_CHOICES)),
        }
        formset_empty = ExamSubjectFormSet(empty_data, grade_level='初一')
        self.assertFalse(formset_empty.is_valid())
        self.assertIn('至少需要配置一个科目', str(formset_empty.non_form_errors()))

    def test_exam_subject_form_delete_flag(self):
        """
        测试ExamSubjectFormSet的can_delete功能：
        - 标记DELETE后，科目不会被创建
        """
        ExamSubjectFormSet = formset_factory(ExamSubjectForm, formset=BaseExamSubjectFormSet, extra=0, can_delete=True)
        formset_data = {
            'form-TOTAL_FORMS': '2',
            'form-INITIAL_FORMS': '0',
            'form-MIN_NUM_FORMS': '1',
            'form-MAX_NUM_FORMS': str(len(SUBJECT_CHOICES)),
            'form-0-subject_code': '语文',
            'form-0-max_score': '120',
            'form-0-DELETE': '',
            'form-1-subject_code': '数学',
            'form-1-max_score': '120',
            'form-1-DELETE': 'on',
        }
        formset = ExamSubjectFormSet(formset_data, grade_level='初一')
        self.assertTrue(formset.is_valid())
        # 只应有一个未删除的科目
        valid_forms = [f for f in formset.forms if not f.cleaned_data.get('DELETE', False)]
        self.assertEqual(len(valid_forms), 1)
        self.assertEqual(valid_forms[0].cleaned_data['subject_code'], '语文')

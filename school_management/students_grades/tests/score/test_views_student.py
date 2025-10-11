"""Integration tests for the student analysis pages (index and detail)."""
from datetime import date

from django.urls import reverse

from .test_base import BaseTestCase
from school_management.students_grades.models import Class, Student, Exam, ExamSubject, Score


class StudentAnalysisViewTests(BaseTestCase):
    """Integration tests for the student analysis pages (index and detail)."""

    def setUp(self):
        super().setUp()
        # 创建一个班级和两个学生
        self.cls = Class.objects.create(grade_level='Grade8', class_name='1班')
        self.s1 = Student.objects.create(student_id='S001', name='Stu1', grade_level='Grade8', current_class=self.cls)
        self.s2 = Student.objects.create(student_id='S002', name='Stu2', grade_level='Grade8', current_class=self.cls)

        # 创建考试与科目
        self.exam = Exam.objects.create(name='学生分析考', academic_year='2024-2025', grade_level='Grade8', date=date(2025, 6, 20))
        ExamSubject.objects.create(exam=self.exam, subject_code='语文', subject_name='语文', max_score=100)
        ExamSubject.objects.create(exam=self.exam, subject_code='数学', subject_name='数学', max_score=100)

        # 添加成绩，仅给 s1 两科成绩，s2 无成绩（用于验证列表/计数）
        Score.objects.create(student=self.s1, exam=self.exam, subject='语文', score_value=85)
        Score.objects.create(student=self.s1, exam=self.exam, subject='数学', score_value=90)

        self.index_url = reverse('students_grades:student_analysis')
        self.detail_url = reverse('students_grades:student_analysis_detail')

    def test_score_analysis_student_no_filters_renders_index(self):
        """访问学生分析首页（无筛选）应返回学生列表和考试列表。"""
        resp = self.client.get(self.index_url)
        self.assertEqual(resp.status_code, 200)

        templates = [t.name for t in resp.templates if t.name]
        self.assertIn('scores/score_analysis_student.html', templates)

        # context 中应包含 students, exams, student_count
        self.assertIn('students', resp.context)
        self.assertIn('exams', resp.context)
        self.assertIn('student_count', resp.context)
        self.assertEqual(resp.context['student_count'], Student.objects.count())

    def test_score_analysis_student_with_grade_and_class_and_exam_sets_context(self):
        """传入 grade_level/class_name(exam) 时应过滤并设置 selected_exam/selected_class。"""
        params = {
            'grade_level': 'Grade8',
            'class_name': str(self.cls.id),  # 视图用 class_name 参数承载班级 id
            'exam': str(self.exam.id),
            'academic_year': self.exam.academic_year,
        }
        resp = self.client.get(self.index_url, params)
        self.assertEqual(resp.status_code, 200)

        # selected_exam 应在 context 中并且正确
        self.assertIn('selected_exam', resp.context)
        self.assertEqual(getattr(resp.context['selected_exam'], 'id', None), self.exam.id)

        # selected_class 被设置为 类似 'Grade8' + '1班' 的字符串
        self.assertIn('selected_class', resp.context)
        expected_selected = f"{self.cls.grade_level}{self.cls.class_name}"
        self.assertEqual(resp.context.get('selected_class'), expected_selected)

    def test_score_analysis_student_detail_missing_params_redirects(self):
        """缺少必要参数访问详情页应被重定向回学生分析首页。"""
        resp = self.client.get(self.detail_url)
        # 重定向到 student_analysis
        self.assertIn(resp.status_code, (302, 301))

    def test_score_analysis_student_detail_renders_expected_context(self):
        """完整参数访问详情页应渲染学生详细分析并包含预期上下文。"""
        params = {
            'grade_level': 'Grade8',
            'class_name': f"{self.cls.grade_level}{self.cls.class_name}",
            'student_id': str(self.s1.id),
        }
        resp = self.client.get(self.detail_url, params)
        self.assertEqual(resp.status_code, 200)

        templates = [t.name for t in resp.templates if t.name]
        self.assertIn('scores/score_analysis_student_detail.html', templates)

        self.assertIn('student', resp.context)
        self.assertEqual(resp.context['student'].id, self.s1.id)
        self.assertIn('scores', resp.context)
        self.assertIn('exams', resp.context)
        self.assertIn('subjects', resp.context)

    def test_score_analysis_student_detail_nonexistent_student_redirects(self):
        """传入不存在的 student_id 应重定向回学生分析首页并显示错误消息（via redirect）。"""
        params = {
            'grade_level': 'Grade8',
            'class_name': f"{self.cls.grade_level}{self.cls.class_name}",
            'student_id': '999999',
        }
        resp = self.client.get(self.detail_url, params)
        self.assertIn(resp.status_code, (302, 301))

"""Integration tests for class/grade analysis views."""
from datetime import date

from django.urls import reverse

from .test_base import BaseTestCase
from school_management.students_grades.models import Class, Student, Exam, ExamSubject, Score


class ClassAnalysisViewTests(BaseTestCase):
    """Integration tests for `score_analysis_class` covering single_class, class_comparison and grade_overall modes."""

    def setUp(self):
        super().setUp()
        self.class_a = Class.objects.create(grade_level='Grade8', class_name='1班')
        self.class_b = Class.objects.create(grade_level='Grade8', class_name='2班')
        self.class_c = Class.objects.create(grade_level='Grade8', class_name='3班')

        # class A: 两名学生
        sa1 = Student.objects.create(student_id='A001', name='A1', grade_level='Grade8', current_class=self.class_a)
        sa2 = Student.objects.create(student_id='A002', name='A2', grade_level='Grade8', current_class=self.class_a)

        # class B: 一名学生
        sb1 = Student.objects.create(student_id='B001', name='B1', grade_level='Grade8', current_class=self.class_b)

        # 创建考试与科目（两科，max_score 分别 100 和 150）
        self.exam = Exam.objects.create(name='分析考试2', academic_year='2024-2025', grade_level='Grade8', date=date(2025, 6, 15))
        ExamSubject.objects.create(exam=self.exam, subject_code='语文', subject_name='语文', max_score=100)
        ExamSubject.objects.create(exam=self.exam, subject_code='数学', subject_name='数学', max_score=150)

        # 为学生添加成绩：class A 两学生，class B 一学生
        # A1: 80 + 70 = 150
        Score.objects.create(student=sa1, exam=self.exam, subject='语文', score_value=80)
        Score.objects.create(student=sa1, exam=self.exam, subject='数学', score_value=70)

        # A2: 60 + 60 = 120
        Score.objects.create(student=sa2, exam=self.exam, subject='语文', score_value=60)
        Score.objects.create(student=sa2, exam=self.exam, subject='数学', score_value=60)

        # B1: 90 + 80 = 170
        Score.objects.create(student=sb1, exam=self.exam, subject='语文', score_value=90)
        Score.objects.create(student=sb1, exam=self.exam, subject='数学', score_value=80)

        self.url = reverse('students_grades:score_analysis_class')

    def test_single_class_analysis_returns_expected_stats_and_template(self):
        """当选择单个班级时，应返回 single_class 分析结果并使用 class 模板。"""
        params = {
            'academic_year': self.exam.academic_year,
            'exam': str(self.exam.id),
            'grade_level': 'Grade8',
            'selected_classes': str(self.class_a.id)
        }
        resp = self.client.get(self.url, params)
        self.assertEqual(resp.status_code, 200)

        # 单班级分析会直接渲染 scores/score_analysis_class.html
        templates = [t.name for t in resp.templates if t.name]
        self.assertIn('scores/score_analysis_class.html', templates)

        # context 中应包含 class 级别的统计字段
        self.assertIn('analysis_mode', resp.context)
        self.assertEqual(resp.context['analysis_mode'], 'single_class')
        # class_avg_total 根据我们输入的两个学生 (150 + 120) / 2 = 135
        self.assertAlmostEqual(resp.context.get('class_avg_total'), 135.0, places=2)

    def test_class_comparison_analysis_renders_multi_template_and_includes_classes(self):
        """选择多个班级应返回班级对比模板并包含所选班级统计。"""
        params = {
            'academic_year': self.exam.academic_year,
            'exam': str(self.exam.id),
            'grade_level': 'Grade8',
            'selected_classes': [str(self.class_a.id), str(self.class_b.id)]
        }
        resp = self.client.get(self.url, params)
        self.assertEqual(resp.status_code, 200)

        templates = [t.name for t in resp.templates if t.name]
        # 多班对比使用多班模板
        self.assertIn('scores/score_analysis_class_multi.html', templates)

        # context 应包含 analysis_mode 与 selected_classes
        self.assertIn('analysis_mode', resp.context)
        self.assertEqual(resp.context['analysis_mode'], 'class_comparison')
        self.assertIn('selected_classes', resp.context)
        # selected_classes 在 context 中应为 QuerySet 或 列表，包含我们传入的两个 class
        selected = resp.context['selected_classes']
        ids = {c.id for c in selected} if hasattr(selected, '__iter__') else set()
        self.assertTrue({self.class_a.id, self.class_b.id}.issubset(ids))

    def test_grade_overall_analysis_computes_total_max_score(self):
        """当传入 selected_classes=all 时，应进行年级整体分析并返回 total_max_score。"""
        params = {
            'academic_year': self.exam.academic_year,
            'exam': str(self.exam.id),
            'grade_level': 'Grade8',
            'selected_classes': 'all'
        }
        resp = self.client.get(self.url, params)
        self.assertEqual(resp.status_code, 200)

        # 年级整体分数最大值应等于两个科目的 max_score 之和 (100 + 150)
        self.assertIn('total_max_score', resp.context)
        self.assertEqual(resp.context['total_max_score'], 250)

    def test_score_analysis_class_with_nonexistent_exam(self):
        """传入不存在的 exam id 时，视图不应崩溃并应显示错误（实现使用 messages），返回页面且不包含 selected_exam。"""
        params = {
            'academic_year': self.exam.academic_year,
            'exam': '999999',  # 不存在的考试
            'grade_level': 'Grade8',
            'selected_classes': str(self.class_a.id)
        }
        resp = self.client.get(self.url, params)
        # 视图应返回 200 并且不包含 selected_exam
        self.assertEqual(resp.status_code, 200)
        self.assertNotIn('selected_exam', resp.context)

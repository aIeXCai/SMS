"""Redirect contract tests for student analysis routes."""
from datetime import date

from django.urls import reverse

from .test_base import BaseTestCase
from school_management.students_grades.models import Class, Student, Exam, ExamSubject, Score


class StudentAnalysisViewTests(BaseTestCase):
    """Verify legacy Django routes redirect to frontend analysis pages."""

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

    def test_score_analysis_student_no_filters_redirects_to_frontend(self):
        """学生分析首页应重定向到前端页面。"""
        resp = self.client.get(self.index_url)
        self.assertIn(resp.status_code, (301, 302))
        self.assertIn('/analysis/student', resp['Location'])

    def test_score_analysis_student_with_query_preserves_params(self):
        """带筛选参数访问时应重定向且保留 query string。"""
        params = {
            'grade_level': 'Grade8',
            'class_name': str(self.cls.id),
            'exam': str(self.exam.id),
            'academic_year': self.exam.academic_year,
        }
        resp = self.client.get(self.index_url, params)
        self.assertIn(resp.status_code, (301, 302))
        location = resp['Location']
        self.assertIn('/analysis/student', location)
        self.assertIn('grade_level=Grade8', location)
        self.assertIn(f'exam={self.exam.id}', location)

    def test_score_analysis_student_detail_missing_params_redirects(self):
        """缺少参数访问详情页也应重定向到前端详情路径。"""
        resp = self.client.get(self.detail_url)
        self.assertIn(resp.status_code, (302, 301))
        self.assertIn('/analysis/student/detail', resp['Location'])

    def test_score_analysis_student_detail_with_params_redirects(self):
        """完整参数访问详情页应重定向并保留参数。"""
        params = {
            'grade_level': 'Grade8',
            'class_name': f"{self.cls.grade_level}{self.cls.class_name}",
            'student_id': str(self.s1.id),
        }
        resp = self.client.get(self.detail_url, params)
        self.assertIn(resp.status_code, (301, 302))
        location = resp['Location']
        self.assertIn('/analysis/student/detail', location)
        self.assertIn(f'student_id={self.s1.id}', location)

    def test_score_analysis_student_detail_nonexistent_student_still_redirects(self):
        """重定向层不校验学生存在性，直接转发到前端详情。"""
        params = {
            'grade_level': 'Grade8',
            'class_name': f"{self.cls.grade_level}{self.cls.class_name}",
            'student_id': '999999',
        }
        resp = self.client.get(self.detail_url, params)
        self.assertIn(resp.status_code, (302, 301))
        self.assertIn('/analysis/student/detail', resp['Location'])

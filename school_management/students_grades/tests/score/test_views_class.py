"""Redirect contract tests for class/grade analysis routes."""

from django.urls import reverse

from .test_base import BaseTestCase


class ClassAnalysisViewTests(BaseTestCase):
    """Verify analysis entry routes now redirect to frontend pages."""

    def setUp(self):
        super().setUp()
        self.single_url = reverse('students_grades:class_grade_analysis_class')
        self.entry_url = reverse('students_grades:class_grade_analysis')
        self.grade_url = reverse('students_grades:class_grade_analysis_grade')

    def test_single_class_route_redirects_to_frontend(self):
        """单班分析入口应重定向到前端路径。"""
        params = {
            'academic_year': '2024-2025',
            'exam': '1',
            'grade_level': 'Grade8',
            'selected_classes': '2'
        }
        resp = self.client.get(self.single_url, params)
        self.assertIn(resp.status_code, (301, 302))
        location = resp['Location']
        self.assertIn('/analysis/class-grade/class', location)
        self.assertIn('selected_classes=2', location)

    def test_class_grade_entry_redirects_to_frontend(self):
        """班级/年级分析总入口应重定向到前端入口页。"""
        resp = self.client.get(self.entry_url)
        self.assertIn(resp.status_code, (301, 302))
        self.assertIn('/analysis/class-grade', resp['Location'])

    def test_grade_route_redirects_and_preserves_query(self):
        """年级分析入口应重定向并保留 query。"""
        params = {
            'academic_year': '2024-2025',
            'exam': '3',
            'grade_level': 'Grade8',
            'selected_classes': 'all'
        }
        resp = self.client.get(self.grade_url, params)
        self.assertIn(resp.status_code, (301, 302))
        location = resp['Location']
        self.assertIn('/analysis/class-grade/grade', location)
        self.assertIn('grade_level=Grade8', location)

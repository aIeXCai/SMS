"""AJAX endpoint tests for score analysis UI.

This file contains tests that call small JSON endpoints used by the frontend.
"""
from datetime import date
import json

from django.urls import reverse

from .test_base import BaseTestCase
from school_management.students_grades.models import Class, Student, Exam, ExamSubject, Score


class AjaxEndpointsTests(BaseTestCase):
    """Tests for small AJAX endpoints used by the analysis UI."""

    def test_get_classes_by_grade_returns_sorted_classes(self):
        """Should return classes for a grade ordered numerically by class name."""
        # 创建三个班级，名称包含数字以验证数字排序
        Class.objects.create(grade_level='Grade8', class_name='2班')
        Class.objects.create(grade_level='Grade8', class_name='10班')
        Class.objects.create(grade_level='Grade8', class_name='1班')

        url = reverse('students_grades:get_classes_by_grade')
        resp = self.client.get(url, {'grade_level': 'Grade8'})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        # 应包含 classes 列表并且 count 与长度一致
        self.assertIn('classes', data)
        self.assertEqual(data['count'], len(data['classes']))

        # 验证排序：按数字顺序 1,2,10
        names = [c['class_name'] for c in data['classes']]
        self.assertEqual(names, ['1班', '2班', '10班'])

    def test_get_classes_by_grade_missing_param_returns_400(self):
        url = reverse('students_grades:get_classes_by_grade')
        resp = self.client.get(url)  # 没有 grade_level
        self.assertEqual(resp.status_code, 400)

    def test_get_students_by_class_by_id_and_by_name(self):
        """Both class_id and class_name input paths should return the students list."""
        cls = Class.objects.create(grade_level='Grade9', class_name='3班')
        s1 = Student.objects.create(student_id='G9001', name='学生A', grade_level='Grade9', current_class=cls)
        s2 = Student.objects.create(student_id='G9002', name='学生B', grade_level='Grade9', current_class=cls)

        url = reverse('students_grades:get_students_by_class')

        # 使用 class_id 查询
        resp1 = self.client.get(url, {'grade_level': 'Grade9', 'class_id': str(cls.id)})
        self.assertEqual(resp1.status_code, 200)
        data1 = resp1.json()
        self.assertEqual(data1['count'], 2)
        ids1 = {s['student_id'] for s in data1['students']}
        self.assertSetEqual(ids1, {s1.student_id, s2.student_id})

        # 使用 class_name 查询
        resp2 = self.client.get(url, {'grade_level': 'Grade9', 'class_name': '3班'})
        self.assertEqual(resp2.status_code, 200)
        data2 = resp2.json()
        ids2 = {s['student_id'] for s in data2['students']}
        self.assertSetEqual(ids2, {s1.student_id, s2.student_id})

    def test_get_students_by_class_missing_grade_returns_400(self):
        url = reverse('students_grades:get_students_by_class')
        resp = self.client.get(url, {})
        self.assertEqual(resp.status_code, 400)

    def test_get_grades_ajax_returns_list_or_defaults(self):
        # 创建一些学生以便返回年级列表
        Student.objects.create(student_id='A1', name='A1', grade_level='Grade7')
        Student.objects.create(student_id='B1', name='B1', grade_level='Grade8')

        url = reverse('students_grades:get_grades_ajax')
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn('grades', data)
        self.assertGreaterEqual(data['count'], 1)

    def test_get_classes_by_grade_handles_non_digit_names(self):
        """班级名称不含数字时不应抛出错误，且返回的 count 正确。"""
        # 创建一些无数字的班级名
        Class.objects.create(grade_level='GradeX', class_name='一班')
        Class.objects.create(grade_level='GradeX', class_name='二班')
        Class.objects.create(grade_level='GradeX', class_name='A班')

        url = reverse('students_grades:get_classes_by_grade')
        resp = self.client.get(url, {'grade_level': 'GradeX'})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data['count'], 3)

    def test_get_students_by_class_nonexistent_returns_empty(self):
        """传入不存在的 class_id 时应返回空 students 列表而不是 500 错误。"""
        url = reverse('students_grades:get_students_by_class')
        resp = self.client.get(url, {'grade_level': 'Grade9', 'class_id': '999999'})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn('students', data)
        self.assertEqual(data['count'], 0)

    def test_get_grades_ajax_returns_defaults_when_no_students(self):
        """当系统中没有学生时，接口应返回默认年级列表（实现退化分支）。"""
        url = reverse('students_grades:get_grades_ajax')
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertGreaterEqual(data['count'], 1)
        values = [g['value'] for g in data['grades']]
        self.assertTrue(any(v.startswith('Grade1') for v in values))


class StudentAnalysisAjaxTests(BaseTestCase):
    """Tests for the get_student_analysis_data AJAX endpoint."""

    def setUp(self):
        super().setUp()
        self.cls = Class.objects.create(grade_level='Grade8', class_name='1班')
        self.student = Student.objects.create(student_id='SA01', name='分析生', grade_level='Grade8', current_class=self.cls)
        self.exam = Exam.objects.create(name='分析考试', academic_year='2024-2025', grade_level='Grade8', date=date(2025, 6, 10))
        ExamSubject.objects.create(exam=self.exam, subject_code='语文', subject_name='语文', max_score=150)
        ExamSubject.objects.create(exam=self.exam, subject_code='数学', subject_name='数学', max_score=150)

        # 给学生两科成绩
        Score.objects.create(student=self.student, exam=self.exam, subject='语文', score_value=80)
        Score.objects.create(student=self.student, exam=self.exam, subject='数学', score_value=70)

        self.url = reverse('students_grades:get_student_analysis_data')

    def test_get_student_analysis_data_missing_params(self):
        # 缺 student_id
        resp = self.client.get(self.url, {})
        self.assertEqual(resp.status_code, 400)

        # 缺 exam_id/exam_ids
        resp2 = self.client.get(self.url, {'student_id': str(self.student.id)})
        self.assertEqual(resp2.status_code, 400)

    def test_get_student_analysis_data_returns_expected_structure(self):
        resp = self.client.get(self.url, {'student_id': str(self.student.id), 'exam_id': str(self.exam.id)})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data.get('success'))
        payload = data.get('data')
        # 基本结构
        self.assertIn('student_info', payload)
        self.assertIn('exams', payload)
        self.assertEqual(len(payload['exams']), 1)

        exam_entry = payload['exams'][0]
        # total_score 应等于两科之和
        self.assertAlmostEqual(exam_entry['total_score'], 150.0, places=1)
        # scores 列表长度为 2（语文、数学）
        self.assertEqual(len(exam_entry['scores']), 2)
        # 检查 trend_data 中的 total scores 长度与 exams 数一致
        self.assertIn('total', payload['trend_data'])
        self.assertEqual(len(payload['trend_data']['total']['scores']), 1)

    def test_get_student_analysis_data_with_multiple_exam_ids(self):
        """API 应该支持传入逗号分隔的多个 exam_ids 并返回对应数量的 exam 数据。"""
        # 创建第二个考试并为同一学生添加分数
        exam2 = Exam.objects.create(name='分析考试2', academic_year='2024-2025', grade_level='Grade8', date=date(2025, 7, 1))
        ExamSubject.objects.create(exam=exam2, subject_code='语文', subject_name='语文', max_score=100)
        Score.objects.create(student=self.student, exam=exam2, subject='语文', score_value=75)

        resp = self.client.get(self.url, {'student_id': str(self.student.id), 'exam_ids': f"{self.exam.id},{exam2.id}"})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data.get('success'))
        payload = data.get('data')
        # 返回 exams 数应为两个
        self.assertEqual(len(payload.get('exams', [])), 2)
        # total trend长度与 exams 数一致
        self.assertEqual(len(payload['trend_data']['total']['scores']), 2)

    def test_get_student_analysis_data_returns_404_for_nonexistent_exams(self):
        """当传入不存在的 exam_ids 时，应返回 404（实现中如未找到考试返回 404）。"""
        resp = self.client.get(self.url, {'student_id': str(self.student.id), 'exam_ids': '999999'})
        self.assertEqual(resp.status_code, 404)

    def test_get_student_analysis_data_percentage_calculation(self):
        """验证 percentage 字段正确计算：score / full_score * 100 并四舍五入到 1 位小数。"""
        # 新建一个考试与科目，设置 max_score 不同于默认
        exam3 = Exam.objects.create(name='PctExam', academic_year='AY', grade_level='Grade8', date=date(2025, 8, 1))
        ExamSubject.objects.create(exam=exam3, subject_code='自定义科目', subject_name='自定义科目', max_score=200)
        Score.objects.create(student=self.student, exam=exam3, subject='自定义科目', score_value=50)

        resp = self.client.get(self.url, {'student_id': str(self.student.id), 'exam_id': str(exam3.id)})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        payload = data.get('data')
        exam_entry = payload['exams'][0]
        self.assertEqual(len(exam_entry['scores']), 1)
        pct = exam_entry['scores'][0]['percentage']
        self.assertAlmostEqual(pct, round(50 / 200 * 100, 1), places=1)

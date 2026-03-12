"""API endpoint tests for score-related AJAX/data APIs (post-migration)."""
from datetime import date

from .test_base import BaseTestCase
from school_management.students_grades.models import Class, Student, Exam, ExamSubject, Score


class ApiEndpointsTests(BaseTestCase):
    """Tests for new API endpoints under /api/*."""

    def test_classes_api_filters_by_grade(self):
        Class.objects.create(grade_level='初二', class_name='2班')
        Class.objects.create(grade_level='初二', class_name='10班')
        Class.objects.create(grade_level='初三', class_name='1班')

        resp = self.client.get('/api/classes/', {'grade_level': '初二'})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(isinstance(data, list))
        self.assertGreaterEqual(len(data), 2)
        self.assertTrue(all(item['grade_level'] == '初二' for item in data))

    def test_students_api_filters_by_class_and_grade(self):
        cls = Class.objects.create(grade_level='初三', class_name='3班')
        Student.objects.create(student_id='G9001', name='学生A', grade_level='初三', current_class=cls)
        Student.objects.create(student_id='G9002', name='学生B', grade_level='初三', current_class=cls)

        resp = self.client.get('/api/students/', {
            'current_class__grade_level': '初三',
            'current_class__class_name': '3班'
        })
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(isinstance(data, list))
        ids = {item['student_id'] for item in data}
        self.assertSetEqual(ids, {'G9001', 'G9002'})

    def test_scores_options_api_returns_filter_options(self):
        resp = self.client.get('/api/scores/options/')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn('grade_levels', data)
        self.assertIn('subjects', data)
        self.assertIn('sort_by_options', data)


class StudentAnalysisApiTests(BaseTestCase):
    """Tests for /api/scores/student-analysis-data/."""

    def setUp(self):
        super().setUp()
        self.cls = Class.objects.create(grade_level='Grade8', class_name='1班')
        self.student = Student.objects.create(student_id='SA01', name='分析生', grade_level='Grade8', current_class=self.cls)
        self.exam = Exam.objects.create(name='分析考试', academic_year='2024-2025', grade_level='Grade8', date=date(2025, 6, 10))
        ExamSubject.objects.create(exam=self.exam, subject_code='语文', subject_name='语文', max_score=150)
        ExamSubject.objects.create(exam=self.exam, subject_code='数学', subject_name='数学', max_score=150)
        Score.objects.create(student=self.student, exam=self.exam, subject='语文', score_value=80)
        Score.objects.create(student=self.student, exam=self.exam, subject='数学', score_value=70)

    def test_student_analysis_data_missing_student_id_returns_400(self):
        resp = self.client.get('/api/scores/student-analysis-data/')
        self.assertEqual(resp.status_code, 400)

    def test_student_analysis_data_returns_expected_payload(self):
        resp = self.client.get('/api/scores/student-analysis-data/', {
            'student_id': str(self.student.id),
            'exam_id': str(self.exam.id),
        })
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertTrue(body.get('success'))
        payload = body['data']
        self.assertIn('student_info', payload)
        self.assertIn('exams', payload)
        self.assertEqual(len(payload['exams']), 1)
        self.assertIn('trend_data', payload)
        self.assertIn('total', payload['trend_data'])

"""API endpoint tests for score-related AJAX/data APIs (post-migration)."""
from datetime import date

from django.contrib.auth import get_user_model

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


class ScoreScopeApiTests(BaseTestCase):
    def setUp(self):
        super().setUp()
        User = get_user_model()

        self.junior_class = Class.objects.create(grade_level='初三', cohort='初中2026级', class_name='3班')
        self.senior_class = Class.objects.create(grade_level='高一', cohort='高中2026级', class_name='7班')

        self.junior_student = Student.objects.create(
            student_id='JS001',
            name='初三学生',
            grade_level='初三',
            cohort='初中2026级',
            current_class=self.junior_class,
        )
        self.senior_student = Student.objects.create(
            student_id='SS001',
            name='高一学生',
            grade_level='高一',
            cohort='高中2026级',
            current_class=self.senior_class,
        )

        self.junior_exam = Exam.objects.create(
            name='初三联考',
            academic_year='2025-2026',
            grade_level='初中2026级',
            date=date(2026, 3, 10),
        )
        self.senior_exam = Exam.objects.create(
            name='高一月考',
            academic_year='2025-2026',
            grade_level='高中2026级',
            date=date(2026, 3, 11),
        )
        ExamSubject.objects.create(exam=self.junior_exam, subject_code='语文', subject_name='语文', max_score=150)
        ExamSubject.objects.create(exam=self.senior_exam, subject_code='语文', subject_name='语文', max_score=150)

        Score.objects.create(student=self.junior_student, exam=self.junior_exam, subject='语文', score_value=88)
        Score.objects.create(student=self.senior_student, exam=self.senior_exam, subject='语文', score_value=91)

        self.grade_manager = User.objects.create_user(
            username='grade_scope_user',
            password='test-pass-123',
            role='grade_manager',
            managed_grade='初三',
        )
        self.subject_teacher = User.objects.create_user(
            username='teacher_scope_user',
            password='test-pass-123',
            role='subject_teacher',
        )
        self.subject_teacher.teaching_classes.add(self.junior_class)
        self.admin_user = User.objects.create_user(
            username='admin_scope_user',
            password='test-pass-123',
            role='admin',
        )

    def test_grade_manager_scores_list_is_limited_to_managed_grade(self):
        self.client.force_login(self.grade_manager)

        resp = self.client.get('/api/scores/')
        self.assertEqual(resp.status_code, 200)

        body = resp.json()
        self.assertEqual(body['count'], 1)
        self.assertEqual(body['results'][0]['student']['student_id'], 'JS001')
        self.assertEqual(body['results'][0]['exam']['name'], '初三联考')

    def test_subject_teacher_scores_options_and_search_are_limited_to_teaching_classes(self):
        self.client.force_login(self.subject_teacher)

        options_resp = self.client.get('/api/scores/options/')
        self.assertEqual(options_resp.status_code, 200)
        options_data = options_resp.json()
        self.assertEqual([item['value'] for item in options_data['grade_levels']], ['初中2026级'])
        self.assertEqual([item['value'] for item in options_data['class_name_choices']], ['3班'])
        self.assertEqual([item['value'] for item in options_data['exams']], [str(self.junior_exam.id)])

        search_resp = self.client.get('/api/scores/student-search/', {'q': '学生'})
        self.assertEqual(search_resp.status_code, 200)
        search_data = search_resp.json()
        self.assertEqual(len(search_data['results']), 1)
        self.assertEqual(search_data['results'][0]['student_id'], 'JS001')

    def test_admin_scores_list_is_unrestricted(self):
        self.client.force_login(self.admin_user)

        resp = self.client.get('/api/scores/')
        self.assertEqual(resp.status_code, 200)

        body = resp.json()
        # Admin sees all 2 scores (unrestricted)
        self.assertEqual(body['count'], 2)
        student_ids = {r['student']['student_id'] for r in body['results']}
        self.assertEqual(student_ids, {'JS001', 'SS001'})

    def test_admin_options_shows_all_grade_levels_and_classes(self):
        self.client.force_login(self.admin_user)

        options_resp = self.client.get('/api/scores/options/')
        self.assertEqual(options_resp.status_code, 200)
        options_data = options_resp.json()

        # Admin sees both cohorts
        grade_level_values = [item['value'] for item in options_data['grade_levels']]
        self.assertIn('初中2026级', grade_level_values)
        self.assertIn('高中2026级', grade_level_values)

        # Admin sees both class names
        class_name_values = [item['value'] for item in options_data['class_name_choices']]
        self.assertIn('3班', class_name_values)
        self.assertIn('7班', class_name_values)

        # Admin sees both exams
        exam_ids = [item['value'] for item in options_data['exams']]
        self.assertIn(str(self.junior_exam.id), exam_ids)
        self.assertIn(str(self.senior_exam.id), exam_ids)

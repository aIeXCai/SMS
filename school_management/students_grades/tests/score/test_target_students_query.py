import json
from datetime import date

from django.contrib.auth import get_user_model
from django.test import Client, TestCase

from school_management.students_grades.models import Class, Exam, ExamSubject, Score, Student


class TargetStudentsQueryApiTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.url = '/api/scores/target-students-query/'

        User = get_user_model()
        self.user = User.objects.create_user(
            username='target_students_user',
            password='test-pass-123',
            role='staff',
        )

        self.class_2_1 = Class.objects.create(grade_level='初二', class_name='1班')

        self.student_a = Student.objects.create(
            student_id='T001',
            name='甲同学',
            grade_level='初二',
            current_class=self.class_2_1,
            status='在读',
        )
        self.student_b = Student.objects.create(
            student_id='T002',
            name='乙同学',
            grade_level='初二',
            current_class=self.class_2_1,
            status='在读',
        )
        self.student_c = Student.objects.create(
            student_id='T003',
            name='丙同学',
            grade_level='初二',
            current_class=self.class_2_1,
            status='在读',
        )

        self.exam_a = Exam.objects.create(
            name='初二第一次月考',
            academic_year='2025-2026',
            grade_level='初二',
            date=date(2025, 9, 10),
        )
        self.exam_b = Exam.objects.create(
            name='初二第二次月考',
            academic_year='2025-2026',
            grade_level='初二',
            date=date(2025, 10, 12),
        )
        self.exam_c = Exam.objects.create(
            name='初二期中考试',
            academic_year='2025-2026',
            grade_level='初二',
            date=date(2025, 11, 15),
        )

        for exam in (self.exam_a, self.exam_b, self.exam_c):
            ExamSubject.objects.create(exam=exam, subject_code='语文', subject_name='语文', max_score=140)

        # 学生A：三次都前50
        self._create_ranked_score(self.student_a, self.exam_a, 10)
        self._create_ranked_score(self.student_a, self.exam_b, 15)
        self._create_ranked_score(self.student_a, self.exam_c, 20)

        # 学生B：前两次前50，第三次缺考
        self._create_ranked_score(self.student_b, self.exam_a, 30)
        self._create_ranked_score(self.student_b, self.exam_b, 40)

        # 学生C：都不在前50
        self._create_ranked_score(self.student_c, self.exam_a, 80)
        self._create_ranked_score(self.student_c, self.exam_b, 85)
        self._create_ranked_score(self.student_c, self.exam_c, 90)

    def _create_ranked_score(self, student, exam, total_rank):
        Score.objects.create(
            student=student,
            exam=exam,
            subject='语文',
            score_value=100,
            total_score_rank_in_grade=total_rank,
        )

    def _post_json(self, payload):
        return self.client.post(self.url, data=json.dumps(payload), content_type='application/json')

    def _base_payload(self):
        return {
            'grade_level': '初二',
            'exam_scope': {'type': 'all_in_grade'},
            'metric': 'total_score_rank_in_grade',
            'operator': 'lte',
            'threshold': 50,
            'quantifier': 'all',
            'k': None,
            'absent_policy': 'strict_fail',
        }

    def test_requires_authentication(self):
        response = self._post_json(self._base_payload())
        self.assertIn(response.status_code, (401, 403))

    def test_all_with_strict_fail(self):
        self.client.force_login(self.user)

        response = self._post_json(self._base_payload())
        self.assertEqual(response.status_code, 200)

        data = response.json()['data']
        self.assertEqual(data['exam_count'], 3)
        self.assertEqual(data['matched_count'], 1)
        self.assertEqual(data['students'][0]['student_id'], 'T001')

    def test_all_with_ignore_absent(self):
        self.client.force_login(self.user)

        payload = self._base_payload()
        payload['absent_policy'] = 'ignore_absent'

        response = self._post_json(payload)
        self.assertEqual(response.status_code, 200)

        data = response.json()['data']
        ids = {item['student_id'] for item in data['students']}
        self.assertEqual(ids, {'T001', 'T002'})

    def test_at_least_with_ignore_absent(self):
        self.client.force_login(self.user)

        payload = self._base_payload()
        payload['quantifier'] = 'at_least'
        payload['k'] = 2
        payload['absent_policy'] = 'ignore_absent'

        response = self._post_json(payload)
        self.assertEqual(response.status_code, 200)

        data = response.json()['data']
        ids = {item['student_id'] for item in data['students']}
        self.assertEqual(ids, {'T001', 'T002'})

    def test_invalid_k_for_strict_fail_returns_400(self):
        self.client.force_login(self.user)

        payload = self._base_payload()
        payload['quantifier'] = 'at_least'
        payload['k'] = 4

        response = self._post_json(payload)
        self.assertEqual(response.status_code, 400)

        body = response.json()
        self.assertFalse(body['success'])
        self.assertIn('k', body['error'])

    def test_empty_exam_scope_returns_400(self):
        self.client.force_login(self.user)

        payload = self._base_payload()
        payload['exam_scope'] = {
            'type': 'date_range',
            'date_from': '2030-01-01',
            'date_to': '2030-12-31',
        }

        response = self._post_json(payload)
        self.assertEqual(response.status_code, 400)

        body = response.json()
        self.assertFalse(body['success'])
        self.assertIn('无考试', body['error'])

    def test_pagination_works(self):
        self.client.force_login(self.user)

        payload = self._base_payload()
        payload['absent_policy'] = 'ignore_absent'
        payload['page_size'] = 1
        payload['page'] = 1

        response = self._post_json(payload)
        self.assertEqual(response.status_code, 200)

        data = response.json()['data']
        self.assertIn('pagination', data)
        self.assertEqual(data['pagination']['page'], 1)
        self.assertEqual(data['pagination']['page_size'], 1)
        self.assertEqual(data['pagination']['total'], 2)
        self.assertEqual(data['pagination']['num_pages'], 2)
        self.assertEqual(len(data['students']), 1)

    def test_invalid_page_size_returns_400(self):
        self.client.force_login(self.user)

        payload = self._base_payload()
        payload['page_size'] = 2001

        response = self._post_json(payload)
        self.assertEqual(response.status_code, 400)

        body = response.json()
        self.assertFalse(body['success'])
        self.assertIn('page_size', body['error'])

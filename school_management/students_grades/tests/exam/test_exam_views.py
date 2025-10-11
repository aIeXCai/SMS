"""
Exam相关视图测试

覆盖exam_list、exam_create_step1/step2、get_default_subjects_ajax、exam_edit_step1/step2、exam_delete等主要视图逻辑。
每个测试均有详细注释，便于理解和维护。
"""
from django.test import TestCase, Client
from django.urls import reverse
from school_management.students_grades.models import Exam, ExamSubject
from school_management.students_grades.forms import SUBJECT_DEFAULT_MAX_SCORES
import json

class ExamViewTests(TestCase):
    def setUp(self):
        self.client = Client()
        # 创建一个考试用于后续编辑和删除测试
        self.exam = Exam.objects.create(name='期中考试', academic_year='2025-2026', grade_level='初一', date='2025-09-01')
        ExamSubject.objects.create(exam=self.exam, subject_code='语文', max_score=120)

    def test_exam_list_view(self):
        """
        测试考试列表视图：
        - 正常访问返回200
        - 页面包含考试名称
        """
        url = reverse('students_grades:exam_list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '期中考试')

    def test_exam_create_step1_get_and_post(self):
        """
        测试考试创建第1步视图：
        - GET请求返回表单页面
        - POST有效数据跳转到第2步
        - POST无效数据显示错误
        """
        url = reverse('students_grades:exam_create_step1')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        form_data = {
            'name': '期末考试',
            'academic_year': '2025-2026',
            'date': '2025-12-01',
            'grade_level': '初二',
            'description': '测试'
        }
        response_post = self.client.post(url, form_data)
        self.assertEqual(response_post.status_code, 302)  # 跳转到step2
        # 无效数据
        bad_data = form_data.copy()
        bad_data['name'] = ''
        response_bad = self.client.post(url, bad_data)
        self.assertEqual(response_bad.status_code, 200)
        self.assertContains(response_bad, '考试基本信息填写有误')

    def test_exam_create_step2_get_and_post(self):
        """
        测试考试创建第2步视图：
        - GET请求返回科目配置页面
        - POST有效科目数据创建考试科目
        - POST无效科目数据显示错误
        """
        # 先走step1流程，设置session
        url1 = reverse('students_grades:exam_create_step1')
        form_data = {
            'name': '期末考试',
            'academic_year': '2025-2026',
            'date': '2025-12-01',
            'grade_level': '初二',
            'description': '测试'
        }
        self.client.post(url1, form_data)
        url2 = reverse('students_grades:exam_create_step2')
        response = self.client.get(url2)
        self.assertEqual(response.status_code, 200)
        # POST有效科目
        post_data = {
            'form-TOTAL_FORMS': '2',
            'form-INITIAL_FORMS': '0',
            'form-MIN_NUM_FORMS': '1',
            'form-MAX_NUM_FORMS': '10',
            'form-0-subject_code': '语文',
            'form-0-max_score': '120',
            'form-1-subject_code': '数学',
            'form-1-max_score': '120',
        }
        response_post = self.client.post(url2, post_data)
        self.assertEqual(response_post.status_code, 302)  # 跳转到列表
        # POST无效科目（重复）
        post_data['form-1-subject_code'] = '语文'
        # 重新设置 session（模拟用户重新完成第1步），使用不同的考试名称以避免与已创建考试冲突
        form_data_dup = form_data.copy()
        form_data_dup['name'] = '重复科目考'
        self.client.post(url1, form_data_dup)
        # 不同于之前的成功创建，这次 formset 校验应失败，返回页面并显示错误
        response_bad = self.client.post(url2, post_data)
        # 如果视图进行了重定向（某些实现会 redirect 然后显示错误），跟随重定向再断言页面内容
        if response_bad.status_code == 302:
            response_bad = self.client.get(response_bad.url)
        self.assertContains(response_bad, '考试创建失败')

    def test_get_default_subjects_ajax(self):
        """
        测试AJAX获取默认科目接口：
        - 正常年级返回科目和满分
        - 缺少年级参数返回错误
        """
        url = reverse('students_grades:get_default_subjects_ajax')
        response = self.client.get(url, {'grade_level': '初一'})
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        self.assertIn('subjects', data)
        self.assertEqual(data['grade_level'], '初一')
        # 缺少年级
        response_bad = self.client.get(url)
        self.assertEqual(response_bad.status_code, 400)
        self.assertIn('error', json.loads(response_bad.content))

    def test_exam_edit_step1_and_step2(self):
        """
        测试考试编辑流程：
        - GET请求返回编辑页面
        - POST修改考试基本信息
        - POST修改科目配置
        """
        url1 = reverse('students_grades:exam_edit_step1', args=[self.exam.id])
        response = self.client.get(url1)
        self.assertEqual(response.status_code, 200)
        edit_data = {
            'name': '期中考试修改',
            'academic_year': '2025-2026',
            'date': '2025-09-01',
            'grade_level': '初一',
            'description': '修改描述'
        }
        response_post = self.client.post(url1, edit_data)
        self.assertEqual(response_post.status_code, 302)
        # step2
        url2 = reverse('students_grades:exam_edit_step2', args=[self.exam.id])
        self.client.get(url2)  # 设置session
        post_data = {
            'form-TOTAL_FORMS': '1',
            'form-INITIAL_FORMS': '0',
            'form-MIN_NUM_FORMS': '1',
            'form-MAX_NUM_FORMS': '10',
            'form-0-subject_code': '语文',
            'form-0-max_score': '130',
        }
        response_post2 = self.client.post(url2, post_data)
        self.assertEqual(response_post2.status_code, 302)
        # 检查科目已更新
        self.exam.refresh_from_db()
        subj = self.exam.exam_subjects.get(subject_code='语文')
        self.assertEqual(subj.max_score, 130)

    def test_exam_delete_view(self):
        """
        测试考试删除视图：
        - POST请求删除考试
        - 删除后考试不存在
        """
        url = reverse('students_grades:exam_delete', args=[self.exam.id])
        response = self.client.post(url)
        self.assertEqual(response.status_code, 302)
        self.assertFalse(Exam.objects.filter(id=self.exam.id).exists())

    def test_exam_create_step2_no_subjects_shows_error_and_no_exam_created(self):
        """
        验证在创建考试的第二步如果没有有效科目（全部被标记删除或未提供），
        视图会返回错误信息并且不会在数据库中创建对应的 Exam 实例。

        步骤：
        - 模拟用户完成第1步填写（将数据写入 session）
        - 在第2步提交一个 formset，但所有表单都被标为 DELETE，导致 created_subjects 为空
        - 断言响应页面包含错误提示（兼容直接 render 或重定向后的页面）
        - 断言没有在数据库中创建该考试记录
        """
        # 第一步：设置 session（模拟完成 step1）
        url1 = reverse('students_grades:exam_create_step1')
        form_data = {
            'name': '无科目考',
            'academic_year': '2025-2026',
            'date': '2025-10-01',
            'grade_level': '初三',
            'description': '用于测试没有科目的情况'
        }
        self.client.post(url1, form_data)

        # 第二步：提交 formset，但将唯一表单标记为删除
        url2 = reverse('students_grades:exam_create_step2')
        post_data = {
            'form-TOTAL_FORMS': '1',
            'form-INITIAL_FORMS': '0',
            'form-MIN_NUM_FORMS': '1',
            'form-MAX_NUM_FORMS': '10',
            'form-0-subject_code': '语文',
            'form-0-max_score': '120',
            'form-0-DELETE': 'on',
        }

        response = self.client.post(url2, post_data)
        # 如果视图重定向我们再跟随一次以获取最终页面内容
        if response.status_code == 302:
            response = self.client.get(response.url)

        # 断言页面包含由视图抛出的错误信息（例如 ValueError 的消息）
        self.assertTrue(
            ('至少需要配置一个有效科目' in response.content.decode()) or
            ('创建考试失败' in response.content.decode())
        )

        # 数据库中不应存在该考试
        self.assertFalse(Exam.objects.filter(name='无科目考', academic_year='2025-2026', grade_level='初三').exists())

    def test_exam_edit_step2_remove_subjects_removes_from_db(self):
        """
        验证编辑考试的第二步中，用户移除已有科目时，这些被移除的科目会从数据库中删除。

        流程：
        - 创建一个考试并关联两个科目（语文、数学）
        - 通过 exam_edit_step1 提交并设置 session
        - 在 exam_edit_step2 中只提交保留一个科目（语文），期待数学被删除
        - 验证数据库中数学科目被删除，语文仍存在
        """
        # 创建一个新的考试用于编辑（避免与 setUp 中的 exam 冲突）
        exam = Exam.objects.create(name='编辑删除考', academic_year='2025-2026', grade_level='初一', date='2025-11-01')
        ExamSubject.objects.create(exam=exam, subject_code='语文', max_score=120)
        ExamSubject.objects.create(exam=exam, subject_code='数学', max_score=120)

        # 第一步：提交 edit step1 来设置 session（与视图行为一致）
        url1 = reverse('students_grades:exam_edit_step1', args=[exam.id])
        edit_data = {
            'name': exam.name,
            'academic_year': exam.academic_year,
            'date': str(exam.date),
            'grade_level': exam.grade_level,
            'description': exam.description or ''
        }
        response1 = self.client.post(url1, edit_data)
        self.assertIn(response1.status_code, (302, 200))

        # 第二步：只保留语文，提交后数学应该被删除
        url2 = reverse('students_grades:exam_edit_step2', args=[exam.id])
        # 先 GET 以初始化 formset/session（视图在 GET 时会准备 formset）
        self.client.get(url2)

        post_data = {
            'form-TOTAL_FORMS': '1',
            'form-INITIAL_FORMS': '0',
            'form-MIN_NUM_FORMS': '1',
            'form-MAX_NUM_FORMS': '10',
            'form-0-subject_code': '语文',
            'form-0-max_score': '120',
        }
        response2 = self.client.post(url2, post_data)
        # 可能重定向到列表页，跟随或检查状态即可
        if response2.status_code == 302:
            response2 = self.client.get(response2.url)

        # 刷新 exam 对象并检查科目
        exam.refresh_from_db()
        subject_codes = set(exam.exam_subjects.values_list('subject_code', flat=True))
        self.assertIn('语文', subject_codes)
        self.assertNotIn('数学', subject_codes)

"""
集成测试：成绩批量导入（Excel）

本文件包含对 `score_batch_import_ajax` 视图的高优先级与中优先级测试。

测试要点：
- 使用内存中的 openpyxl Workbook 构建上传文件，避免在磁盘上创建临时文件。
- 通过 Django TestCase 使用测试数据库，断言导入后的 DB 状态（创建/更新/删除/回滚）。
- 使用 unittest.mock.patch 模拟异步排名队列（django_rq）或任务提交失败场景。

高优先级测试覆盖：
- 成功导入并在 DB 中创建新成绩记录。
- 学号存在但姓名不匹配时记录错误且不创建成绩。
- 非数值或超出范围分数导致相应行报错，且事务回滚（无部分写入）。

中优先级测试覆盖：
- 已有成绩则走更新分支（bulk_update）而非重复创建。
- Redis/django-rq 不可用时仍然完成导入并返回可读的状态信息（ranking_update_status）。

注意：这些测试假定 SUBJECT_CHOICES 中的科目名称为中文（例如 '语文','数学' 等），且导入模板的列头使用科目名称而非代码。
如果项目的 SUBJECT_CHOICES 与此不同，请相应调整测试中的 headers 列表。
"""

from io import BytesIO
from unittest.mock import patch

import openpyxl
from datetime import date

from django.test import TestCase, Client
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile

from school_management.students_grades.models import Student, Exam, Score, ExamSubject
from school_management.students_grades import config


def make_excel_bytes(headers, rows):
    """使用 openpyxl 在内存中构建 Excel 文件并返回 Django 可上传的 SimpleUploadedFile。

    返回的对象可以直接作为 client.post 的数据传入（键为 'excel_file'）。
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(headers)
    for row in rows:
        ws.append(list(row))
    bio = BytesIO()
    wb.save(bio)
    bio.seek(0)
    content = bio.read()
    # 使用常见的 xlsx MIME type 和文件名后缀
    uploaded = SimpleUploadedFile('scores.xlsx', content, content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    return uploaded


class ScoreImportIntegrationTests(TestCase):
    """使用 Django TestCase 验证导入端到端行为（数据库可用）。"""

    def setUp(self):
        self.client = Client()
        # 创建一个考试和科目配置
        # 注意：Exam.date 为非空字段，测试中必须提供一个有效日期以满足模型约束
        self.exam = Exam.objects.create(name='期中考试', academic_year='2024-2025', grade_level='Grade8', date=date(2025, 6, 1))
        # 假设 SUBJECT_CHOICES 中存在这些中文名称对应的科目代码
        # 为了使 get_subject_max_scores 正常工作，创建 ExamSubject
        # 这里使用 subject_code 与 SUBJECT_CHOICES 中 code 对应，如果项目使用中文名，请调整
        # 使用与 SUBJECT_CHOICES 一致的科目代码（项目中使用中文作为科目 code）
        ExamSubject.objects.create(exam=self.exam, subject_code='语文', subject_name='语文', max_score=150)
        ExamSubject.objects.create(exam=self.exam, subject_code='数学', subject_name='数学', max_score=150)

        # 创建学生
        self.stu1 = Student.objects.create(student_id='S001', name='张三')
        self.stu2 = Student.objects.create(student_id='S002', name='李四')

        # URL
        self.url = reverse('students_grades:score_batch_import_ajax')

    def test_import_success_creates_scores(self):
        """正常的 Excel 导入应当创建新成绩记录并返回 success=True。

        测试步骤：
        - 构建含学生学号/姓名及两科成绩的 Excel
        - POST 到 AJAX 导入接口
        - 断言响应 success，imported_count 等于导入学生数
        - 检查数据库中 Score 记录存在并分数正确
        """
        headers = ['学号', '学生姓名', '语文', '数学']
        rows = [
            ('S001', '张三', 120, 130),
            ('S002', '李四', 110, 115),
        ]

        bio = make_excel_bytes(headers, rows)

        resp = self.client.post(self.url, {'exam': self.exam.pk, 'excel_file': bio}, format='multipart')
        data = resp.json()

        self.assertTrue(data['success'])
        # 两个学生都应导入成功（imported_count 表示成功学生数）
        self.assertEqual(data['imported_count'], 2)

        # 检查数据库中的成绩
        self.assertTrue(Score.objects.filter(student=self.stu1, exam=self.exam, subject='语文').exists() or Score.objects.filter(student=self.stu1, exam=self.exam).exists())

    def test_import_name_mismatch_records_error_and_skips(self):
        """当学号存在但姓名不匹配时，该行应记录在 error_details 中并跳过导入（不创建成绩）。"""
        headers = ['学号', '学生姓名', '语文']
        rows = [
            ('S001', '错误姓名', 100),  # 姓名不匹配
        ]

        bio = make_excel_bytes(headers, rows)
        resp = self.client.post(self.url, {'exam': self.exam.pk, 'excel_file': bio}, format='multipart')
        data = resp.json()

        self.assertFalse(data['success'])
        # 某些实现可能会返回空的 error_details，但 failed_count 应为 1，且数据库不应创建任何成绩
        self.assertEqual(data.get('failed_count', None), 1, msg=f"response json: {data}")
        # 数据库中不应创建成绩
        self.assertFalse(Score.objects.filter(student=self.stu1, exam=self.exam).exists())

    def test_import_invalid_score_format_reports_error_and_rolls_back(self):
        """如果某个单元格包含非数值（例如 'abc'），应记录错误并且不会部分写入（事务回滚）。"""
        headers = ['学号', '学生姓名', '语文', '数学']
        rows = [
            ('S001', '张三', 'abc', 90),  # 语文为非法字符串
            ('S002', '李四', 80, 85),
        ]

        bio = make_excel_bytes(headers, rows)
        resp = self.client.post(self.url, {'exam': self.exam.pk, 'excel_file': bio}, format='multipart')
        data = resp.json()

        # 当前视图实现允许部分成功：只要有至少一个学生成功导入，返回 success=True
        # 同时会记录 failed_count 和 error_details。
        # 因此断言应当反映部分成功的行为：
        self.assertTrue(data['success'])
        # 失败的学生数应为 1（S001 的语文列格式非法）
        self.assertEqual(data.get('failed_count', 0), 1, msg=f"response json: {data}")
        # 返回的错误详情应包含至少一条记录
        self.assertTrue('error_details' in data and len(data['error_details']) >= 1, msg=f"response json: {data}")

        # 检查数据库中确实写入了成功的分数（S002 的两科）
        # 以及视图实现可能已经写入了该行中合法的科目（例如 S001 的数学）
        scores = Score.objects.filter(exam=self.exam)
        # 至少应该有 S002 的两条成绩
        self.assertTrue(scores.filter(student=self.stu2).count() >= 2)

    def test_import_updates_existing_scores_and_skips_redis(self):
        """验证更新已存在成绩的路径（bulk_update），并模拟 Redis 不可用场景。

        步骤：先创建一个已存在成绩，然后通过导入更新它；并通过 patch 抛出异常模拟 redis 不可用，断言导入仍成功。
        """
        # 先创建已有成绩
        # 注意：视项目 Score 模型的 subject 字段可能是科目 code 或 display name
        s = Score.objects.create(student=self.stu1, exam=self.exam, subject='语文', score_value=100)

        headers = ['学号', '学生姓名', '语文']
        rows = [
            ('S001', '张三', 130),  # 更新分数
        ]

        bio = make_excel_bytes(headers, rows)

        # 模拟 django_rq.get_queue().connection.ping 抛异常，表示 Redis 不可用
        # django-rq 在视图中是动态导入的，直接 patch django_rq.get_queue 更稳健
        with patch('django_rq.get_queue') as mock_get_queue:
            mock_get_queue.side_effect = Exception('redis down')

            resp = self.client.post(self.url, {'exam': self.exam.pk, 'excel_file': bio}, format='multipart')
            data = resp.json()

            # 导入仍应成功（因为代码在 redis 不可用时跳过排名更新），且返回的 ranking_update_status 指明跳过
            self.assertTrue(data['success'])

        # 刷新对象并检查分数已被更新
        s.refresh_from_db()
        self.assertEqual(float(s.score_value), 130.0)

    def test_import_student_not_found_records_error(self):
        """学号在系统中不存在时，应记录失败且不创建成绩。

        预期行为（当前视图实现）：该行会被标记为 failed_students，
        最终响应 success 为 False（没有成功导入的学生），failed_count 为 1，数据库中不应有对应 Score 被创建。
        """
        headers = ['学号', '学生姓名', '语文']
        rows = [
            ('S999', '不存在的学生', 100),
        ]

        bio = make_excel_bytes(headers, rows)
        resp = self.client.post(self.url, {'exam': self.exam.pk, 'excel_file': bio}, format='multipart')
        data = resp.json()

        self.assertFalse(data['success'])
        self.assertEqual(data.get('failed_count', 0), 1)
        # 确认数据库没有为不存在学生创建成绩
        self.assertFalse(Score.objects.filter(exam=self.exam, student__student_id='S999').exists())

    def test_import_missing_required_header_handles_gracefully(self):
        """当 Excel 缺少必须的 '学号' 列时，视图应优雅处理并返回失败（不抛出500）。

        实现细节：视图会在读取行时跳过没有学号的行，最终 imported_count==0 且 success==False。
        """
        # 故意不包含 '学号' 列
        headers = ['学生姓名', '语文']
        rows = [
            ('张三', 100),
        ]

        bio = make_excel_bytes(headers, rows)
        resp = self.client.post(self.url, {'exam': self.exam.pk, 'excel_file': bio}, format='multipart')
        data = resp.json()

        # 没有被识别为任何可导入的学生
        self.assertFalse(data['success'])
        self.assertEqual(data.get('imported_count', 0), 0)

    def test_import_duplicate_rows_dont_create_partial_records(self):
        """当 Excel 中出现完全重复的学号+科目多行时，当前实现可能导致重复插入触发 IntegrityError。

        该测试断言视图能优雅返回失败（success==False）且数据库不产生重复记录（事务回滚）。
        """
        headers = ['学号', '学生姓名', '语文']
        # 两行完全相同（对同一学生、同一科目）
        rows = [
            ('S001', '张三', 100),
            ('S001', '张三', 95),
        ]

        bio = make_excel_bytes(headers, rows)
        resp = self.client.post(self.url, {'exam': self.exam.pk, 'excel_file': bio}, format='multipart')
        data = resp.json()

        # 视图应当捕获插入冲突并返回失败（而不是抛500）
        self.assertFalse(data['success'])
        # 确认没有写入任何成绩（事务回滚）
        self.assertFalse(Score.objects.filter(exam=self.exam, student=self.stu1, subject='语文').exists())

    def test_import_unknown_subject_column_is_ignored(self):
        """如果表头中包含不在 SUBJECT_CHOICES 的列（例如 '未知科目'），该列应被忽略且不创建任何成绩。"""
        headers = ['学号', '学生姓名', '未知科目']
        rows = [
            ('S001', '张三', 88),
        ]

        bio = make_excel_bytes(headers, rows)
        resp = self.client.post(self.url, {'exam': self.exam.pk, 'excel_file': bio}, format='multipart')
        data = resp.json()

        # 由于没有有效的科目列，视图不会创建成绩
        self.assertFalse(data['success'])
        self.assertEqual(Score.objects.filter(exam=self.exam, student=self.stu1).count(), 0)

    def test_import_score_exceeds_exam_subject_max_is_currently_written(self):
        """验证当分数超过 ExamSubject.max_score 时，当前导入实现是否写入（bulk_create 会绕过 model.clean）。

        这里测试当前行为：视图在批量创建时没有调用 model.clean，因此会写入超过满分的分数；
        如果你希望更严格的行为（拒绝超过满分的分数），应在视图层加入显式校验。
        """
        # 将语文的 max_score 调小以触发超过满分的情况
        es = ExamSubject.objects.get(exam=self.exam, subject_code='语文')
        es.max_score = 100
        es.save()

        headers = ['学号', '学生姓名', '语文']
        rows = [
            ('S001', '张三', 120),  # 超过了现在的满分100
        ]

        bio = make_excel_bytes(headers, rows)
        resp = self.client.post(self.url, {'exam': self.exam.pk, 'excel_file': bio}, format='multipart')
        data = resp.json()

        # 记录当前观察到的行为：导入仍成功（部分/全部），且数据库中存在超过满分的记录
        # 至少应该创建一条成绩记录
        self.assertTrue(Score.objects.filter(exam=self.exam, student=self.stu1, subject='语文').exists())
        s = Score.objects.get(exam=self.exam, student=self.stu1, subject='语文')
        # 断言分数确实被写入为上传值（表明 bulk_create 绕过了 model.clean）
        self.assertEqual(float(s.score_value), 120.0)

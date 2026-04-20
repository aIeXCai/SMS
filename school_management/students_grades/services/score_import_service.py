from decimal import Decimal, InvalidOperation

import openpyxl
from django.db import transaction
from django.utils import timezone

from ..models.exam import Exam, SUBJECT_DEFAULT_MAX_SCORES
from ..models.score import Score, SUBJECT_CHOICES as SCORE_SUBJECT_CHOICES
from ..models.student import Student
from ..tasks import update_all_rankings_async


class ScoreImportServiceError(Exception):
    """成绩导入服务异常。"""

    def __init__(self, message, status_code):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class ScoreImportService:
    """成绩批量导入服务。"""

    @staticmethod
    def _trigger_ranking_update(exam_id):
        try:
            update_all_rankings_async.delay(exam_id)
        except Exception:
            pass

    @classmethod
    def batch_import(cls, excel_file, exam_id):
        start_time = timezone.now()

        if not exam_id:
            raise ScoreImportServiceError('请选择考试', 400)
        if not excel_file:
            raise ScoreImportServiceError('请选择Excel文件', 400)
        if not excel_file.name.endswith(('.xlsx', '.xls')):
            raise ScoreImportServiceError('文件格式不正确，请上传 .xlsx 或 .xls 文件', 400)

        try:
            exam = Exam.objects.get(pk=exam_id)
        except Exam.DoesNotExist as exc:
            raise ScoreImportServiceError('考试不存在', 400) from exc

        try:
            workbook = openpyxl.load_workbook(excel_file)
            sheet = workbook.active
            headers = [cell.value for cell in sheet[1]]

            exam_subject_map = {
                subject.subject_code: subject
                for subject in exam.exam_subjects.all()
            }
            max_score_map = {
                subject.subject_code: Decimal(str(subject.max_score))
                for subject in exam.exam_subjects.all()
            }

            if not max_score_map:
                default_config = SUBJECT_DEFAULT_MAX_SCORES.get(exam.get_grade_level_from_cohort(), {})
                for subject_code, _ in SCORE_SUBJECT_CHOICES:
                    if subject_code in default_config:
                        max_score_map[subject_code] = Decimal(str(default_config[subject_code]))

            subject_codes = [subject_code for subject_code, _ in SCORE_SUBJECT_CHOICES if subject_code in headers]

            if not subject_codes:
                raise ScoreImportServiceError(
                    'Excel 中未找到任何科目列（语文、数学、英语等）。'
                    '请确保科目列名与模板一致，且第一行为标题行。',
                    400,
                )

            # 必须包含的必填列
            required_headers = ['学号', '学生姓名']
            missing_headers = [h for h in required_headers if h not in headers]
            if missing_headers:
                raise ScoreImportServiceError(
                    f'Excel 缺少必填列：{", ".join(missing_headers)}。'
                    f'请使用标准模板填写数据。',
                    400,
                )

            # 检查 Excel 中是否有无法识别的列（提前预警）
            unknown_columns = [h for h in headers if h not in ['学号', '学生姓名'] and h not in dict(SCORE_SUBJECT_CHOICES)]
            if unknown_columns:
                raise ScoreImportServiceError(
                    f'Excel 中包含无法识别的列名：{", ".join(unknown_columns)}。'
                    f'请检查列名是否与模板一致，或删除多余列后重新导入。',
                    400,
                )

            student_ids = set()
            excel_rows = []
            for row_idx, row in enumerate(sheet.iter_rows(min_row=2, values_only=True), start=2):
                if not any(row):
                    continue
                row_data = dict(zip(headers, row))
                sid = row_data.get('学号')
                if sid:
                    sid = str(sid).strip()
                    student_ids.add(sid)
                excel_rows.append((row_idx, row_data))

            students = Student.objects.filter(student_id__in=student_ids).select_related('current_class')
            students_map = {student.student_id: student for student in students}

            existing_scores = Score.objects.filter(
                exam=exam,
                student_id__in=[student.id for student in students],
                subject__in=subject_codes,
            )
            existing_scores_map = {
                (score.student_id, score.subject): score
                for score in existing_scores
            }

            imported_count = 0
            failed_count = 0
            error_details = []
            pending_create_map = {}
            pending_update_map = {}
            now_ts = timezone.now()

            with transaction.atomic():
                for row_idx, row_data in excel_rows:
                    student_id = str(row_data.get('学号') or '').strip()
                    student_name = str(row_data.get('学生姓名') or '').strip()

                    row_errors = []
                    if not student_id:
                        row_errors.append('缺少学号')
                    student = students_map.get(student_id)
                    if not student:
                        row_errors.append(f'学号 {student_id} 对应的学生不存在')

                    changed_any = False
                    if not row_errors:
                        for subject_code in subject_codes:
                            raw_score = row_data.get(subject_code)
                            if raw_score in [None, '']:
                                continue
                            try:
                                score_value = Decimal(str(raw_score))
                            except (TypeError, ValueError, InvalidOperation):
                                row_errors.append(f'{subject_code} 分数 "{raw_score}" 格式错误（须为数字）')
                                continue

                            if score_value < 0:
                                row_errors.append(f'{subject_code} 分数 {score_value} 不能为负数')
                                continue

                            max_score = max_score_map.get(subject_code)
                            if max_score is not None and score_value > max_score:
                                row_errors.append(f'{subject_code} 分数 {score_value} 超过满分 {max_score}')
                                continue

                            exam_subject_obj = exam_subject_map.get(subject_code)
                            key = (student.id, subject_code)
                            existing_score = existing_scores_map.get(key)

                            if existing_score:
                                if (
                                    existing_score.score_value != score_value
                                    or existing_score.exam_subject_id != (exam_subject_obj.id if exam_subject_obj else None)
                                ):
                                    existing_score.score_value = score_value
                                    existing_score.exam_subject = exam_subject_obj
                                    existing_score.updated_at = now_ts
                                    pending_update_map[existing_score.id] = existing_score
                                    changed_any = True
                            else:
                                pending_score = pending_create_map.get(key)
                                if pending_score:
                                    if (
                                        pending_score.score_value != score_value
                                        or pending_score.exam_subject_id != (exam_subject_obj.id if exam_subject_obj else None)
                                    ):
                                        pending_score.score_value = score_value
                                        pending_score.exam_subject = exam_subject_obj
                                        pending_score.updated_at = now_ts
                                        changed_any = True
                                else:
                                    pending_create_map[key] = Score(
                                        student=student,
                                        exam=exam,
                                        subject=subject_code,
                                        score_value=score_value,
                                        exam_subject=exam_subject_obj,
                                        created_at=now_ts,
                                        updated_at=now_ts,
                                    )
                                    changed_any = True

                    if row_errors:
                        failed_count += 1
                        error_details.append({
                            'row': row_idx,
                            'student_id': student_id,
                            'student_name': student_name,
                            'errors': row_errors,
                        })
                    elif changed_any:
                        imported_count += 1

                if pending_create_map:
                    Score.objects.bulk_create(list(pending_create_map.values()), batch_size=1000)

                if pending_update_map:
                    Score.objects.bulk_update(
                        list(pending_update_map.values()),
                        ['score_value', 'exam_subject', 'updated_at'],
                        batch_size=1000,
                    )

            cls._trigger_ranking_update(exam.pk)

            execution_time = (timezone.now() - start_time).total_seconds()
            return {
                'success': True,
                'message': '导入完成',
                'imported_count': imported_count,
                'failed_count': failed_count,
                'error_details': error_details,
                'execution_time': round(execution_time, 2),
            }
        except ScoreImportServiceError:
            raise
        except Exception as exc:
            raise ScoreImportServiceError(f'文件处理失败：{str(exc)}', 500) from exc

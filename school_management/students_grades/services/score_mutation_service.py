from django.db import transaction

from ..models.exam import Exam, ExamSubject, SUBJECT_DEFAULT_MAX_SCORES
from ..models.score import Score, SUBJECT_CHOICES as SCORE_SUBJECT_CHOICES
from ..models.student import Student
from ..tasks import update_all_rankings_async


class ScoreMutationServiceError(Exception):
    """成绩写操作服务异常。"""

    def __init__(self, message, status_code=400, payload=None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.payload = payload


class ScoreMutationService:
    """成绩写操作与编辑详情服务。"""

    @staticmethod
    def get_subject_max_scores(exam):
        exam_subjects = ExamSubject.objects.filter(exam=exam)
        max_scores = {subject.subject_code: float(subject.max_score) for subject in exam_subjects}

        default_config = SUBJECT_DEFAULT_MAX_SCORES.get(exam.get_grade_level_from_cohort(), {})
        for subject_code, _ in SCORE_SUBJECT_CHOICES:
            if subject_code not in max_scores:
                max_scores[subject_code] = float(default_config.get(subject_code, 100))

        return max_scores

    @staticmethod
    def _trigger_ranking_update(exam_id, grade_level=None):
        try:
            if grade_level is None:
                update_all_rankings_async.delay(exam_id)
            else:
                update_all_rankings_async.delay(exam_id, grade_level)
        except Exception:
            pass

    @classmethod
    def manual_add(cls, student_id, exam_id, scores):
        if not student_id or not exam_id:
            raise ScoreMutationServiceError('学生和考试为必填项', 400)

        try:
            student = Student.objects.get(pk=student_id)
        except Student.DoesNotExist as exc:
            raise ScoreMutationServiceError('选择的学生不存在', 400) from exc

        try:
            exam = Exam.objects.get(pk=exam_id)
        except Exam.DoesNotExist as exc:
            raise ScoreMutationServiceError('选择的考试不存在', 400) from exc

        valid_scores = {}
        for subject_code, _ in SCORE_SUBJECT_CHOICES:
            raw_value = (scores or {}).get(subject_code)
            if raw_value in [None, '']:
                continue
            try:
                valid_scores[subject_code] = float(raw_value)
            except (TypeError, ValueError) as exc:
                raise ScoreMutationServiceError(f'{subject_code} 分数格式不正确', 400) from exc

        if not valid_scores:
            raise ScoreMutationServiceError('请至少输入一个科目的成绩', 400)

        existing_subjects = []
        subject_name_map = {code: name for code, name in SCORE_SUBJECT_CHOICES}
        for subject_code in valid_scores.keys():
            if Score.objects.filter(student=student, exam=exam, subject=subject_code).exists():
                existing_subjects.append(subject_name_map.get(subject_code, subject_code))

        if existing_subjects:
            raise ScoreMutationServiceError(
                message=f"以下科目的成绩已存在：{', '.join(existing_subjects)}。",
                status_code=400,
                payload={
                    'success': False,
                    'code': 'duplicate_scores',
                    'message': f"以下科目的成绩已存在：{', '.join(existing_subjects)}。",
                    'duplicate_subjects': existing_subjects,
                    'student_id': student.pk,
                    'exam_id': exam.pk,
                },
            )

        exam_subject_map = {s.subject_code: s for s in exam.exam_subjects.all()}

        created_count = 0
        with transaction.atomic():
            for subject_code, score_value in valid_scores.items():
                score = Score(
                    student=student,
                    exam=exam,
                    subject=subject_code,
                    score_value=score_value,
                    exam_subject=exam_subject_map.get(subject_code)
                )
                score.save()
                created_count += 1

        cls._trigger_ranking_update(exam.pk, student.grade_level)

        return {
            'success': True,
            'message': f'成功添加 {created_count} 个科目的成绩',
            'created_count': created_count,
        }

    @classmethod
    def batch_edit_detail(cls, student_id, exam_id):
        if not student_id or not exam_id:
            raise ScoreMutationServiceError('缺少必要参数：学生ID或考试ID', 400)

        try:
            student = Student.objects.select_related('current_class').get(pk=student_id)
        except Student.DoesNotExist as exc:
            raise ScoreMutationServiceError('学生不存在', 404) from exc

        try:
            exam = Exam.objects.get(pk=exam_id)
        except Exam.DoesNotExist as exc:
            raise ScoreMutationServiceError('考试不存在', 404) from exc

        existing_scores = {
            score.subject: float(score.score_value)
            for score in Score.objects.filter(student=student, exam=exam)
        }

        return {
            'success': True,
            'student': {
                'id': student.pk,
                'name': student.name,
                'student_id': student.student_id,
                'grade_level': student.grade_level,
                'grade_level_display': student.get_grade_level_display() if student.grade_level else '',
                'class_name': student.current_class.class_name if student.current_class else '',
            },
            'exam': {
                'id': exam.pk,
                'name': exam.name,
                'academic_year': exam.academic_year,
                'date': exam.date.strftime('%Y-%m-%d') if exam.date else '',
            },
            'subjects': [{'value': code, 'label': label} for code, label in SCORE_SUBJECT_CHOICES],
            'existing_scores': existing_scores,
            'subject_max_scores': cls.get_subject_max_scores(exam),
        }

    @classmethod
    def batch_edit_save(cls, student_id, exam_id, scores):
        if not student_id or not exam_id:
            raise ScoreMutationServiceError('缺少必要参数：学生ID或考试ID', 400)

        try:
            student = Student.objects.get(pk=student_id)
        except Student.DoesNotExist as exc:
            raise ScoreMutationServiceError('学生不存在', 404) from exc

        try:
            exam = Exam.objects.get(pk=exam_id)
        except Exam.DoesNotExist as exc:
            raise ScoreMutationServiceError('考试不存在', 404) from exc

        subject_max_scores = cls.get_subject_max_scores(exam)
        subject_name_map = {code: name for code, name in SCORE_SUBJECT_CHOICES}
        exam_subject_map = {subject.subject_code: subject for subject in exam.exam_subjects.all()}

        updated_count = 0
        created_count = 0
        deleted_count = 0

        try:
            with transaction.atomic():
                for subject_code, _ in SCORE_SUBJECT_CHOICES:
                    raw_value = (scores or {}).get(subject_code)

                    if raw_value in [None, '']:
                        deleted_count += Score.objects.filter(
                            student=student,
                            exam=exam,
                            subject=subject_code
                        ).delete()[0]
                        continue

                    try:
                        score_value = float(raw_value)
                    except (TypeError, ValueError) as exc:
                        raise ScoreMutationServiceError(
                            f"{subject_name_map.get(subject_code, subject_code)} 的分数格式不正确",
                            400,
                        ) from exc

                    max_score = float(subject_max_scores.get(subject_code, 100))
                    if score_value < 0 or score_value > max_score:
                        raise ScoreMutationServiceError(
                            f"{subject_name_map.get(subject_code, subject_code)} 的分数必须在0-{max_score:g}分之间",
                            400,
                        )

                    score_obj, created = Score.objects.update_or_create(
                        student=student,
                        exam=exam,
                        subject=subject_code,
                        defaults={
                            'score_value': score_value,
                            'exam_subject': exam_subject_map.get(subject_code)
                        }
                    )

                    score_obj.clean()
                    score_obj.save()

                    if created:
                        created_count += 1
                    else:
                        updated_count += 1

        except ScoreMutationServiceError:
            raise
        except Exception as exc:
            raise ScoreMutationServiceError(str(exc), 400) from exc

        cls._trigger_ranking_update(exam.pk, student.grade_level)

        return {
            'success': True,
            'message': '成功修改成绩！',
            'created_count': created_count,
            'updated_count': updated_count,
            'deleted_count': deleted_count,
        }

from collections import defaultdict

from ..models.score import Score, SUBJECT_CHOICES as SCORE_SUBJECT_CHOICES
from ..models.student import GRADE_LEVEL_CHOICES
from .score_access_service import ScoreAccessService


class ScoreQueryService:
    """成绩查询聚合服务。"""

    @staticmethod
    def filter_scores(request):
        scores = Score.objects.select_related('student', 'student__current_class', 'exam').order_by(
            'student__student_id', 'exam__date', 'subject'
        )
        scores = ScoreAccessService.scope_scores(request.user, scores)

        student_id_filter = request.query_params.get('student_id_filter')
        student_name_filter = request.query_params.get('student_name_filter')
        exam_filter = request.query_params.get('exam_filter')
        subject_filter = request.query_params.get('subject_filter')
        subject_filters = request.query_params.getlist('subject_filters')
        subject_multi = request.query_params.getlist('subject')
        grade_filter = request.query_params.get('grade_filter')
        class_filter = request.query_params.get('class_filter')
        academic_year_filter = request.query_params.get('academic_year_filter')
        date_from_filter = request.query_params.get('date_from_filter')
        date_to_filter = request.query_params.get('date_to_filter')

        if subject_filter and isinstance(subject_filter, str) and ',' in subject_filter:
            subject_filters.extend([x.strip() for x in subject_filter.split(',') if x.strip()])
        if subject_multi:
            subject_filters.extend([x for x in subject_multi if x])

        if student_id_filter:
            scores = scores.filter(student__student_id__icontains=student_id_filter)
        if student_name_filter:
            scores = scores.filter(student__name__icontains=student_name_filter)
        if exam_filter:
            scores = scores.filter(exam__pk=exam_filter)
        if subject_filters:
            scores = scores.filter(subject__in=list(set(subject_filters)))
        elif subject_filter:
            scores = scores.filter(subject=subject_filter)
        if grade_filter:
            scores = scores.filter(student__cohort=grade_filter)
        if class_filter:
            scores = scores.filter(student__current_class__class_name=class_filter)
        if academic_year_filter:
            scores = scores.filter(exam__academic_year=academic_year_filter)
        if date_from_filter:
            scores = scores.filter(exam__date__gte=date_from_filter)
        if date_to_filter:
            scores = scores.filter(exam__date__lte=date_to_filter)

        return scores

    @staticmethod
    def aggregate_rows(scores):
        grade_label_map = {value: label for value, label in GRADE_LEVEL_CHOICES}
        aggregated_data = defaultdict(lambda: {
            'student_obj': None,
            'class_obj': None,
            'exam_obj': None,
            'scores': {},
            'total_score': 0.0,
            'grade_rank': None,
        })

        for score in scores:
            key = (score.student.pk, score.exam.pk)
            if aggregated_data[key]['student_obj'] is None:
                aggregated_data[key]['student_obj'] = score.student
                aggregated_data[key]['class_obj'] = score.student.current_class
                aggregated_data[key]['exam_obj'] = score.exam
                aggregated_data[key]['grade_rank'] = score.total_score_rank_in_grade
            aggregated_data[key]['scores'][score.subject] = float(score.score_value)
            aggregated_data[key]['total_score'] += float(score.score_value)

        rows = []
        for _, data in aggregated_data.items():
            student = data['student_obj']
            class_obj = data['class_obj']
            exam = data['exam_obj']
            rows.append({
                'record_key': f"{student.pk}_{exam.pk}",
                'student_id': student.pk,
                'exam_id': exam.pk,
                'student': {
                    'student_id': student.student_id,
                    'name': student.name,
                    'cohort': student.cohort or '',
                    'grade_level': student.grade_level,
                    'grade_level_display': grade_label_map.get(student.grade_level, student.grade_level),
                },
                'class': {
                    'class_name': class_obj.class_name if class_obj else None,
                },
                'exam': {
                    'id': exam.pk,
                    'name': exam.name,
                    'academic_year': exam.academic_year,
                    'date': exam.date.strftime('%Y-%m-%d') if exam.date else '',
                },
                'scores': data['scores'],
                'total_score': round(data['total_score'], 2),
                'grade_rank': data['grade_rank'],
            })
        return rows

    @staticmethod
    def sort_rows(rows, request):
        sort_by = request.query_params.get('sort_by')
        subject_sort = request.query_params.get('subject_sort')
        sort_order = request.query_params.get('sort_order', 'desc')
        reverse = sort_order == 'desc'

        if subject_sort:
            if subject_sort == 'total_score':
                rows.sort(key=lambda x: float(x.get('total_score') or 0), reverse=reverse)
            elif subject_sort == 'grade_rank':
                rows.sort(
                    key=lambda x: (x.get('grade_rank') is None, x.get('grade_rank') if x.get('grade_rank') is not None else 999999),
                    reverse=reverse,
                )
            else:
                rows.sort(key=lambda x: float(x.get('scores', {}).get(subject_sort, -1)), reverse=reverse)
            return rows

        if sort_by == 'total_score_desc':
            rows.sort(key=lambda x: float(x.get('total_score') or 0), reverse=True)
        elif sort_by == 'total_score_asc':
            rows.sort(key=lambda x: float(x.get('total_score') or 0), reverse=False)
        elif sort_by == 'student_name':
            rows.sort(key=lambda x: x.get('student', {}).get('name') or '')
        elif sort_by == 'exam_date':
            rows.sort(key=lambda x: x.get('exam', {}).get('date') or '', reverse=True)
        elif sort_by == 'grade_rank':
            rows.sort(key=lambda x: x.get('grade_rank') if x.get('grade_rank') is not None else 999999)

        return rows

    @staticmethod
    def resolve_subjects(rows, dynamic_subjects):
        subject_order = [value for value, _ in SCORE_SUBJECT_CHOICES]
        if dynamic_subjects in ['1', 'true', 'True']:
            subject_set = set()
            for row in rows:
                subject_set.update(row.get('scores', {}).keys())
            return [subject for subject in subject_order if subject in subject_set]
        return subject_order

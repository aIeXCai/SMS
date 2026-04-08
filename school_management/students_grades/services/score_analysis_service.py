import json

from ..models.exam import Exam
from ..models.score import Score, SUBJECT_CHOICES as SCORE_SUBJECT_CHOICES
from ..models.student import Class, Student
from .analysis_service import analyze_single_class, analyze_multiple_classes, analyze_grade


class ScoreAnalysisServiceError(Exception):
    """成绩分析服务异常，包含前端可消费的错误信息与状态码。"""

    def __init__(self, message, status_code):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class ScoreAnalysisService:
    """成绩分析编排服务。"""

    @staticmethod
    def _get_subject_order(subject):
        for index, (subject_code, subject_name) in enumerate(SCORE_SUBJECT_CHOICES):
            if subject_code == subject or subject_name == subject:
                return index
        return 999

    @classmethod
    def build_student_analysis_data(cls, student_id, exam_ids, exam_id):
        if not student_id:
            raise ScoreAnalysisServiceError('缺少学生ID参数', 400)

        if exam_ids:
            exam_id_list = [item.strip() for item in exam_ids.split(',') if item.strip()]
        elif exam_id:
            exam_id_list = [exam_id]
        else:
            student_exam_ids = Score.objects.filter(student_id=student_id).values_list('exam_id', flat=True).distinct()
            exam_id_list = [str(item) for item in student_exam_ids]

        try:
            student = Student.objects.select_related('current_class').get(id=student_id)
        except Student.DoesNotExist as exc:
            raise ScoreAnalysisServiceError('学生不存在', 404) from exc

        exams = Exam.objects.filter(id__in=exam_id_list).order_by('date', 'id')
        if not exams.exists():
            raise ScoreAnalysisServiceError('未找到指定的考试', 404)

        analysis_data = {
            'student_info': {
                'id': student.id,
                'student_id': student.student_id,
                'name': student.name,
                'cohort': student.cohort,
                'grade_level': student.grade_level,
                'class_name': student.current_class.class_name if student.current_class else '未分班',
            },
            'exams': [],
            'subjects': [],
            'trend_data': {},
            'summary': {
                'total_exams': exams.count(),
                'subjects_count': 0,
            }
        }

        all_subjects = set()

        for exam in exams:
            scores = Score.objects.filter(student=student, exam=exam).select_related('exam_subject')
            scores_list = list(scores)
            scores_list.sort(key=lambda score: cls._get_subject_order(score.subject))
            exam_subject_max_scores = {
                item.subject_code: float(item.max_score)
                for item in exam.exam_subjects.all()
            }

            exam_data = {
                'id': exam.id,
                'name': exam.name,
                'academic_year': exam.academic_year,
                'exam_date': exam.date.strftime('%Y-%m-%d') if exam.date else None,
                'grade_level': exam.get_grade_level_display(),
                'scores': [],
                'total_score': 0,
                'average_score': 0,
                'grade_total_rank': None,
                'class_total_rank': None,
            }

            total_score = 0
            valid_scores = 0

            for score in scores_list:
                subject_name = score.subject
                all_subjects.add(subject_name)

                score_value = float(score.score_value) if score.score_value else 0

                if score.exam_subject and score.exam_subject.max_score is not None:
                    full_score = float(score.exam_subject.max_score)
                elif subject_name in exam_subject_max_scores:
                    full_score = exam_subject_max_scores[subject_name]
                else:
                    max_score = score.get_max_score()
                    full_score = float(max_score) if max_score else 0

                percentage = round((score_value / full_score) * 100, 1) if full_score > 0 else 0

                exam_data['scores'].append({
                    'subject_name': subject_name,
                    'score_value': score_value,
                    'full_score': full_score,
                    'grade_rank': score.grade_rank_in_subject,
                    'class_rank': score.class_rank_in_subject,
                    'percentage': percentage,
                })

                if score.score_value is not None:
                    total_score += float(score.score_value)
                    valid_scores += 1

                if subject_name not in analysis_data['trend_data']:
                    analysis_data['trend_data'][subject_name] = {
                        'class_ranks': [],
                        'grade_ranks': [],
                        'scores': [],
                        'exam_names': [],
                        'exam_ids': [],
                    }

                analysis_data['trend_data'][subject_name]['class_ranks'].append(score.class_rank_in_subject)
                analysis_data['trend_data'][subject_name]['grade_ranks'].append(score.grade_rank_in_subject)
                analysis_data['trend_data'][subject_name]['scores'].append(score_value)
                analysis_data['trend_data'][subject_name]['exam_names'].append(exam.name)
                analysis_data['trend_data'][subject_name]['exam_ids'].append(exam.id)

            exam_data['total_score'] = round(total_score, 1)
            if valid_scores > 0:
                exam_data['average_score'] = round(total_score / valid_scores, 1)

            if scores_list:
                first_score = scores_list[0]
                exam_data['grade_total_rank'] = first_score.total_score_rank_in_grade
                exam_data['class_total_rank'] = first_score.total_score_rank_in_class

            analysis_data['exams'].append(exam_data)

        analysis_data['subjects'] = sorted(list(all_subjects), key=cls._get_subject_order)
        analysis_data['summary']['subjects_count'] = len(all_subjects)
        analysis_data['trend_data']['total'] = {
            'class_ranks': [item['class_total_rank'] for item in analysis_data['exams']],
            'grade_ranks': [item['grade_total_rank'] for item in analysis_data['exams']],
            'scores': [item['total_score'] for item in analysis_data['exams']],
            'exam_names': [item['name'] for item in analysis_data['exams']],
            'exam_ids': [item['id'] for item in analysis_data['exams']],
        }

        return analysis_data

    @staticmethod
    def build_class_analysis_single(exam_id, grade_level, academic_year, class_name_param, selected_classes):
        if not exam_id:
            raise ScoreAnalysisServiceError('缺少考试ID参数', 400)

        class_id = None
        if selected_classes:
            if 'all' in selected_classes:
                raise ScoreAnalysisServiceError('该接口仅支持单班级分析，不支持 all', 400)
            class_id = selected_classes[0]
        elif class_name_param:
            if ',' in class_name_param:
                raise ScoreAnalysisServiceError('该接口仅支持单班级分析，请只传入一个班级', 400)
            class_id = class_name_param

        if not class_id:
            raise ScoreAnalysisServiceError('缺少班级参数', 400)

        try:
            exam = Exam.objects.get(id=exam_id)
        except Exam.DoesNotExist as exc:
            raise ScoreAnalysisServiceError('考试不存在', 404) from exc

        try:
            target_class = Class.objects.get(id=class_id)
        except Class.DoesNotExist as exc:
            raise ScoreAnalysisServiceError('班级不存在', 404) from exc

        if grade_level and target_class.cohort != grade_level:
            raise ScoreAnalysisServiceError('班级与年级参数不一致', 400)

        scores = Score.objects.filter(exam=exam, student__current_class=target_class)
        analysis_result = analyze_single_class(scores, target_class, exam)
        chart_data = json.loads(analysis_result.get('chart_data_json', '{}') or '{}')

        subject_stats_dict = analysis_result.get('subject_stats', {}) or {}
        ordered_subject_stats = []
        for subject_code, _ in SCORE_SUBJECT_CHOICES:
            if subject_code in subject_stats_dict:
                item = subject_stats_dict[subject_code]
                ordered_subject_stats.append({
                    'code': subject_code,
                    'name': item.get('name', subject_code),
                    'avg_score': float(item.get('avg_score', 0) or 0),
                    'actual_max_score': float(item.get('actual_max_score', 0) or 0),
                    'actual_min_score': float(item.get('actual_min_score', 0) or 0),
                    'count': int(item.get('count', 0) or 0),
                    'exam_max_score': float(item.get('exam_max_score', 0) or 0),
                })

        return {
            'selected_exam': {
                'id': exam.id,
                'name': exam.name,
                'academic_year': exam.academic_year,
                'grade_level': exam.grade_level,
                'grade_level_display': exam.get_grade_level_display(),
            },
            'selected_grade': grade_level or target_class.grade_level,
            'academic_year': academic_year or exam.academic_year,
            'target_class': {
                'id': target_class.id,
                'grade_level': target_class.grade_level,
                'class_name': target_class.class_name,
            },
            'total_students': int(analysis_result.get('total_students', 0) or 0),
            'class_avg_total': float(analysis_result.get('class_avg_total', 0) or 0),
            'class_max_total': float(analysis_result.get('class_max_total', 0) or 0),
            'class_min_total': float(analysis_result.get('class_min_total', 0) or 0),
            'subject_stats': ordered_subject_stats,
            'student_rankings': analysis_result.get('student_rankings', []) or [],
            'chart_data': chart_data,
        }

    @staticmethod
    def build_class_analysis_multi(exam_id, grade_level, academic_year, class_name_param, selected_classes_param):
        if not exam_id:
            raise ScoreAnalysisServiceError('缺少考试ID参数', 400)

        class_id_values = [value for value in selected_classes_param if value and value != 'all']
        if not class_id_values and class_name_param:
            class_id_values = [item.strip() for item in class_name_param.split(',') if item.strip() and item.strip() != 'all']

        if len(class_id_values) < 2:
            raise ScoreAnalysisServiceError('多班级分析至少需要选择2个班级', 400)

        try:
            selected_class_ids = [int(value) for value in class_id_values]
        except ValueError as exc:
            raise ScoreAnalysisServiceError('班级参数格式错误', 400) from exc

        try:
            exam = Exam.objects.get(id=exam_id)
        except Exam.DoesNotExist as exc:
            raise ScoreAnalysisServiceError('考试不存在', 404) from exc

        selected_classes = list(Class.objects.filter(id__in=selected_class_ids))
        if len(selected_classes) < 2:
            raise ScoreAnalysisServiceError('有效班级不足，无法进行多班级分析', 400)

        if grade_level:
            invalid_classes = [item for item in selected_classes if item.cohort != grade_level]
            if invalid_classes:
                raise ScoreAnalysisServiceError('存在与年级参数不一致的班级', 400)

        selected_classes = sorted(selected_classes, key=lambda item: selected_class_ids.index(item.id))

        analysis_result = analyze_multiple_classes(selected_classes, exam)
        chart_data = json.loads(analysis_result.get('chart_data_json', '{}') or '{}')

        return {
            'selected_exam': {
                'id': exam.id,
                'name': exam.name,
                'academic_year': exam.academic_year,
                'grade_level': exam.grade_level,
                'grade_level_display': exam.get_grade_level_display(),
            },
            'selected_grade': grade_level or exam.grade_level,
            'academic_year': academic_year or exam.academic_year,
            'selected_classes': [f"{item.grade_level}{item.class_name}" for item in selected_classes],
            'class_statistics': analysis_result.get('class_statistics', []) or [],
            'subjects': analysis_result.get('subjects', []) or [],
            'total_students': int(analysis_result.get('total_students', 0) or 0),
            'subject_count': int(analysis_result.get('subject_count', 0) or 0),
            'highest_avg': float(analysis_result.get('highest_avg', 0) or 0),
            'chart_data': chart_data,
        }

    @staticmethod
    def build_class_analysis_grade(exam_id, grade_level, academic_year):
        if not exam_id:
            raise ScoreAnalysisServiceError('缺少考试ID参数', 400)
        if not grade_level:
            raise ScoreAnalysisServiceError('缺少年级参数', 400)

        try:
            exam = Exam.objects.get(id=exam_id)
        except Exam.DoesNotExist as exc:
            raise ScoreAnalysisServiceError('考试不存在', 404) from exc

        analysis_result = analyze_grade(exam, grade_level)
        chart_data = json.loads(analysis_result.get('chart_data_json', '{}') or '{}')

        return {
            'selected_exam': {
                'id': exam.id,
                'name': exam.name,
                'academic_year': exam.academic_year,
                'grade_level': exam.grade_level,
                'grade_level_display': exam.get_grade_level_display(),
            },
            'selected_grade': grade_level,
            'academic_year': academic_year or exam.academic_year,
            'total_students': int(analysis_result.get('total_students', 0) or 0),
            'total_classes': int(analysis_result.get('total_classes', 0) or 0),
            'grade_avg_score': float(analysis_result.get('grade_avg_score', 0) or 0),
            'excellent_rate': float(analysis_result.get('excellent_rate', 0) or 0),
            'class_statistics': analysis_result.get('class_statistics', []) or [],
            'subjects': analysis_result.get('subjects', []) or [],
            'total_max_score': float(analysis_result.get('total_max_score', 0) or 0),
            'chart_data': chart_data,
        }

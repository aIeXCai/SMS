import datetime

import openpyxl
from django.core.paginator import Paginator
from django.db import models
from django.http import HttpResponse
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from school_management.users.permissions import IsAdminOrGradeManagerOrStaff

from ..models.exam import Exam
from ..models.score import Score, SUBJECT_CHOICES as SCORE_SUBJECT_CHOICES
from ..models.student import (
    Student,
    Class,
    STATUS_CHOICES,
    CLASS_NAME_CHOICES,
    COHORT_CHOICES,
)
from ..serializers import ScoreSerializer
from ..services import (
    execute_target_student_rule,
    ScoreQueryService,
    ScoreWorkbookService,
    ScoreAnalysisService,
    ScoreAnalysisServiceError,
    ScoreMutationService,
    ScoreMutationServiceError,
    ScoreImportService,
    ScoreImportServiceError,
)
from ..services.student_analysis_export import StudentAnalysisExportService
from ..tasks import update_all_rankings_async

class ScoreViewSet(viewsets.ModelViewSet):
    """
    成绩管理 API
    - 列表：按(学生,考试)聚合，输出前端 `/scores` 页面所需数据结构
    - 批量：导出选中、删除选中
    - 导入：Excel 批量导入
    """
    queryset = Score.objects.all().select_related('student', 'student__current_class', 'exam', 'exam_subject')
    serializer_class = ScoreSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_permissions(self):
        if self.action == 'target_students_query':
            return [permissions.IsAuthenticated()]

        if self.action in [
            'create', 'update', 'partial_update', 'destroy',
            'manual_add', 'batch_edit_save',
            'batch_delete_selected', 'batch_delete_filtered', 'batch_import'
        ]:
            return [permissions.IsAuthenticated(), IsAdminOrGradeManagerOrStaff()]
        return [permissions.IsAuthenticated()]

    @action(detail=False, methods=['post'], url_path='target-students-query')
    def target_students_query(self, request):
        """按规则筛选目标生（第一期：单条件 + 时序量词）。"""
        try:
            result = execute_target_student_rule(request.data)

            page = self._parse_pagination_value(
                request.query_params.get('page', request.data.get('page', 1)),
                default_value=1,
                field_name='page',
                min_value=1,
                max_value=100000,
            )
            page_size = self._parse_pagination_value(
                request.query_params.get('page_size', request.data.get('page_size', 200)),
                default_value=200,
                field_name='page_size',
                min_value=1,
                max_value=1000,
            )

            students = result.get('students', [])
            total = len(students)
            num_pages = ((total - 1) // page_size + 1) if total else 1

            if page > num_pages and total > 0:
                raise ValueError('page 超出范围')

            start = (page - 1) * page_size
            end = start + page_size
            paged_students = students[start:end]

            result['students'] = paged_students
            result['pagination'] = {
                'page': page,
                'page_size': page_size,
                'total': total,
                'num_pages': num_pages,
                'has_next': page < num_pages,
                'has_previous': page > 1,
            }

            return Response({'success': True, 'data': result})
        except ValueError as e:
            return Response({'success': False, 'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'success': False, 'error': f'服务器错误: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @staticmethod
    def _parse_pagination_value(raw_value, default_value, field_name, min_value, max_value):
        if raw_value in [None, '']:
            return default_value

        try:
            value = int(raw_value)
        except (TypeError, ValueError):
            raise ValueError(f'{field_name} 必须是整数')

        if value < min_value or value > max_value:
            raise ValueError(f'{field_name} 必须在 {min_value}-{max_value} 之间')

        return value

    def _filter_scores(self, request):
        return ScoreQueryService.filter_scores(request)

    def _aggregate_rows(self, scores):
        return ScoreQueryService.aggregate_rows(scores)

    def _sort_rows(self, rows, request):
        return ScoreQueryService.sort_rows(rows, request)

    def _build_export_workbook(self, rows):
        return ScoreWorkbookService.build_export_workbook(rows)

    def _build_query_export_workbook(self, rows, all_subjects):
        return ScoreWorkbookService.build_query_export_workbook(rows, all_subjects)

    def _build_student_analysis_export_payload(self, request):
        """组装个人分析导出 payload，复用 student_analysis_data 同口径数据。"""
        analysis_response = self.student_analysis_data(request)
        if analysis_response.status_code >= 500:
            return None, Response({'success': False, 'error': '服务异常，请稍后重试'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        if analysis_response.status_code >= 400:
            response_data = getattr(analysis_response, 'data', None) or {}
            if (
                analysis_response.status_code == status.HTTP_404_NOT_FOUND
                and response_data.get('error') == '未找到指定的考试'
            ):
                return None, Response({'success': False, 'error': '该学生暂无可导出分析数据'}, status=status.HTTP_400_BAD_REQUEST)
            return None, analysis_response

        response_data = getattr(analysis_response, 'data', None) or {}
        if not response_data.get('success'):
            return None, Response({'success': False, 'error': response_data.get('error', '导出数据准备失败')}, status=status.HTTP_400_BAD_REQUEST)

        analysis_data = response_data.get('data') or {}
        try:
            payload = StudentAnalysisExportService.build_payload(analysis_data, SCORE_SUBJECT_CHOICES)
        except ValueError as exc:
            return None, Response({'success': False, 'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return payload, None

    @action(detail=False, methods=['get'], url_path='student-analysis-report-export')
    def student_analysis_report_export(self, request):
        """导出个人成绩分析报告（Excel）。"""
        payload, error_response = self._build_student_analysis_export_payload(request)
        if error_response is not None:
            return error_response

        try:
            workbook = openpyxl.Workbook()
            StudentAnalysisExportService.build_overview_sheet(workbook, payload)
            StudentAnalysisExportService.build_total_trend_sheet(workbook, payload)
            StudentAnalysisExportService.build_subject_detail_sheet(workbook, payload)
            StudentAnalysisExportService.build_subject_trend_sheet(workbook, payload)

            student_info = payload.get('student_info') or {}
            timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M')
            filename = StudentAnalysisExportService.build_filename(student_info, timestamp)

            response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            workbook.save(response)
            return response
        except Exception:
            return Response({'success': False, 'error': '服务异常，请稍后重试'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'], url_path='options')
    def options(self, request):
        grade_level_filter = request.query_params.get('grade_level')
        exams = Exam.objects.all()
        if grade_level_filter:
            exams = exams.filter(grade_level=grade_level_filter)
        exams = exams.order_by('-academic_year', '-date', 'name')[:100]
        academic_year_filter = request.query_params.get('academic_year')
        all_exams_qs = Exam.objects.all()
        if grade_level_filter:
            all_exams_qs = all_exams_qs.filter(grade_level=grade_level_filter)
        academic_year_values = sorted(
            {
                value
                for value in all_exams_qs.exclude(academic_year__isnull=True)
                .exclude(academic_year='')
                .values_list('academic_year', flat=True)
                if value
            },
            reverse=True,
        )
        return Response({
            'exams': [
                {
                    'value': str(exam.pk),
                    'label': f"{exam.academic_year} {exam.name} ({exam.get_grade_level_display()})"
                }
                for exam in exams
            ],
            'grade_levels': [{'value': value, 'label': label} for value, label in COHORT_CHOICES],
            'class_name_choices': [{'value': value, 'label': label} for value, label in CLASS_NAME_CHOICES],
            'subjects': [{'value': value, 'label': label} for value, label in SCORE_SUBJECT_CHOICES],
            'academic_years': [{'value': value, 'label': value} for value in academic_year_values],
            'sort_by_options': [
                {'value': '', 'label': '--- 默认排序 ---'},
                {'value': 'total_score_desc', 'label': '总分降序'},
                {'value': 'total_score_asc', 'label': '总分升序'},
                {'value': 'student_name', 'label': '学生姓名'},
                {'value': 'exam_date', 'label': '考试日期'},
                {'value': 'grade_rank', 'label': '年级排名'},
            ],
            'all_subjects': [value for value, _ in SCORE_SUBJECT_CHOICES],
            'per_page_options': [10, 20, 50, 100],
        })

    @action(detail=False, methods=['get'], url_path='student-search')
    def student_search(self, request):
        query = (request.query_params.get('q') or '').strip()
        if not query:
            return Response({'results': []})

        students = Student.objects.select_related('current_class').filter(
            models.Q(name__icontains=query)
            | models.Q(student_id__icontains=query)
            | models.Q(current_class__class_name__icontains=query)
        ).order_by('name', 'student_id')[:20]

        return Response({
            'results': [
                {
                    'id': student.pk,
                    'student_id': student.student_id,
                    'name': student.name,
                    'grade_level': student.grade_level,
                    'grade_level_display': student.get_grade_level_display() if student.grade_level else '',
                    'class_name': student.current_class.class_name if student.current_class else '',
                    'display': f"{student.name} ({student.student_id}) - {student.get_grade_level_display() if student.grade_level else ''}{student.current_class.class_name if student.current_class else ''}",
                }
                for student in students
            ]
        })

    @action(detail=False, methods=['get'], url_path='student-analysis-data')
    def student_analysis_data(self, request):
        """获取学生个人成绩分析数据（前后端分离 API 版本）"""
        student_id = request.query_params.get('student_id')
        exam_ids = request.query_params.get('exam_ids', '')
        exam_id = request.query_params.get('exam_id')

        try:
            analysis_data = ScoreAnalysisService.build_student_analysis_data(student_id, exam_ids, exam_id)
            return Response({'success': True, 'data': analysis_data})
        except ScoreAnalysisServiceError as exc:
            return Response({'success': False, 'error': exc.message}, status=exc.status_code)
        except Exception as exc:
            return Response({'success': False, 'error': f'服务器错误: {str(exc)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'], url_path='class-analysis-single')
    def class_analysis_single(self, request):
        """获取单班级成绩分析数据（前后端分离 API 版本）"""
        exam_id = request.query_params.get('exam')
        grade_level = request.query_params.get('grade_level')
        academic_year = request.query_params.get('academic_year', '')
        class_name_param = request.query_params.get('class_name')
        selected_classes = request.query_params.getlist('selected_classes')
        try:
            data = ScoreAnalysisService.build_class_analysis_single(
                exam_id,
                grade_level,
                academic_year,
                class_name_param,
                selected_classes,
            )
            return Response({'success': True, 'data': data})
        except ScoreAnalysisServiceError as exc:
            return Response({'success': False, 'error': exc.message}, status=exc.status_code)
        except Exception as exc:
            return Response({'success': False, 'error': f'服务器错误: {str(exc)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'], url_path='class-analysis-multi')
    def class_analysis_multi(self, request):
        """获取多班级成绩对比分析数据（前后端分离 API 版本）"""
        exam_id = request.query_params.get('exam')
        grade_level = request.query_params.get('grade_level')
        academic_year = request.query_params.get('academic_year', '')
        class_name_param = request.query_params.get('class_name', '')
        selected_classes_param = request.query_params.getlist('selected_classes')
        try:
            data = ScoreAnalysisService.build_class_analysis_multi(
                exam_id,
                grade_level,
                academic_year,
                class_name_param,
                selected_classes_param,
            )
            return Response({'success': True, 'data': data})
        except ScoreAnalysisServiceError as exc:
            return Response({'success': False, 'error': exc.message}, status=exc.status_code)
        except Exception as exc:
            return Response({'success': False, 'error': f'服务器错误: {str(exc)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'], url_path='class-analysis-grade')
    def class_analysis_grade(self, request):
        """获取年级成绩分析数据（前后端分离 API 版本）"""
        exam_id = request.query_params.get('exam')
        grade_level = request.query_params.get('grade_level')
        academic_year = request.query_params.get('academic_year', '')
        try:
            data = ScoreAnalysisService.build_class_analysis_grade(exam_id, grade_level, academic_year)
            return Response({'success': True, 'data': data})
        except ScoreAnalysisServiceError as exc:
            return Response({'success': False, 'error': exc.message}, status=exc.status_code)
        except Exception as exc:
            return Response({'success': False, 'error': f'服务器错误: {str(exc)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'], url_path='manual-add')
    def manual_add(self, request):
        student_id = request.data.get('student_id')
        exam_id = request.data.get('exam_id')
        scores = request.data.get('scores', {})

        try:
            result = ScoreMutationService.manual_add(student_id, exam_id, scores)
            return Response(result)
        except ScoreMutationServiceError as exc:
            return Response(exc.payload or {'success': False, 'message': exc.message}, status=exc.status_code)
        except Exception as exc:
            return Response({'success': False, 'message': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], url_path='batch-edit-detail')
    def batch_edit_detail(self, request):
        student_id = request.query_params.get('student') or request.query_params.get('student_id')
        exam_id = request.query_params.get('exam') or request.query_params.get('exam_id')

        try:
            data = ScoreMutationService.batch_edit_detail(student_id, exam_id)
            return Response(data)
        except ScoreMutationServiceError as exc:
            return Response({'success': False, 'message': exc.message}, status=exc.status_code)
        except Exception as exc:
            return Response({'success': False, 'message': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], url_path='batch-edit-save')
    def batch_edit_save(self, request):
        student_id = request.data.get('student_id')
        exam_id = request.data.get('exam_id')
        scores = request.data.get('scores', {})

        try:
            result = ScoreMutationService.batch_edit_save(student_id, exam_id, scores)
            return Response(result)
        except ScoreMutationServiceError as exc:
            return Response({'success': False, 'message': exc.message}, status=exc.status_code)
        except Exception as exc:
            return Response({'success': False, 'message': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    def list(self, request, *args, **kwargs):
        rows = self._aggregate_rows(self._filter_scores(request))
        rows = self._sort_rows(rows, request)
        all_subjects = ScoreQueryService.resolve_subjects(rows, request.query_params.get('dynamic_subjects'))

        page = request.query_params.get('page', '1')
        page_size = request.query_params.get('page_size', '100')
        try:
            page_size = int(page_size)
        except (TypeError, ValueError):
            page_size = 100
        page_size = max(10, min(100, page_size))

        paginator = Paginator(rows, page_size)
        page_obj = paginator.get_page(page)

        return Response({
            'count': paginator.count,
            'num_pages': paginator.num_pages,
            'current_page': page_obj.number,
            'has_previous': page_obj.has_previous(),
            'has_next': page_obj.has_next(),
            'previous_page': page_obj.previous_page_number() if page_obj.has_previous() else None,
            'next_page': page_obj.next_page_number() if page_obj.has_next() else None,
            'start_index': page_obj.start_index() if paginator.count else 0,
            'end_index': page_obj.end_index() if paginator.count else 0,
            'page_size': page_size,
            'results': list(page_obj),
            'all_subjects': all_subjects,
        })

    @action(detail=False, methods=['get'], url_path='download-template')
    def download_template(self, request):
        workbook = openpyxl.Workbook()
        sheet = workbook.active
        sheet.title = "成绩导入模板"

        headers = ["学号", "学生姓名"] + [name for name, _ in SCORE_SUBJECT_CHOICES]
        sheet.append(headers)

        row_a = ['S001', '张三'] + [''] * len(SCORE_SUBJECT_CHOICES)
        if '语文' in headers:
            row_a[headers.index('语文')] = 85.5
        if '数学' in headers:
            row_a[headers.index('数学')] = 92.0
        sheet.append(row_a)

        row_b = ['S002', '李四'] + [''] * len(SCORE_SUBJECT_CHOICES)
        if '英语' in headers:
            row_b[headers.index('英语')] = 78.0
        if '物理' in headers:
            row_b[headers.index('物理')] = 90.0
        sheet.append(row_b)

        response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = 'attachment; filename="score_import_template.xlsx"'
        workbook.save(response)
        return response

    @action(detail=False, methods=['post'], url_path='batch-delete-selected')
    def batch_delete_selected(self, request):
        selected_records = request.data.get('selected_records', [])
        if not selected_records:
            return Response({'success': False, 'message': '没有选择任何记录'}, status=status.HTTP_400_BAD_REQUEST)

        total_deleted = 0
        affected_exam_ids = set()

        for record in selected_records:
            try:
                student_id, exam_id = str(record).split('_')
            except ValueError:
                continue
            deleted_count = Score.objects.filter(student_id=student_id, exam_id=exam_id).delete()[0]
            total_deleted += deleted_count
            if deleted_count > 0:
                affected_exam_ids.add(int(exam_id))

        for exam_id in affected_exam_ids:
            try:
                update_all_rankings_async.delay(exam_id)
            except Exception:
                pass

        return Response({
            'success': True,
            'deleted_count': total_deleted,
            'message': f'成功删除 {total_deleted} 条成绩记录' if total_deleted else '没有找到对应的成绩记录'
        })

    @action(detail=False, methods=['post'], url_path='batch-delete-filtered')
    def batch_delete_filtered(self, request):
        """按当前筛选条件批量删除成绩（与旧 score_batch_delete_filtered 行为对齐）"""
        filtered_scores = self._filter_scores(request)
        delete_count = filtered_scores.count()

        if delete_count == 0:
            return Response({
                'success': True,
                'deleted_count': 0,
                'message': '没有符合筛选条件的成绩记录'
            })

        affected_exam_ids = list(filtered_scores.values_list('exam_id', flat=True).distinct())
        filtered_scores.delete()

        for exam_id in affected_exam_ids:
            try:
                update_all_rankings_async.delay(exam_id)
            except Exception:
                pass

        return Response({
            'success': True,
            'deleted_count': delete_count,
            'message': f'成功删除 {delete_count} 条符合筛选条件的成绩记录'
        })

    @action(detail=False, methods=['get'], url_path='select-all-record-keys')
    def select_all_record_keys(self, request):
        score_pairs = self._filter_scores(request).values_list('student_id', 'exam_id').distinct()
        record_keys = [f"{student_id}_{exam_id}" for student_id, exam_id in score_pairs]

        return Response({
            'success': True,
            'count': len(record_keys),
            'record_keys': record_keys,
        })

    @action(detail=False, methods=['post'], url_path='batch-export-selected')
    def batch_export_selected(self, request):
        selected_records = request.data.get('selected_records', [])
        if not selected_records:
            return Response({'success': False, 'message': '没有选择任何记录'}, status=status.HTTP_400_BAD_REQUEST)

        selected_rows = []
        for record in selected_records:
            try:
                student_id, exam_id = str(record).split('_')
            except ValueError:
                continue
            scores = Score.objects.filter(student_id=student_id, exam_id=exam_id).select_related(
                'student', 'student__current_class', 'exam'
            )
            selected_rows.extend(self._aggregate_rows(scores))

        workbook = self._build_export_workbook(selected_rows)
        timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
        response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = f'attachment; filename="聚合成绩导出_{timestamp}.xlsx"'
        workbook.save(response)
        return response

    @action(detail=False, methods=['get'], url_path='batch-export')
    def batch_export(self, request):
        rows = self._aggregate_rows(self._filter_scores(request))
        workbook = self._build_export_workbook(rows)
        timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
        response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = f'attachment; filename="筛选成绩导出_{timestamp}.xlsx"'
        workbook.save(response)
        return response

    @action(detail=False, methods=['get'], url_path='query-export')
    def query_export(self, request):
        rows = self._aggregate_rows(self._filter_scores(request))
        rows = self._sort_rows(rows, request)
        all_subjects = ScoreQueryService.resolve_subjects(rows, request.query_params.get('dynamic_subjects'))

        workbook = self._build_query_export_workbook(rows, all_subjects)
        timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
        response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = f'attachment; filename="成绩查询导出_{timestamp}.xlsx"'
        workbook.save(response)
        return response

    @action(detail=False, methods=['post'], url_path='batch-import', parser_classes=[MultiPartParser, FormParser])
    def batch_import(self, request):
        excel_file = request.FILES.get('excel_file')
        exam_id = request.data.get('exam')

        try:
            result = ScoreImportService.batch_import(excel_file, exam_id)
            return Response(result)
        except ScoreImportServiceError as exc:
            return Response({'success': False, 'message': exc.message}, status=exc.status_code)
        except Exception as exc:
            return Response(
                {'success': False, 'message': f'文件处理失败：{str(exc)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

from django.db import models
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from ..models import Exam, FilterResultSnapshot, SavedFilterRule, Score, Student
from ..serializers import FilterResultSnapshotSerializer, SavedFilterRuleSerializer
from ..services import AdvancedFilterService, FilterComparisonService
from school_management.users.permissions import IsAdminOrGradeManagerOrStaff


SUBJECT_LABEL_MAP = {
    'total': '总分',
    'chinese': '语文',
    'math': '数学',
    'english': '英语',
    'physics': '物理',
    'chemistry': '化学',
    'biology': '生物',
    'history': '历史',
    'geography': '地理',
    'politics': '政治',
}


def _get_condition_rank_map(exam_id: int, condition: dict, student_ids: list[int]) -> dict[int, int]:
    subject = condition.get('subject')
    dimension = condition.get('dimension')

    if subject == 'total':
        rank_field = 'total_score_rank_in_grade' if dimension == 'grade' else 'total_score_rank_in_class'
        rows = (
            Score.objects.filter(exam_id=exam_id, student_id__in=student_ids)
            .values('student_id')
            .annotate(rank_value=models.Min(rank_field))
        )
    else:
        subject_name = AdvancedFilterService.SUBJECT_MAP.get(subject)
        if not subject_name:
            return {}
        rank_field = 'grade_rank_in_subject' if dimension == 'grade' else 'class_rank_in_subject'
        rows = (
            Score.objects.filter(exam_id=exam_id, student_id__in=student_ids, subject=subject_name)
            .values('student_id')
            .annotate(rank_value=models.Min(rank_field))
        )

    return {
        row['student_id']: row['rank_value']
        for row in rows
        if row.get('rank_value') is not None
    }


def _get_condition_score_map(exam_id: int, condition: dict, student_ids: list[int]) -> dict[int, float]:
    subject = condition.get('subject')

    if subject == 'total':
        rows = (
            Score.objects.filter(exam_id=exam_id, student_id__in=student_ids)
            .values('student_id')
            .annotate(score_value=models.Sum('score_value'))
        )
    else:
        subject_name = AdvancedFilterService.SUBJECT_MAP.get(subject)
        if not subject_name:
            return {}
        rows = (
            Score.objects.filter(exam_id=exam_id, student_id__in=student_ids, subject=subject_name)
            .values('student_id')
            .annotate(score_value=models.Max('score_value'))
        )

    return {
        row['student_id']: float(row['score_value'])
        for row in rows
        if row.get('score_value') is not None
    }


class _FilterWritePermissionMixin:
    """筛选相关视图权限：读操作登录可用，写操作仅 admin/grade_manager/staff。"""

    def get_permissions(self):
        if self.request.method in ['POST', 'PUT', 'PATCH', 'DELETE']:
            return [permissions.IsAuthenticated(), IsAdminOrGradeManagerOrStaff()]
        return [permissions.IsAuthenticated()]


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated, IsAdminOrGradeManagerOrStaff])
def advanced_filter(request):
    """高级筛选 API：按多条件组合返回学生列表。"""
    try:
        exam_id = request.data.get('exam_id')
        logic = request.data.get('logic')
        conditions = request.data.get('conditions') or []
        class_id = request.data.get('class_id')

        if not exam_id:
            return Response({'message': 'exam_id 为必填项'}, status=status.HTTP_400_BAD_REQUEST)

        student_ids = AdvancedFilterService.apply_filter(
            exam_id=int(exam_id),
            logic=logic,
            conditions=conditions,
            class_id=int(class_id) if class_id else None,
        )

        students = {
            student.id: student
            for student in Student.objects.select_related('current_class').filter(id__in=student_ids)
        }
        rank_rows = (
            Score.objects.filter(exam_id=exam_id, student_id__in=student_ids)
            .values('student_id')
            .annotate(total_rank=models.Min('total_score_rank_in_grade'))
        )
        rank_map = {row['student_id']: row['total_rank'] for row in rank_rows}

        condition_columns = []
        condition_rank_maps = []
        condition_score_maps = []
        for index, condition in enumerate(conditions, start=1):
            subject = condition.get('subject', '')
            condition_columns.append(
                {
                    'index': index,
                    'subject': subject,
                    'subject_label': SUBJECT_LABEL_MAP.get(subject, subject),
                    'dimension': condition.get('dimension'),
                }
            )
            condition_rank_maps.append(_get_condition_rank_map(int(exam_id), condition, student_ids))
            condition_score_maps.append(_get_condition_score_map(int(exam_id), condition, student_ids))

        result_students = []
        for student_id in student_ids:
            student = students.get(student_id)
            if not student:
                continue
            class_name = student.current_class.class_name if student.current_class else '未分班'
            condition_details = []
            for idx, column in enumerate(condition_columns):
                condition_details.append(
                    {
                        'condition_index': column['index'],
                        'subject': column['subject'],
                        'subject_label': column['subject_label'],
                        'score': condition_score_maps[idx].get(student_id),
                        'rank': condition_rank_maps[idx].get(student_id),
                    }
                )
            result_students.append(
                {
                    'student_id': student.id,
                    'student_number': student.student_id,
                    'name': student.name,
                    'cohort': student.cohort,
                    'class_name': class_name,
                    'total_rank': rank_map.get(student.id),
                    'condition_details': condition_details,
                }
            )

        result_students.sort(
            key=lambda item: (
                item['total_rank'] if item['total_rank'] is not None else 10**9,
                item['student_number'],
            )
        )

        return Response(
            {
                'count': len(result_students),
                'logic': (logic or '').upper(),
                'condition_columns': condition_columns,
                'students': result_students,
            }
        )
    except Exam.DoesNotExist:
        return Response({'message': '考试不存在'}, status=status.HTTP_404_NOT_FOUND)
    except ValueError as exc:
        return Response({'message': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as exc:
        return Response({'message': f'服务器错误: {str(exc)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class FilterRuleListView(_FilterWritePermissionMixin, generics.ListCreateAPIView):
    """规则列表与创建。"""

    serializer_class = SavedFilterRuleSerializer

    def get_queryset(self):
        return SavedFilterRule.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class FilterRuleDetailView(_FilterWritePermissionMixin, generics.RetrieveUpdateDestroyAPIView):
    """规则详情（仅本人可读写删）。"""

    serializer_class = SavedFilterRuleSerializer
    lookup_field = 'id'

    def get_queryset(self):
        return SavedFilterRule.objects.filter(user=self.request.user)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response({'message': '规则删除成功'}, status=status.HTTP_200_OK)


class FilterSnapshotListView(_FilterWritePermissionMixin, generics.ListCreateAPIView):
    """快照列表与创建。"""

    serializer_class = FilterResultSnapshotSerializer

    def get_queryset(self):
        return FilterResultSnapshot.objects.filter(user=self.request.user).select_related('exam', 'rule')

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class FilterSnapshotDetailView(_FilterWritePermissionMixin, generics.DestroyAPIView):
    """快照删除（仅本人可删）。"""

    serializer_class = FilterResultSnapshotSerializer
    lookup_field = 'id'

    def get_queryset(self):
        return FilterResultSnapshot.objects.filter(user=self.request.user)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response({'message': '快照删除成功'}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated, IsAdminOrGradeManagerOrStaff])
def compare_snapshots(request):
    """对比两个快照（仅允许比较本人快照）。"""
    baseline_snapshot_id = request.data.get('baseline_snapshot_id')
    comparison_snapshot_id = request.data.get('comparison_snapshot_id')

    if not baseline_snapshot_id or not comparison_snapshot_id:
        return Response({'message': 'baseline_snapshot_id 和 comparison_snapshot_id 为必填项'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        baseline = FilterResultSnapshot.objects.select_related('exam').get(id=baseline_snapshot_id, user=request.user)
        comparison = FilterResultSnapshot.objects.select_related('exam').get(id=comparison_snapshot_id, user=request.user)
    except FilterResultSnapshot.DoesNotExist:
        return Response({'message': '快照不存在或无权限访问'}, status=status.HTTP_404_NOT_FOUND)

    result = FilterComparisonService.compare_snapshots(baseline, comparison)
    return Response(result)

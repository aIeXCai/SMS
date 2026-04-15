from rest_framework import viewsets, status, serializers
from rest_framework.response import Response
from django.db.models import Q

from ..models.calendar import CalendarEvent
from ..serializers import CalendarEventSerializer


class CalendarEventViewSet(viewsets.ModelViewSet):
    """日历日程 ViewSet"""
    serializer_class = CalendarEventSerializer
    queryset = CalendarEvent.objects.all()

    def get_queryset(self):
        """返回当前用户可见的日程"""
        user = self.request.user
        queryset = CalendarEvent.objects.all().order_by('start')

        # 管理员可见所有
        if hasattr(user, 'role') and user.role == 'admin':
            return queryset

        # 级长可见 personal(本人) + grade(本年级) + school
        if hasattr(user, 'role') and user.role == 'grade_manager':
            managed = user.managed_grade or ''
            return queryset.filter(
                Q(visibility='personal', creator=user) |
                Q(visibility='grade', grade=managed) |
                Q(visibility='school')
            )

        # 普通教师可见 personal(本人) + school
        return queryset.filter(
            Q(visibility='personal', creator=user) |
            Q(visibility='school')
        )

    def perform_create(self, serializer):
        user = self.request.user
        data = serializer.validated_data
        visibility = data.get('visibility', 'personal')

        # 级长只能创建个人或本年级日程，不能创建全校
        if hasattr(user, 'role') and user.role == 'grade_manager':
            if visibility == 'school':
                raise serializers.ValidationError({'visibility': '级长不能创建全校可见的日程'})

        serializer.save()

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        user = request.user

        # 权限校验：仅 creator 或 admin 可更新
        if instance.creator != user and not (hasattr(user, 'role') and user.role == 'admin'):
            return Response({'detail': '无权修改此日程'}, status=status.HTTP_403_FORBIDDEN)

        # 级长不能将可见性改为全校
        if hasattr(user, 'role') and user.role == 'grade_manager':
            new_visibility = request.data.get('visibility', instance.visibility)
            if new_visibility == 'school':
                return Response({'detail': '级长不能创建全校可见的日程'}, status=status.HTTP_403_FORBIDDEN)

        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        user = request.user

        # 权限校验：仅 creator 或 admin 可删除
        if instance.creator != user and not (hasattr(user, 'role') and user.role == 'admin'):
            return Response({'detail': '无权删除此日程'}, status=status.HTTP_403_FORBIDDEN)

        return super().destroy(request, *args, **kwargs)

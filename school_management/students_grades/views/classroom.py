from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, permissions, viewsets

from ..models.student import Class
from ..serializers import ClassSerializer


class ClassViewSet(viewsets.ReadOnlyModelViewSet):
    """
    班级管理 ViewSet
    只提供查看操作
    """

    queryset = Class.objects.all()
    serializer_class = ClassSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["cohort"]  # grade_level 保留用于展示，cohort 用于查询
    ordering = ["grade_level", "class_name"]

from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from .models.student import Student, Class
from .serializers import StudentSerializer, ClassSerializer


class StudentViewSet(viewsets.ModelViewSet):
    """
    学生管理 ViewSet
    提供学生的 CRUD 操作
    """
    queryset = Student.objects.all().select_related('current_class')
    serializer_class = StudentSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'gender', 'current_class__grade_level']
    search_fields = ['name', 'student_id', 'current_class__class_name']
    ordering_fields = ['student_id', 'name', 'entry_date']
    ordering = ['student_id']

    def get_permissions(self):
        """
        根据操作类型设置不同的权限
        """
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            # 创建、编辑、删除需要管理员或级长权限
            permission_classes = [permissions.IsAuthenticated, IsAdminOrGradeManager]
        else:
            # 查看操作所有登录用户都可以
            permission_classes = [permissions.IsAuthenticated]
        
        return [permission() for permission in permission_classes]


class ClassViewSet(viewsets.ReadOnlyModelViewSet):
    """
    班级管理 ViewSet
    只提供查看操作
    """
    queryset = Class.objects.all()
    serializer_class = ClassSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['grade_level']
    ordering = ['grade_level', 'class_name']


class IsAdminOrGradeManager(permissions.BasePermission):
    """
    自定义权限类：只允许管理员或级长执行操作
    """
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            hasattr(request.user, 'role') and
            request.user.role in ['admin', 'grade_manager']
        )
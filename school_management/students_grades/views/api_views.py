from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from ..models.student import Student, Class
from ..serializers import StudentSerializer, ClassSerializer

class StudentViewSet(viewsets.ModelViewSet):
    """
    一个用于查看和编辑学生的 API 视图集。
    
    支持以下操作:
    - 列表 (list): `GET /api/students/`
    - 创建 (create): `POST /api/students/`
    - 详情 (retrieve): `GET /api/students/{id}/`
    - 更新 (update): `PUT /api/students/{id}/`
    - 部分更新 (partial_update): `PATCH /api/students/{id}/`
    - 删除 (destroy): `DELETE /api/students/{id}/`
    """
    queryset = Student.objects.select_related('current_class').all()
    serializer_class = StudentSerializer
    permission_classes = [IsAuthenticated]

    filterset_fields = ['grade_level', 'status', 'current_class__class_name']
    search_fields = ['name', 'student_id']

    def create(self, request, *args, **kwargs):
        """
        重写创建方法以处理嵌套的班级数据。
        """
        class_data = request.data.get('current_class')
        if class_data and 'grade_level' in class_data and 'class_name' in class_data:
            # 查找或创建班级
            grade_level = class_data['grade_level']
            class_name = class_data['class_name']
            
            if not grade_level or not class_name:
                return Response(
                    {"current_class": "年级和班级名称不能为空。"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            class_obj, created = Class.objects.get_or_create(
                grade_level=grade_level,
                class_name=class_name
            )
            
            # 修改请求数据，将班级对象ID赋值给 current_class_id
            mutable_data = request.data.copy()
            mutable_data['current_class_id'] = class_obj.id
            serializer = self.get_serializer(data=mutable_data)
        else:
            # 如果没有提供班级信息，确保 current_class_id 不在数据中或为 null
            mutable_data = request.data.copy()
            mutable_data.pop('current_class', None) # 移除嵌套对象
            serializer = self.get_serializer(data=mutable_data)
            
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        """
        重写更新方法以处理嵌套的班级数据。
        """
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        class_data = request.data.get('current_class')
        mutable_data = request.data.copy()

        if class_data and 'grade_level' in class_data and 'class_name' in class_data:
            grade_level = class_data['grade_level']
            class_name = class_data['class_name']

            if grade_level and class_name:
                class_obj, created = Class.objects.get_or_create(
                    grade_level=grade_level,
                    class_name=class_name
                )
                mutable_data['current_class_id'] = class_obj.id
        
        # 移除嵌套对象以避免验证错误
        mutable_data.pop('current_class', None)

        serializer = self.get_serializer(instance, data=mutable_data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        if getattr(instance, '_prefetched_objects_cache', None):
            # If 'prefetch_related' has been used, we need to reload the instance
            # from the database to get the updated data.
            instance = self.get_object()
            serializer = self.get_serializer(instance)

        return Response(serializer.data)


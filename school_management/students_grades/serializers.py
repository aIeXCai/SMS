from rest_framework import serializers
from .models.student import Student, Class

class ClassSerializer(serializers.ModelSerializer):
    class Meta:
        model = Class
        fields = ['id', 'grade_level', 'class_name']

class StudentSerializer(serializers.ModelSerializer):
    # 在读取（GET请求）时，使用嵌套的ClassSerializer来展示班级详情
    current_class = ClassSerializer(read_only=True)
    # 在写入（POST/PUT请求）时，只接受一个班级的ID
    current_class_id = serializers.PrimaryKeyRelatedField(
        queryset=Class.objects.all(), source='current_class', write_only=True, allow_null=True, required=False
    )

    class Meta:
        model = Student
        # 确保这里的字段与前端期望的一致
        fields = [
            'id', 
            'student_id', 
            'name', 
            'gender', 
            'date_of_birth', # 添加了出生日期
            'grade_level', 
            'current_class', # 用于读取
            'current_class_id', # 用于写入
            'status',
        ]

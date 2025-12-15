from rest_framework import serializers
from .models.student import Student
from .models.student import Class


class ClassSerializer(serializers.ModelSerializer):
    class Meta:
        model = Class
        fields = ['id', 'grade_level', 'class_name']


class StudentSerializer(serializers.ModelSerializer):
    current_class = ClassSerializer(read_only=True)
    current_class_id = serializers.PrimaryKeyRelatedField(
        queryset=Class.objects.all(),
        source='current_class',
        write_only=True,
        required=False,
        allow_null=True
    )

    class Meta:
        model = Student
        fields = [
            'id', 'student_id', 'name', 'gender', 'date_of_birth', 
            'entry_date', 'current_class', 'current_class_id', 'status'
        ]
        read_only_fields = ['id']

    def create(self, validated_data):
        # 处理嵌套的班级数据
        current_class_data = self.initial_data.get('current_class')
        if current_class_data and isinstance(current_class_data, dict):
            grade_level = current_class_data.get('grade_level')
            class_name = current_class_data.get('class_name')
            
            if grade_level and class_name:
                class_obj, created = Class.objects.get_or_create(
                    grade_level=grade_level,
                    class_name=class_name
                )
                validated_data['current_class'] = class_obj
        
        return super().create(validated_data)

    def update(self, instance, validated_data):
        # 处理嵌套的班级数据
        current_class_data = self.initial_data.get('current_class')
        if current_class_data and isinstance(current_class_data, dict):
            grade_level = current_class_data.get('grade_level')
            class_name = current_class_data.get('class_name')
            
            if grade_level and class_name:
                class_obj, created = Class.objects.get_or_create(
                    grade_level=grade_level,
                    class_name=class_name
                )
                validated_data['current_class'] = class_obj
        
        return super().update(instance, validated_data)
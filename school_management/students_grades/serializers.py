from rest_framework import serializers
from .models.student import Student
from .models.student import Class
from .models.exam import Exam, ExamSubject
from .models.score import Score


class ClassSerializer(serializers.ModelSerializer):
    # grade_level 已废弃，仅保留用于兼容，cohort 是新的主查询字段
    grade_level = serializers.CharField(read_only=True, required=False)

    class Meta:
        model = Class
        fields = ['id', 'grade_level', 'cohort', 'class_name']
        # 标记 grade_level 为废弃字段
        extra_kwargs = {
            'grade_level': {'help_text': 'DEPRECATED: 旧格式年级字段，请使用 cohort'}
        }


class StudentSerializer(serializers.ModelSerializer):
    current_class = ClassSerializer(read_only=True)
    current_class_id = serializers.PrimaryKeyRelatedField(
        queryset=Class.objects.all(),
        source='current_class',
        write_only=True,
        required=False,
        allow_null=True
    )
    # 新增字段：cohort 是主查询字段，grade_level 保留用于展示但已废弃
    cohort = serializers.CharField(source='cohort', read_only=True, required=False)
    grade_level = serializers.CharField(source='grade_level', read_only=True, required=False)

    class Meta:
        model = Student
        fields = [
            'id', 'student_id', 'name', 'gender', 'date_of_birth',
            'entry_date', 'graduation_date', 'id_card_number',
            'student_enrollment_number', 'home_address', 'guardian_name',
            'guardian_contact_phone', 'current_class', 'current_class_id',
            'status', 'cohort', 'grade_level'
        ]
        read_only_fields = ['id']
        # 标记 grade_level 为废弃字段
        extra_kwargs = {
            'grade_level': {'help_text': 'DEPRECATED: 旧格式年级字段，请使用 cohort'},
            'cohort': {'help_text': '新的届别格式，如"初中2024级"'}
        }

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


class ExamSubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExamSubject
        fields = ['id', 'exam', 'subject_code', 'subject_name', 'max_score']

class ExamSubjectWriteSerializer(serializers.Serializer):
    subject_code = serializers.CharField(max_length=50)
    max_score = serializers.IntegerField(min_value=1)

class ExamSerializer(serializers.ModelSerializer):
    exam_subjects = ExamSubjectSerializer(many=True, read_only=True)
    subjects = ExamSubjectWriteSerializer(many=True, write_only=True, required=False)

    class Meta:
        model = Exam
        fields = ['id', 'name', 'academic_year', 'date', 'grade_level', 'description', 'exam_subjects', 'subjects']

    def create(self, validated_data):
        subjects_data = validated_data.pop('subjects', [])
        exam = Exam.objects.create(**validated_data)
        for s in subjects_data:
            ExamSubject.objects.create(
                exam=exam,
                subject_code=s['subject_code'],
                subject_name=s['subject_code'],
                max_score=s['max_score'],
            )
        return exam

    def update(self, instance, validated_data):
        subjects_data = validated_data.pop('subjects', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if subjects_data is not None:
            submitted_codes = {s['subject_code'] for s in subjects_data}
            # 只删除被移除的科目，保留已有科目的关联成绩
            instance.exam_subjects.exclude(subject_code__in=submitted_codes).delete()
            # 更新或创建科目
            for s in subjects_data:
                ExamSubject.objects.update_or_create(
                    exam=instance,
                    subject_code=s['subject_code'],
                    defaults={
                        'subject_name': s['subject_code'],
                        'max_score': s['max_score'],
                    }
                )
        return instance


class ScoreSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.name', read_only=True)
    student_id_display = serializers.CharField(source='student.student_id', read_only=True)
    exam_name = serializers.CharField(source='exam.name', read_only=True)

    class Meta:
        model = Score
        fields = [
            'id', 'student', 'exam', 'subject', 'score_value',
            'student_name', 'student_id_display', 'exam_name'
        ]

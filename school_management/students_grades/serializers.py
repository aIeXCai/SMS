from rest_framework import serializers
from .models.student import Student
from .models.student import Class
from .models.exam import Exam, ExamSubject, SUBJECT_CHOICES as EXAM_SUBJECT_CHOICES
from .models.score import Score
from .models.filter import SavedFilterRule, FilterResultSnapshot
from .services.advanced_filter import AdvancedFilterService


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

    class Meta:
        model = Student
        fields = [
            'id', 'student_id', 'name', 'gender', 'date_of_birth',
            'entry_date', 'graduation_date', 'id_card_number',
            'student_enrollment_number', 'home_address', 'guardian_name',
            'guardian_contact_phone', 'current_class', 'current_class_id',
            'status'
        ]
        read_only_fields = ['id']

    def create(self, validated_data):
        # 处理嵌套的班级数据
        current_class_data = self.initial_data.get('current_class')
        if current_class_data and isinstance(current_class_data, dict):
            grade_level = current_class_data.get('grade_level')
            class_name = current_class_data.get('class_name')
            cohort = current_class_data.get('cohort')

            if grade_level and class_name:
                class_obj, created = Class.objects.get_or_create(
                    grade_level=grade_level,
                    class_name=class_name,
                    defaults={
                        'cohort': cohort or ''
                    }
                )
                # 如果已存在但 cohort 不同，更新 cohort
                if not created and cohort and class_obj.cohort != cohort:
                    class_obj.cohort = cohort
                    class_obj.save(update_fields=['cohort'])
                validated_data['current_class'] = class_obj

        return super().create(validated_data)

    def update(self, instance, validated_data):
        # 处理嵌套的班级数据
        current_class_data = self.initial_data.get('current_class')
        if current_class_data and isinstance(current_class_data, dict):
            grade_level = current_class_data.get('grade_level')
            class_name = current_class_data.get('class_name')
            cohort = current_class_data.get('cohort')

            if grade_level and class_name:
                class_obj, created = Class.objects.get_or_create(
                    grade_level=grade_level,
                    class_name=class_name,
                    defaults={
                        'cohort': cohort or ''
                    }
                )
                # 如果已存在但 cohort 不同，更新 cohort
                if not created and cohort and class_obj.cohort != cohort:
                    class_obj.cohort = cohort
                    class_obj.save(update_fields=['cohort'])
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
    exam_subjects = serializers.SerializerMethodField(read_only=True)
    subjects = ExamSubjectWriteSerializer(many=True, write_only=True, required=False)

    class Meta:
        model = Exam
        fields = ['id', 'name', 'academic_year', 'date', 'grade_level', 'description', 'exam_subjects', 'subjects']

    def get_exam_subjects(self, obj):
        order_map = {code: index for index, (code, _) in enumerate(EXAM_SUBJECT_CHOICES)}
        exam_subjects = list(obj.exam_subjects.all())
        exam_subjects.sort(key=lambda item: (order_map.get(item.subject_code, 10_000), item.subject_code))
        return ExamSubjectSerializer(exam_subjects, many=True).data

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


class SavedFilterRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavedFilterRule
        fields = [
            'id',
            'name',
            'rule_type',
            'rule_config',
            'usage_count',
            'last_used_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'usage_count', 'last_used_at', 'created_at', 'updated_at']

    def validate_rule_type(self, value):
        if value not in {'simple', 'advanced'}:
            raise serializers.ValidationError('rule_type 必须是 simple 或 advanced')
        return value

    def validate_rule_config(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError('rule_config 必须是对象')

        logic = (value.get('logic') or '').upper()
        if logic not in {'AND', 'OR'}:
            raise serializers.ValidationError('rule_config.logic 必须是 AND 或 OR')

        conditions = value.get('conditions')
        if not isinstance(conditions, list) or len(conditions) == 0:
            raise serializers.ValidationError('rule_config.conditions 必须是非空数组')

        for condition in conditions:
            if not AdvancedFilterService.validate_condition(condition):
                raise serializers.ValidationError('rule_config.conditions 存在非法条件')

        return {
            **value,
            'logic': logic,
        }


class FilterResultSnapshotSerializer(serializers.ModelSerializer):
    exam_id = serializers.PrimaryKeyRelatedField(
        queryset=Exam.objects.all(),
        source='exam',
        write_only=True,
    )
    rule_id = serializers.PrimaryKeyRelatedField(
        queryset=SavedFilterRule.objects.all(),
        source='rule',
        write_only=True,
        required=False,
        allow_null=True,
    )

    exam_name = serializers.CharField(source='exam.name', read_only=True)
    exam_academic_year = serializers.CharField(source='exam.academic_year', read_only=True)
    rule_name = serializers.CharField(source='rule.name', read_only=True)
    student_count = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = FilterResultSnapshot
        fields = [
            'id',
            'snapshot_name',
            'exam_id',
            'exam_name',
            'exam_academic_year',
            'rule_id',
            'rule_name',
            'rule_config_snapshot',
            'result_snapshot',
            'student_count',
            'created_at',
        ]
        read_only_fields = ['id', 'exam_name', 'exam_academic_year', 'rule_name', 'student_count', 'created_at']

    def get_student_count(self, obj):
        if not isinstance(obj.result_snapshot, dict):
            return 0
        return int(obj.result_snapshot.get('count') or 0)

    def validate_rule_id(self, value):
        request = self.context.get('request')
        if request and value and value.user_id != request.user.id:
            raise serializers.ValidationError('只能使用自己的规则')
        return value

    def validate_result_snapshot(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError('result_snapshot 必须是对象')

        student_ids = value.get('student_ids')
        count = value.get('count')

        if not isinstance(student_ids, list):
            raise serializers.ValidationError('result_snapshot.student_ids 必须是数组')

        normalized_ids = []
        for student_id in student_ids:
            if not isinstance(student_id, int) or student_id <= 0:
                raise serializers.ValidationError('result_snapshot.student_ids 只能包含正整数')
            normalized_ids.append(student_id)

        if len(normalized_ids) != len(set(normalized_ids)):
            raise serializers.ValidationError('result_snapshot.student_ids 不能有重复值')

        if not isinstance(count, int) or count < 0:
            raise serializers.ValidationError('result_snapshot.count 必须是非负整数')

        if count != len(normalized_ids):
            raise serializers.ValidationError('result_snapshot.count 与 student_ids 数量不一致')

        return {
            **value,
            'student_ids': normalized_ids,
            'count': count,
        }

    def validate(self, attrs):
        request = self.context.get('request')
        exam = attrs.get('exam')
        rule = attrs.get('rule')

        if request and exam and rule and request.user.id != rule.user_id:
            raise serializers.ValidationError({'rule_id': '只能使用自己的规则'})

        if request and exam:
            # 快照所属用户由视图层 perform_create 注入，此处仅做 exam 基本存在性后的扩展位
            pass

        return attrs

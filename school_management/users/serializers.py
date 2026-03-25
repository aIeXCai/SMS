from rest_framework import serializers
from .models import CustomUser


class CurrentUserSerializer(serializers.ModelSerializer):
    # 新字段：学段 + 入学年份（可写）
    managed_section = serializers.CharField(required=False, allow_null=True)
    managed_cohort_year = serializers.IntegerField(required=False, allow_null=True)

    # 兼容字段：保留旧 managed_grade（只读，用于兼容旧数据展示）
    managed_grade = serializers.CharField(read_only=True, required=False)

    # 组合字段：managed_cohort（只读，计算得出）
    managed_cohort = serializers.SerializerMethodField()

    def get_managed_cohort(self, obj):
        section_map = {'junior': '初中', 'senior': '高中'}
        if obj.managed_section and obj.managed_cohort_year:
            return f"{section_map.get(obj.managed_section, obj.managed_section)}{obj.managed_cohort_year}级"
        return None

    class Meta:
        model = CustomUser
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'managed_grade', 'managed_section', 'managed_cohort_year',
            'managed_cohort'
        ]
        extra_kwargs = {
            'managed_grade': {'read_only': True},
        }

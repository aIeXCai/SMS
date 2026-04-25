from rest_framework import serializers
from .models import CustomUser


class CurrentUserSerializer(serializers.ModelSerializer):
    managed_grade = serializers.CharField(read_only=True, required=False)
    teaching_classes = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = [
            'id', 'username', 'email', 'name',
            'role', 'managed_grade', 'teaching_classes',
        ]
        extra_kwargs = {
            'managed_grade': {'read_only': True},
        }

    def get_teaching_classes(self, obj):
        classes = getattr(obj, "teaching_classes", None)
        if classes is None:
            return []

        rows = classes.all().order_by("grade_level", "class_name")
        return [
            {
                "id": row.id,
                "grade_level": row.grade_level,
                "cohort": row.cohort,
                "class_name": row.class_name,
                "display_name": f"{row.grade_level}{row.class_name}",
            }
            for row in rows
        ]

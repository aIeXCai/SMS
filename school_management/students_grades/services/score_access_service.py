from ..models.score import Score
from ..models.student import Class


class ScoreAccessService:
    """成绩相关读权限作用域服务。"""

    @staticmethod
    def _is_unrestricted(user):
        return getattr(user, "role", None) in {"admin", "staff"}

    @classmethod
    def scoped_class_ids(cls, user):
        if cls._is_unrestricted(user):
            return None

        role = getattr(user, "role", None)
        if role == "grade_manager":
            managed_grade = getattr(user, "managed_grade", None)
            if not managed_grade:
                return []
            return list(Class.objects.filter(grade_level=managed_grade).values_list("id", flat=True))

        if role == "subject_teacher":
            return list(user.teaching_classes.values_list("id", flat=True))

        return []

    @classmethod
    def scope_scores(cls, user, queryset):
        class_ids = cls.scoped_class_ids(user)
        if class_ids is None:
            return queryset
        if not class_ids:
            return queryset.none()
        return queryset.filter(student__current_class_id__in=class_ids)

    @classmethod
    def scope_students(cls, user, queryset):
        class_ids = cls.scoped_class_ids(user)
        if class_ids is None:
            return queryset
        if not class_ids:
            return queryset.none()
        return queryset.filter(current_class_id__in=class_ids)

    @classmethod
    def scope_classes(cls, user, queryset):
        class_ids = cls.scoped_class_ids(user)
        if class_ids is None:
            return queryset
        if not class_ids:
            return queryset.none()
        return queryset.filter(id__in=class_ids)

    @classmethod
    def scope_exams_from_scores(cls, user, queryset):
        """Return exams that HAVE scores the user can see."""
        if cls._is_unrestricted(user):
            return queryset

        accessible_exam_ids = cls.scope_scores(
            user,
            Score.objects.all(),
        ).values_list("exam_id", flat=True).distinct()
        return queryset.filter(id__in=accessible_exam_ids)

    @classmethod
    def scope_exams_for_entry(cls, user, queryset):
        """Return exams the user can ENTER scores for (including exams with no scores yet)."""
        if cls._is_unrestricted(user):
            return queryset

        # Find cohorts associated with user's accessible classes
        class_ids = cls.scoped_class_ids(user)
        if not class_ids:
            return queryset.none()

        cohorts = Class.objects.filter(id__in=class_ids).values_list("cohort", flat=True).distinct()
        return queryset.filter(grade_level__in=cohorts)

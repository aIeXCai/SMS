"""Permission filters for Agent Tool queries."""

from ...models.score import Score
from ...models.student import Class, Student

PERMISSION_DENIED_MESSAGE = "未找到符合条件且你有权限查看的数据，请检查查询范围或联系管理员。"


class AgentPermissionError(PermissionError):
    pass


def permission_denied_result():
    return {
        "error": PERMISSION_DENIED_MESSAGE,
        "status": "permission_denied",
        "fallback": {"available": False, "reason": "permission_denied"},
    }


def ensure_context_allowed(security_context):
    if not security_context or not security_context.allowed:
        raise AgentPermissionError(PERMISSION_DENIED_MESSAGE)


def scope_students(security_context, queryset):
    ensure_context_allowed(security_context)
    if security_context.is_unrestricted:
        return queryset
    return queryset.filter(current_class_id__in=security_context.allowed_class_ids or [])


def scope_scores(security_context, queryset):
    ensure_context_allowed(security_context)
    if security_context.is_unrestricted:
        return queryset
    return queryset.filter(student__current_class_id__in=security_context.allowed_class_ids or [])


def scope_classes(security_context, queryset):
    ensure_context_allowed(security_context)
    if security_context.is_unrestricted:
        return queryset
    return queryset.filter(id__in=security_context.allowed_class_ids or [])


def allowed_student_ids(security_context):
    return set(scope_students(security_context, Student.objects.all()).values_list("id", flat=True))


def allowed_class_ids(security_context):
    return set(scope_classes(security_context, Class.objects.all()).values_list("id", flat=True))


def allowed_exam_ids(security_context):
    return set(scope_scores(security_context, Score.objects.all()).values_list("exam_id", flat=True).distinct())

"""Build and carry the V3 Agent permission context."""

from dataclasses import dataclass

from ...models.student import Class
from ...services.score_access_service import ScoreAccessService


@dataclass(frozen=True)
class AgentSecurityContext:
    user_id: int | None
    role: str | None
    allowed_class_ids: list[int] | None
    is_unrestricted: bool
    deny_reason: str | None = None

    @property
    def allowed(self):
        return self.deny_reason is None

    def scope_summary(self):
        if self.is_unrestricted:
            return {"type": "all_school"}
        return {
            "type": "class_ids",
            "count": len(self.allowed_class_ids or []),
        }


def build_agent_security_context(user):
    if not user or not getattr(user, "is_authenticated", False):
        return AgentSecurityContext(None, None, [], False, "unauthenticated")

    role = getattr(user, "role", None)
    user_id = getattr(user, "id", None)

    if role in {"admin", "staff"}:
        return AgentSecurityContext(user_id, role, None, True)

    if role == "grade_manager":
        managed_grade = getattr(user, "managed_grade", None)
        if not managed_grade:
            return AgentSecurityContext(user_id, role, [], False, "missing_managed_grade")
        class_ids = list(Class.objects.filter(grade_level=managed_grade).values_list("id", flat=True))
        if not class_ids:
            return AgentSecurityContext(user_id, role, [], False, "empty_managed_grade")
        return AgentSecurityContext(user_id, role, class_ids, False)

    if role == "subject_teacher":
        class_ids = ScoreAccessService.scoped_class_ids(user)
        if not class_ids:
            return AgentSecurityContext(user_id, role, [], False, "missing_teaching_classes")
        return AgentSecurityContext(user_id, role, class_ids, False)

    return AgentSecurityContext(user_id, role, [], False, "unsupported_role")

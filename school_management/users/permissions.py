from rest_framework import permissions


class _RolePermissionBase(permissions.BasePermission):
    """Base role permission: allow only authenticated users with allowed roles."""

    allowed_roles = frozenset()

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and hasattr(user, "role")
            and user.role in self.allowed_roles
        )


class IsAdminOrStaff(_RolePermissionBase):
    allowed_roles = frozenset({"admin", "staff"})


class IsAdminOrGradeManagerOrStaff(_RolePermissionBase):
    allowed_roles = frozenset({"admin", "grade_manager", "staff"})

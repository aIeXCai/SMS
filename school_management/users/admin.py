from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ('角色信息', {'fields': ('role', 'managed_grade', 'managed_section', 'managed_cohort_year')}),
    )
    list_display = ('username', 'email', 'first_name', 'last_name', 'role', 'managed_section', 'managed_cohort_year', 'managed_grade', 'is_staff')
    list_filter = ('role', 'is_staff', 'is_superuser', 'is_active', 'managed_section')

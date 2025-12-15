from django.contrib.auth.models import AbstractUser
from django.db import models


class CustomUser(AbstractUser):
    class RoleChoices(models.TextChoices):
        SUBJECT_TEACHER = 'subject_teacher', '科任老师'
        STAFF = 'staff', '教辅人员'
        GRADE_MANAGER = 'grade_manager', '级长'
        ADMIN = 'admin', '管理员'

    role = models.CharField(max_length=32, choices=RoleChoices.choices, default=RoleChoices.STAFF, verbose_name='角色')

    # 可选：级长负责的年级（简单起见用 CharField；若需多年级可另建表或改为多对多）
    managed_grade = models.CharField(max_length=10, blank=True, null=True, verbose_name='负责年级')

    class Meta:
        verbose_name = '用户'
        verbose_name_plural = '用户'

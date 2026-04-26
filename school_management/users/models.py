from django.contrib.auth.models import AbstractUser
from django.db import models

GRADE_CHOICES = [
    ('初一', '初一'),
    ('初二', '初二'),
    ('初三', '初三'),
    ('高一', '高一'),
    ('高二', '高二'),
    ('高三', '高三'),
]


class CustomUser(AbstractUser):
    class RoleChoices(models.TextChoices):
        SUBJECT_TEACHER = 'subject_teacher', '科任老师'
        STAFF = 'staff', '教辅人员'
        GRADE_MANAGER = 'grade_manager', '级长'
        ADMIN = 'admin', '管理员'

    role = models.CharField(max_length=32, choices=RoleChoices.choices, default=RoleChoices.STAFF, verbose_name='角色')

    # 级长/科任老师负责的年级
    managed_grade = models.CharField(max_length=16, choices=GRADE_CHOICES, blank=True, null=True, verbose_name='负责年级')

    # 姓名（合并 last_name + first_name）
    name = models.CharField(max_length=150, blank=True, default='', verbose_name='姓名')

    # 继承自 AbstractUser，保留字段但不再使用
    first_name = models.CharField(max_length=150, blank=True, null=True, editable=False)
    last_name = models.CharField(max_length=150, blank=True, null=True, editable=False)

    class Meta:
        verbose_name = '用户'
        verbose_name_plural = '用户'

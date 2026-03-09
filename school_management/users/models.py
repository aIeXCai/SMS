from django.contrib.auth.models import AbstractUser
from django.db import models

GRADE_CHOICES = [
    ('grade_7', '初一'),
    ('grade_8', '初二'),
    ('grade_9', '初三'),
    ('grade_10', '高一'),
    ('grade_11', '高二'),
    ('grade_12', '高三'),
]

class CustomUser(AbstractUser):
    class RoleChoices(models.TextChoices):
        SUBJECT_TEACHER = 'subject_teacher', '科任老师'
        STAFF = 'staff', '教辅人员'
        GRADE_MANAGER = 'grade_manager', '级长'
        ADMIN = 'admin', '管理员'

    role = models.CharField(max_length=32, choices=RoleChoices.choices, default=RoleChoices.STAFF, verbose_name='角色')

    # 可选：级长负责的年级（初一、初二、初三、高一、高二、高三）
    managed_grade = models.CharField(max_length=16, choices=GRADE_CHOICES, blank=True, null=True, verbose_name='负责年级')
    
    class Meta:
        verbose_name = '用户'
        verbose_name_plural = '用户'

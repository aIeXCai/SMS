from django.contrib.auth.models import AbstractUser
from django.db import models

SECTION_CHOICES = [
    ('junior', '初中'),
    ('senior', '高中'),
]

COHORT_YEAR_CHOICES = [
    (2024, '2024级'),
    (2025, '2025级'),
    (2026, '2026级'),
    (2027, '2027级'),
    (2028, '2028级'),
    (2029, '2029级'),
]

# 旧版年级选项（兼容旧数据）
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

    # 旧字段（保留兼容）：级长负责的年级
    managed_grade = models.CharField(max_length=16, choices=GRADE_CHOICES, blank=True, null=True, verbose_name='负责年级(旧)')

    # 新字段：级长负责的学段（junior=初中, senior=高中）
    managed_section = models.CharField(max_length=8, choices=SECTION_CHOICES, blank=True, null=True, verbose_name='负责学段')
    # 新字段：级长负责的入学年份（如 2026）
    managed_cohort_year = models.IntegerField(choices=COHORT_YEAR_CHOICES, blank=True, null=True, verbose_name='负责入学年份')
    
    class Meta:
        verbose_name = '用户'
        verbose_name_plural = '用户'

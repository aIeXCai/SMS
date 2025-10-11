from random import choices
from django.db import models
from django.contrib.auth.models import User # Django 内建的用户模型
from django.core.validators import RegexValidator
# 如果你在 settings.py 中配置了 AUTH_USER_MODEL 为自定义用户模型，则需要导入你自己的用户模型

GRADE_LEVEL_CHOICES = [
    ('高一', '高一'),
    ('高二', '高二'),
    ('高三', '高三'),
    ('初一', '初一'),
    ('初二', '初二'),
    ('初三', '初三'),
    # 可以根據需要添加更多年級，例如 '初一', '初二', '初三'
]

CLASS_NAME_CHOICES = [(f'{i}班', f'{i}班') for i in range(1, 21)]

STATUS_CHOICES = [
    ('在读', '在读'),
    ('转学', '转学'),
    ('休学', '休学'),
    ('复学', '复学'),
    ('毕业', '毕业'),
]

class Class(models.Model):
    """
    班級實體：管理學校的班級資訊，包含年級。
    """
    grade_level = models.CharField(max_length=10, choices=GRADE_LEVEL_CHOICES, verbose_name="年级")
    class_name = models.CharField(max_length=20, choices=CLASS_NAME_CHOICES, verbose_name="班级名称") # 例如 '1班', '2班'
    # full_class_name 可以在 Model 方法中生成，無需單獨儲存
    homeroom_teacher = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="班主任")

    class Meta:
        # 确保在同一學年（年級）下，班級名稱是唯一的
        unique_together = ('grade_level', 'class_name')
        verbose_name = "班级"
        verbose_name_plural = "班级"

    def __str__(self):
        return f"{self.grade_level}{self.class_name}" # 例如：高一1班


class Student(models.Model):
    """
    學生實體：儲存每個學生的基本資料。
    """
    student_id = models.CharField(max_length=20, unique=True, verbose_name="学号")
    name = models.CharField(max_length=50, verbose_name="姓名")
    
    gender_choices = [
        ('男', '男'),
        ('女', '女'),
    ]
    gender = models.CharField(max_length=5, choices=gender_choices, null=True, blank=True, verbose_name="性别")
    
    date_of_birth = models.DateField(null=True, blank=True, verbose_name="出生日期")
    grade_level = models.CharField(
        max_length=10,
        choices=GRADE_LEVEL_CHOICES,
        verbose_name="年級",
        null=True,
        blank=True
    )
    current_class = models.ForeignKey(Class, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="当前班级") # 保持與 Class 的外鍵關係
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='在读', verbose_name="在校状态")
    
    id_card_number = models.CharField(
        max_length=18, 
        unique=True, 
        null=True, 
        blank=True, 
        verbose_name="身份证号码",
        validators=[
            RegexValidator(
                regex=r'^[1-9]\d{5}(18|19|20)\d{2}((0[1-9])|(1[0-2]))(([0-2][1-9])|10|20|30|31)\d{3}[0-9Xx]$',
                message='身份证号码格式不正确'
            )
        ]
    )
    student_enrollment_number = models.CharField(max_length=30, unique=True, null=True, blank=True, verbose_name="学籍号")
    home_address = models.TextField(null=True, blank=True, verbose_name="家庭地址")
    guardian_name = models.CharField(max_length=50, null=True, blank=True, verbose_name="监护人姓名")
    guardian_contact_phone = models.CharField(
        max_length=20, 
        null=True, 
        blank=True, 
        verbose_name="监护人联系电话",
        validators=[
            RegexValidator(
                regex=r'^1[3-9]\d{9}$',
                message='请输入正确的手机号码格式'
            )
        ]
    )
    entry_date = models.DateField(null=True, blank=True, verbose_name="入学日期")
    graduation_date = models.DateField(null=True, blank=True, verbose_name="毕业日期")

    class Meta:
        verbose_name = "学生"
        verbose_name_plural = "学生"
        ordering = ['grade_level', 'current_class__class_name', 'name']

    def __str__(self):
        class_name = self.current_class.class_name if self.current_class else "未分班"
        return f"{self.name} ({self.student_id}) - {self.get_grade_level_display()}{class_name}"
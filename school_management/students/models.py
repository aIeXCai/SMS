from random import choices
from django.db import models
from django.contrib.auth.models import User # Django 内建的用户模型
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
    ('在讀', '在读'),
    ('轉學', '转学'),
    ('休學', '休学'),
    ('復學', '复学'),
    ('畢業', '毕业'),
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
    gender = models.CharField(max_length=5, choices=gender_choices, verbose_name="性别")
    
    date_of_birth = models.DateField(verbose_name="出生日期")
    current_class = models.ForeignKey(Class, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="当前班级") # 保持與 Class 的外鍵關係
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='在讀', verbose_name="在校状态")
    
    id_card_number = models.CharField(max_length=18, unique=True, null=True, blank=True, verbose_name="身份证号码")
    student_enrollment_number = models.CharField(max_length=30, unique=True, null=True, blank=True, verbose_name="学籍号")
    home_address = models.TextField(null=True, blank=True, verbose_name="家庭地址")
    guardian_name = models.CharField(max_length=50, null=True, blank=True, verbose_name="监护人姓名")
    guardian_contact_phone = models.CharField(max_length=20, null=True, blank=True, verbose_name="监护人联系电话")
    entry_date = models.DateField(verbose_name="入学日期")
    graduation_date = models.DateField(null=True, blank=True, verbose_name="毕业日期")

    class Meta:
        verbose_name = "学生"
        verbose_name_plural = "学生"

    def __str__(self):
        return f"{self.name} ({self.student_id})"

class Exam(models.Model):
    """
    考試實體：記錄每次考試的基本資訊。
    """
    name = models.CharField(max_length=100, verbose_name="考试名称")
    exam_date = models.DateField(verbose_name="考试日期")
    academic_year = models.CharField(max_length=20, verbose_name="学年") # 例如 '2024-2025'

    class Meta:
        verbose_name = "考试"
        verbose_name_plural = "考试"
        # 确保同一学年内考试名称唯一
        unique_together = ('name', 'academic_year')

    def __str__(self):
        return f"{self.academic_year} {self.name}"

class Subject(models.Model):
    """
    科目實體：定義學校開設的所有學科。
    """
    name = models.CharField(max_length=50, unique=True, verbose_name="科目名称")
    description = models.TextField(null=True, blank=True, verbose_name="描述")

    class Meta:
        verbose_name = "科目"
        verbose_name_plural = "科目"

    def __str__(self):
        return self.name

class Score(models.Model):
    """
    成績實體：記錄學生在某次考試中某個科目的具體得分和排名。
    """
    student = models.ForeignKey(Student, on_delete=models.CASCADE, verbose_name="学生")
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, verbose_name="考试")
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, verbose_name="科目")
    score_value = models.DecimalField(max_digits=5, decimal_places=2, verbose_name="得分") # 可以存 999.99
    
    # 排名字段，可以为空，因为排名可能需要计算后才填入
    grade_rank_in_subject = models.IntegerField(null=True, blank=True, verbose_name="学科年级排名")
    total_score_rank_in_grade = models.IntegerField(null=True, blank=True, verbose_name="总分年级排名")
    
    recorded_at = models.DateTimeField(auto_now_add=True, verbose_name="记录时间")

    class Meta:
        verbose_name = "成绩"
        verbose_name_plural = "成绩"
        # 确保一个学生在同一场考试的同一科目中只有一条成绩记录
        unique_together = ('student', 'exam', 'subject')

    def __str__(self):
        return f"{self.student.name} - {self.exam.name} - {self.subject.name}: {self.score_value}"
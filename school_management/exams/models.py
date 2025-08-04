from django.db import models
from school_management.students.models import Student, GRADE_LEVEL_CHOICES # 導入年級選項，確保一致性

ACADEMIC_YEAR_CHOICES = []
for year in range(2025, 2030): # 從2025年到2029年
    academic_year_str = f"{year}-{year+1}"
    ACADEMIC_YEAR_CHOICES.append((academic_year_str, academic_year_str))

SUBJECT_CHOICES = [
    ('语文', '语文'),
    ('数学', '数学'),
    ('英语', '英语'),
    ('政治', '政治'),
    ('历史', '历史'),
    ('物理', '物理'),
    ('化学', '化学'),
    ('生物', '生物'),
    ('地理', '地理'),
    ('体育', '体育'),
    # ('美术', '美术'),
    # ('音乐', '音乐'),
    # ('心理', '心理'),
    # ('信息技术', '信息技术'),
    # 可以根據需要添加更多科目
]

# 不同年级科目的默认满分配置
SUBJECT_DEFAULT_MAX_SCORES = {
    # 初中年级
    '初一': {
        '语文': 120, '数学': 120, '英语': 120,
        '政治': 90, '历史': 90, '物理': 100,
        '化学': 100, '生物': 100, '地理': 100, '体育': 70
    },
    '初二': {
        '语文': 120, '数学': 120, '英语': 120,
        '政治': 90, '历史': 90, '物理': 100,
        '化学': 100, '生物': 100, '地理': 100, '体育': 70
    },
    '初三': {
        '语文': 120, '数学': 120, '英语': 120,
        '政治': 90, '历史': 90, '物理': 100,
        '化学': 100, '生物': 100, '地理': 100, '体育': 70
    },
    # 高中年级
    '高一': {
        '语文': 150, '数学': 150, '英语': 150,
        '政治': 100, '历史': 100, '物理': 100,
        '化学': 100, '生物': 100, '地理': 100, '体育': 60
    },
    '高二': {
        '语文': 150, '数学': 150, '英语': 150,
        '政治': 100, '历史': 100, '物理': 100,
        '化学': 100, '生物': 100, '地理': 100, '体育': 60
    },
    '高三': {
        '语文': 150, '数学': 150, '英语': 150,
        '政治': 100, '历史': 100, '物理': 100,
        '化学': 100, '生物': 100, '地理': 100, '体育': 60
    }
}

class Exam(models.Model):
    """
    考試模型，用於記錄每次考試的基本資訊。
    """
    name = models.CharField(max_length=100, verbose_name="考試名稱")
    academic_year = models.CharField(
        max_length=10,
        choices=ACADEMIC_YEAR_CHOICES, # 使用定義好的選項
        verbose_name="學年",
        help_text="請選擇考試所屬的學年 (例如: 2025-2026)",
        null = True,
        blank = True
    )
    date = models.DateField(verbose_name="考試日期")
    # 可以指定適用年級，或者如果考試是跨年級的，可以設計為多對多關係
    # 這裡先使用單一年級，沿用 students.models 中的 GRADE_LEVEL_CHOICES
    grade_level = models.CharField(
        max_length=10,
        choices=GRADE_LEVEL_CHOICES,
        verbose_name="適用年級"
    )
    description = models.TextField(
        blank=True,
        null=True,
        verbose_name="考试描述",
        help_text="可选：填写考试的相关说明或注意事项"
    )

    class Meta:
        verbose_name = "考试"
        verbose_name_plural = "考试管理"
        ordering = ['-date', 'grade_level', 'name'] # 依日期降序、年級、名稱排序
        unique_together = ('academic_year', 'name', 'grade_level') # 同一學年內，相同年級的考試名稱必須唯一

    def __str__(self):
        if self.academic_year:
            return f"{self.academic_year} {self.name} ({self.get_grade_level_display()})"
        else:
            return f"{self.name} ({self.get_grade_level_display()})"
    
    def get_default_subjects_config(self):
        """
        根据年级获取默认的科目配置
        """
        return SUBJECT_DEFAULT_MAX_SCORES.get(self.grade_level, {})

class ExamSubject(models.Model):
    """
    考试科目模型，用于记录每个考试包含的科目及其满分配置
    """
    exam = models.ForeignKey(
        Exam,
        on_delete=models.CASCADE,
        related_name='exam_subjects',
        verbose_name="考试"
    )
    subject_code = models.CharField(
        max_length=50,
        choices=SUBJECT_CHOICES,
        verbose_name="科目代码"
    )
    subject_name = models.CharField(
        max_length=100,
        verbose_name="科目名称",
        help_text="通常与科目代码相同，但可以自定义"
    )
    max_score = models.IntegerField(
        verbose_name="满分",
        help_text="该科目在此次考试中的满分"
    )
    
    # 自动时间戳
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")
    
    class Meta:
        verbose_name = "考试科目"
        verbose_name_plural = "考试科目配置"
        unique_together = ('exam', 'subject_code')
        # 移除默认排序，让视图层根据SUBJECT_CHOICES顺序控制排序
    
    def __str__(self):
        return f"{self.exam.name} - {self.subject_name} ({self.max_score}分)"
    
    @classmethod
    def get_default_max_score(cls, grade_level, subject_code):
        """
        获取指定年级和科目的默认满分
        """
        grade_config = SUBJECT_DEFAULT_MAX_SCORES.get(grade_level, {})
        return grade_config.get(subject_code, 100)  # 默认100分
    
    def save(self, *args, **kwargs):
        # 如果没有设置科目名称，使用科目代码
        if not self.subject_name:
            self.subject_name = self.subject_code
        super().save(*args, **kwargs)

class Score(models.Model):
    """
    成績模型，用於記錄學生在某場考試某科目上的分數。
    """
    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE, # 學生刪除時，其成績也刪除
        verbose_name="學生",
        related_name="exam_scores"
    )
    exam = models.ForeignKey(
        Exam,
        on_delete=models.CASCADE, # 考試刪除時，相關成績也刪除
        verbose_name="考試"
    )
    exam_subject = models.ForeignKey(
        ExamSubject,
        on_delete=models.SET_NULL,
        verbose_name="考试科目",
        help_text="关联到具体的考试科目配置",
        null=True,  # 允许为空，当ExamSubject被删除时设为NULL
        blank=True
    )
    # 保留原有的subject字段，用于向后兼容
    subject = models.CharField(
        max_length=50,
        choices=SUBJECT_CHOICES, # 使用預定義的科目選項
        verbose_name="科目"
    )
    score_value = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        verbose_name="分數"
    )
    
    # 添加排名字段
    grade_rank_in_subject = models.IntegerField(null=True, blank=True, verbose_name="学科年级排名")
    total_score_rank_in_grade = models.IntegerField(null=True, blank=True, verbose_name="总分年级排名")
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="創建時間")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新時間")

    class Meta:
        verbose_name = "成績"
        verbose_name_plural = "成績記錄"
        # 確保同一學生在同一考試中的同一科目只能有一條成績記錄
        unique_together = ('student', 'exam', 'subject')
        # 按考試日期、學生姓名、科目排序
        ordering = ['exam__date', 'student__name', 'subject']
        # 添加数据库索引以提升查询性能
        indexes = [
            models.Index(fields=['student', 'exam'], name='score_student_exam_idx'),
            models.Index(fields=['exam', 'subject'], name='score_exam_subject_idx'),
            models.Index(fields=['student', 'subject'], name='score_student_subject_idx'),
        ]

    def clean(self):
        """
        验证分数是否超过该科目的满分
        """
        from django.core.exceptions import ValidationError
        
        # 如果有exam_subject关联，验证分数不超过满分
        if self.exam_subject and self.score_value > self.exam_subject.max_score:
            raise ValidationError(
                f"分数 {self.score_value} 超过了 {self.exam_subject.subject_name} 的满分 {self.exam_subject.max_score}"
            )
        
        # 确保exam_subject与subject字段一致
        if self.exam_subject and self.exam_subject.subject_code != self.subject:
            raise ValidationError("考试科目与科目字段不匹配")
    
    def save(self, *args, **kwargs):
        # 如果没有exam_subject但有subject，尝试自动关联
        if not self.exam_subject and self.subject and self.exam:
            try:
                self.exam_subject = ExamSubject.objects.get(
                    exam=self.exam,
                    subject_code=self.subject
                )
            except ExamSubject.DoesNotExist:
                pass  # 如果找不到对应的ExamSubject，保持为空
        
        # 调用clean方法进行验证
        self.clean()
        super().save(*args, **kwargs)
    
    def get_max_score(self):
        """
        获取该科目的满分
        """
        if self.exam_subject:
            return self.exam_subject.max_score
        # 如果没有exam_subject，返回默认满分
        return ExamSubject.get_default_max_score(self.exam.grade_level, self.subject)
    
    def get_score_percentage(self):
        """
        获取分数百分比
        """
        max_score = self.get_max_score()
        if max_score > 0:
            return (float(self.score_value) / float(max_score)) * 100
        return 0
    
    def get_grade_level(self):
        """
        根据百分比获取等级（优秀、良好、及格、不及格）
        """
        percentage = self.get_score_percentage()
        if percentage >= 85:
            return "优秀"
        elif percentage >= 70:
            return "良好"
        elif percentage >= 60:
            return "及格"
        else:
            return "不及格"

    def __str__(self):
        subject_name = self.exam_subject.subject_name if self.exam_subject else self.get_subject_display()
        return f"{self.student.name} - {self.exam.academic_year} {self.exam.name} ({subject_name}): {self.score_value}"









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
    ('美术', '美术'),
    ('音乐', '音乐'),
    ('心理', '心理'),
    ('信息技术', '信息技术'),
    # 可以根據需要添加更多科目
]


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
        unique_together = ('academic_year', 'name') # 同一學年內，考試名稱必須唯一

    def __str__(self):
        return f"{self.date.year}年{self.name} ({self.get_grade_level_display()})"

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
    subject = models.CharField(
        max_length=50,
        choices=SUBJECT_CHOICES, # 使用預定義的科目選項
        verbose_name="科目"
    )
    score_value = models.DecimalField(
        max_digits=5, # 最大值為 999.99 (例如：100.00)
        decimal_places=2,
        verbose_name="分數"
    )
    
    # 自動時間戳，有助於追蹤
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="創建時間")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新時間")

    class Meta:
        verbose_name = "成績"
        verbose_name_plural = "成績記錄"
        # 確保同一個學生在同一場考試的同一科目上只有一條成績
        unique_together = ('student', 'exam', 'subject')
        # 預設排序：按考試日期、學生姓名、科目排序
        ordering = ['exam__date', 'student__name', 'subject']

    def __str__(self):
        return f"{self.student.name} - {self.exam.academic_year} {self.exam.name} ({self.get_subject_display()}): {self.score_value}"









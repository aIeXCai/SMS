from django.db import models
from school_management.students.models import GRADE_LEVEL_CHOICES # 導入年級選項，確保一致性

ACADEMIC_YEAR_CHOICES = []
for year in range(2025, 2030): # 從2025年到2029年
    academic_year_str = f"{year}-{year+1}"
    ACADEMIC_YEAR_CHOICES.append((academic_year_str, academic_year_str))

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
from django.db import models
from school_management.students.models import GRADE_LEVEL_CHOICES # 導入年級選項，確保一致性

class Exam(models.Model):
    """
    考試模型，用於記錄每次考試的基本資訊。
    """
    name = models.CharField(max_length=100, verbose_name="考試名稱")
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
        verbose_name="考試描述",
        help_text="可選：填寫考試的具體說明或注意事項"
    )

    class Meta:
        verbose_name = "考試"
        verbose_name_plural = "考試管理"
        ordering = ['-date', 'grade_level', 'name'] # 依日期降序、年級、名稱排序

    def __str__(self):
        return f"{self.date.year}年{self.name} ({self.get_grade_level_display()})"
from django.db import models
from django.core.exceptions import ValidationError
from .student import Student
from .exam import Exam, ExamSubject

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
    class_rank_in_subject = models.IntegerField(null=True, blank=True, verbose_name="学科班级排名")
    total_score_rank_in_grade = models.IntegerField(null=True, blank=True, verbose_name="总分年级排名")
    total_score_rank_in_class = models.IntegerField(null=True, blank=True, verbose_name="总分班级排名")
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="創建時間")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新時間")

    class Meta:
        verbose_name = "成績"
        verbose_name_plural = "成績記錄"
        # 確保同一學生在同一考試中的同一科目只能有一條成績記錄
        unique_together = ('student', 'exam', 'subject')
        # 按考試日期、學生姓名、科目排序
        ordering = ['exam__date', 'student__name', 'subject']
        # 暂时注释掉索引，避免迁移冲突
        # indexes = [
        #     models.Index(fields=['student', 'exam'], name='score_student_exam_idx'),
        #     models.Index(fields=['exam', 'subject'], name='score_exam_subject_idx'),
        #     models.Index(fields=['student', 'subject'], name='score_student_subject_idx'),
        # ]

    def clean(self):
        """
        验证分数是否超过该科目的满分
        """
        from django.core.exceptions import ValidationError
        
        # 验证 score_value 必须是数字且不可为负
        if self.score_value is not None:
            try:
                # Decimal/float-compatible comparison
                if float(self.score_value) < 0:
                    raise ValidationError("分数不能为负数")
            except (TypeError, ValueError):
                raise ValidationError("分数必须为数字")
        
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
        # avoid showing the literal 'None' when academic_year is not set
        academic_prefix = f"{self.exam.academic_year} " if getattr(self.exam, 'academic_year', None) else ''
        return f"{self.student.name} - {academic_prefix}{self.exam.name} ({subject_name}): {self.score_value}"
from django.db import models
from .student import COHORT_CHOICES


# 学年选择
ACADEMIC_YEAR_CHOICES = []
for year in range(2023, 2030): # 從2023年到2029年
    academic_year_str = f"{year}-{year+1}"
    ACADEMIC_YEAR_CHOICES.append((academic_year_str, academic_year_str))


# 科目选择
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
        '语文': 140, '数学': 150, '英语': 140,
        '政治': 70, '历史': 70, '物理': 100,
        '化学': 70, '生物': 100, '地理': 100, '体育': 70
    },
    '初二': {
        '语文': 140, '数学': 150, '英语': 140,
        '政治': 70, '历史': 70, '物理': 100,
        '化学': 70, '生物': 100, '地理': 100, '体育': 70
    },
    '初三': {
        '语文': 120, '数学': 120, '英语': 120,
        '政治': 90, '历史': 90, '物理': 100,
        '化学': 100, '体育': 70
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
    # 适用年级：改造后存储 cohort 值（如"初中2026级"）
    grade_level = models.CharField(
        max_length=20,
        choices=COHORT_CHOICES,
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
    
    def get_grade_level_from_cohort(self):
        """
        根据 cohort 和 academic_year 计算基础年级（初几/高几）

        计算公式：grade_index = academic_year_start - cohort_year + 1
        例如：
        - cohort="初中2023级"，academic_year="2025-2026"
        - academic_year_start=2025, cohort_year=2023
        - grade_index = 2025 - 2023 + 1 = 3
        - 初中第3年 = 初三
        """
        if not self.grade_level or not self.academic_year:
            return None

        grade_level = self.grade_level

        # 如果是旧格式（直接是"初一"等），直接返回
        if grade_level in ['初一', '初二', '初三', '高一', '高二', '高三']:
            return grade_level

        # cohort 格式: "初中2026级" 或 "高中2025级"
        try:
            # 提取 section 和 cohort_year
            if '初' in grade_level:
                section = '初'
                cohort_year = int(grade_level.replace('初中', '').replace('级', ''))
            elif '高' in grade_level:
                section = '高'
                cohort_year = int(grade_level.replace('高中', '').replace('级', ''))
            else:
                return None

            # 计算学年起始年
            academic_year_start = int(self.academic_year.split('-')[0])

            # 计算年级索引（1=初一/高一, 2=初二/高二, 3=初三/高三）
            grade_index = academic_year_start - cohort_year + 1

            # 映射到年级
            if section == '初':
                grades = ['初一', '初二', '初三']
            else:
                grades = ['高一', '高二', '高三']

            if 1 <= grade_index <= 3:
                return grades[grade_index - 1]
            else:
                return None
        except (ValueError, IndexError):
            return None

    def get_default_subjects_config(self):
        """
        根据年级获取默认的科目配置
        """
        grade_level = self.get_grade_level_from_cohort()
        return SUBJECT_DEFAULT_MAX_SCORES.get(grade_level, {})

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
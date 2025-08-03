from django.contrib import admin
from .models import Exam, ExamSubject, Score

class ExamSubjectInline(admin.TabularInline):
    """
    考试科目内联编辑器，允许在考试页面直接编辑科目配置
    """
    model = ExamSubject
    extra = 0  # 不显示额外的空行
    fields = ('subject_code', 'subject_name', 'max_score')
    ordering = ('subject_code',)

@admin.register(Exam)
class ExamAdmin(admin.ModelAdmin):
    """
    考试管理界面
    """
    list_display = ('name', 'academic_year', 'grade_level', 'date', 'get_subjects_count')
    list_filter = ('academic_year', 'grade_level', 'date')
    search_fields = ('name', 'description')
    ordering = ('-date', 'grade_level', 'name')
    inlines = [ExamSubjectInline]
    
    def get_subjects_count(self, obj):
        """
        显示考试包含的科目数量
        """
        return obj.exam_subjects.count()
    get_subjects_count.short_description = '科目数量'

@admin.register(ExamSubject)
class ExamSubjectAdmin(admin.ModelAdmin):
    """
    考试科目管理界面
    """
    list_display = ('exam', 'subject_name', 'max_score')
    list_filter = ('exam__grade_level', 'subject_code', 'exam__academic_year')
    search_fields = ('exam__name', 'subject_name')
    ordering = ('exam__date', 'subject_code')
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('exam')

@admin.register(Score)
class ScoreAdmin(admin.ModelAdmin):
    """
    成绩管理界面
    """
    list_display = ('student', 'exam', 'get_subject_name', 'score_value', 'get_max_score', 'get_score_percentage', 'get_grade_level')
    list_filter = ('exam__academic_year', 'exam__grade_level', 'subject', 'exam')
    search_fields = ('student__name', 'student__student_id', 'exam__name')
    ordering = ('-exam__date', 'student__name', 'subject')
    
    def get_subject_name(self, obj):
        """
        显示科目名称
        """
        return obj.exam_subject.subject_name if obj.exam_subject else obj.get_subject_display()
    get_subject_name.short_description = '科目'
    
    def get_max_score(self, obj):
        """
        显示满分
        """
        return obj.get_max_score()
    get_max_score.short_description = '满分'
    
    def get_score_percentage(self, obj):
        """
        显示分数百分比
        """
        return f"{obj.get_score_percentage():.1f}%"
    get_score_percentage.short_description = '百分比'
    
    def get_grade_level(self, obj):
        """
        显示等级
        """
        return obj.get_grade_level()
    get_grade_level.short_description = '等级'
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('student', 'exam', 'exam_subject')

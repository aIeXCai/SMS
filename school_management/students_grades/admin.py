from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe
from .models import Student, Class, Exam, ExamSubject, Score

# =============================================================================
# 班级管理
# =============================================================================

@admin.register(Class)
class ClassAdmin(admin.ModelAdmin):
    list_display = ['grade_level', 'class_name', 'homeroom_teacher', 'student_count']
    list_filter = ['grade_level']
    search_fields = ['class_name', 'homeroom_teacher']
    ordering = ['grade_level', 'class_name']
    
    def student_count(self, obj):
        """显示班级学生数量"""
        count = obj.student_set.count()
        if count > 0:
            url = reverse('admin:students_grades_student_changelist') + f'?current_class__id__exact={obj.id}'
            return format_html('<a href="{}">{} 人</a>', url, count)
        return '0 人'
    student_count.short_description = '学生数量'

# =============================================================================
# 学生管理
# =============================================================================

@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = [
        'student_id', 'name', 'gender', 'current_class', 
        'status', 'entry_date', 'graduation_date'
    ]
    list_filter = [
        'gender', 'status', 'current_class__grade_level', 
        'current_class', 'entry_date'
    ]
    search_fields = [
        'student_id', 'name', 'id_card_number', 
        'student_enrollment_number', 'guardian_name'
    ]
    ordering = ['current_class__grade_level', 'current_class__class_name', 'student_id']
    
    fieldsets = (
        ('基本信息', {
            'fields': ('student_id', 'name', 'gender', 'date_of_birth')
        }),
        ('班级信息', {
            'fields': ('current_class', 'status')
        }),
        ('证件信息', {
            'fields': ('id_card_number', 'student_enrollment_number'),
            'classes': ('collapse',)
        }),
        ('联系信息', {
            'fields': ('home_address', 'guardian_name', 'guardian_contact_phone'),
            'classes': ('collapse',)
        }),
        ('学籍信息', {
            'fields': ('entry_date', 'graduation_date'),
            'classes': ('collapse',)
        }),
    )
    
    list_per_page = 50
    date_hierarchy = 'entry_date'
    
    actions = ['mark_as_graduated', 'mark_as_active']
    
    def mark_as_graduated(self, request, queryset):
        """批量标记为毕业"""
        from django.utils import timezone
        updated = queryset.update(
            status='毕业',
            graduation_date=timezone.now().date()
        )
        self.message_user(request, f'成功将 {updated} 名学生标记为毕业状态')
    mark_as_graduated.short_description = '标记为毕业'
    
    def mark_as_active(self, request, queryset):
        """批量标记为在读"""
        updated = queryset.update(status='在读')
        self.message_user(request, f'成功将 {updated} 名学生标记为在读状态')
    mark_as_active.short_description = '标记为在读'

# =============================================================================
# 考试管理
# =============================================================================

class ExamSubjectInline(admin.TabularInline):
    model = ExamSubject
    extra = 1
    fields = ['subject_code', 'subject_name', 'max_score']
    
@admin.register(Exam)
class ExamAdmin(admin.ModelAdmin):
    list_display = [
        'name', 'academic_year', 'date', 'grade_level', 
        'subject_count', 'score_count', 'description'
    ]
    list_filter = ['academic_year', 'grade_level', 'date']
    search_fields = ['name', 'description']
    ordering = ['-date', 'grade_level']
    
    inlines = [ExamSubjectInline]
    
    fieldsets = (
        ('基本信息', {
            'fields': ('name', 'academic_year', 'date', 'grade_level')
        }),
        ('详细信息', {
            'fields': ('description',),
            'classes': ('collapse',)
        }),
    )
    
    def subject_count(self, obj):
        """显示考试科目数量"""
        count = obj.examsubject_set.count()
        return f'{count} 科'
    subject_count.short_description = '科目数量'
    
    def score_count(self, obj):
        """显示成绩记录数量"""
        count = obj.score_set.count()
        if count > 0:
            url = reverse('admin:students_grades_score_changelist') + f'?exam__id__exact={obj.id}'
            return format_html('<a href="{}">{} 条</a>', url, count)
        return '0 条'
    score_count.short_description = '成绩记录'

@admin.register(ExamSubject)
class ExamSubjectAdmin(admin.ModelAdmin):
    list_display = ['exam', 'subject_code', 'subject_name', 'max_score', 'score_count']
    list_filter = ['exam__academic_year', 'exam__grade_level', 'subject_code']
    search_fields = ['exam__name', 'subject_name']
    ordering = ['exam__date', 'subject_code']
    
    def score_count(self, obj):
        """显示该科目的成绩记录数量"""
        count = obj.exam.score_set.filter(subject=obj.subject_code).count()
        return f'{count} 条'
    score_count.short_description = '成绩记录'

# =============================================================================
# 成绩管理
# =============================================================================

@admin.register(Score)
class ScoreAdmin(admin.ModelAdmin):
    list_display = [
        'student', 'exam', 'subject', 'score_value', 
        'grade_rank_in_subject', 'total_score_rank_in_grade', 'created_at'
    ]
    list_filter = [
        'exam__academic_year', 'exam__grade_level', 'exam', 
        'subject', 'student__current_class'
    ]
    search_fields = [
        'student__name', 'student__student_id', 
        'exam__name', 'subject'
    ]
    ordering = ['-exam__date', 'student__current_class', 'student__name']
    
    fieldsets = (
        ('基本信息', {
            'fields': ('student', 'exam', 'subject', 'score_value')
        }),
        ('排名信息', {
            'fields': ('grade_rank_in_subject', 'total_score_rank_in_grade'),
            'classes': ('collapse',)
        }),
    )
    
    list_per_page = 100
    date_hierarchy = 'created_at'
    
    readonly_fields = ['created_at', 'updated_at']
    
    def get_queryset(self, request):
        """优化查询，减少数据库访问"""
        return super().get_queryset(request).select_related(
            'student', 'student__current_class', 'exam'
        )

# =============================================================================
# 管理界面自定义
# =============================================================================

# 设置管理界面标题
admin.site.site_header = '学生成绩管理系统'
admin.site.site_title = '管理后台'
admin.site.index_title = '欢迎使用学生成绩管理系统'

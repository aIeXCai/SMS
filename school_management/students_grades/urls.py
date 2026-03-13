# =============================================================================
# 学生与成绩模块URL配置
# =============================================================================

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .api_views import StudentViewSet, ClassViewSet
from .views.analysis_redirect_views import (
    redirect_student_list,
    redirect_student_add,
    redirect_student_edit,
    redirect_student_batch_import_page,
    redirect_student_batch_promote_page,
    redirect_download_student_import_template,
    redirect_student_delete,
    redirect_student_update_status,
    redirect_student_batch_delete,
    redirect_student_batch_update_status,
    redirect_student_batch_graduate,
    redirect_class_grade_entry,
    redirect_class_grade_single,
    redirect_class_grade_grade,
    redirect_student_analysis_entry,
    redirect_student_analysis_detail,
    redirect_score_list,
    redirect_score_add,
    redirect_score_edit,
    redirect_score_batch_export,
    redirect_score_batch_delete_filtered,
    redirect_score_batch_export_selected,
    redirect_score_batch_delete_selected,
    redirect_score_batch_edit,
    redirect_download_score_import_template,
    redirect_score_query,
    redirect_score_query_export,
    redirect_exam_list,
    redirect_exam_create,
    redirect_exam_edit,
    redirect_exam_delete,
    redirect_exam_default_subjects,
)

app_name = 'students_grades'

# API 路由配置
router = DefaultRouter()
router.register(r'students', StudentViewSet)
router.register(r'classes', ClassViewSet)

urlpatterns = [
    # === 基础学生管理 ===
    path('students/', redirect_student_list, name='student_list'),                    # 学生列表页面
    path('students/list/', redirect_student_list, name='student_list_alt'),           # 备用学生列表路径
    path('students/add/', redirect_student_add, name='student_add'),                  # 添加学生
    path('students/edit/<int:pk>/', redirect_student_edit, name='student_edit'),      # 编辑学生
    path('students/delete/<int:pk>/', redirect_student_delete, name='student_delete'), # 删除学生
    
    # === 学生状态管理 ===
    path('students/update-status/<int:pk>/', redirect_student_update_status, name='student_update_status'), # 更新单个学生状态
    
    # === 批量操作 ===
    path('students/batch-import/', redirect_student_batch_import_page, name='student_batch_import'),           # 批量导入学生
    path('students/batch-delete/', redirect_student_batch_delete, name='student_batch_delete'),          # 批量删除学生
    path('students/batch-update-status/', redirect_student_batch_update_status, name='student_batch_update_status'), # 批量更新状态
    path('students/batch-promote-grade/', redirect_student_batch_promote_page, name='student_batch_promote_grade'), # 批量升年级
    path('students/batch-graduate/', redirect_student_batch_graduate, name='student_batch_graduate'),    # 批量毕业
    
    # === 工具功能 ===
    path('students/download-template/', redirect_download_student_import_template, name='download_student_import_template'), # 下载导入模板
    
    # === 考试管理 ===
    path('exams/', redirect_exam_list, name='exam_list'),
    path('exams/create/step1/', redirect_exam_create, name='exam_create_step1'),
    path('exams/create/step2/', redirect_exam_create, name='exam_create_step2'),
    path('exams/<int:pk>/edit/step1/', redirect_exam_edit, name='exam_edit_step1'),
    path('exams/<int:pk>/edit/step2/', redirect_exam_edit, name='exam_edit_step2'),
    path('exams/<int:pk>/delete/', redirect_exam_delete, name='exam_delete'),
    
    # === 成绩管理 ===
    path('scores/', redirect_score_list, name='score_list'),
    path('scores/add/', redirect_score_add, name='score_add'),
    path('scores/<int:pk>/edit/', redirect_score_edit, name='score_edit'),
    
    # === 成绩批量操作 ===
    path('scores/batch_export/', redirect_score_batch_export, name='score_batch_export'),
    path('scores/batch_delete_filtered/', redirect_score_batch_delete_filtered, name='score_batch_delete_filtered'),
    path('scores/batch_export_selected/', redirect_score_batch_export_selected, name='score_batch_export_selected'),
    path('scores/batch_delete_selected/', redirect_score_batch_delete_selected, name='score_batch_delete_selected'),
    path('scores/batch_edit/', redirect_score_batch_edit, name='score_batch_edit'),
    path('scores/download_template/', redirect_download_score_import_template, name='download_score_import_template'),
    
    # === 成绩查询功能 ===
    path('scores/query/', redirect_score_query, name='score_query'),
    path('scores/query/export/', redirect_score_query_export, name='score_query_export'),
    
    # === 成绩分析功能 ===
    # 班级/年级成绩分析（原成绩分析功能）
    path('analysis/class-grade/', redirect_class_grade_entry, name='class_grade_analysis'),
    path('analysis/class-grade/class/', redirect_class_grade_single, name='class_grade_analysis_class'),
    path('analysis/class-grade/grade/', redirect_class_grade_grade, name='class_grade_analysis_grade'),
    
    # 个人成绩分析（独立的个人分析功能）
    path('analysis/student/', redirect_student_analysis_entry, name='student_analysis'),
    path('analysis/student/detail/', redirect_student_analysis_detail, name='student_analysis_detail'),
    
    # === AJAX接口 ===
    path('get_default_subjects/', redirect_exam_default_subjects, name='get_default_subjects_ajax'),
    
]

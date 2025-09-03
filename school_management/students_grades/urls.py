# =============================================================================
# 学生与成绩模块URL配置
# =============================================================================

from django.urls import path
from .views.student_views import (
    student_list, student_add, student_edit, student_delete,
    student_update_status, student_batch_import, student_batch_delete,
    student_batch_update_status, student_batch_promote_grade,
    student_batch_graduate, download_student_import_template
)

app_name = 'students_grades'

urlpatterns = [
    # === 基础学生管理 ===
    path('', student_list, name='student_list'),                    # 学生列表页面（主页）
    path('students/', student_list, name='student_list_alt'),       # 备用学生列表路径
    path('students/add/', student_add, name='student_add'),         # 添加学生
    path('students/edit/<int:pk>/', student_edit, name='student_edit'),      # 编辑学生
    path('students/delete/<int:pk>/', student_delete, name='student_delete'), # 删除学生
    
    # === 学生状态管理 ===
    path('students/update-status/<int:pk>/', student_update_status, name='student_update_status'), # 更新单个学生状态
    
    # === 批量操作 ===
    path('students/batch-import/', student_batch_import, name='student_batch_import'),           # 批量导入学生
    path('students/batch-delete/', student_batch_delete, name='student_batch_delete'),          # 批量删除学生
    path('students/batch-update-status/', student_batch_update_status, name='student_batch_update_status'), # 批量更新状态
    path('students/batch-promote-grade/', student_batch_promote_grade, name='student_batch_promote_grade'), # 批量升年级
    path('students/batch-graduate/', student_batch_graduate, name='student_batch_graduate'),    # 批量毕业
    
    # === 工具功能 ===
    path('students/download-template/', download_student_import_template, name='download_student_import_template'), # 下载导入模板
    
    # === 未来扩展：考试管理 ===
    # path('exams/', exam_list, name='exam_list'),
    # path('exams/add/', exam_add, name='exam_add'),
    # path('exams/edit/<int:pk>/', exam_edit, name='exam_edit'),
    
    # === 未来扩展：成绩管理 ===
    # path('scores/', score_list, name='score_list'),
    # path('scores/add/', score_add, name='score_add'),
    # path('scores/edit/<int:pk>/', score_edit, name='score_edit'),
]

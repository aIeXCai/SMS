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
from .views.exam_views import (
    exam_list, exam_create_step1, exam_create_step2,
    exam_edit_step1, exam_edit_step2, exam_delete,
    get_default_subjects_ajax
)
from .views.score_views import (
    score_list, score_add, score_edit, score_batch_export,
    score_batch_delete_filtered, score_batch_export_selected,
    score_batch_delete_selected, score_batch_edit,
    download_score_import_template, score_query, score_query_results,
    score_query_export, score_analysis, score_analysis_class,
    score_analysis_student, score_analysis_student_detail, score_analysis_grade,
    score_batch_import_ajax, search_students_ajax,
    get_classes_by_grade, get_students_by_class, get_student_analysis_data, get_grades_ajax
)
from .views.ranking_debug_view import (
    ranking_debug_view, get_ranking_data, ranking_update_test
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
    
    # === 考试管理 ===
    path('exams/', exam_list, name='exam_list'),
    path('exams/create/step1/', exam_create_step1, name='exam_create_step1'),
    path('exams/create/step2/', exam_create_step2, name='exam_create_step2'),
    path('exams/<int:pk>/edit/step1/', exam_edit_step1, name='exam_edit_step1'),
    path('exams/<int:pk>/edit/step2/', exam_edit_step2, name='exam_edit_step2'),
    path('exams/<int:pk>/delete/', exam_delete, name='exam_delete'),
    
    # === 成绩管理 ===
    path('scores/', score_list, name='score_list'),
    path('scores/add/', score_add, name='score_add'),
    path('scores/<int:pk>/edit/', score_edit, name='score_edit'),
    
    # === 成绩批量操作 ===
    path('scores/batch_export/', score_batch_export, name='score_batch_export'),
    path('scores/batch_delete_filtered/', score_batch_delete_filtered, name='score_batch_delete_filtered'),
    path('scores/batch_export_selected/', score_batch_export_selected, name='score_batch_export_selected'),
    path('scores/batch_delete_selected/', score_batch_delete_selected, name='score_batch_delete_selected'),
    path('scores/batch_edit/', score_batch_edit, name='score_batch_edit'),
    path('scores/download_template/', download_score_import_template, name='download_score_import_template'),
    
    # === 成绩查询功能 ===
    path('scores/query/', score_query, name='score_query'),
    path('scores/query/results/', score_query_results, name='score_query_results'),
    path('scores/query/export/', score_query_export, name='score_query_export'),
    
    # === 成绩分析功能 ===
    # 班级/年级成绩分析（原成绩分析功能）
    path('analysis/class-grade/', score_analysis, name='class_grade_analysis'),
    path('analysis/class-grade/class/', score_analysis_class, name='class_grade_analysis_class'),
    path('analysis/class-grade/grade/', score_analysis_grade, name='class_grade_analysis_grade'),
    
    # 个人成绩分析（独立的个人分析功能）
    path('analysis/student/', score_analysis_student, name='student_analysis'),
    path('analysis/student/detail/', score_analysis_student_detail, name='student_analysis_detail'),
    
    # 保持向后兼容的旧URL（重定向到新URL）
    path('scores/analysis/', score_analysis, name='score_analysis'),
    path('scores/analysis/class/', score_analysis_class, name='score_analysis_class'),
    path('scores/analysis/student/', score_analysis_student, name='score_analysis_student'),
    path('scores/analysis/grade/', score_analysis_grade, name='score_analysis_grade'),
    
    # === AJAX接口 ===
    path('get_grades_ajax/', get_grades_ajax, name='get_grades_ajax'),
    path('get_classes_by_grade/', get_classes_by_grade, name='get_classes_by_grade'),
    path('get_default_subjects/', get_default_subjects_ajax, name='get_default_subjects_ajax'),
    path('scores/batch_import_ajax/', score_batch_import_ajax, name='score_batch_import_ajax'),
    path('search_students_ajax/', search_students_ajax, name='search_students_ajax'),
    path('get_students_by_class/', get_students_by_class, name='get_students_by_class'),
    path('get_student_analysis_data/', get_student_analysis_data, name='get_student_analysis_data'),
    
    # === 排名调试工具 ===
    path('ranking_debug/', ranking_debug_view, name='ranking_debug'),
    path('ranking_debug/data/', get_ranking_data, name='get_ranking_data'),
    path('ranking_debug/update/', ranking_update_test, name='ranking_update_test'),
]

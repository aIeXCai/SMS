from django.urls import path
from . import views

urlpatterns = [
    # 考试管理urls
    path('exams/', views.exam_list, name='exam_list'),
    path('exams/add/', views.exam_add, name='exam_add'),
    path('exams/<int:pk>/edit/', views.exam_edit, name='exam_edit'),
    path('exams/<int:pk>/delete/', views.exam_delete, name='exam_delete'),

    # 成绩管理urls
    path('scores/', views.score_list, name='score_list'),
    path('scores/add/', views.score_add, name='score_add'),
    path('scores/batch_import/', views.score_batch_import, name='score_batch_import'),
    path('scores/<int:pk>/edit/', views.score_edit, name='score_edit'),
    
    # 批量操作URLs
    path('scores/batch_export/', views.score_batch_export, name='score_batch_export'),
    path('scores/batch_delete_filtered/', views.score_batch_delete_filtered, name='score_batch_delete_filtered'),
    
    # 新增：选中项批量操作
    path('scores/batch_export_selected/', views.score_batch_export_selected, name='score_batch_export_selected'),
    path('scores/batch_delete_selected/', views.score_batch_delete_selected, name='score_batch_delete_selected'),
    # 在现有的URL模式中添加
    path('scores/batch_edit/', views.score_batch_edit, name='score_batch_edit'),
    
    # 批量导入模板下载url
    path('scores/download_template/', views.download_score_import_template, name='download_score_import_template'),

    # 成绩查询功能URLs
    path('scores/query/', views.score_query, name='score_query'),
    path('scores/query/results/', views.score_query_results, name='score_query_results'),
    path('scores/student/<int:student_id>/', views.student_score_detail, name='student_score_detail'),
    path('scores/query/export/', views.score_query_export, name='score_query_export'),

    # 成绩分析功能URLs
    path('scores/analysis/', views.score_analysis, name='score_analysis'),
    path('scores/analysis/class/', views.score_analysis_class, name='score_analysis_class'),
    path('scores/analysis/student/', views.score_analysis_student, name='score_analysis_student'),
]
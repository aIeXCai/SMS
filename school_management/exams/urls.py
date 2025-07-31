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
    path('scores/<int:pk>/delete/', views.score_delete, name='score_delete'),

    # 批量导入模板下载url
    path('scores/download_template/', views.download_score_import_template, name='download_score_import_template'),
]
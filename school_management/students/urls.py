from django.urls import path
from . import views

urlpatterns = [
    # 學生列表頁面
    path('students/', views.student_list, name='student_list'),
    # 新增學生頁面
    path('students/add/', views.student_add, name='student_add'),
    # 修改學生頁面 (需要指定學生 ID)
    path('students/<int:pk>/edit/', views.student_edit, name='student_edit'),
    # 刪除學生 (需要指定學生 ID)
    path('students/<int:pk>/delete/', views.student_delete, name='student_delete'),
    # 学生状态切换
    path('students/<int:pk>/update_status/', views.student_update_status, name='student_update_status'),

    # 批量操作urls
    path('students/batch_import/', views.student_batch_import, name='student_batch_import'),
    path('students/batch_delete/', views.student_batch_delete, name='student_batch_delete'),
    path('students/batch_update_status/', views.student_batch_update_status, name='student_batch_update_status'),

    # 批量升年级
    path('students/batch_promote_grade/', views.student_batch_promote_grade, name='student_batch_promote_grade'),

    # 批量毕业
    path('students/batch_graduate/', views.student_batch_graduate, name='student_batch_graduate'),
]
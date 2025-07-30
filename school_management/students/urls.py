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
]
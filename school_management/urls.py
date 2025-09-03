"""
URL configuratiurlpatterns = [
    path('admin/', admin.site.urls),
    path('django-rq/', include('django_rq.urls')),  # RQ任务管理界面
    
    # 🔴 新的统一学生与成绩模块
    path('', include('school_management.students_grades.urls')),
    
    # 🔴 原有模块URL（暂时注释掉，迁移完成后移除）
    # path('', include('school_management.students.urls')),
    # path('', include('school_management.exams.urls')),
]ol_management project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('django-rq/', include('django_rq.urls')),  # RQ任务管理界面
    
    # 🔴 新的统一学生与成绩模块
    path('', include('school_management.students_grades.urls')),
    
    # 🔴 原有模块（暂时保留，后续迁移完成后移除）
    # path('', include('school_management.students.urls')),
    # path('', include('school_management.exams.urls')),
]

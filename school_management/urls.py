"""
URL configuration for school_management project.

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
from django.conf import settings
from django.conf.urls.static import static
from django.contrib.staticfiles.urls import staticfiles_urlpatterns
from django.views.generic.base import RedirectView
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from . import views

urlpatterns = [
    path('admin', RedirectView.as_view(url='/admin/', permanent=False)),
    path('admin/', admin.site.urls),
    path('django-rq/', include('django_rq.urls')),  # RQ任务管理界面

    # API only: 后端不再承接页面入口
    path('api/dashboard/stats/', views.dashboard_stats_api, name='dashboard_stats_api'),
    
    # 认证 - 支持有无斜杠两种格式
    path('api/token', TokenObtainPairView.as_view(), name='token_obtain_pair_no_slash'),
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh', TokenRefreshView.as_view(), name='token_refresh_no_slash'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # 🔴 学生与成绩 API
    path('api/', include('school_management.students_grades.api_urls')),
    
    # 🔴 用户与权限接口
    path('api/users/', include('school_management.users.urls')),

]

# 开发环境下提供静态文件
if settings.DEBUG:
    urlpatterns += staticfiles_urlpatterns()

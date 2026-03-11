from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .api_views import StudentViewSet, ClassViewSet, ExamViewSet

# API 路由配置
router = DefaultRouter()
router.register(r'students', StudentViewSet)
router.register(r'classes', ClassViewSet)
router.register(r'exams', ExamViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
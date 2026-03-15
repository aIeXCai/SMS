from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .api_views import StudentViewSet, ClassViewSet, ExamViewSet, ScoreViewSet

# API 路由配置
router = DefaultRouter(trailing_slash='/?')
router.register(r'students', StudentViewSet)
router.register(r'classes', ClassViewSet)
router.register(r'exams', ExamViewSet)
router.register(r'scores', ScoreViewSet)

urlpatterns = [
    # 兼容无尾斜杠调用（APPEND_SLASH=False）
    path('scores/options', ScoreViewSet.as_view({'get': 'options'})),
    path('scores/student-search', ScoreViewSet.as_view({'get': 'student_search'})),
    path('scores/student-analysis-data', ScoreViewSet.as_view({'get': 'student_analysis_data'})),
    path('scores/class-analysis-single', ScoreViewSet.as_view({'get': 'class_analysis_single'})),
    path('scores/class-analysis-multi', ScoreViewSet.as_view({'get': 'class_analysis_multi'})),
    path('scores/class-analysis-grade', ScoreViewSet.as_view({'get': 'class_analysis_grade'})),
    path('scores/manual-add', ScoreViewSet.as_view({'post': 'manual_add'})),
    path('scores/batch-edit-detail', ScoreViewSet.as_view({'get': 'batch_edit_detail'})),
    path('scores/batch-edit-save', ScoreViewSet.as_view({'post': 'batch_edit_save'})),
    path('scores/download-template', ScoreViewSet.as_view({'get': 'download_template'})),
    path('scores/batch-delete-selected', ScoreViewSet.as_view({'post': 'batch_delete_selected'})),
    path('scores/batch-delete-filtered', ScoreViewSet.as_view({'post': 'batch_delete_filtered'})),
    path('scores/select-all-record-keys', ScoreViewSet.as_view({'get': 'select_all_record_keys'})),
    path('scores/batch-export-selected', ScoreViewSet.as_view({'post': 'batch_export_selected'})),
    path('scores/batch-export', ScoreViewSet.as_view({'get': 'batch_export'})),
    path('scores/query-export', ScoreViewSet.as_view({'get': 'query_export'})),
    path('scores/batch-import', ScoreViewSet.as_view({'post': 'batch_import'})),
    path('', include(router.urls)),
]
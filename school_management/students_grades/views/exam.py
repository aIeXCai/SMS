from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from school_management.users.permissions import IsAdminOrGradeManagerOrStaff

from ..models.exam import ACADEMIC_YEAR_CHOICES, Exam, SUBJECT_DEFAULT_MAX_SCORES
from ..models.exam import SUBJECT_CHOICES as EXAM_SUBJECT_CHOICES
from ..models.student import COHORT_CHOICES
from ..serializers import ExamSerializer


class ExamViewSet(viewsets.ModelViewSet):
    """
    考试管理 ViewSet
    """

    queryset = Exam.objects.all()
    serializer_class = ExamSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["academic_year", "grade_level"]
    search_fields = ["name", "description"]
    ordering_fields = ["date", "name"]
    ordering = ["-date"]

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [permissions.IsAuthenticated(), IsAdminOrGradeManagerOrStaff()]
        return [permissions.IsAuthenticated()]

    @action(detail=False, methods=["get"], url_path="options")
    def options(self, request):
        """返回学年、年级下拉选项"""
        return Response(
            {
                "academic_years": [
                    {"value": choice[0], "label": choice[1]} for choice in ACADEMIC_YEAR_CHOICES
                ],
                "grade_levels": [{"value": choice[0], "label": choice[1]} for choice in COHORT_CHOICES],
            }
        )

    @action(detail=False, methods=["get"], url_path="default-subjects")
    def default_subjects(self, request):
        """根据年级和学年返回默认科目和满分配置"""
        grade_level = request.query_params.get("grade_level", "")
        academic_year = request.query_params.get("academic_year", "")

        # 创建一个临时 Exam 对象来计算基础年级
        exam = Exam(grade_level=grade_level, academic_year=academic_year)
        base_grade_level = exam.get_grade_level_from_cohort()
        grade_config = SUBJECT_DEFAULT_MAX_SCORES.get(base_grade_level, {})

        # 按 SUBJECT_CHOICES 顺序返回
        subject_order = [code for code, _ in EXAM_SUBJECT_CHOICES]
        subjects = [
            {"subject_code": code, "max_score": grade_config[code]}
            for code in subject_order
            if code in grade_config
        ]
        all_subjects = [{"value": code, "label": label} for code, label in EXAM_SUBJECT_CHOICES]
        return Response({"subjects": subjects, "all_subjects": all_subjects})

from django.db.models import Min

from ..models import Exam, Score, Student


class AdvancedFilterService:
    """高级筛选服务。"""

    SUBJECT_MAP = {
        "chinese": "语文",
        "math": "数学",
        "english": "英语",
        "physics": "物理",
        "chemistry": "化学",
        "biology": "生物",
        "history": "历史",
        "geography": "地理",
        "politics": "政治",
    }

    @staticmethod
    def apply_filter(exam_id: int, logic: str, conditions: list[dict], class_id: int = None) -> list[int]:
        """应用多条件筛选，返回学生主键列表。"""
        exam = Exam.objects.get(id=exam_id)

        if not conditions:
            return []

        condition_results = []
        for condition in conditions:
            student_ids = AdvancedFilterService._apply_single_condition(exam, condition)
            condition_results.append(set(student_ids))

        normalized_logic = (logic or "").upper()
        if normalized_logic == "AND":
            final_result = set.intersection(*condition_results) if condition_results else set()
        elif normalized_logic == "OR":
            final_result = set.union(*condition_results) if condition_results else set()
        else:
            raise ValueError("logic 必须是 AND 或 OR")

        if class_id:
            class_student_ids = set(
                Student.objects.filter(current_class_id=class_id).values_list("id", flat=True)
            )
            final_result &= class_student_ids

        return sorted(final_result)

    @staticmethod
    def _apply_single_condition(exam: Exam, condition: dict) -> list[int]:
        """应用单个筛选条件，返回匹配学生主键列表。"""
        if not AdvancedFilterService.validate_condition(condition):
            raise ValueError("筛选条件格式或取值无效")

        subject = condition["subject"]
        dimension = condition["dimension"]
        operator = condition["operator"]
        value = condition["value"]

        base_scores = Score.objects.filter(exam=exam)

        if subject == "total":
            rank_field = "total_score_rank_in_grade" if dimension == "grade" else "total_score_rank_in_class"
            ranked = base_scores.values("student_id").annotate(rank_value=Min(rank_field))
        else:
            rank_field = "grade_rank_in_subject" if dimension == "grade" else "class_rank_in_subject"
            ranked = (
                base_scores.filter(subject=AdvancedFilterService.SUBJECT_MAP[subject])
                .values("student_id")
                .annotate(rank_value=Min(rank_field))
            )

        ranked = ranked.filter(rank_value__isnull=False)

        if operator == "top_n":
            ranked = ranked.filter(rank_value__lte=value)
        elif operator == "bottom_n":
            total_count = ranked.count()
            if total_count <= 0:
                return []
            threshold = max(total_count - value + 1, 1)
            ranked = ranked.filter(rank_value__gte=threshold)
        elif operator == "range":
            start, end = value
            ranked = ranked.filter(rank_value__gte=start, rank_value__lte=end)
        else:
            raise ValueError("operator 无效")

        return list(ranked.values_list("student_id", flat=True))

    @staticmethod
    def validate_condition(condition: dict) -> bool:
        """验证条件结构和取值是否合法。"""
        if not isinstance(condition, dict):
            return False

        required_fields = ["subject", "dimension", "operator", "value"]
        if any(field not in condition for field in required_fields):
            return False

        subject = condition["subject"]
        dimension = condition["dimension"]
        operator = condition["operator"]
        value = condition["value"]

        valid_subjects = {"total", *AdvancedFilterService.SUBJECT_MAP.keys()}
        if subject not in valid_subjects:
            return False

        if dimension not in {"grade", "class"}:
            return False

        if operator not in {"top_n", "bottom_n", "range"}:
            return False

        if operator == "range":
            if not isinstance(value, list) or len(value) != 2:
                return False
            if not all(isinstance(v, int) for v in value):
                return False
            if value[0] <= 0 or value[1] <= 0 or value[0] > value[1]:
                return False
        else:
            if not isinstance(value, int) or value <= 0:
                return False

        return True

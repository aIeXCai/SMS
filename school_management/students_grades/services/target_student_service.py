import datetime

from django.db.models import Min

from ..models.exam import Exam
from ..models.score import Score
from ..models.student import COHORT_CHOICES, Student


ALLOWED_METRICS = {"total_score_rank_in_grade"}
ALLOWED_OPERATORS = {"lte"}
ALLOWED_QUANTIFIERS = {"all", "at_least"}
ALLOWED_ABSENT_POLICIES = {"strict_fail", "ignore_absent"}
ALLOWED_EXAM_SCOPE_TYPES = {"all_in_grade", "selected_exam_ids", "date_range"}
MAX_EXAM_SCOPE_SIZE = 50


def validate_rule_payload(payload):
    """Validate and normalize rule payload for target-student filtering."""
    if not isinstance(payload, dict):
        raise ValueError("请求参数格式错误")

    grade_level = payload.get("grade_level")
    if not grade_level:
        raise ValueError("缺少年级参数 grade_level（cohort格式，如初中2023级）")

    grade_values = {value for value, _ in COHORT_CHOICES}
    if grade_level not in grade_values:
        raise ValueError("grade_level 非法，应为 cohort 格式（如初中2023级）")

    exam_scope = payload.get("exam_scope") or {}
    if not isinstance(exam_scope, dict):
        raise ValueError("exam_scope 参数格式错误")

    exam_scope_type = exam_scope.get("type")
    if exam_scope_type not in ALLOWED_EXAM_SCOPE_TYPES:
        raise ValueError("exam_scope.type 非法")

    metric = payload.get("metric")
    if metric not in ALLOWED_METRICS:
        raise ValueError("metric 非法，第一期仅支持 total_score_rank_in_grade")

    operator = payload.get("operator")
    if operator not in ALLOWED_OPERATORS:
        raise ValueError("operator 非法，第一期仅支持 lte")

    threshold = payload.get("threshold")
    try:
        threshold = int(threshold)
    except (TypeError, ValueError):
        raise ValueError("threshold 必须为正整数")

    if threshold <= 0:
        raise ValueError("threshold 必须为正整数")

    quantifier = payload.get("quantifier")
    if quantifier not in ALLOWED_QUANTIFIERS:
        raise ValueError("quantifier 非法")

    absent_policy = payload.get("absent_policy")
    if absent_policy not in ALLOWED_ABSENT_POLICIES:
        raise ValueError("absent_policy 非法")

    k = payload.get("k")
    if quantifier == "at_least":
        try:
            k = int(k)
        except (TypeError, ValueError):
            raise ValueError("quantifier=at_least 时，k 必须为正整数")
        if k <= 0:
            raise ValueError("quantifier=at_least 时，k 必须大于0")
    else:
        k = None

    normalized_exam_scope = _normalize_exam_scope(exam_scope)

    return {
        "grade_level": grade_level,
        "exam_scope": normalized_exam_scope,
        "metric": metric,
        "operator": operator,
        "threshold": threshold,
        "quantifier": quantifier,
        "k": k,
        "absent_policy": absent_policy,
    }


def _normalize_exam_scope(exam_scope):
    scope_type = exam_scope.get("type")

    normalized = {"type": scope_type}

    if scope_type == "selected_exam_ids":
        exam_ids = exam_scope.get("exam_ids") or []
        if not isinstance(exam_ids, list) or not exam_ids:
            raise ValueError("exam_scope.type=selected_exam_ids 时，exam_ids 必须为非空数组")

        normalized_ids = []
        for exam_id in exam_ids:
            try:
                normalized_ids.append(int(exam_id))
            except (TypeError, ValueError):
                raise ValueError("exam_ids 中存在非法考试ID")

        normalized["exam_ids"] = list(dict.fromkeys(normalized_ids))

    if scope_type == "date_range":
        date_from_raw = exam_scope.get("date_from")
        date_to_raw = exam_scope.get("date_to")

        if not date_from_raw or not date_to_raw:
            raise ValueError("exam_scope.type=date_range 时，date_from 和 date_to 为必填")

        try:
            date_from = datetime.date.fromisoformat(str(date_from_raw))
            date_to = datetime.date.fromisoformat(str(date_to_raw))
        except ValueError:
            raise ValueError("date_from/date_to 格式必须为 YYYY-MM-DD")

        if date_from > date_to:
            raise ValueError("date_from 不能晚于 date_to")

        normalized["date_from"] = date_from
        normalized["date_to"] = date_to

    return normalized


def build_exam_scope(grade_level, exam_scope):
    """Resolve target exams from scope definition and grade."""
    scope_type = exam_scope["type"]

    exams = Exam.objects.filter(grade_level=grade_level).order_by("date", "id")

    if scope_type == "selected_exam_ids":
        exams = exams.filter(id__in=exam_scope["exam_ids"])
    elif scope_type == "date_range":
        exams = exams.filter(date__gte=exam_scope["date_from"], date__lte=exam_scope["date_to"])

    exam_list = list(exams)
    if not exam_list:
        raise ValueError("该范围内无考试数据")

    if len(exam_list) > MAX_EXAM_SCOPE_SIZE:
        raise ValueError(f"考试范围过大，最多允许 {MAX_EXAM_SCOPE_SIZE} 场")

    return exam_list


def build_candidate_students(grade_level, only_active=True):
    """
    Build candidate student queryset for the target grade.

    grade_level 参数实际上是 cohort 格式（如"初中2023级"），
    Student 用 cohort 字段过滤。
    """
    students = Student.objects.select_related("current_class").filter(cohort=grade_level)
    if only_active:
        students = students.filter(status="在读")
    return list(students.order_by("student_id", "id"))


def compute_student_hits(students, exams, threshold):
    """Compute hit/participation/missing stats for each student across exams."""
    if not students:
        return []

    student_ids = [student.id for student in students]
    exam_ids = [exam.id for exam in exams]

    # Total rank is duplicated on every subject row; Min() gives a stable single value per (student, exam).
    raw_rank_rows = (
        Score.objects.filter(student_id__in=student_ids, exam_id__in=exam_ids)
        .values("student_id", "exam_id")
        .annotate(total_rank=Min("total_score_rank_in_grade"))
    )

    rank_map = {}
    for row in raw_rank_rows:
        rank_map[(row["student_id"], row["exam_id"])] = row["total_rank"]

    exam_count = len(exams)
    stats = []
    for student in students:
        hit_count = 0
        participated_count = 0
        rank_sum = 0

        for exam in exams:
            rank = rank_map.get((student.id, exam.id))
            if rank is None:
                continue

            participated_count += 1
            rank_sum += rank
            if rank <= threshold:
                hit_count += 1

        stats.append(
            {
                "student": student,
                "hit_count": hit_count,
                "participated_count": participated_count,
                "missed_exam_count": exam_count - participated_count,
                "exam_count": exam_count,
                "avg_rank": round(rank_sum / participated_count, 1) if participated_count > 0 else None,
            }
        )

    return stats


def apply_quantifier(student_stat, quantifier, absent_policy, k=None):
    """Evaluate whether one student stat matches the quantifier condition."""
    hit_count = student_stat["hit_count"]
    participated_count = student_stat["participated_count"]
    exam_count = student_stat["exam_count"]

    if quantifier == "all":
        if absent_policy == "strict_fail":
            return hit_count == exam_count
        return participated_count >= 1 and hit_count == participated_count

    if quantifier == "at_least":
        return hit_count >= (k or 0)

    return False


def execute_target_student_rule(payload):
    """Execute first-phase target-student filtering rule and return normalized result."""
    rule = validate_rule_payload(payload)

    exams = build_exam_scope(rule["grade_level"], rule["exam_scope"])
    exam_count = len(exams)

    if rule["quantifier"] == "at_least" and rule["absent_policy"] == "strict_fail" and rule["k"] > exam_count:
        raise ValueError("strict_fail 场景下，k 不能大于目标考试场次")

    students = build_candidate_students(rule["grade_level"], only_active=True)
    student_stats = compute_student_hits(students, exams, rule["threshold"])

    matched_students = []
    for stat in student_stats:
        if not apply_quantifier(stat, rule["quantifier"], rule["absent_policy"], rule["k"]):
            continue

        student = stat["student"]
        matched_students.append(
            {
                "student_pk": student.id,
                "student_id": student.student_id,
                "name": student.name,
                "cohort": student.cohort,
                "grade_level": student.grade_level,
                "grade_level_display": student.get_grade_level_display() if student.grade_level else None,
                "class_name": student.current_class.class_name if student.current_class else None,
                "hit_count": stat["hit_count"],
                "required_count": stat["exam_count"] if rule["absent_policy"] == "strict_fail" else stat["participated_count"],
                "participated_count": stat["participated_count"],
                "missed_exam_count": stat["missed_exam_count"],
                "avg_rank": stat["avg_rank"],
            }
        )

    matched_students.sort(key=lambda item: (-item["hit_count"], item["missed_exam_count"], item["student_id"]))

    return {
        "rule_summary": {
            "grade_level": rule["grade_level"],
            "metric": rule["metric"],
            "operator": rule["operator"],
            "threshold": rule["threshold"],
            "quantifier": rule["quantifier"],
            "k": rule["k"],
            "absent_policy": rule["absent_policy"],
        },
        "exam_count": exam_count,
        "matched_count": len(matched_students),
        "students": matched_students,
    }

"""Group comparison calculation tool."""

from .score_tool import (
    competition_rank,
    compute_student_metric,
    format_number,
    scores_by_student,
    student_queryset_for_scope,
)


def _average_for_scope(exam, scope, subject=None):
    subjects = [subject] if subject else None
    students = list(student_queryset_for_scope(scope))
    grouped = scores_by_student(exam, students, subjects)
    values = []
    for student in students:
        score = compute_student_metric(exam, student, grouped, subjects)
        if score is not None:
            values.append(score)
    if not values:
        return None, 0
    return sum(values) / len(values), len(values)


def calculate_group_comparison(exam, object_scope, reference_scope, subject=None):
    object_avg, object_count = _average_for_scope(exam, object_scope, subject)
    reference_avg, reference_count = _average_for_scope(exam, reference_scope, subject)
    if object_avg is None or reference_avg is None:
        return {"status": "empty"}

    rank = "-"
    if reference_scope.get("type") == "business_group" and reference_scope.get("class_names"):
        class_items = []
        for class_name in reference_scope["class_names"]:
            scope = {"type": "class", "cohort": reference_scope["cohort"], "class_name": class_name}
            avg, count = _average_for_scope(exam, scope, subject)
            if avg is not None:
                class_items.append({"class_name": class_name, "avg": avg, "count": count})
        class_items.sort(key=lambda item: (-item["avg"], item["class_name"]))
        for item_rank, item in competition_rank(class_items, lambda value: round(value["avg"], 6)):
            if object_scope.get("class_name") == item["class_name"]:
                rank = item_rank
                break

    return {
        "status": "success",
        "rows": [
            {
                "object_name": object_scope.get("label"),
                "reference_name": reference_scope.get("label"),
                "metric": f"{subject or '总分'}均分",
                "object_avg": format_number(object_avg),
                "reference_avg": format_number(reference_avg),
                "diff": format_number(object_avg - reference_avg),
                "ratio": f"{round((object_avg / reference_avg) * 100, 1)}%" if reference_avg else "-",
                "rank_in_reference": rank,
                "valid_count": object_count,
            }
        ],
        "object_count": object_count,
        "reference_count": reference_count,
    }


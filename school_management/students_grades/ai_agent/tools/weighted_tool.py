"""Two-exam weighted score calculation tool."""

from .score_tool import (
    competition_rank,
    compute_student_metric,
    excluded_count,
    format_number,
    get_exam_subjects,
    scores_by_student,
    student_queryset_for_scope,
)


def normalize_weights(weight_a, weight_b):
    total = float(weight_a) + float(weight_b)
    if total <= 0:
        return None
    return float(weight_a) / total, float(weight_b) / total


def calculate_weighted(exam_a, exam_b, weights, scope, subjects=None, top_n=3):
    if subjects is None:
        subjects_a = set(get_exam_subjects(exam_a))
        subjects_b = set(get_exam_subjects(exam_b))
        if subjects_a != subjects_b:
            return {
                "status": "subject_mismatch",
                "common_subjects": sorted(subjects_a & subjects_b),
                "only_exam_a": sorted(subjects_a - subjects_b),
                "only_exam_b": sorted(subjects_b - subjects_a),
            }

    normalized = normalize_weights(weights[0], weights[1])
    if normalized is None:
        return {"status": "invalid_weight"}
    weight_a, weight_b = normalized

    students = list(student_queryset_for_scope(scope).order_by("current_class__class_name", "student_id", "id"))
    grouped_a = scores_by_student(exam_a, students, subjects)
    grouped_b = scores_by_student(exam_b, students, subjects)

    items = []
    for student in students:
        score_a = compute_student_metric(exam_a, student, grouped_a, subjects)
        score_b = compute_student_metric(exam_b, student, grouped_b, subjects)
        if score_a is None or score_b is None:
            continue
        weighted_score = score_a * weight_a + score_b * weight_b
        items.append(
            {
                "student": student,
                "score_a": score_a,
                "score_b": score_b,
                "weighted_score": weighted_score,
            }
        )

    items.sort(
        key=lambda item: (
            -item["weighted_score"],
            item["student"].current_class.class_name if item["student"].current_class else "",
            item["student"].student_id or "",
            item["student"].id,
        )
    )

    rows = []
    for rank, item in competition_rank(items, lambda value: round(value["weighted_score"], 6)):
        if len(rows) >= top_n:
            break
        student = item["student"]
        rows.append(
            {
                "rank": rank,
                "student_name": student.name,
                "class_name": student.current_class.class_name if student.current_class else "未分班",
                "exam_a_score": format_number(item["score_a"]),
                "exam_a_weight": f"{round(weight_a * 100, 1)}%",
                "exam_b_score": format_number(item["score_b"]),
                "exam_b_weight": f"{round(weight_b * 100, 1)}%",
                "weighted_score": format_number(item["weighted_score"]),
                "note": "-",
            }
        )

    return {
        "status": "success",
        "rows": rows,
        "excluded_count": excluded_count(students, grouped_a, subjects) + excluded_count(students, grouped_b, subjects),
        "valid_count": len(items),
        "weights": (weight_a, weight_b),
    }


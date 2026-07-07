"""Ranking calculation tool."""

from .score_tool import (
    competition_rank,
    compute_student_metric,
    excluded_count,
    format_number,
    scores_by_student,
    student_queryset_for_scope,
)


def calculate_ranking(exam, scope, subject=None, top_n=3, student_name=None):
    subjects = [subject] if subject else None
    students = list(student_queryset_for_scope(scope).order_by("current_class__class_name", "student_id", "id"))
    grouped = scores_by_student(exam, students, subjects)

    items = []
    for student in students:
        score = compute_student_metric(exam, student, grouped, subjects)
        if score is None:
            continue
        items.append({"student": student, "score": score})

    items.sort(
        key=lambda item: (
            -item["score"],
            item["student"].current_class.class_name if item["student"].current_class else "",
            item["student"].student_id or "",
            item["student"].id,
        )
    )

    ranked = list(competition_rank(items, lambda value: value["score"]))

    # Single-student mode: find the named student in the full ranking
    if student_name:
        matches = []
        for rank, item in ranked:
            if item["student"].name == student_name:
                student = item["student"]
                matches.append({
                    "rank": rank,
                    "total": len(ranked),
                    "student_name": student.name,
                    "student_id": student.student_id,
                    "class_name": student.current_class.class_name if student.current_class else "未分班",
                    "score": format_number(item["score"]),
                })
        if matches:
            return {
                "rows": matches,
                "excluded_count": excluded_count(students, grouped, subjects),
                "valid_count": len(items),
                "student_mode": True,
            }

    rows = []
    for rank, item in ranked:
        if len(rows) >= top_n:
            break
        student = item["student"]
        rows.append(
            {
                "rank": rank,
                "student_name": student.name,
                "student_id": student.student_id,
                "class_name": student.current_class.class_name if student.current_class else "未分班",
                "score": format_number(item["score"]),
                "note": "并列" if sum(1 for candidate in items if candidate["score"] == item["score"]) > 1 else "-",
            }
        )

    return {
        "rows": rows,
        "excluded_count": excluded_count(students, grouped, subjects),
        "valid_count": len(items),
    }


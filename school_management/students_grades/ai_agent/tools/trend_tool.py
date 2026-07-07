"""Single student trend calculation tool."""

from .ranking_tool import calculate_ranking
from .score_tool import compute_student_metric, format_number, scores_by_student, student_queryset_for_scope


def calculate_student_trend(student, exams, subject=None, rank_scope=None, group_scope=None):
    rows = []
    previous_score = None
    previous_rank = None
    subjects = [subject] if subject else None

    for exam in exams:
        grouped = scores_by_student(exam, [student], subjects)
        score = compute_student_metric(exam, student, grouped, subjects)
        if score is None:
            continue

        rank = None
        if rank_scope:
            scope = dict(group_scope or {})
            if rank_scope == "class":
                scope = {
                    "type": "class",
                    "cohort": student.cohort,
                    "class_name": student.current_class.class_name if student.current_class else None,
                }
            elif rank_scope == "grade":
                scope = {"type": "grade", "cohort": student.cohort}
            ranking = calculate_ranking(exam, scope, subject=subject, top_n=9999)
            for item in ranking["rows"]:
                if item["student_id"] == student.student_id:
                    rank = item["rank"]
                    break

        rows.append(
            {
                "exam_name": exam.name,
                "exam_date": exam.date.strftime("%Y-%m-%d") if exam.date else "",
                "metric": subject or "总分",
                "score": format_number(score),
                "rank": rank or "-",
                "score_change": "-" if previous_score is None else format_number(score - previous_score),
                "rank_change": "-" if previous_rank is None or rank is None else previous_rank - rank,
            }
        )
        previous_score = score
        previous_rank = rank

    return {"rows": rows, "valid_count": len(rows)}


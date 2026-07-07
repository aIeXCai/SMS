"""Shared score query and calculation helpers."""

from collections import defaultdict

from django.db.models import Q

from ...models.exam import Exam
from ...models.score import Score
from ...models.student import Class, Student


CHINESE_NUMBERS = {
    "一": 1,
    "二": 2,
    "三": 3,
    "四": 4,
    "五": 5,
    "六": 6,
    "七": 7,
    "八": 8,
    "九": 9,
    "十": 10,
}


def format_number(value):
    if value is None:
        return None
    rounded = round(float(value), 2)
    return int(rounded) if rounded.is_integer() else rounded


def competition_rank(sorted_items, score_getter):
    ranks = []
    previous_score = None
    previous_rank = 0
    for index, item in enumerate(sorted_items, start=1):
        score = score_getter(item)
        if previous_score is None or score != previous_score:
            previous_rank = index
            previous_score = score
        ranks.append((previous_rank, item))
    return ranks


def get_exam_subjects(exam):
    subjects = list(exam.exam_subjects.values_list("subject_code", flat=True))
    if subjects:
        return subjects
    return list(
        Score.objects.filter(exam=exam)
        .values_list("subject", flat=True)
        .distinct()
        .order_by("subject")
    )


def student_queryset_for_scope(scope):
    qs = Student.objects.select_related("current_class").filter(status="在读")
    scope_type = scope.get("type")
    if scope_type == "class":
        return qs.filter(current_class__class_name=scope.get("class_name"), cohort=scope.get("cohort"))
    if scope_type == "grade":
        return qs.filter(cohort=scope.get("cohort"))
    if scope_type == "business_group":
        return qs.filter(current_class_id__in=scope.get("class_ids", []), cohort=scope.get("cohort"))
    return qs.none()


def scores_by_student(exam, students, subjects=None):
    student_ids = [student.id for student in students]
    query = Score.objects.filter(exam=exam, student_id__in=student_ids).select_related(
        "student", "student__current_class"
    )
    if subjects:
        query = query.filter(subject__in=subjects)

    grouped = defaultdict(dict)
    for score in query:
        grouped[score.student_id][score.subject] = float(score.score_value)
    return grouped


def compute_student_metric(exam, student, grouped_scores, subjects=None):
    subject_scores = grouped_scores.get(student.id, {})
    if subjects:
        values = [subject_scores[item] for item in subjects if item in subject_scores]
        if len(values) != len(subjects):
            return None
        return sum(values)
    if not subject_scores:
        return None
    return sum(subject_scores.values())


def excluded_count(students, grouped_scores, subjects=None):
    count = 0
    for student in students:
        subject_scores = grouped_scores.get(student.id, {})
        if subjects:
            if any(subject not in subject_scores for subject in subjects):
                count += 1
        elif not subject_scores:
            count += 1
    return count


def find_student(name):
    matches = Student.objects.select_related("current_class").exclude(status='毕业').filter(name__icontains=name).order_by("id")
    if matches.count() == 1:
        return matches.first(), []
    return None, list(matches[:8])


def find_classes(cohort, class_names):
    return list(Class.objects.filter(cohort=cohort, class_name__in=class_names).order_by("class_name", "id"))


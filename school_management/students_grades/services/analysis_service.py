import json
import re
import statistics
from decimal import Decimal

from django.db.models import Avg, Count, Max, Min, Sum

from ..models.exam import ExamSubject, SUBJECT_DEFAULT_MAX_SCORES
from ..models.score import SUBJECT_CHOICES
from ..models.student import Class
from ..models.score import Score


def _decimal_to_float(value):
    if value is None:
        return 0.0
    if isinstance(value, Decimal):
        return float(value)
    return value


def _build_exam_subject_max_score_map(exam):
    return {
        item.subject_code: item.max_score
        for item in exam.exam_subjects.all()
    }


def _compute_total_max_score(exam, extra_subject_codes=None):
    subject_max_score_map = _build_exam_subject_max_score_map(exam)
    total_max_score = sum(subject_max_score_map.values())

    if extra_subject_codes:
        # exam.grade_level 是 cohort 格式（如"初中2024级"），需要转换为旧格式（如"初三"）
        base_grade_level = exam.get_grade_level_from_cohort()
        grade_config = SUBJECT_DEFAULT_MAX_SCORES.get(base_grade_level, {})
        for subject_code in extra_subject_codes:
            if subject_code not in subject_max_score_map:
                total_max_score += grade_config.get(subject_code, 100)

    return total_max_score


def analyze_single_class(scores, target_class, exam):
    total_students = scores.values("student").distinct().count()

    subject_stats = {}
    score_distribution = {}
    exam_subject_max_score_map = _build_exam_subject_max_score_map(exam)

    for subject_code, subject_name in SUBJECT_CHOICES:
        subject_scores = scores.filter(subject=subject_code)
        if subject_scores.exists():
            stats = subject_scores.aggregate(
                avg_score=Avg("score_value"),
                max_score=Max("score_value"),
                min_score=Min("score_value"),
                count=Count("score_value"),
            )
            subject_stats[subject_code] = {
                "name": subject_name,
                "avg_score": round(float(stats["avg_score"] or 0), 2),
                "actual_max_score": float(stats["max_score"] or 0),
                "actual_min_score": float(stats["min_score"] or 0),
                "count": stats["count"],
            }

            subject_max_score = exam_subject_max_score_map.get(subject_code)
            if not subject_max_score:
                base_grade_level = exam.get_grade_level_from_cohort()
                grade_config = SUBJECT_DEFAULT_MAX_SCORES.get(base_grade_level, {})
                subject_max_score = grade_config.get(subject_code, 100)

            subject_stats[subject_code]["exam_max_score"] = subject_max_score

            score_distribution[subject_code] = {
                "特优(95%+)": subject_scores.filter(score_value__gte=subject_max_score * 0.95).count(),
                "优秀(85%-95%)": subject_scores.filter(
                    score_value__gte=subject_max_score * 0.85,
                    score_value__lt=subject_max_score * 0.95,
                ).count(),
                "良好(70%-85%)": subject_scores.filter(
                    score_value__gte=subject_max_score * 0.70,
                    score_value__lt=subject_max_score * 0.85,
                ).count(),
                "及格(60%-70%)": subject_scores.filter(
                    score_value__gte=subject_max_score * 0.60,
                    score_value__lt=subject_max_score * 0.70,
                ).count(),
                "不及格(<60%)": subject_scores.filter(score_value__lt=subject_max_score * 0.60).count(),
            }

    student_total_scores = []
    student_scores = scores.values("student__id", "student__name").annotate(
        total_score=Sum("score_value"),
        subject_count=Count("subject"),
    ).order_by("-total_score")

    for index, student_data in enumerate(student_scores):
        student_id = student_data["student__id"]
        grade_rank = None
        sample_score = scores.filter(student_id=student_id).first()
        if sample_score:
            grade_rank = sample_score.total_score_rank_in_grade

        student_total_scores.append(
            {
                "student_id": student_id,
                "student_name": student_data["student__name"],
                "total_score": float(student_data["total_score"]),
                "subject_count": student_data["subject_count"],
                "rank": index + 1,
                "grade_rank": grade_rank,
            }
        )

    if student_total_scores:
        class_avg_total = sum(item["total_score"] for item in student_total_scores) / len(student_total_scores)
        class_max_total = max(item["total_score"] for item in student_total_scores)
        class_min_total = min(item["total_score"] for item in student_total_scores)
    else:
        class_avg_total = class_max_total = class_min_total = 0

    observed_subject_codes = list(scores.values_list("subject", flat=True).distinct())
    total_max_score = _compute_total_max_score(exam, observed_subject_codes)

    grade_distribution = {
        "特优(95%+)": 0,
        "优秀(85%-95%)": 0,
        "良好(70%-85%)": 0,
        "及格(60%-70%)": 0,
        "不及格(<60%)": 0,
    }

    for student_data in student_total_scores:
        if total_max_score > 0:
            percentage = student_data["total_score"] / total_max_score
            if percentage >= 0.95:
                grade_distribution["特优(95%+)"] += 1
            elif percentage >= 0.85:
                grade_distribution["优秀(85%-95%)"] += 1
            elif percentage >= 0.70:
                grade_distribution["良好(70%-85%)"] += 1
            elif percentage >= 0.60:
                grade_distribution["及格(60%-70%)"] += 1
            else:
                grade_distribution["不及格(<60%)"] += 1

    chart_data = {
        "subject_avg_scores": {
            "labels": [subject_stats[code]["name"] for code in subject_stats.keys()],
            "data": [float(subject_stats[code]["avg_score"]) for code in subject_stats.keys()],
        },
        "subject_max_scores": [subject_stats[code]["actual_max_score"] for code in subject_stats.keys()],
        "score_distribution": score_distribution,
        "student_total_scores": [
            {
                "student_id": item["student_id"],
                "student_name": item["student_name"],
                "total_score": float(item["total_score"]),
                "subject_count": item["subject_count"],
                "rank": item["rank"],
                "grade_rank": item["grade_rank"],
            }
            for item in student_total_scores[:10]
        ],
        "total_max_score": total_max_score,
        "grade_distribution": grade_distribution,
    }

    return {
        "total_students": total_students,
        "subject_stats": subject_stats,
        "score_distribution": score_distribution,
        "student_rankings": student_total_scores,
        "class_avg_total": round(class_avg_total, 2),
        "class_max_total": float(class_max_total) if class_max_total else 0,
        "class_min_total": float(class_min_total) if class_min_total else 0,
        "chart_data_json": json.dumps(chart_data, ensure_ascii=False),
        "target_class": target_class,
    }


def analyze_multiple_classes(selected_classes, exam):
    all_scores = Score.objects.filter(
        exam=exam,
        student__current_class__in=selected_classes,
    ).select_related("student", "student__current_class")

    exam_subjects = ExamSubject.objects.filter(exam=exam)
    subjects = [item.subject_code for item in exam_subjects]

    class_statistics = []
    class_subject_averages = {}
    score_distributions = {}
    total_students = 0
    highest_avg = 0

    def extract_class_number(class_obj):
        class_name = class_obj.class_name
        match = re.search(r"(\d+)", class_name)
        return int(match.group(1)) if match else 0

    sorted_classes = sorted(selected_classes, key=extract_class_number)

    for class_obj in sorted_classes:
        class_scores = all_scores.filter(student__current_class=class_obj)

        student_count = class_scores.values("student").distinct().count()
        total_students += student_count

        subject_averages = []
        class_name = class_obj.class_name
        class_subject_averages[class_name] = []

        for subject in subjects:
            subject_scores = class_scores.filter(subject=subject)
            scores_list = [_decimal_to_float(item.score_value) for item in subject_scores if item.score_value is not None]
            if scores_list:
                avg_score = statistics.mean(scores_list)
                subject_averages.append(round(avg_score, 2))
                class_subject_averages[class_name].append(round(avg_score, 2))
            else:
                subject_averages.append(0)
                class_subject_averages[class_name].append(0)

        student_totals = {}
        for score in class_scores:
            if score.student.id not in student_totals:
                student_totals[score.student.id] = 0
            if score.score_value is not None:
                student_totals[score.student.id] += _decimal_to_float(score.score_value)

        total_scores_list = list(student_totals.values()) if student_totals else [0]
        avg_total = statistics.mean(total_scores_list) if total_scores_list else 0
        max_total = max(total_scores_list) if total_scores_list else 0
        min_total = min(total_scores_list) if total_scores_list else 0

        avg_total = round(float(avg_total), 2)
        max_total = float(max_total)
        min_total = float(min_total)

        if avg_total > highest_avg:
            highest_avg = avg_total

        score_dist = [0, 0, 0, 0, 0]
        observed_subject_codes = list(class_scores.values_list("subject", flat=True).distinct())
        total_max_score = _compute_total_max_score(exam, observed_subject_codes)

        for total in total_scores_list:
            if total_max_score > 0:
                percentage = (total / total_max_score) * 100
                if percentage >= 95:
                    score_dist[0] += 1
                elif percentage >= 85:
                    score_dist[1] += 1
                elif percentage >= 70:
                    score_dist[2] += 1
                elif percentage >= 60:
                    score_dist[3] += 1
                else:
                    score_dist[4] += 1

        score_distributions[class_name] = score_dist

        class_statistics.append(
            {
                "class_name": class_name,
                "student_count": student_count,
                "avg_total": _decimal_to_float(avg_total),
                "max_total": _decimal_to_float(max_total),
                "min_total": _decimal_to_float(min_total),
                "subject_averages": subject_averages,
            }
        )

    sorted_class_names = [item.class_name for item in sorted_classes]
    chart_data = {
        "subjects": subjects,
        "classes": sorted_class_names,
        "class_subject_averages": class_subject_averages,
        "score_distributions": score_distributions,
    }

    subject_names = []
    for subject_code in subjects:
        exam_subject = exam_subjects.filter(subject_code=subject_code).first()
        if exam_subject:
            subject_names.append(exam_subject.subject_name)
        else:
            for code, name in SUBJECT_CHOICES:
                if code == subject_code:
                    subject_names.append(name)
                    break
            else:
                subject_names.append(subject_code)

    return {
        "class_statistics": class_statistics,
        "subjects": [{"code": code, "name": name} for code, name in zip(subjects, subject_names)],
        "total_students": total_students,
        "subject_count": len(subjects),
        "highest_avg": float(highest_avg),
        "chart_data_json": json.dumps(chart_data),
        "academic_year": exam.academic_year,
    }


def analyze_grade(exam, grade_level):
    """
    分析年级成绩。

    grade_level 参数是 cohort 格式（如"初中2023级"）。
    Class 用 cohort 字段存储，Score 用 student__current_class__cohort 过滤。
    """
    classes = Class.objects.filter(cohort=grade_level)
    classes = sorted(classes, key=lambda item: int("".join(filter(str.isdigit, item.class_name))) if any(char.isdigit() for char in item.class_name) else 999)

    all_scores = Score.objects.filter(
        exam=exam,
        student__current_class__cohort=grade_level,
    ).select_related("student", "student__current_class")

    exam_subjects = ExamSubject.objects.filter(exam=exam)
    subjects = [
        {
            "code": item.subject_code,
            "name": dict(SUBJECT_CHOICES).get(item.subject_code, item.subject_code),
            "max_score": item.max_score,
        }
        for item in exam_subjects
    ]

    total_students = all_scores.values("student").distinct().count()
    total_classes = len(classes)

    class_statistics = []
    class_names = []
    class_averages = []
    class_grade_distribution = {}

    subject_stats = {}
    for subject in subjects:
        subject_code = subject["code"]
        subject_scores = all_scores.filter(subject=subject_code)
        if subject_scores.exists():
            avg_score = subject_scores.aggregate(avg=Avg("score_value"))["avg"]
            subject_stats[subject_code] = {
                "name": subject["name"],
                "avg_score": _decimal_to_float(avg_score),
                "max_score": subject["max_score"],
            }

    student_totals = {}
    for score in all_scores:
        if score.student.id not in student_totals:
            student_totals[score.student.id] = 0
        if score.score_value is not None:
            student_totals[score.student.id] += _decimal_to_float(score.score_value)

    total_scores_list = list(student_totals.values()) if student_totals else [0]
    grade_avg_score = statistics.mean(total_scores_list) if total_scores_list else 0

    observed_subject_codes = list(all_scores.values_list("subject", flat=True).distinct())
    total_max_score = _compute_total_max_score(exam, observed_subject_codes)

    if total_max_score > 0:
        excellent_count = sum(1 for score in total_scores_list if score >= total_max_score * 0.95)
        excellent_rate = (excellent_count / len(total_scores_list) * 100) if total_scores_list else 0
    else:
        excellent_count = 0
        excellent_rate = 0

    for class_obj in classes:
        class_scores = all_scores.filter(student__current_class=class_obj)
        if not class_scores.exists():
            continue

        class_name = class_obj.class_name
        class_names.append(class_name)

        class_student_totals = {}
        for score in class_scores:
            if score.student.id not in class_student_totals:
                class_student_totals[score.student.id] = 0
            if score.score_value is not None:
                class_student_totals[score.student.id] += _decimal_to_float(score.score_value)

        class_total_scores = list(class_student_totals.values()) if class_student_totals else [0]
        avg_total = statistics.mean(class_total_scores) if class_total_scores else 0
        max_total = max(class_total_scores) if class_total_scores else 0
        min_total = min(class_total_scores) if class_total_scores else 0

        class_averages.append(_decimal_to_float(avg_total))

        student_count = len(class_total_scores)
        if total_max_score > 0:
            class_excellent_plus_count = sum(1 for score in class_total_scores if score >= total_max_score * 0.95)
            class_excellent_count = sum(1 for score in class_total_scores if total_max_score * 0.85 <= score < total_max_score * 0.95)
            class_good_count = sum(1 for score in class_total_scores if total_max_score * 0.70 <= score < total_max_score * 0.85)
            class_pass_count = sum(1 for score in class_total_scores if total_max_score * 0.60 <= score < total_max_score * 0.70)
            class_fail_count = sum(1 for score in class_total_scores if score < total_max_score * 0.60)

            class_excellent_rate = ((class_excellent_plus_count + class_excellent_count) / student_count * 100) if student_count > 0 else 0
            class_good_rate = ((class_good_count + class_excellent_count + class_excellent_plus_count) / student_count * 100) if student_count > 0 else 0
            class_pass_rate = ((class_pass_count + class_good_count + class_excellent_count + class_excellent_plus_count) / student_count * 100) if student_count > 0 else 0
        else:
            class_excellent_plus_count = class_excellent_count = class_good_count = class_pass_count = class_fail_count = 0
            class_excellent_rate = class_good_rate = class_pass_rate = 0

        subject_averages = []
        for subject in subjects:
            subject_code = subject["code"]
            class_subject_scores = class_scores.filter(subject=subject_code)
            if class_subject_scores.exists():
                avg = class_subject_scores.aggregate(avg=Avg("score_value"))["avg"]
                subject_averages.append(_decimal_to_float(avg))
            else:
                subject_averages.append(0)

        class_statistics.append(
            {
                "class_name": class_name,
                "student_count": student_count,
                "avg_total": _decimal_to_float(avg_total),
                "max_total": _decimal_to_float(max_total),
                "min_total": _decimal_to_float(min_total),
                "excellent_rate": class_excellent_rate,
                "good_rate": class_good_rate,
                "pass_rate": class_pass_rate,
                "subject_averages": subject_averages,
            }
        )

        class_grade_distribution[class_name] = [
            class_fail_count,
            class_pass_count,
            class_good_count,
            class_excellent_count,
            class_excellent_plus_count,
        ]

    score_ranges = ["特优(95%+)", "优秀(85%-95%)", "良好(70%-85%)", "及格(60%-70%)", "不及格(<60%)"]
    score_distribution = [0, 0, 0, 0, 0]

    if total_max_score > 0:
        for total_score in total_scores_list:
            if total_score >= total_max_score * 0.95:
                score_distribution[0] += 1
            elif total_score >= total_max_score * 0.85:
                score_distribution[1] += 1
            elif total_score >= total_max_score * 0.70:
                score_distribution[2] += 1
            elif total_score >= total_max_score * 0.60:
                score_distribution[3] += 1
            else:
                score_distribution[4] += 1

    difficulty_coefficients = []
    subject_names = []
    subject_averages = []
    subject_max_scores = []

    for subject in subjects:
        subject_code = subject["code"]
        if subject_code in subject_stats:
            subject_names.append(subject_stats[subject_code]["name"])
            subject_averages.append(subject_stats[subject_code]["avg_score"])
            subject_max_scores.append(subject["max_score"])
            subject_max_score = subject["max_score"]
            difficulty_coefficient = (subject_stats[subject_code]["avg_score"] / subject_max_score) if subject_max_score else 0
            difficulty_coefficients.append(difficulty_coefficient)

    chart_data = {
        "class_names": class_names,
        "class_averages": class_averages,
        "subject_names": subject_names,
        "subject_averages": subject_averages,
        "subject_max_scores": subject_max_scores,
        "score_ranges": score_ranges,
        "score_distribution": score_distribution,
        "class_grade_distribution": class_grade_distribution,
        "difficulty_coefficients": difficulty_coefficients,
        "total_max_score": total_max_score,
        "total_scores": total_scores_list,
    }

    return {
        "total_students": total_students,
        "total_classes": total_classes,
        "grade_avg_score": _decimal_to_float(grade_avg_score),
        "excellent_rate": excellent_rate,
        "class_statistics": class_statistics,
        "subjects": subjects,
        "total_max_score": total_max_score,
        "chart_data_json": json.dumps(chart_data, ensure_ascii=False),
    }

from datetime import date
import json

from .test_base import BaseTestCase
from school_management.students_grades.models import Class, Student, Exam, ExamSubject, Score
from school_management.students_grades.services.analysis_service import (
    analyze_single_class,
    analyze_multiple_classes,
    analyze_grade,
)


class AnalysisServiceTests(BaseTestCase):
    def test_single_class_subject_max_score_prefers_exam_subject(self):
        cls = Class.objects.create(grade_level="初三", class_name="1班")
        student = Student.objects.create(student_id="SVC1", name="SVC1", grade_level="初三", current_class=cls)

        exam = Exam.objects.create(name="E_service_single", academic_year="2025-2026", grade_level="初三", date=date(2024, 1, 1))
        ExamSubject.objects.create(exam=exam, subject_code="语文", subject_name="语文", max_score=120)

        Score.objects.create(student=student, exam=exam, subject="语文", score_value=96)

        scores = Score.objects.filter(exam=exam, student__current_class=cls)
        result = analyze_single_class(scores, cls, exam)

        subject_stats = result.get("subject_stats", {})
        self.assertIn("语文", subject_stats)
        self.assertEqual(subject_stats["语文"].get("exam_max_score"), 120)

    def test_single_class_total_max_score_fills_missing_subjects_from_default(self):
        cls = Class.objects.create(grade_level="初三", class_name="2班")
        student = Student.objects.create(student_id="SVC2", name="SVC2", grade_level="初三", current_class=cls)

        exam = Exam.objects.create(name="E_service_total", academic_year="2025-2026", grade_level="初三", date=date(2024, 2, 1))
        ExamSubject.objects.create(exam=exam, subject_code="语文", subject_name="语文", max_score=120)

        Score.objects.create(student=student, exam=exam, subject="语文", score_value=100)
        Score.objects.create(student=student, exam=exam, subject="数学", score_value=100)

        scores = Score.objects.filter(exam=exam, student__current_class=cls)
        result = analyze_single_class(scores, cls, exam)
        chart_data = json.loads(result.get("chart_data_json", "{}"))

        self.assertEqual(chart_data.get("total_max_score"), 240)

    def test_multiple_classes_distribution_uses_completed_total_max_score(self):
        cls = Class.objects.create(grade_level="初三", class_name="3班")
        student = Student.objects.create(student_id="SVC3", name="SVC3", grade_level="初三", current_class=cls)

        exam = Exam.objects.create(name="E_service_multi", academic_year="2025-2026", grade_level="初三", date=date(2024, 3, 1))
        ExamSubject.objects.create(exam=exam, subject_code="语文", subject_name="语文", max_score=120)

        Score.objects.create(student=student, exam=exam, subject="语文", score_value=110)
        Score.objects.create(student=student, exam=exam, subject="数学", score_value=110)

        result = analyze_multiple_classes([cls], exam)
        chart_data = json.loads(result.get("chart_data_json", "{}"))
        distribution = chart_data.get("score_distributions", {}).get("3班", [])

        self.assertEqual(distribution, [0, 1, 0, 0, 0])

    def test_grade_total_max_score_fills_missing_subjects_from_default(self):
        cls = Class.objects.create(grade_level="初三", class_name="4班")
        student = Student.objects.create(student_id="SVC4", name="SVC4", grade_level="初三", current_class=cls)

        exam = Exam.objects.create(name="E_service_grade", academic_year="2025-2026", grade_level="初三", date=date(2024, 4, 1))
        ExamSubject.objects.create(exam=exam, subject_code="语文", subject_name="语文", max_score=120)

        Score.objects.create(student=student, exam=exam, subject="语文", score_value=100)
        Score.objects.create(student=student, exam=exam, subject="数学", score_value=100)

        result = analyze_grade(exam, "初三")
        self.assertEqual(result.get("total_max_score"), 240)

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse

@login_required
def dashboard_stats_api(request):
    """
    Dashboard statistics API
    Returns JSON data for real-time dashboard updates
    """
    from school_management.students_grades.models.student import Student, Class
    from school_management.students_grades.models.exam import Exam
    from school_management.students_grades.models.score import Score
    from django.utils import timezone
    
    now = timezone.now()
    
    # Get counts
    student_count = Student.objects.count()
    class_count = Class.objects.count()
    
    # Exams this month
    exam_count = Exam.objects.filter(
        date__year=now.year,
        date__month=now.month
    ).count()
    
    score_count = Score.objects.count()
    
    data = {
        'student_count': student_count,
        'class_count': class_count,
        'exam_count': exam_count,
        'score_count': score_count,
    }
    
    return JsonResponse(data)
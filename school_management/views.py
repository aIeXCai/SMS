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
    
    score_count = Score.objects.values('student', 'exam').distinct().count()
    
    data = {
        'student_count': student_count,
        'class_count': class_count,
        'exam_count': exam_count,
        'score_count': score_count,
    }
    
    return JsonResponse(data)


@login_required
def dashboard_events_api(request):
    """
    Dashboard calendar events API
    Returns FullCalendar-compatible events from CalendarEvent model
    """
    from school_management.students_grades.models.calendar import CalendarEvent
    from django.utils import timezone

    user = request.user
    events = []

    def get_event_color(event_type):
        colors = {
            'exam': '#b45309',
            'meeting': '#0369a1',
            'activity': '#7c3aed',
            'reminder': '#01876c',
            'other': '#6b7280',
        }
        return colors.get(event_type, '#6b7280')

    # 全校日程所有人都可见
    school_events = CalendarEvent.objects.filter(visibility='school').order_by('start')[:50]
    for event in school_events:
        creator_name = ''
        if event.creator:
            full_name = event.creator.get_full_name()
            creator_name = full_name if full_name else (event.creator.username if event.creator else '')
        events.append({
            'id': str(event.id),
            'title': event.title,
            'start': event.start.isoformat(),
            'end': event.end.isoformat() if event.end else None,
            'is_all_day': event.is_all_day,
            'color': get_event_color(event.event_type),
            'extendedProps': {
                'type': event.event_type,
                'grade': event.grade,
                'description': event.description,
                'visibility': event.visibility,
                'creator_name': creator_name,
                'is_all_day': event.is_all_day,
                'end': event.end.isoformat() if event.end else None,
            }
        })

    # 个人日程（本人可见，admin 也可见所有个人日程）
    is_admin = hasattr(user, 'role') and user.role == 'admin'
    if is_admin:
        # admin 可见所有个人日程
        personal_events = CalendarEvent.objects.filter(visibility='personal').order_by('start')[:50]
    else:
        # 普通用户仅可见本人的个人日程
        personal_events = CalendarEvent.objects.filter(visibility='personal', creator=user).order_by('start')[:50]
    for event in personal_events:
        creator_name = ''
        if event.creator:
            full_name = event.creator.get_full_name()
            creator_name = full_name if full_name else (event.creator.username if event.creator else '')
        events.append({
            'id': str(event.id),
            'title': event.title,
            'start': event.start.isoformat(),
            'end': event.end.isoformat() if event.end else None,
            'is_all_day': event.is_all_day,
            'color': get_event_color(event.event_type),
            'extendedProps': {
                'type': event.event_type,
                'grade': event.grade,
                'description': event.description,
                'visibility': event.visibility,
                'creator_name': creator_name,
                'is_all_day': event.is_all_day,
                'end': event.end.isoformat() if event.end else None,
            }
        })

    # 年级日程（级长可见本年级，admin 可见所有年级日程）
    if is_admin:
        grade_events = CalendarEvent.objects.filter(visibility='grade').order_by('start')[:50]
    elif hasattr(user, 'role') and user.role == 'grade_manager' and user.managed_grade:
        grade_events = CalendarEvent.objects.filter(
            visibility='grade', 
            grade=user.managed_grade
        ).order_by('start')[:50]
    else:
        grade_events = []
    for event in grade_events:
        creator_name = ''
        if event.creator:
            full_name = event.creator.get_full_name()
            creator_name = full_name if full_name else (event.creator.username if event.creator else '')
        events.append({
            'id': str(event.id),
            'title': event.title,
            'start': event.start.isoformat(),
            'end': event.end.isoformat() if event.end else None,
            'is_all_day': event.is_all_day,
            'color': get_event_color(event.event_type),
            'extendedProps': {
                'type': event.event_type,
                'grade': event.grade,
                'description': event.description,
                'visibility': event.visibility,
                'creator_name': creator_name,
                'is_all_day': event.is_all_day,
                'end': event.end.isoformat() if event.end else None,
            }
        })

    return JsonResponse({'events': events})
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
    
    user = request.user

    students_qs = Student.objects.all()
    classes_qs = Class.objects.all()

    if user.role == 'grade_manager' and getattr(user, 'managed_grade', None):
        students_qs = students_qs.filter(current_class__grade_level=user.managed_grade)
        classes_qs = classes_qs.filter(grade_level=user.managed_grade)
    elif user.role == 'subject_teacher':
        teaching_classes = user.teaching_classes.all()
        class_ids = list(teaching_classes.values_list('id', flat=True))
        students_qs = students_qs.filter(current_class_id__in=class_ids)
        classes_qs = teaching_classes

    student_count = students_qs.distinct().count()
    class_count = classes_qs.distinct().count()

    # Import here to avoid circular imports
    from .students_grades.services.score_access_service import ScoreAccessService

    # Exams this month — scoped to user's accessible scope
    exams_this_month = Exam.objects.filter(
        date__year=now.year,
        date__month=now.month
    )
    if user.role == 'grade_manager' and getattr(user, 'managed_grade', None):
        exams_this_month = exams_this_month.filter(grade_level=user.managed_grade)
        exam_count = exams_this_month.count()
    elif user.role == 'subject_teacher':
        exam_count = ScoreAccessService.scope_exams_from_scores(
            user, exams_this_month
        ).count()
    else:
        exam_count = exams_this_month.count()

    # Score count — scoped to user's accessible students
    score_count = ScoreAccessService.scope_scores(
        user, Score.objects.all()
    ).values('student', 'exam').distinct().count()
    
    coverage = {
        'scope': 'school',
        'label': '全校范围',
    }
    if user.role == 'grade_manager' and getattr(user, 'managed_grade', None):
        coverage = {
            'scope': 'grade',
            'label': f'{user.managed_grade}范围',
            'grade_level': user.managed_grade,
        }
    elif user.role == 'subject_teacher':
        teaching_classes = list(user.teaching_classes.all().order_by('grade_level', 'class_name'))
        coverage = {
            'scope': 'teacher_classes',
            'label': '任教班级范围',
            'class_names': [f'{row.grade_level}{row.class_name}' for row in teaching_classes],
        }

    data = {
        'student_count': student_count,
        'class_count': class_count,
        'exam_count': exam_count,
        'score_count': score_count,
        'coverage': coverage,
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
        creator_username = ''
        if event.creator:
            full_name = event.creator.get_full_name()
            creator_name = full_name if full_name else (event.creator.username if event.creator else '')
            creator_username = event.creator.username
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
                'location': event.location,
                'visibility': event.visibility,
                'creator_name': creator_name,
                'creator_username': creator_username,
                'is_all_day': event.is_all_day,
                'end': event.end.isoformat() if event.end else None,
            }
        })

    # 个人日程（本人可见，admin 也可见所有个人日程）
    is_admin = user.role == 'admin'
    if is_admin:
        # admin 可见所有个人日程
        personal_events = CalendarEvent.objects.filter(visibility='personal').order_by('start')[:50]
    else:
        # 普通用户仅可见本人的个人日程
        personal_events = CalendarEvent.objects.filter(visibility='personal', creator=user).order_by('start')[:50]
    for event in personal_events:
        creator_name = ''
        creator_username = ''
        if event.creator:
            full_name = event.creator.get_full_name()
            creator_name = full_name if full_name else (event.creator.username if event.creator else '')
            creator_username = event.creator.username
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
                'location': event.location,
                'visibility': event.visibility,
                'creator_name': creator_name,
                'creator_username': creator_username,
                'is_all_day': event.is_all_day,
                'end': event.end.isoformat() if event.end else None,
            }
        })

    # 年级日程（级长/科任老师可见本年级，admin 可见所有年级日程）
    if is_admin:
        grade_events = CalendarEvent.objects.filter(visibility='grade').order_by('start')[:50]
    elif user.role == 'grade_manager' and user.managed_grade:
        grade_events = CalendarEvent.objects.filter(
            visibility='grade',
            grade=user.managed_grade
        ).order_by('start')[:50]
    elif user.managed_grade:
        # 科任老师也可见本年级的年级日程
        grade_events = CalendarEvent.objects.filter(
            visibility='grade',
            grade=user.managed_grade
        ).order_by('start')[:50]
    else:
        grade_events = []
    for event in grade_events:
        creator_name = ''
        creator_username = ''
        if event.creator:
            full_name = event.creator.get_full_name()
            creator_name = full_name if full_name else (event.creator.username if event.creator else '')
            creator_username = event.creator.username
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
                'location': event.location,
                'visibility': event.visibility,
                'creator_name': creator_name,
                'creator_username': creator_username,
                'is_all_day': event.is_all_day,
                'end': event.end.isoformat() if event.end else None,
            }
        })

    return JsonResponse({'events': events})

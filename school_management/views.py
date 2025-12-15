from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import logging

logger = logging.getLogger(__name__)

def home_view(request):
    """
    主页视图，处理来自前端的JWT认证跳转
    """
    # 检查是否有token参数（来自前端跳转）
    token = request.GET.get('token')
    if token:
        logger.info(f"检测到前端传递的JWT token")
        # token的处理在中间件中完成，这里只需要重定向到清理后的URL
        return redirect('/')
    
    # 如果用户已认证，显示Dashboard
    if request.user.is_authenticated:
        context = {
            'user': request.user,
            'page_title': '系统首页',
        }
        return render(request, 'dashboard.html', context)
    else:
        # 未认证用户，显示登录提示
        context = {
            'page_title': '欢迎使用白云实验学校管理系统',
        }
        return render(request, 'welcome.html', context)

@login_required
def dashboard_view(request):
    """
    仪表盘视图
    """
    context = {
        'user': request.user,
        'page_title': '系统首页',
    }
    return render(request, 'dashboard.html', context)

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
"""
临时排名调试视图 - 用于查看排名是否正确应用
"""
from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from django.db.models import Sum, Q
from school_management.students_grades.models import Score, Exam, Student
from school_management.students_grades.models.student import Class


def ranking_debug_view(request):
    """排名调试页面"""
    context = {
        'exams': Exam.objects.all(),
        'grade_levels': ['高一', '高二', '高三'],
    }
    return render(request, 'ranking_debug.html', context)


def get_ranking_data(request):
    """获取排名数据的AJAX接口"""
    exam_id = request.GET.get('exam_id')
    grade_level = request.GET.get('grade_level')
    
    if not exam_id or not grade_level:
        return JsonResponse({'error': '请选择考试和年级'})
    
    try:
        exam = get_object_or_404(Exam, pk=exam_id)
        
        # 获取该年级的所有学生总分和排名
        students_data = []
        
        # 获取所有学生的总分
        student_totals = Score.objects.filter(
            exam=exam,
            student__grade_level=grade_level
        ).values('student_id', 'student__name', 'student__current_class__class_name').annotate(
            total_score=Sum('score_value')
        ).order_by('-total_score')[:20]  # 只显示前20名
        
        for student_total in student_totals:
            student_id = student_total['student_id']
            student_name = student_total['student__name']
            class_name = student_total['student__current_class__class_name']
            total_score = student_total['total_score']
            
            # 获取该学生的一条成绩记录来查看排名
            sample_score = Score.objects.filter(
                exam=exam,
                student_id=student_id
            ).first()
            
            if sample_score:
                grade_total_rank = sample_score.total_score_rank_in_grade
                class_total_rank = sample_score.total_score_rank_in_class
            else:
                grade_total_rank = None
                class_total_rank = None
            
            # 获取各科成绩和排名
            subjects_data = []
            student_scores = Score.objects.filter(
                exam=exam,
                student_id=student_id
            ).order_by('subject')
            
            for score in student_scores:
                subjects_data.append({
                    'subject': score.subject,
                    'score_value': float(score.score_value) if score.score_value else 0,
                    'grade_rank': score.grade_rank_in_subject,
                    'class_rank': score.class_rank_in_subject,
                })
            
            students_data.append({
                'student_id': student_id,
                'student_name': student_name,
                'class_name': class_name,
                'total_score': float(total_score) if total_score else 0,
                'grade_total_rank': grade_total_rank,
                'class_total_rank': class_total_rank,
                'subjects': subjects_data
            })
        
        # 获取统计信息
        total_students = Score.objects.filter(
            exam=exam,
            student__grade_level=grade_level
        ).values('student_id').distinct().count()
        
        total_records = Score.objects.filter(
            exam=exam,
            student__grade_level=grade_level
        ).count()
        
        # 检查排名覆盖率
        grade_total_rank_coverage = Score.objects.filter(
            exam=exam,
            student__grade_level=grade_level,
            total_score_rank_in_grade__isnull=False
        ).values('student_id').distinct().count()
        
        class_total_rank_coverage = Score.objects.filter(
            exam=exam,
            student__grade_level=grade_level,
            total_score_rank_in_class__isnull=False
        ).values('student_id').distinct().count()
        
        grade_subject_rank_coverage = Score.objects.filter(
            exam=exam,
            student__grade_level=grade_level,
            grade_rank_in_subject__isnull=False
        ).count()
        
        class_subject_rank_coverage = Score.objects.filter(
            exam=exam,
            student__grade_level=grade_level,
            class_rank_in_subject__isnull=False
        ).count()
        
        return JsonResponse({
            'success': True,
            'students': students_data,
            'statistics': {
                'total_students': total_students,
                'total_records': total_records,
                'grade_total_rank_coverage': grade_total_rank_coverage,
                'class_total_rank_coverage': class_total_rank_coverage,
                'grade_subject_rank_coverage': grade_subject_rank_coverage,
                'class_subject_rank_coverage': class_subject_rank_coverage,
                'grade_total_rank_percentage': round(grade_total_rank_coverage / total_students * 100, 1) if total_students > 0 else 0,
                'class_total_rank_percentage': round(class_total_rank_coverage / total_students * 100, 1) if total_students > 0 else 0,
                'grade_subject_rank_percentage': round(grade_subject_rank_coverage / total_records * 100, 1) if total_records > 0 else 0,
                'class_subject_rank_percentage': round(class_subject_rank_coverage / total_records * 100, 1) if total_records > 0 else 0,
            }
        })
        
    except Exception as e:
        return JsonResponse({'error': str(e)})


def ranking_update_test(request):
    """排名更新测试接口 - 使用异步任务"""
    exam_id = request.POST.get('exam_id')
    grade_level = request.POST.get('grade_level')
    
    if not exam_id or not grade_level:
        return JsonResponse({'error': '请选择考试和年级'})
    
    try:
        from school_management.students_grades.tasks import update_all_rankings_async
        
        # 提交异步任务
        job = update_all_rankings_async.delay(exam_id, grade_level)
        
        return JsonResponse({
            'success': True,
            'message': f'排名更新任务已提交到后台处理',
            'job_id': job.id,
            'note': '请等待几分钟后刷新页面查看结果'
        })
        
    except Exception as e:
        return JsonResponse({'error': f'排名更新任务提交失败: {str(e)}'})

"""
异步任务模块
用于处理耗时的后台任务，如排名计算等
"""
import time
from django.db.models import Sum
from .models import Exam, Score

def update_grade_rankings_async(exam_id, grade_level=None, *args, **kwargs):
    """
    异步更新年级排名
    这是一个耗时的操作，适合在后台执行
    """
    print(f"开始异步更新排名，考试ID: {exam_id}")
    start_time = time.time()
    
    try:
        # 在异步任务中不使用get_object_or_404，直接查询
        try:
            exam = Exam.objects.get(pk=exam_id)
        except Exam.DoesNotExist:
            error_message = f"考试ID {exam_id} 不存在"
            print(error_message)
            return {
                'success': False,
                'message': error_message,
                'error': 'Exam not found'
            }
        
        # 获取需要更新排名的年级
        if grade_level:
            grade_levels = [grade_level]
        else:
            # 获取该考试涉及的所有年级
            grade_levels = Score.objects.filter(exam=exam).values_list(
                'student__grade_level', flat=True
            ).distinct()
        
        total_updated = 0
        
        for current_grade in grade_levels:
            print(f"正在处理年级: {current_grade}")
            
            # 获取该年级该考试的所有学生成绩
            students_scores = Score.objects.filter(
                exam=exam,
                student__grade_level=current_grade
            ).values(
                'student_id',
                'student__name'
            ).annotate(
                total_score=Sum('score_value')
            ).order_by('-total_score')
            
            # 正确的排名逻辑：处理并列排名
            current_rank = 1
            previous_score = None
            
            # 批量更新列表
            score_updates = []
            
            for i, student_data in enumerate(students_scores):
                student_id = student_data['student_id']
                total_score = student_data['total_score']
                
                # 处理空值情况
                if total_score is None:
                    total_score = 0.0
                else:
                    total_score = float(total_score)
                
                # 如果当前分数与前一个分数不同，更新排名
                if previous_score is not None and total_score != previous_score:
                    current_rank = i + 1  # 跳过并列的位次
                
                # 收集需要更新的成绩记录
                student_scores = Score.objects.filter(
                    exam=exam,
                    student_id=student_id
                )
                
                for score in student_scores:
                    score.total_score_rank_in_grade = current_rank
                    score_updates.append(score)
                
                previous_score = total_score
            
            # 批量更新排名
            if score_updates:
                Score.objects.bulk_update(
                    score_updates, 
                    ['total_score_rank_in_grade'], 
                    batch_size=1000
                )
                total_updated += len(score_updates)
        
        execution_time = time.time() - start_time
        success_message = f"排名更新完成！共更新 {total_updated} 条记录，耗时 {execution_time:.2f} 秒"
        print(success_message)

        return {
            'success': True,
            'message': success_message,
            'updated_count': total_updated,
            'execution_time': execution_time
        }

    except Exception as e:
        error_message = f"排名更新失败: {str(e)}"
        print(error_message)
        return {
            'success': False,
            'message': error_message,
            'error': str(e)
        }

# def update_subject_rankings_async(exam_id, subject=None):
#     """
#     异步更新学科排名 - 暂时注释掉，后面可能还要用到
#     """
#     print(f"开始异步更新学科排名，考试ID: {exam_id}, 科目: {subject}")
#     start_time = time.time()
#     
#     try:
#         # 在异步任务中不使用get_object_or_404，直接查询
#         try:
#             exam = Exam.objects.get(pk=exam_id)
#         except Exam.DoesNotExist:
#             error_message = f"考试ID {exam_id} 不存在"
#             print(error_message)
#             return {
#                 'success': False,
#                 'message': error_message,
#                 'error': 'Exam not found'
#             }
#         
#         # 确定要更新的科目
#         if subject:
#             subjects = [subject]
#         else:
#             subjects = Score.objects.filter(exam=exam).values_list('subject', flat=True).distinct()
#         
#         total_updated = 0
#         
#         for current_subject in subjects:
#             print(f"正在处理科目: {current_subject}")
#             
#             # 获取该科目的所有年级
#             grade_levels = Score.objects.filter(
#                 exam=exam, 
#                 subject=current_subject
#             ).values_list('student__grade_level', flat=True).distinct()
#             
#             for grade_level in grade_levels:
#                 # 获取该年级该科目的成绩，按分数排序
#                 subject_scores = Score.objects.filter(
#                     exam=exam,
#                     subject=current_subject,
#                     student__grade_level=grade_level
#                 ).order_by('-score_value')
#                 
#                 # 计算排名
#                 current_rank = 1
#                 previous_score = None
#                 score_updates = []
#                 
#                 for i, score in enumerate(subject_scores):
#                     # 处理空值情况
#                     current_score_value = score.score_value
#                     if current_score_value is None:
#                         current_score_value = 0.0
#                     
#                     if previous_score is not None and current_score_value != previous_score:
#                         current_rank = i + 1
#                     
#                     score.grade_rank_in_subject = current_rank
#                     score_updates.append(score)
#                     previous_score = current_score_value
#                 
#                 # 批量更新
#                 if score_updates:
#                     Score.objects.bulk_update(
#                         score_updates,
#                         ['grade_rank_in_subject'],
#                         batch_size=1000
#                     )
#                     total_updated += len(score_updates)
#         
#         execution_time = time.time() - start_time
#         success_message = f"学科排名更新完成！共更新 {total_updated} 条记录，耗时 {execution_time:.2f} 秒"
#         print(success_message)
#         
#         return {
#             'success': True,
#             'message': success_message,
#             'updated_count': total_updated,
#             'execution_time': execution_time
#         }
#         
#     except Exception as e:
#         error_message = f"学科排名更新失败: {str(e)}"
#         print(error_message)
#         return {
#             'success': False,
#             'message': error_message,
#             'error': str(e)
#         }

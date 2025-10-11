"""
优化版异步任务模块
用于高效处理大量数据的排名计算
"""
import time
from django.db.models import Sum, F
from django.db import transaction
from django_rq import job
from .models import Exam, Score

@job('default', timeout=600)  # 增加超时时间到10分钟
def update_all_rankings_async(exam_id, grade_level=None, *args, **kwargs):
    """
    优化版异步更新完整排名
    使用更高效的算法处理大量数据
    """
    print(f"开始优化版异步更新完整排名，考试ID: {exam_id}")
    start_time = time.time()
    
    try:
        # 检查考试是否存在
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
            # 修复distinct()查询，确保正确去重
            grade_levels = list(set(Score.objects.filter(exam=exam).values_list(
                'student__grade_level', flat=True
            )))
        
        total_updated = 0
        
        for current_grade in grade_levels:
            print(f"正在处理年级: {current_grade}")
            grade_start_time = time.time()
            
            # 使用事务确保数据一致性
            with transaction.atomic():
                result = update_grade_rankings_optimized(exam, current_grade)
                if result and result.get('success'):
                    updated_count = result.get('updated_count', 0) or 0
                    total_updated += updated_count
                else:
                    print(f"年级 {current_grade} 排名更新失败: {result.get('message', '未知错误') if result else '返回值为空'}")
                    updated_count = 0
            
            grade_time = time.time() - grade_start_time
            print(f"年级 {current_grade} 处理完成，耗时 {grade_time:.2f} 秒，更新 {updated_count} 条记录")
        
        execution_time = time.time() - start_time
        success_message = f"优化版排名更新完成！共更新 {total_updated} 条记录，耗时 {execution_time:.2f} 秒"
        print(success_message)

        return {
            'success': True,
            'message': success_message,
            'updated_count': total_updated,
            'execution_time': execution_time
        }

    except Exception as e:
        error_message = f"优化版排名更新失败: {str(e)}"
        print(error_message)
        import traceback
        traceback.print_exc()
        return {
            'success': False,
            'message': error_message,
            'error': str(e)
        }


def update_grade_rankings_optimized(exam, grade_level):
    """
    优化版年级排名更新
    使用更高效的算法和批量操作
    """
    import time
    start_time = time.time()
    
    # 获取该年级所有学生的总分
    students_total_scores = list(Score.objects.filter(
        exam=exam,
        student__grade_level=grade_level
    ).values('student_id', 'student__current_class_id').annotate(
        total_score=Sum('score_value')
    ).order_by('-total_score', 'student_id'))  # 添加student_id确保排序稳定
    
    print(f"  获取到 {len(students_total_scores)} 个学生的总分数据")
    
    # 创建学生ID到总分排名的映射
    grade_rank_map = {}
    class_rank_maps = {}
    
    # 1. 计算年级总分排名
    current_rank = 1
    previous_score = None
    
    for i, student_data in enumerate(students_total_scores):
        student_id = student_data['student_id']
        total_score = student_data['total_score'] or 0
        
        if previous_score is not None and total_score != previous_score:
            current_rank = i + 1
        
        grade_rank_map[student_id] = current_rank
        previous_score = total_score
    
    # 2. 按班级分组计算班级总分排名
    class_students = {}
    for student_data in students_total_scores:
        class_id = student_data['student__current_class_id']
        if class_id not in class_students:
            class_students[class_id] = []
        class_students[class_id].append(student_data)
    
    for class_id, class_student_list in class_students.items():
        if not class_id:
            continue
            
        # 对班级内学生按总分排序
        class_student_list.sort(key=lambda x: (-x['total_score'] or 0, x['student_id']))
        
        class_rank_map = {}
        current_rank = 1
        previous_score = None
        
        for i, student_data in enumerate(class_student_list):
            student_id = student_data['student_id']
            total_score = student_data['total_score'] or 0
            
            if previous_score is not None and total_score != previous_score:
                current_rank = i + 1
            
            class_rank_map[student_id] = current_rank
            previous_score = total_score
        
        class_rank_maps[class_id] = class_rank_map
    
    print(f"  总分排名计算完成")
    
    # 3. 获取所有科目 - 修复重复问题
    # 修复subjects查询 - 使用set直接去重避免Django ORM的distinct问题
    from django.db import connection
    
    # 使用原生SQL确保真正的去重
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT DISTINCT subject 
            FROM students_grades_score s
            INNER JOIN students_grades_student st ON s.student_id = st.id
            WHERE s.exam_id = %s AND st.grade_level = %s
        """, [exam.id, grade_level])
        subjects_list = [row[0] for row in cursor.fetchall()]
    
    print(f"Found {len(subjects_list)} subjects to process: {subjects_list}")
    
    print(f"  需要处理 {len(subjects_list)} 个科目的排名: {subjects_list}")
    
    # 第4步：计算各科目的班级排名  
    print("  正在计算班级排名...")
    
    # 4. 为每个科目计算排名
    subject_grade_rank_maps = {}
    subject_class_rank_maps = {}
    
    for subject in subjects_list:
        # 年级科目排名
        subject_scores = list(Score.objects.filter(
            exam=exam,
            subject=subject,
            student__grade_level=grade_level
        ).values('student_id', 'student__current_class_id', 'score_value').order_by(
            '-score_value', 'student_id'
        ))
        
        # 年级科目排名
        grade_subject_rank_map = {}
        current_rank = 1
        previous_score = None
        
        for i, score_data in enumerate(subject_scores):
            student_id = score_data['student_id']
            score_value = score_data['score_value'] or 0
            
            if previous_score is not None and score_value != previous_score:
                current_rank = i + 1
            
            grade_subject_rank_map[student_id] = current_rank
            previous_score = score_value
        
        subject_grade_rank_maps[subject] = grade_subject_rank_map
        
        # 班级科目排名
        class_subject_students = {}
        for score_data in subject_scores:
            class_id = score_data['student__current_class_id']
            if class_id not in class_subject_students:
                class_subject_students[class_id] = []
            class_subject_students[class_id].append(score_data)
        
        class_subject_rank_maps = {}
        for class_id, class_scores in class_subject_students.items():
            if not class_id:
                continue
                
            # 对班级内学生按科目成绩排序
            class_scores.sort(key=lambda x: (-x['score_value'] or 0, x['student_id']))
            
            class_subject_rank_map = {}
            current_rank = 1
            previous_score = None
            
            for i, score_data in enumerate(class_scores):
                student_id = score_data['student_id']
                score_value = score_data['score_value'] or 0
                
                if previous_score is not None and score_value != previous_score:
                    current_rank = i + 1
                
                class_subject_rank_map[student_id] = current_rank
                previous_score = score_value
            
            class_subject_rank_maps[class_id] = class_subject_rank_map
        
        subject_class_rank_maps[subject] = class_subject_rank_maps
    
    print(f"  科目排名计算完成")
    
    # 5. 批量更新所有排名
    print(f"  开始批量更新排名...")
    scores_to_update = Score.objects.filter(
        exam=exam,
        student__grade_level=grade_level
    )
    
    update_list = []
    processed_count = 0
    
    for score in scores_to_update:
        student_id = score.student_id
        subject = score.subject
        class_id = score.student.current_class_id
        
        # 更新总分排名
        score.total_score_rank_in_grade = grade_rank_map.get(student_id, 999)
        if class_id and class_id in class_rank_maps:
            score.total_score_rank_in_class = class_rank_maps[class_id].get(student_id, 999)
        else:
            score.total_score_rank_in_class = 999
        
        # 更新科目排名
        if subject in subject_grade_rank_maps:
            score.grade_rank_in_subject = subject_grade_rank_maps[subject].get(student_id, 999)
        else:
            score.grade_rank_in_subject = 999
            
        if (subject in subject_class_rank_maps and 
            class_id and class_id in subject_class_rank_maps[subject]):
            score.class_rank_in_subject = subject_class_rank_maps[subject][class_id].get(student_id, 999)
        else:
            score.class_rank_in_subject = 999
        
        update_list.append(score)
        processed_count += 1
        
        # 分批处理，避免内存问题和长时间锁定
        if len(update_list) >= 500:
            print(f"    批量更新第 {processed_count-499}-{processed_count} 条记录...")
            Score.objects.bulk_update(
                update_list,
                ['total_score_rank_in_grade', 'total_score_rank_in_class', 
                 'grade_rank_in_subject', 'class_rank_in_subject'],
                batch_size=500
            )
            update_list = []  # 清空列表释放内存
    
    # 更新剩余记录
    if update_list:
        print(f"    批量更新最后 {len(update_list)} 条记录...")
        Score.objects.bulk_update(
            update_list,
            ['total_score_rank_in_grade', 'total_score_rank_in_class', 
             'grade_rank_in_subject', 'class_rank_in_subject'],
            batch_size=500
        )
    
    execution_time = time.time() - start_time
    success_message = f"排名更新完成！年级: {grade_level}, 共更新 {processed_count} 条记录，耗时 {execution_time:.2f} 秒"
    print(success_message)
    
    return {
        'success': True,
        'message': success_message,
        'updated_count': processed_count,
        'execution_time': execution_time,
        'grade_level': grade_level
    }


# 向后兼容函数，重定向到完整排名更新
@job('default', timeout=3600)
def update_grade_rankings_async(exam_id, grade_level=None, *args, **kwargs):
    """
    向后兼容函数，调用优化版排名更新
    """
    return update_all_rankings_async(exam_id, grade_level, *args, **kwargs)


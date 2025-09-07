#!/usr/bin/env python
"""
Django系统状态监控
"""
import os
import django
from datetime import datetime
import sys
from pathlib import Path

# Ensure project root is on sys.path when script is run directly
PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

# 配置Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'school_management.settings')
django.setup()

def check_django_status():
    """检查Django系统状态"""
    print(f"=== Django系统状态检查 ({datetime.now().strftime('%Y-%m-%d %H:%M:%S')}) ===\n")
    
    # 1. 数据库连接状态
    try:
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        print("✅ 数据库连接: 正常")

        # 获取数据库统计（已迁移到 students_grades）
        from school_management.students_grades.models import Exam, Score, Student

        exam_count = Exam.objects.count()
        student_count = Student.objects.count()
        score_count = Score.objects.count()

        print(f"📊 数据统计:")
        print(f"   - 考试数量: {exam_count}")
        print(f"   - 学生数量: {student_count}")
        print(f"   - 成绩记录: {score_count}")

    except Exception as e:
        print(f"❌ 数据库连接失败: {e}")
    
    print()
    
    # 2. Redis/异步任务状态
    try:
        import django_rq
        queue = django_rq.get_queue('default')
        
        print("✅ Redis连接: 正常")
        print(f"📊 任务队列状态:")
        print(f"   - 排队任务: {len(queue)}")
        print(f"   - 已完成: {queue.finished_job_registry.count}")
        print(f"   - 失败任务: {queue.failed_job_registry.count}")
        
        # 检查workers
        workers = queue.workers
        print(f"   - 活跃Workers: {len(workers)}")
        
    except Exception as e:
        print(f"❌ Redis/RQ状态检查失败: {e}")
    
    print()
    
    # 3. 应用状态
    try:
        from django.apps import apps
        installed_apps = [app.name for app in apps.get_app_configs()]
        print(f"📱 已安装应用 ({len(installed_apps)}):")
        for app in installed_apps:
            if 'school_management' in app or app in ['exams', 'students']:
                print(f"   ✅ {app}")
    except Exception as e:
        print(f"❌ 应用状态检查失败: {e}")
    
    print()
    
    # 4. 缓存状态（如果有）
    try:
        from django.core.cache import cache
        cache.set('test_key', 'test_value', 30)
        test_value = cache.get('test_key')
        if test_value == 'test_value':
            print("✅ 缓存系统: 正常")
        else:
            print("⚠️  缓存系统: 异常")
    except Exception as e:
        print(f"❌ 缓存状态检查失败: {e}")
    
    print()
    
    # 5. 最近活动
    try:
        latest_exam = Exam.objects.order_by('-date').first()
        if latest_exam:
            print(f"📈 最新考试: {latest_exam.name} ({latest_exam.date})")
            recent_scores = Score.objects.filter(exam=latest_exam).count()
            print(f"📊 该考试成绩数: {recent_scores}")
        
        # 检查最近的排名更新状态
        ranked_count = Score.objects.filter(
            exam=latest_exam,
            total_score_rank_in_grade__isnull=False
        ).count() if latest_exam else 0
        
        if latest_exam and recent_scores > 0:
            ranking_rate = (ranked_count / recent_scores * 100)
            print(f"🏆 排名完成率: {ranking_rate:.1f}%")
        
    except Exception as e:
        print(f"❌ 活动状态检查失败: {e}")

if __name__ == "__main__":
    check_django_status()

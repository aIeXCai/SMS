#!/usr/bin/env python
"""
异步任务监控脚本
用于监控年级排名计算等异步任务的执行状态
"""
import os
import django
import time
from datetime import datetime

# 配置Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'school_management.settings')
django.setup()

def monitor_ranking_tasks():
    """监控排名计算任务"""
    print(f"=== 异步任务监控 ({datetime.now().strftime('%Y-%m-%d %H:%M:%S')}) ===\n")
    
    try:
        import django_rq
        from rq.job import Job
        
        # 获取默认队列
        queue = django_rq.get_queue('default')
        
        print("📊 任务队列状态:")
        print(f"   - 排队中任务: {len(queue)}")
        print(f"   - 已完成任务: {queue.finished_job_registry.count}")
        print(f"   - 失败任务: {queue.failed_job_registry.count}")
        print(f"   - 延迟任务: {queue.deferred_job_registry.count}")
        print()
        
        # 显示排队中的任务
        if len(queue) > 0:
            print("🔄 排队中的任务:")
            for i, job in enumerate(queue.jobs):
                print(f"   {i+1}. {job.func_name} (ID: {job.id[:8]}...)")
                if hasattr(job, 'args') and job.args:
                    print(f"      参数: {job.args}")
                print(f"      创建时间: {job.created_at}")
            print()
        
        # 显示正在执行的任务
        started_jobs = queue.started_job_registry.get_job_ids()
        if started_jobs:
            print("⚡ 正在执行的任务:")
            for job_id in started_jobs:
                try:
                    job = Job.fetch(job_id, connection=queue.connection)
                    print(f"   - {job.func_name} (ID: {job_id[:8]}...)")
                    print(f"     开始时间: {job.started_at}")
                    if hasattr(job, 'args') and job.args:
                        print(f"     参数: {job.args}")
                except Exception as e:
                    print(f"   - 任务 {job_id[:8]}... (无法获取详情: {e})")
            print()
        
        # 显示最近完成的任务
        finished_jobs = queue.finished_job_registry.get_job_ids()
        if finished_jobs:
            print("✅ 最近完成的任务 (最多显示5个):")
            for job_id in finished_jobs[:5]:
                try:
                    job = Job.fetch(job_id, connection=queue.connection)
                    print(f"   - {job.func_name} (ID: {job_id[:8]}...)")
                    print(f"     完成时间: {job.ended_at}")
                    if hasattr(job, 'result'):
                        result = job.result
                        if isinstance(result, dict):
                            print(f"     结果: {result.get('message', '完成')}")
                        else:
                            print(f"     结果: {result}")
                except Exception as e:
                    print(f"   - 任务 {job_id[:8]}... (无法获取详情: {e})")
            print()
        
        # 显示失败的任务
        failed_jobs = queue.failed_job_registry.get_job_ids()
        if failed_jobs:
            print("❌ 失败的任务:")
            for job_id in failed_jobs:
                try:
                    job = Job.fetch(job_id, connection=queue.connection)
                    print(f"   - {job.func_name} (ID: {job_id[:8]}...)")
                    print(f"     失败时间: {job.ended_at}")
                    if hasattr(job, 'exc_info') and job.exc_info:
                        print(f"     错误: {job.exc_info}")
                except Exception as e:
                    print(f"   - 任务 {job_id[:8]}... (无法获取详情: {e})")
            print()
        
        # 检查排名计算进度
        print("🏆 排名计算进度:")
        from school_management.exams.models import Exam, Score
        
        latest_exam = Exam.objects.order_by('-date').first()
        if latest_exam:
            total_scores = Score.objects.filter(exam=latest_exam).count()
            ranked_scores = Score.objects.filter(
                exam=latest_exam,
                total_score_rank_in_grade__isnull=False
            ).count()
            
            if total_scores > 0:
                progress = (ranked_scores / total_scores) * 100
                print(f"   考试: {latest_exam.name}")
                print(f"   总成绩数: {total_scores}")
                print(f"   已排名: {ranked_scores}")
                print(f"   完成度: {progress:.1f}%")
                
                if progress == 100.0:
                    print("   状态: ✅ 排名计算完成")
                elif progress > 0:
                    print("   状态: 🔄 排名计算进行中")
                else:
                    print("   状态: ⏸️ 排名计算未开始")
            else:
                print("   状态: ❓ 暂无成绩数据")
        else:
            print("   状态: ❓ 暂无考试数据")
            
    except Exception as e:
        print(f"❌ 监控失败: {e}")

def watch_mode():
    """监控模式，每5秒刷新一次"""
    print("🔍 进入监控模式 (每5秒刷新，按 Ctrl+C 退出)")
    print("=" * 50)
    
    try:
        while True:
            os.system('clear' if os.name == 'posix' else 'cls')  # 清屏
            monitor_ranking_tasks()
            print("⏰ 5秒后自动刷新... (按 Ctrl+C 退出)")
            time.sleep(5)
    except KeyboardInterrupt:
        print("\n👋 监控结束")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "--watch":
        watch_mode()
    else:
        monitor_ranking_tasks()
        print("💡 提示: 使用 'python monitor_tasks.py --watch' 进入监控模式")

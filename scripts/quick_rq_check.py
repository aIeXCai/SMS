#!/usr/bin/env python
"""
快速RQ状态检测脚本
提供简洁的任务队列状态概览
"""

import os
import sys
import django

# 获取项目根目录路径（scripts的上级目录）
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)

# 将项目根目录添加到Python路径
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# 设置Django环境
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'school_management.settings')
django.setup()

try:
    import django_rq
    from rq import Worker
    
    # 获取连接
    redis_conn = django_rq.get_connection('default')
    queue = django_rq.get_queue('default')
    workers = Worker.all(connection=redis_conn)
    
    print("🔍 RQ快速状态检测")
    print("-" * 40)
    
    # Redis状态
    try:
        redis_conn.ping()
        print("✅ Redis: 连接正常")
    except:
        print("❌ Redis: 连接失败")
        exit(1)
    
    # 队列状态
    queued_count = len(queue)
    print(f"📊 队列: {queued_count} 个等待任务")
    
    # 工作进程状态
    worker_count = len(workers)
    if worker_count == 0:
        print("⚠️  工作进程: 0 个 (需要启动)")
    else:
        active_workers = sum(1 for w in workers if w.get_current_job())
        idle_workers = worker_count - active_workers
        print(f"👷 工作进程: {worker_count} 个 ({active_workers} 活跃, {idle_workers} 空闲)")
    
    # 显示当前执行的任务
    if worker_count > 0:
        for i, worker in enumerate(workers, 1):
            current_job = worker.get_current_job()
            if current_job:
                print(f"   🔄 工作进程{i}: {current_job.func_name}")
    
    # 显示等待的任务
    if queued_count > 0:
        print("\n📋 等待中的任务:")
        for i, job in enumerate(queue.jobs[:3], 1):
            print(f"   {i}. {job.func_name} (ID: {job.id[:8]}...)")
    
    print("-" * 40)
    
    # 如果有问题，给出建议
    if worker_count == 0:
        print("💡 建议: 运行 'python manage.py rqworker' 启动工作进程")
    elif queued_count > 0 and all(not w.get_current_job() for w in workers):
        print("💡 建议: 工作进程空闲但有任务等待，可能需要重启工作进程")

except ImportError:
    print("❌ django-rq 未安装")
except Exception as e:
    print(f"❌ 检测失败: {e}")

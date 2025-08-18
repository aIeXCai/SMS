#!/bin/bash
# SMS系统启动脚本

echo "=== 学校管理系统启动脚本 ==="

# 检查Redis是否运行
echo "检查Redis服务..."
if ! pgrep -x "redis-server" > /dev/null; then
    echo "启动Redis服务器..."
    redis-server --daemonize yes --port 6379
    if [ $? -eq 0 ]; then
        echo "✅ Redis启动成功"
    else
        echo "❌ Redis启动失败，请检查是否已安装Redis"
        echo "在macOS上可以使用: brew install redis"
        exit 1
    fi
else
    echo "✅ Redis已经在运行"
fi

# 启动RQ Worker进程
echo "启动RQ Worker..."
python manage.py rqworker default &
RQ_PID=$!
echo "✅ RQ Worker启动成功 (PID: $RQ_PID)"

# 启动Django服务器
echo "启动Django开发服务器..."
python manage.py runserver &
DJANGO_PID=$!
echo "✅ Django服务器启动成功 (PID: $DJANGO_PID)"

echo ""
echo "=== 启动完成 ==="
echo "📊 Django管理界面: http://127.0.0.1:8000/admin/"
echo "📈 RQ任务监控界面: http://127.0.0.1:8000/django-rq/"
echo "🏫 学校管理系统: http://127.0.0.1:8000/"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 等待信号并清理进程
cleanup() {
    echo ""
    echo "正在停止服务..."
    kill $DJANGO_PID 2>/dev/null
    kill $RQ_PID 2>/dev/null
    echo "✅ 服务已停止"
    exit 0
}

trap cleanup INT TERM

# 保持脚本运行
wait

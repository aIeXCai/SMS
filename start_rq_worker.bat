@echo off
title Django RQ Worker
cd /d "C:\Users\Cai\Desktop\工作\SMS\SMS"

echo ==========================================
echo     Django RQ Worker 启动脚本
echo ==========================================
echo.

echo [1/3] 检查Redis连接...
python -c "import redis; r=redis.Redis(); r.ping(); print('✅ Redis连接正常')" 2>nul
if errorlevel 1 (
    echo ❌ Redis连接失败，请先启动Redis服务
    echo 💡 提示: 下载并启动Redis服务器
    pause
    exit /b 1
)

echo [2/3] 检查Django配置...
python manage.py check --deploy 2>nul
if errorlevel 1 (
    echo ❌ Django配置检查失败
    pause
    exit /b 1
)
echo ✅ Django配置正常

echo [3/3] 启动RQ Worker...
echo.
echo 🚀 启动默认队列Worker...
echo 📈 管理界面: http://127.0.0.1:8000/django-rq/
echo 💡 按 Ctrl+C 停止Worker
echo.

python manage.py rqworker default

echo.
echo Worker已停止
pause

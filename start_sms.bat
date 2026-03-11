@echo off
REM 成绩管理系统完整启动脚本 (Windows版)
REM 同时启动 Django 服务器、RQ Worker 和 Next.js 前端服务器

chcp 65001 >nul
echo ========================================
echo 🚀 启动成绩管理系统 (完整版 - 前后端)
echo 时间: %date% %time%
echo ========================================

REM 进入项目目录
cd /d "%~dp0"
echo 📁 项目目录: %CD%

REM 检查 Redis 连接
echo.
echo 🔍 检查 Redis 连接...

REM 尝试通过 redis-cli ping 检查 Redis（本地安装的 redis-cli）
redis-cli ping >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo ✅ Redis 连接正常
    goto redis_ready
)

REM 如果本地没有 redis-cli，尝试使用 Docker 容器内的 Redis
set "DOCKER_EXE="
for /f "delims=" %%D in ('where docker 2^>nul') do set "DOCKER_EXE=%%D"
if defined DOCKER_EXE (
    REM 检查名为 redis 的容器是否存在并在运行
    set "REDIS_RUNNING="
    for /f "delims=" %%R in ('"%DOCKER_EXE%" inspect -f "{{.State.Running}}" redis 2^>nul') do set "REDIS_RUNNING=%%R"

    if not "%REDIS_RUNNING%"=="true" (
        echo ⚙️ 未发现运行中的 Redis 容器，正在启动 Docker Redis...
        "%DOCKER_EXE%" rm -f redis >nul 2>&1
        "%DOCKER_EXE%" run -d --name redis -p 6379:6379 redis:8.6.1 >nul 2>&1
        timeout /t 3 >nul
    )

    REM 再次尝试连接容器内 Redis
    "%DOCKER_EXE%" exec redis redis-cli ping >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo ✅ Redis Docker 容器连接正常
        goto redis_ready
    )
)

REM 如果 redis-cli 不可用，检查 Redis 进程
tasklist /FI "IMAGENAME eq redis-server.exe" 2>NUL | find /I /N "redis-server.exe">NUL
if %ERRORLEVEL% EQU 0 (
    echo ✅ Redis 进程已运行
    goto redis_ready
)

REM Redis 未运行，尝试启动
echo ⚠️  Redis 未运行，尝试启动...

REM 检查 redis-server 是否在 PATH 中
where redis-server >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo 直接启动 Redis 服务器...
    start /B redis-server
    timeout /t 3 /nobreak >nul
    redis-cli ping >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo ✅ Redis 启动成功
        goto redis_ready
    ) else (
        echo ❌ Redis 启动失败
        echo 请手动启动 Redis
        exit /b 1
    )
) else (
    echo ❌ 未找到 redis-server，请先安装 Redis
    echo   Windows: 下载 Redis for Windows 并启动
    exit /b 1
)

:redis_ready

REM 激活 conda 环境
echo.
echo 🐍 配置 Python 环境...

REM 默认使用全局 python，可在失败时切换到 conda env 的 python
set "PYTHON_EXE=python"

REM 尝试使用 conda activate
call conda activate sms 2>nul
if %ERRORLEVEL% EQU 0 (
    echo ✅ 成功切换到 sms 环境
) else (
    echo ⚠️  conda 环境 'sms' 无法激活（可能未安装 conda 或未在 PATH 中）
    echo 尝试使用 sms 环境的 python 解释器作为回退...
    set "PYTHON_EXE=C:\Users\ADMIN\.conda\envs\sms\python.exe"
    if exist "%PYTHON_EXE%" (
        echo ✅ 找到 sms 环境 python：%PYTHON_EXE%
    ) else (
        echo ❌ 未找到 sms 环境 python：%PYTHON_EXE%
        echo 请手动激活 conda 环境后重试：
        echo   conda activate sms
        echo   python -m pip install -r requirements.txt
        exit /b 1
    )
)

REM 显示当前 Python 环境信息
echo.
echo 当前 Python 环境:
"%PYTHON_EXE%" --version

REM 检查前端环境
echo.
echo 📦 检查前端环境...
if exist "frontend" (
    echo 发现前端目录: frontend\

    if exist "frontend\package.json" (
        echo ✅ package.json 存在

        if exist "frontend\node_modules" (
            echo ✅ node_modules 存在
        ) else (
            echo ⚠️  node_modules 不存在，需要安装依赖
            echo 请先运行: cd frontend && npm install
        )

        findstr /C:"\"dev\"" "frontend\package.json" >nul 2>&1
        if %ERRORLEVEL% EQU 0 (
            echo ✅ dev 脚本存在
        ) else (
            echo ⚠️  未找到 dev 脚本
        )
    ) else (
        echo ⚠️  frontend\package.json 不存在
    )
) else (
    echo ⚠️  frontend 目录不存在
)

REM 检查 Django 和依赖
echo.
echo 🔧 检查 Django 环境...
"%PYTHON_EXE%" -c "import django; print('Django版本:', django.get_version())" 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Django 未安装
    exit /b 1
)

"%PYTHON_EXE%" -c "import redis; print('Redis-py 已安装')" 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ redis-py 未安装
    exit /b 1
)

"%PYTHON_EXE%" -c "import django_rq; print('Django-RQ 已安装')" 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ django-rq 未安装
    exit /b 1
)

REM 应用数据库迁移
echo.
echo 🗃️  应用数据库迁移...
"%PYTHON_EXE%" manage.py migrate --verbosity=1

REM 清理失败的任务
echo.
echo 🧹 清理失败的异步任务...
"%PYTHON_EXE%" -c "import os, django; os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'school_management.settings'); django.setup(); import django_rq; queue = django_rq.get_queue('default'); failed_count = queue.failed_job_registry.count; queue.failed_job_registry.requeue() if failed_count > 0 else print('没有失败的任务需要清理'); print(f'已重新排队 {failed_count} 个失败任务' if failed_count > 0 else '')"

REM 创建日志目录
if not exist "logs" mkdir logs

echo.
echo 🚀 启动服务...
echo.

REM 启动前端服务器 (在新窗口)
echo 🌐 启动前端服务器...
if exist "frontend\package.json" (
    start "SMS Frontend" cmd /k "cd /d "%CD%\frontend" && echo 🌐 启动 Next.js 前端服务器... && npm run dev"
    echo ✅ 前端服务器启动命令已发送到新窗口
    echo 📱 前端将在 http://localhost:3000 运行
    echo 等待前端服务器启动...
    timeout /t 5 /nobreak >nul
) else (
    echo ⚠️  跳过前端启动（配置文件不存在）
)

REM 启动 RQ Worker (后台)
echo.
echo ⚡ 启动 RQ Worker...
start "RQ Worker" cmd /k "cd /d "%CD%" && "%PYTHON_EXE%" manage.py rqworker default --worker-class rq.SimpleWorker"
echo ✅ RQ Worker 已启动 (新窗口)

REM 启动 Django 服务器 (前台)
echo.
echo 🌐 启动 Django 服务器...
echo.
echo ========================================
echo 🎉 成绩管理系统已启动！
echo.
echo 📱 访问地址:
echo    🏠 前端主页: http://localhost:3000
echo    🏠 后端主页: http://127.0.0.1:8000
echo    📊 成绩管理: http://127.0.0.1:8000/exams/scores/
echo    📤 批量导入: http://127.0.0.1:8000/exams/scores/batch-import/
echo    📈 任务监控: http://127.0.0.1:8000/django-rq/
echo.
echo 🔧 后台服务:
echo    🌐 Next.js 前端: http://localhost:3000 (新窗口)
echo    ⚡ RQ Worker: 正在运行 (新窗口)
echo    📝 Worker 日志: logs\rq_worker.log
echo.
echo 💡 提示: 按 Ctrl+C 停止后端服务，请手动关闭前端窗口
echo ========================================
echo.

REM 启动 Django 服务器
"%PYTHON_EXE%" manage.py runserver 0.0.0.0:8000

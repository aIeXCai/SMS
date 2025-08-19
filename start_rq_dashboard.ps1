# Django RQ 管理界面快速启动脚本
# PowerShell版本

param(
    [switch]$SkipRedisCheck,
    [switch]$Help
)

if ($Help) {
    Write-Host @"
Django RQ 管理界面启动脚本

用法:
  .\start_rq_dashboard.ps1          # 正常启动
  .\start_rq_dashboard.ps1 -SkipRedisCheck  # 跳过Redis检查

功能:
- 检查Redis服务状态
- 启动Django开发服务器
- 启动RQ Worker
- 打开管理界面

管理界面地址: http://127.0.0.1:8000/django-rq/
"@ -ForegroundColor Yellow
    exit
}

$ErrorActionPreference = "Stop"

Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "     Django RQ 管理界面启动脚本" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""

# 检查Redis连接
if (-not $SkipRedisCheck) {
    Write-Host "[1/4] 检查Redis安装..." -ForegroundColor Yellow
    try {
        $redisVersion = redis-cli --version 2>$null
        if ($redisVersion) {
            Write-Host "✅ Redis已安装: $redisVersion" -ForegroundColor Green
        } else {
            throw "Redis未安装"
        }
    } catch {
        Write-Host "❌ Redis未安装或未添加到PATH" -ForegroundColor Red
        Write-Host "💡 请先安装Redis:" -ForegroundColor Yellow
        Write-Host "   下载地址: https://github.com/microsoftarchive/redis/releases" -ForegroundColor Cyan
        Write-Host "   运行安装检查脚本: .\check_redis.bat" -ForegroundColor Cyan
        Read-Host "按Enter键退出"
        exit 1
    }
    
    Write-Host "[2/4] 检查Redis服务状态..." -ForegroundColor Yellow
    try {
        $redisService = Get-Service -Name "Redis" -ErrorAction SilentlyContinue
        if ($redisService -and $redisService.Status -eq "Running") {
            Write-Host "✅ Redis服务正在运行" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Redis服务未运行，尝试启动..." -ForegroundColor Yellow
            try {
                Start-Service -Name "Redis" -ErrorAction Stop
                Write-Host "✅ Redis服务启动成功" -ForegroundColor Green
            } catch {
                Write-Host "❌ 无法通过服务管理器启动Redis，尝试手动启动..." -ForegroundColor Yellow
                Start-Process "redis-server" -WindowStyle Minimized -ErrorAction SilentlyContinue
                Start-Sleep -Seconds 3
            }
        }
    } catch {
        Write-Host "⚠️  Redis服务检查失败，尝试手动启动..." -ForegroundColor Yellow
        Start-Process "redis-server" -WindowStyle Minimized -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 3
    }
    
    Write-Host "[3/4] 测试Redis连接..." -ForegroundColor Yellow
    try {
        $result = redis-cli ping 2>$null
        if ($result -eq "PONG") {
            Write-Host "✅ Redis连接正常" -ForegroundColor Green
        } else {
            throw "Redis ping失败"
        }
    } catch {
        Write-Host "❌ Redis连接失败" -ForegroundColor Red
        Write-Host "💡 请检查Redis服务状态或运行: .\check_redis.bat" -ForegroundColor Yellow
        Read-Host "按Enter键退出"
        exit 1
    }
} else {
    Write-Host "[1/4] 跳过Redis检查..." -ForegroundColor Yellow
}

# 检查Django配置
Write-Host "[4/4] 检查Django配置..." -ForegroundColor Yellow
try {
    python manage.py check --deploy 2>$null
    Write-Host "✅ Django配置正常" -ForegroundColor Green
} catch {
    Write-Host "❌ Django配置检查失败" -ForegroundColor Red
    Read-Host "按Enter键退出"
    exit 1
}

# 启动说明
Write-Host "[5/5] 准备启动服务..." -ForegroundColor Yellow
Write-Host ""
Write-Host "🚀 即将启动以下服务:" -ForegroundColor Cyan
Write-Host "   • Django开发服务器 (端口8000)" -ForegroundColor White
Write-Host "   • RQ Worker (默认队列)" -ForegroundColor White
Write-Host ""
Write-Host "📊 管理界面地址:" -ForegroundColor Cyan
Write-Host "   • RQ管理: http://127.0.0.1:8000/django-rq/" -ForegroundColor Green
Write-Host "   • Django Admin: http://127.0.0.1:8000/admin/" -ForegroundColor Green
Write-Host "   • 主页: http://127.0.0.1:8000/" -ForegroundColor Green
Write-Host ""
Write-Host "💡 使用说明:" -ForegroundColor Cyan
Write-Host "   • 在RQ管理界面可以监控任务队列" -ForegroundColor White
Write-Host "   • 查看任务执行状态和失败原因" -ForegroundColor White
Write-Host "   • 重新排队或删除任务" -ForegroundColor White
Write-Host ""

Read-Host "按Enter键继续启动"

# 启动Django服务器
Write-Host "[启动] 启动Django服务器..." -ForegroundColor Yellow
Write-Host "💡 按 Ctrl+C 停止服务器" -ForegroundColor Yellow
Write-Host ""

try {
    # 在新窗口启动RQ Worker
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; Write-Host 'RQ Worker 启动中...' -ForegroundColor Green; python manage.py rqworker default"
    
    Start-Sleep -Seconds 2
    
    # 启动Django服务器
    python manage.py runserver 8000
} catch {
    Write-Host "❌ 启动失败: $_" -ForegroundColor Red
} finally {
    Write-Host ""
    Write-Host "服务器已停止" -ForegroundColor Yellow
    Read-Host "按Enter键退出"
}

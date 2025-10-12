#!/bin/bash

# 成绩管理系统完整启动脚本
# 同时启动 Django 服务器和 RQ Worker

echo "========================================"
echo "🚀 启动成绩管理系统 (完整版)"
echo "时间: $(date)"
echo "========================================"

# 进入项目目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "📁 项目目录: $SCRIPT_DIR"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查是否安装了必要组件
echo -e "${BLUE}🔍 检查系统依赖...${NC}"

# 检查 Redis 连接
echo -e "${BLUE}🔍 检查 Redis 连接...${NC}"
if redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Redis 连接正常${NC}"
elif brew services list | grep redis | grep started > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Redis 服务已启动 (通过 brew)${NC}"
elif pgrep -x "redis-server" > /dev/null; then
    echo -e "${GREEN}✅ Redis 进程已运行${NC}"
else
    echo -e "${YELLOW}⚠️  Redis 未运行，尝试启动...${NC}"
    
    # 首先尝试通过 brew 启动
    if command -v brew > /dev/null && brew services list | grep redis > /dev/null; then
        echo "通过 brew 启动 Redis..."
        brew services start redis
        sleep 3
        if redis-cli ping > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Redis 启动成功 (brew)${NC}"
        else
            echo -e "${YELLOW}⚠️  brew 启动失败，尝试直接启动...${NC}"
        fi
    fi
    
    # 如果 brew 启动失败，尝试直接启动
    if ! redis-cli ping > /dev/null 2>&1; then
        if command -v redis-server > /dev/null; then
            echo "直接启动 Redis 服务器..."
            redis-server --daemonize yes
            sleep 3
            if redis-cli ping > /dev/null 2>&1; then
                echo -e "${GREEN}✅ Redis 启动成功 (直接启动)${NC}"
            else
                echo -e "${RED}❌ Redis 启动失败${NC}"
                echo "请手动启动 Redis: brew services start redis"
                exit 1
            fi
        else
            echo -e "${RED}❌ 未找到 Redis，请先安装 Redis${NC}"
            echo "   macOS: brew install redis"
            echo "   然后运行: brew services start redis"
            exit 1
        fi
    fi
fi

# 激活conda环境
echo -e "${BLUE}🐍 配置 Python 环境...${NC}"
if command -v conda > /dev/null; then
    echo "初始化 conda..."
    source /opt/miniconda3/etc/profile.d/conda.sh
    
    # 检查 sms 环境是否存在
    if conda env list | grep -q "^sms "; then
        echo "激活 conda 环境: sms"
        conda activate sms
        if [ "$CONDA_DEFAULT_ENV" = "sms" ]; then
            echo -e "${GREEN}✅ 成功切换到 sms 环境${NC}"
        else
            echo -e "${RED}❌ 切换到 sms 环境失败${NC}"
            exit 1
        fi
    else
        echo -e "${RED}❌ conda 环境 'sms' 不存在${NC}"
        echo "请先创建 sms 环境:"
        echo "  conda create -n sms python=3.12"
        echo "  conda activate sms"
        echo "  pip install -r requirements.txt"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  conda 未安装，使用系统 Python${NC}"
fi

# 显示当前 Python 环境信息
echo "当前 Python 环境:"
echo "  Python 路径: $(which python)"
echo "  Python 版本: $(python --version)"
if [ ! -z "$CONDA_DEFAULT_ENV" ]; then
    echo "  Conda 环境: $CONDA_DEFAULT_ENV"
fi

# 检查Django和依赖
echo -e "${BLUE}🔧 检查 Django 环境...${NC}"
python -c "import django; print('Django版本:', django.get_version())" || {
    echo -e "${RED}❌ Django 未安装${NC}"
    exit 1
}

python -c "import redis; print('Redis-py 已安装')" || {
    echo -e "${RED}❌ redis-py 未安装${NC}"
    exit 1
}

python -c "import django_rq; print('Django-RQ 已安装')" || {
    echo -e "${RED}❌ django-rq 未安装${NC}"
    exit 1
}

# 应用数据库迁移
echo -e "${BLUE}🗃️  应用数据库迁移...${NC}"
python manage.py migrate --verbosity=1

# 清理失败的任务
echo -e "${BLUE}🧹 清理失败的异步任务...${NC}"
python -c "
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'school_management.settings')
django.setup()
import django_rq
queue = django_rq.get_queue('default')
failed_count = queue.failed_job_registry.count
if failed_count > 0:
    queue.failed_job_registry.requeue()
    print(f'已重新排队 {failed_count} 个失败任务')
else:
    print('没有失败的任务需要清理')
"

# 创建日志目录
mkdir -p logs

# 定义清理函数
cleanup() {
    echo -e "\n${YELLOW}🛑 正在停止服务...${NC}"
    
    # 杀死子进程
    if [ ! -z "$DJANGO_PID" ]; then
        echo "停止 Django 服务器..."
        kill $DJANGO_PID 2>/dev/null || true
    fi
    
    if [ ! -z "$WORKER_PID" ]; then
        echo "停止 RQ Worker..."
        kill $WORKER_PID 2>/dev/null || true
    fi
    
    echo -e "${GREEN}✅ 服务已停止${NC}"
    exit 0
}

# 设置信号处理
trap cleanup SIGINT SIGTERM

echo -e "${GREEN}🚀 启动服务...${NC}"
echo ""

# 启动 RQ Worker (后台)
echo -e "${BLUE}⚡ 启动 RQ Worker...${NC}"
python manage.py rqworker default > logs/rq_worker.log 2>&1 &
WORKER_PID=$!
echo "RQ Worker PID: $WORKER_PID"

# 等待一下确保 Worker 启动
sleep 2

# 检查 Worker 是否正常启动
if kill -0 $WORKER_PID 2>/dev/null; then
    echo -e "${GREEN}✅ RQ Worker 启动成功${NC}"
else
    echo -e "${RED}❌ RQ Worker 启动失败${NC}"
    exit 1
fi

# 启动 Django 服务器 (前台)
echo -e "${BLUE}🌐 启动 Django 服务器...${NC}"
echo ""
echo "========================================="
echo -e "${GREEN}🎉 成绩管理系统已启动！${NC}"
echo ""
echo "📱 访问地址:"
echo "   🏠 主页: http://127.0.0.1:8000"
echo "   📊 成绩管理: http://127.0.0.0:8001/exams/scores/"
echo "   📤 批量导入: http://127.0.0.0:8001/exams/scores/batch-import/"
echo "   📈 任务监控: http://127.0.0.0:8001/django-rq/"
echo ""
echo "🔧 后台服务:"
echo "   ⚡ RQ Worker: 正在运行 (PID: $WORKER_PID)"
echo "   📝 Worker 日志: logs/rq_worker.log"
echo ""
echo -e "${YELLOW}💡 提示: 按 Ctrl+C 停止所有服务${NC}"
echo "========================================="
echo ""

# 启动 Django 服务器（这会阻塞直到收到信号）
python manage.py runserver 8000 &
DJANGO_PID=$!

# 等待服务器进程
wait $DJANGO_PID

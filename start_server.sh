#!/bin/bash

# 启动优化后的成绩管理系统

echo "=== 启动优化后的成绩管理系统 ==="
echo "时间: $(date)"

# 进入项目目录
cd /Users/caijinbin/Desktop/白实/信息/信息管理系统/SMS

echo "1. 激活conda环境..."
source /opt/miniconda3/etc/profile.d/conda.sh
conda activate sms

echo "2. 检查Django环境..."
python -c "import django; print('Django版本:', django.get_version())"

echo "3. 应用数据库迁移..."
python manage.py migrate --verbosity=1

echo "4. 启动Django服务器..."
echo "访问地址: http://127.0.0.1:8001"
echo "成绩管理页面: http://127.0.0.1:8001/exams/scores/"
echo "成绩批量导入: http://127.0.0.1:8001/exams/scores/batch-import/"
echo ""
echo "按 Ctrl+C 停止服务器"
echo "================================"

python manage.py runserver 8001

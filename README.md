# SMS — 成绩管理，重新定义

一个界面，取代一百个 Excel。

查看所有成绩，读懂每个学生的成长曲线——不需要再一个一个文件翻找，不需要再手动对比每次考试的分数变化。

## 解决的问题

**班主任**：每次考试后不用再对着 Excel 整理成绩，数据自动汇聚，班级情况一目了然。

**科任老师**：所教班级的发展趋势，一图呈现，不用逐班复制粘贴。

**学校管理层**：全年级的成绩数据，横向对比、纵向追踪，一处看清楚。

## 快速开始

```bash
git clone https://github.com/aIeXCai/SMS.git
cd SMS
bash start_sms.sh
```

- 前端：http://localhost:3000
- 后端 API：http://localhost:8000
- 管理后台：http://localhost:8000/admin/
- 任务监控：http://localhost:8000/django-rq/

## 技术栈

Django 5.2 · Next.js 15 · SQLite / MySQL · Redis + django-rq

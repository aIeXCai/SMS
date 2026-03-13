# 学校成绩管理系统 (SMS)
> School Management System - 产品需求文档 (PRD)

## 📋 项目概览

### 1.1 项目简介
SMS 是面向中小学的“学籍 + 成绩”一体化管理系统，覆盖：

- 学生档案与学籍管理
- 考试与科目配置
- 成绩录入、验证与批量处理
- 排名计算与可视化分析
- 异步任务（导入/计算/报表）

### 1.2 技术栈
- **后端**: Django 5.2.4 + Python 3.12
- **前端**: Next.js 15 + React 19 + TypeScript + Tailwind CSS
- **数据库**: SQLite（开发）/ PostgreSQL（生产可选）
- **异步任务**: Redis + django-rq
- **可视化**: Chart.js + Bootstrap（Django 模板界面）

### 1.3 迁移状态（2026-03-13）
- `score` 模块已完成“旧 Django 模板视图 -> 前端页面 + `/api/scores/*`”分离。
- 旧成绩模板页面（`templates/scores/*`）已下线，旧路由保留为重定向/代理层。
- `student` 模块已完成“旧 Django 模板视图 -> 前端页面 + `/api/students/*`”分离。
- 旧学生模板页面（`templates/students/*`）与旧 `student_views.py` 已下线，旧路由保留为重定向/代理层。
- `exam` 模块已完成“旧 Django 模板视图 -> 前端页面 + `/api/exams/*`”分离。
- 旧考试模板页面（`templates/exams/*`）与旧 `exam_views.py` 已下线，旧路由保留为重定向/代理层。
- 分析与成绩契约文档已冻结：见 `docs/score_management_api_contract.md`、`docs/analysis_api_contract.md`。
- 学生契约文档已冻结：见 `docs/student_management_api_contract.md`。
- 考试契约文档已冻结：见 `docs/exam_management_api_contract.md`。
- 最新验收结果：exam 测试 13/13、student 关键测试 35/35、score 测试 57/57、models 测试 26/26、`python manage.py check` 通过、frontend build 成功。
- 模块分离进度与后续模板见 `MIGRATION_TRACKER.md`。

---

## 🏗️ 系统架构

### 2.1 核心模块说明
- **school_management.students_grades**: 学生档案、考试管理、成绩录入、排名/分析
- **school_management.users**: 用户、权限、JWT认证
- **frontend/**: Next.js 前端界面（登录、学生/成绩管理、分析报表）
- **scripts/**: 运行脚本（含 `start_sms.sh` 启动脚本）

### 2.2 关键依赖
- Django + DRF + SimpleJWT
- Redis + django-rq（异步任务队列）
- Chart.js（分析图表）
- Tailwind CSS + Radix UI（前端样式）

---

## 📚 核心功能模块

## 3. 统一学生管理模块 (students_grades)

### 3.1 模块概述
统一学生管理模块（`students_grades`）是系统的核心，整合了学生档案管理、考试管理、成绩录入与分析等所有与学生相关的功能。该模块为合并后的模块，包含原先的 `students` 与 `exams` 功能，提供从入学到毕业的全生命周期管理体验，实现学生信息与学业表现的一体化管理。

### 3.2 子功能模块

#### 3.2.1 学生档案管理
- 学生基础信息（学号、姓名、性别、出生日期、联系方式）
- 学籍状态管理（在读/转学/休学/毕业）、班级/年级关联
- 批量导入/导出、状态批量更新

#### 3.2.2 考试管理子系统
- 考试创建/编辑（名称、学年、日期、年级、描述）
- 科目配置（多科目、满分设置、模板支持）
- 适配不同年级的科目与满分差异

#### 3.2.3 学业成绩管理子系统
- 成绩录入（单条 + Excel 批量导入）
- 成绩验证与重复检查
- 异步排名计算（年级/班级/学科）
- 成绩导出与批量处理

#### 3.2.4 学业查询子系统
- 多维筛选：学生/班级/考试/科目/时间
- 实时搜索 + 高级筛选
- 查询结果可导出为 Excel

#### 3.2.5 学业分析子系统
- 支持学生/班级/年级视角的成绩趋势与排名分析
- 可视化展示：趋势图、雷达图、柱状图、分布图
- 数据导出：图表、分析结果可导出为 Excel

### 3.3 批量操作功能
**功能描述**: 高效的批量数据处理能力，覆盖学生档案和成绩管理的各个方面。

**学生档案批量操作**:
- **📥 批量导入**: Excel文件导入学生信息
- **🗑️ 批量删除**: 多选删除学生记录
- **📝 批量状态更新**: 批量修改学生在校状态
- **🎓 批量升年级**: 一键处理年级升级
- **👨‍🎓 批量毕业**: 批量设置学生毕业状态

**学业成绩批量操作**:
- **📥 批量成绩导入**: Excel文件批量导入考试成绩
- **📊 批量成绩导出**: 按条件导出成绩数据
- **🗑️ 批量成绩删除**: 多选删除成绩记录
- **✏️ 批量成绩编辑**: 批量修改成绩数据
- **📄 模板下载**: 提供标准Excel导入模板

### 3.4 技术特性

#### 3.4.1 异步任务处理
**功能描述**: 利用django-rq实现大数据量的异步处理。

**应用场景**:
- **排名计算**: 大规模学生成绩排名异步计算
- **批量导入**: 大量学生档案和成绩数据的后台处理
- **报表生成**: 复杂统计报表的异步生成
- **数据迁移**: 学生升年级等批量操作的异步处理

#### 3.4.2 一体化数据管理
**功能描述**: 学生档案与学业数据的统一管理和关联分析。

**核心特性**:
- **数据关联**: 学生档案与成绩数据的无缝关联
- **状态同步**: 学生状态变化与成绩记录的自动同步
- **历史追踪**: 完整的学生学业历程追踪
- **数据一致性**: 确保档案与成绩数据的一致性

### 3.5 成绩分析系统核心特色

#### 3.5.1 智能分析引擎
**多维度数据处理**:
- **🧠 智能排名计算**: 自动计算班级排名、年级排名、科目排名
- **📊 趋势识别**: 基于历史数据的成绩趋势分析和预测
- **🎯 异常检测**: 自动识别成绩异常波动和特殊表现
- **📈 对比分析**: 横向对比（同班、同年级）和纵向对比（历史表现）

#### 3.5.2 可视化技术栈
**Chart.js 图表库集成**:
- **📈 趋势图**: 支持多数据集的线性图表，动态边距调整
- **🎯 雷达图**: 多维数据的雷达图展示，支持多层对比
- **📊 柱状图**: 成绩对比的柱状图，支持分组和堆叠
- **📱 响应式**: 所有图表完美适配移动端设备

#### 3.5.3 交互体验优化
**前端交互技术**:
- **⚡ AJAX异步**: 无刷新的数据加载和图表更新
- **🔄 实时筛选**: 筛选条件变化时的实时图表重绘
- **💫 动画效果**: 平滑的图表过渡和数据变化动画
- **🎨 主题配色**: 统一的色彩体系和视觉规范

### 3.6 页面功能总览
```
统一学生管理入口:
├── /students/                     # 学生管理主页（整合档案和成绩）

学生档案管理:
├── /students/profile/             # 学生档案列表
├── /students/profile/add/         # 新增学生档案
├── /students/profile/<id>/edit/   # 编辑学生档案  
├── /students/profile/batch/       # 批量档案操作

考试管理:
├── /students/exams/               # 考试列表
├── /students/exams/create/step1/  # 考试创建-基础信息
├── /students/exams/create/step2/  # 考试创建-科目配置
├── /students/exams/<id>/edit/     # 考试编辑

成绩管理:
├── /students/scores/              # 成绩列表
├── /students/scores/add/          # 单个成绩录入
├── /students/scores/batch/        # 批量成绩操作

学业查询:
├── /students/query/               # 统一查询界面
├── /students/query/results/       # 查询结果展示
├── /students/query/export/        # 数据导出

🔥 核心成绩分析系统:
├── /analysis/                     # 成绩分析主页
├── /analysis/student/             # 学生个人分析选择页
├── /analysis/student/detail/      # 🌟 学生个人成绩详细分析（核心功能）
├── /analysis/class/               # 班级群体成绩分析
├── /analysis/grade/               # 年级整体成绩分析
└── /analysis/export/              # 分析结果导出

🔧 AJAX API接口:
├── /api/scores/student-analysis-data/  # 学生个人分析数据API
├── /api/scores/class-analysis-single/  # 单班分析数据API
├── /api/scores/class-analysis-multi/   # 多班对比数据API
└── /api/scores/class-analysis-grade/   # 年级分析数据API
```

## 4. 前端应用模块 (frontend)

### 4.1 技术栈
基于现代化的React生态系统构建，提供优秀的用户体验。

**核心技术**:
- **Next.js 15.4.6**: App Router、服务端渲染、API路由
- **React 19**: 最新的React特性和性能优化
- **TypeScript**: 类型安全的开发体验
- **Tailwind CSS**: 原子化CSS和响应式设计
- **Radix UI**: 高质量的UI组件库

### 4.2 主要功能
- **用户注册登录**: 完整的身份认证流程
- **学生管理界面**: 与统一学生模块的无缝集成
- **响应式界面**: 支持PC、平板、手机多端访问
- **现代化UI**: 基于设计系统的一致性界面
- **API集成**: 与Django后端的无缝集成

### 4.3 开发特性
- **热重载**: 快速的开发调试体验
- **TypeScript**: 类型安全和代码智能提示
- **ESLint**: 代码质量检查和规范
- **组件化**: 可复用的UI组件系统

---

## 5. 系统管理模块

### 5.1 运维脚本 (scripts/)
**功能描述**: 完整的系统运维和监控工具集。

**脚本清单**:
- **monitor_tasks.py**: RQ任务队列监控
- **django_status.py**: Django系统状态检查
- **manage_admin_users.py**: 管理员用户管理
- **start_sms.sh**: 一键启动系统服务

注意：项目结构已将历史上的 `students` 和 `exams` 应用合并到 `school_management/students_grades/`，并移除了旧的 `school_management/students/` 与 `school_management/exams/` 目录。相关运维脚本（如 `scripts/django_status.py`、`scripts/monitor_tasks.py`）已更新为从 `school_management.students_grades` 引入模型和函数。

如果你的部署或外部任务（Cron、CI/CD、运维脚本）仍然引用旧模块路径，请将导入更新为 `school_management.students_grades` 或联系维护人员进行同步更新。

### 5.2 数据管理 (data/)
**功能描述**: 数据文件和模板管理。

**内容包括**:
- **导入模板**: 学生信息、成绩数据Excel模板
- **样例数据**: 测试和演示用数据
- **数据备份**: 重要数据的备份文件

### 5.3 异步任务系统
**功能描述**: 基于Redis和django-rq的异步任务处理。

**核心功能**:
- **任务队列**: 支持default、high、low优先级队列
- **任务监控**: 实时监控任务执行状态
- **失败重试**: 自动重试和错误恢复机制
- **性能监控**: 任务执行统计和性能分析

---

## 🚀 部署和运行

### 6.1 快速启动（推荐）
本项目提供一键启动脚本 `start_sms.sh`，会自动：

- 检查并启动 Redis
- 激活 Conda 环境（如果已创建）
- 安装/校验 Python 依赖
- 执行 Django 数据库迁移
- 启动 django-rq Worker
- 在新终端启动 Next.js 前端
- 启动 Django 开发服务器

```bash
bash start_sms.sh
```

> ⚠️ 该脚本使用 macOS `osascript` 新开终端窗口启动前端，若在 Linux/Windows 环境运行，请参考“单独启动”部分。

### 6.1.1 后端（Django）单独启动
```bash
# 1. 环境准备（可使用 venv/conda）
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 2. 数据库初始化
python manage.py makemigrations
python manage.py migrate

# 3. 创建管理员账号（可选）
python manage.py createsuperuser

# 4. 启动后端服务
python manage.py runserver 0.0.0.0:8000
```

### 6.1.2 前端（Next.js）单独启动
```bash
cd frontend
npm install
npm run dev
```

> ✅ 前端地址： http://localhost:3000
> ✅ 后端地址： http://127.0.0.1:8000

### 6.2 服务访问
- **后端 API / Django**: http://127.0.0.1:8000
- **管理后台 (Django Admin)**: http://127.0.0.1:8000/admin/
- **异步任务监控 (django-rq)**: http://127.0.0.1:8000/django-rq/
- **前端应用 (Next.js 开发模式)**: http://127.0.0.1:3000

### 6.3 系统要求
- **Python**: 3.12+
- **Node.js**: 18+
- **Redis**: 用于异步任务队列
- **浏览器**: Chrome/Firefox/Safari/Edge (现代浏览器)

---

## 📊 数据统计

### 7.1 系统规模
- **代码行数**: ~10,000+ 行
- **数据模型**: 6个核心模型（整合在统一学生模块中）
- **API接口**: 30+ 个功能接口
- **页面模板**: 25+ 个功能页面
- **前端组件**: 20+ 个React组件

### 7.2 功能统计
- **学生档案管理**: 15个字段的完整学生档案
- **考试成绩管理**: 支持10个科目的成绩管理
- **批量操作**: 10种批量操作功能（档案+成绩）
- **🔥 成绩分析系统**: 
  - **3个分析维度**: 学生个人、班级群体、年级整体
  - **4种图表类型**: 趋势图、雷达图、柱状图、数据表格
  - **多维筛选**: 考试多选、科目多选、排名类型切换
  - **智能默认**: 自动选择最优分析配置
  - **响应式图表**: 完美适配各种设备屏幕
- **异步任务**: 3个优先级队列
- **前端技术**: Chart.js图表库 + Bootstrap响应式框架
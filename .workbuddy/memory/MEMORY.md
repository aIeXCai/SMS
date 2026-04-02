# MEMORY.md — SMS 项目长期记忆

## 项目概况
- **项目**：白云实验学校成绩管理系统 (SMS)
- **技术栈**：Django 5.2.4 + DRF + SimpleJWT | Next.js 15 + React 19 + TypeScript + Tailwind CSS
- **数据库**：SQLite(开发) / PostgreSQL(生产可选) | Redis + django-rq 异步任务
- **代码规模**：~10,000+ 行后端 / 20+ 前端页面
- **核心模块**：`school_management.students_grades`（学生/考试/成绩）+ `school_management.users`（认证权限）

## 关键架构决策
- 前后端完全分离，后端 API-only，前端通过 Next.js rewrites 代理 `/api/*`
- JWT + Session 双认证模式，自定义 JWTAuthenticationMiddleware
- 已完成 Django 模板 → 前端页面的迁移（2026-03-13）
- 采用 cohort（如"初中2026级"）替代旧的 grade_level 字段

## 已知问题（2026-03-30 代码审阅）
- 🔴 SECRET_KEY 硬编码、DEBUG=True、ALLOWED_HOSTS=['*'] — 安全风险
- 🔴 Dashboard 通过 URL 传递 Token — 信息泄露风险
- 🟡 数据库索引被注释掉、api_views.py 1816行过大
- 🟡 SUBJECT_CHOICES 在 exam.py/score.py 重复定义
- 🟡 前端多个页面组件超 35KB，需拆分
- 🟡 admin.py N+1 查询、缺少 API 限流

## 开发规范
- Python 环境使用 conda `sms` 环境
- 前端使用 `npm run dev --turbopack` 启动
- 启动脚本 `start_sms.sh` 可一键启动全部服务
- db.sqlite3 和 .env 已在 .gitignore 中

## 开发规划（2026-03-31）
### 当前系统完成度
- 核心模块完成度约 85%
- 已完成：学生档案、考试管理、成绩管理、排名系统、成绩分析、目标生筛选第一期

### 下一阶段开发优先级
1. **目标生筛选第二期**（最高优先级，2-3周）
   - 多条件组合筛选（AND/OR）
   - 学科排名筛选
   - 规则保存与复用
   - 目标生变化追踪
   - PRD 文档：`docs/目标生筛选-第二期/PRD-目标生筛选第二期.md`（v1.4，已审批通过）
   - 开发文档：`docs/目标生筛选-第二期/DEV-目标生筛选第二期.md`（v1.0）
   - 3 个新增页面：高级筛选(`/advanced`)、我的规则(`/rules`)、变化追踪(`/tracking`)
   - 2 个新增模型：`SavedFilterRule`、`FilterResultSnapshot`
   - 10 个新增 API 端点

2. **细粒度权限系统 v2**（次优先，1.5-2周）
   - 数据范围权限（级长/班主任/科任老师）
   - 操作审计日志

3. **Score 表字段优化**（3-5天）
   - 添加 `student_grade_level_at_exam`、`student_class_at_exam`
   - 解决学生转班后历史成绩归属问题

4. **排名系统增强**（可选）
5. **性能与运维优化**（持续进行）

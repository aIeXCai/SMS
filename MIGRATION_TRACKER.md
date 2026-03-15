# 模块分离迁移追踪（Migration Tracker）

更新时间：2026-03-13

## 1. 当前状态总览

| 模块 | 目标状态 | 当前状态 | 说明 |
|---|---|---|---|
| score（成绩管理） | 前端页面 + `/api/scores/*` 主链路 | ✅ 完成 | 旧模板与旧重定向层下线，后端仅保留 API，测试基线已迁移 |
| analysis（成绩分析） | 前端页面 + `/api/scores/*analysis*` 主链路 | ✅ 完成 | 页面入口与数据接口契约已冻结 |
| student | 前端页面 + `/api/students/*` 主链路 | ✅ 完成 | 旧模板、旧视图与旧重定向层已下线，后端仅保留 API |
| exam | 前端页面 + `/api/exams/*` 主链路 | ✅ 完成 | 旧模板、旧视图与旧重定向层已下线，后端仅保留 API |

## Exam 分离进展（已完成）

- [x] 第 1 步：入口盘点
- [x] 第 2 步：冻结 Exam API 契约（`docs/exam_management_api_contract.md`）
- [x] 第 3 步：切换 Django 考试路由为前端重定向
- [x] 第 4 步：迁移导航与内部跳转
- [x] 第 5 步：迁移测试到新契约（`test_exam_views` 13/13 通过）
- [x] 第 6 步：下线 `templates/exams/*` 与旧视图
- [x] 第 7 步：全量回归与冒烟验证
- [x] 第 8 步：文档收口与发布说明

### Exam 分离发布说明（2026-03-13）

- 分离目标已达成：Exam 页面主入口已统一到前端，数据主链路统一为 `/api/exams/*`。
- API-only 收口已完成：后端不再承接旧页面入口与旧重定向入口。
- 旧资产已下线：`templates/exams/*` 与旧 `views/exam_views.py` 已删除。
- 回归验证已完成：Exam/Student/Score 关键回归测试与前端构建均通过。

### Exam 分离验收记录

- `python manage.py test school_management.students_grades.tests.exam.test_exam_views`：13/13 通过
- `python manage.py test school_management.students_grades.tests.score`：57/57 通过
- `python manage.py test school_management.students_grades.tests.student.test_student_views`：17/17 通过
- `python manage.py test school_management.students_grades.tests.student.test_student_forms`：11/11 通过
- `python manage.py test school_management.students_grades.tests.student.test_student_imports`：7/7 通过
- `python manage.py test school_management.students_grades.tests.test_models`：26/26 通过
- `python manage.py check`：0 issues
- `cd frontend && npm run build`：构建成功（存在既有 ESLint 插件告警，不阻断产物）

## Student 分离进展（进行中）

- [x] 第 1 步：入口盘点
- [x] 第 2 步：冻结 Student API 契约（`docs/student_management_api_contract.md`）
- [x] 第 3 步：切换 Django 学生路由为前端重定向
- [x] 第 4 步：迁移导航与内部跳转
- [x] 第 5 步：迁移测试到新契约
- [x] 第 6 步：下线 `templates/students/*` 与旧视图
- [x] 第 7 步：全量回归与冒烟验证
- [x] 第 8 步：文档收口与发布说明

### Student 分离发布说明（2026-03-12）

- 分离目标已达成：Student 页面主入口已统一到前端，数据主链路统一为 `/api/students/*`。
- API-only 收口已完成：后端不再承接旧页面入口与旧重定向入口。
- 旧资产已下线：`templates/students/*` 与旧 `views/student_views.py` 已删除。
- API 契约已补测：学生模块关键 mutation 与列表能力已纳入 API 测试。

### Student 分离验收记录

- `python manage.py test school_management.students_grades.tests.student.test_student_forms school_management.students_grades.tests.student.test_student_imports school_management.students_grades.tests.student.test_student_views -v 2`：35/35 通过
- `python manage.py test school_management.students_grades.tests.student.test_student_views -v 2`：17/17 通过（含新增旧 mutation 重定向用例）
- `python manage.py test school_management.students_grades.tests.score -v 2`：57/57 通过
- `python manage.py check`：0 issues
- `cd frontend && npm run build`：构建成功（存在既有 ESLint 插件告警，不阻断产物）

## 2. score 模块分离完成定义（DoD）

- [x] 旧 `templates/scores/*` 下线。
- [x] 旧 `score_views.py` 下线。
- [x] 旧重定向层（`students_grades/urls.py`、`analysis_redirect_views.py`）下线。
- [x] 前端 score 页面统一走 `/api/scores/*`。
- [x] 契约文档冻结：
  - `docs/score_management_api_contract.md`
  - `docs/analysis_api_contract.md`
- [x] 测试基线迁移到新架构并通过：
  - `python manage.py test school_management.students_grades.tests.score`

## 3. 后续模块分离标准流程（复用模板）

1. **路由收口**：梳理旧入口、新入口、兼容入口，先保证行为等价。
2. **API 契约冻结**：先写契约，再改前端调用，避免字段漂移。
3. **测试迁移**：把“模板断言”改为“API 契约断言”。
4. **旧资产下线**：删除旧模板/旧视图/旧重定向层。
5. **回归验证**：模块级测试通过 + `manage.py check` 无错误。
6. **文档收口**：README + 本追踪文件同步更新。

## 4. 下一模块开工前检查清单

- [ ] 明确模块边界（页面、API、任务、脚本）。
- [ ] 列出旧路由清单与兼容策略（保留期限）。
- [ ] 建立测试迁移清单（按文件列出）。
- [ ] 确认完成后验收命令与责任人。

# tests/score（迁移后基线）

更新时间：2026-03-12

本目录测试已完成从“旧模板渲染断言”到“重定向 + `/api/scores/*` 契约断言”的迁移。

## 当前覆盖范围

- `test_base.py`
  - 统一测试基类，默认登录 `admin` 角色，避免鉴权噪音。

- `test_views_student.py`
  - 校验学生分析入口路由重定向：
    - `/analysis/student`
    - `/analysis/student/detail`
  - 校验 query 参数透传。

- `test_views_class.py`
  - 校验班级/年级分析入口路由重定向：
    - `/analysis/class-grade`
    - `/analysis/class-grade/class`
    - `/analysis/class-grade/grade`

- `test_ajax.py`
  - API 契约测试（已迁移到新接口）：
    - `/api/classes/`
    - `/api/students/`
    - `/api/scores/options/`
    - `/api/scores/student-analysis-data/`

- `test_score_views_core.py`
  - score 旧页面路由重定向到前端页面（`/scores*`）。
  - 旧批量操作路由 307 代理到 `/api/scores/*`。
  - 新 API 冒烟：`/api/scores/`、`/api/scores/student-search/`。

- `test_score_imports.py`
  - 批量导入接口：`/api/scores/batch-import/`。
  - 覆盖成功导入、权限约束、学号优先匹配等关键行为。

## 迁移策略说明

- 不再断言 `templates/scores/*` 的渲染结果。
- 统一断言“路由契约 + API 数据结构”，与前后端分离后的架构一致。
- 若后续继续收紧兼容层，应优先更新本目录测试，再删路由。

## 验收命令

```bash
python manage.py test school_management.students_grades.tests.score
```

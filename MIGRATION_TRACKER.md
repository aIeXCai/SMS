# 模块分离迁移追踪（Migration Tracker）

更新时间：2026-03-12

## 1. 当前状态总览

| 模块 | 目标状态 | 当前状态 | 说明 |
|---|---|---|---|
| score（成绩管理） | 前端页面 + `/api/scores/*` 主链路 | ✅ 完成 | 旧模板下线，旧路由改 redirect / 307 代理，测试基线已迁移 |
| analysis（成绩分析） | 前端页面 + `/api/scores/*analysis*` 主链路 | ✅ 完成 | 页面入口与数据接口契约已冻结 |
| student | 待分离 | ⏳ 未开始 | 下一阶段候选 |
| exam | 待分离 | ⏳ 未开始 | 下一阶段候选 |

## 2. score 模块分离完成定义（DoD）

- [x] 旧 `templates/scores/*` 下线。
- [x] 旧 `score_views.py` 下线。
- [x] `students_grades/urls.py` 成绩相关入口切换为 redirect / API 代理。
- [x] 前端 score 页面统一走 `/api/scores/*`。
- [x] 契约文档冻结：
  - `docs/score_management_api_contract.md`
  - `docs/analysis_api_contract.md`
- [x] 测试基线迁移到新架构并通过：
  - `python manage.py test school_management.students_grades.tests.score`

## 3. 后续模块分离标准流程（复用模板）

1. **路由收口**：梳理旧入口、新入口、兼容入口，先保证行为等价。
2. **API 契约冻结**：先写契约，再改前端调用，避免字段漂移。
3. **测试迁移**：把“模板断言”改为“重定向/API 契约断言”。
4. **旧资产下线**：删除旧模板/旧视图，保留必要兼容层。
5. **回归验证**：模块级测试通过 + `manage.py check` 无错误。
6. **文档收口**：README + 本追踪文件同步更新。

## 4. 下一模块开工前检查清单

- [ ] 明确模块边界（页面、API、任务、脚本）。
- [ ] 列出旧路由清单与兼容策略（保留期限）。
- [ ] 建立测试迁移清单（按文件列出）。
- [ ] 确认完成后验收命令与责任人。

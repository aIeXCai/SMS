# 用户权限体系草案（v1）

- 状态：Draft（待完善）
- 日期：2026-03-15
- 适用范围：`school_management` 后端 API 与 `frontend` 前端页面
- 目标：统一“谁可以做什么”，作为后端鉴权、前端显隐、测试验收的唯一依据

---

## 1. 角色定义

系统当前角色（与 `CustomUser.role` 一致）：

- `admin`：管理员
  - 具备全量读写权限
- `grade_manager`：级长
  - 具备业务写权限（学生/考试/成绩）
  - 后续可扩展为“仅本年级”数据范围
- `subject_teacher`：科任老师
  - 只读权限为主（查询、分析、导出）
- `staff`：教辅人员
  - 具备业务写权限（学生/考试/成绩）

备注：当前版本先落地“功能权限（RBAC）”；数据范围（如“仅本年级可见”）放到 v2。

---

## 2. 权限模型（RBAC）

### 2.1 动作分类

- `READ`：查看、搜索、统计、分析、下拉选项
- `WRITE`：新增、编辑、删除、批量写入、导入
- `EXPORT`：导出、下载模板（不改数据）

### 2.2 角色权限矩阵

| 资源 | 动作 | admin | grade_manager | subject_teacher | staff |
|---|---|---|---|---|---|
| 学生 Student | READ | 允许 | 允许 | 允许 | 允许 |
| 学生 Student | WRITE | 允许 | 拒绝 | 拒绝 | 允许 |
| 学生 Student | EXPORT | 允许 | 允许 | 允许 | 允许 |
| 考试 Exam | READ | 允许 | 允许 | 允许 | 允许 |
| 考试 Exam | WRITE | 允许 | 允许 | 拒绝 | 允许 |
| 成绩 Score | READ | 允许 | 允许 | 允许 | 允许 |
| 成绩 Score | WRITE | 允许 | 允许 | 拒绝 | 允许 |
| 成绩 Score | EXPORT | 允许 | 允许 | 允许 | 允许 |
| 分析 Analysis | READ | 允许 | 允许 | 允许 | 允许 |

---

## 3. API 权限映射（v1）

说明：以下按“已存在接口”分组，标注为 `READ/WRITE/EXPORT`，并据此控制 200/403。

### 3.1 用户接口

- `GET /api/users/me/` -> READ（登录可访问）

### 3.2 学生接口（/api/students/*）

READ：
- `GET /api/students/`
- `GET /api/students/{id}/`
- `GET /api/students/stats/`

WRITE：
- `POST /api/students/`
- `PUT/PATCH /api/students/{id}/`
- `DELETE /api/students/{id}/`
- `POST /api/students/batch-delete/`
- `POST /api/students/batch-update-status/`
- `POST /api/students/batch-promote/`
- `POST /api/students/batch-import/`

EXPORT：
- `GET /api/students/download-template/`

### 3.3 考试接口（/api/exams/*）

READ：
- `GET /api/exams/`
- `GET /api/exams/{id}/`
- `GET /api/exams/options/`
- `GET /api/exams/default-subjects/`

WRITE：
- `POST /api/exams/`
- `PUT/PATCH /api/exams/{id}/`
- `DELETE /api/exams/{id}/`

### 3.4 成绩接口（/api/scores/*）

READ：
- `GET /api/scores/`
- `GET /api/scores/options/`
- `GET /api/scores/student-search/`
- `GET /api/scores/batch-edit-detail/`
- `GET /api/scores/select-all-record-keys/`

WRITE：
- `POST /api/scores/manual-add/`
- `POST /api/scores/batch-edit-save/`
- `POST /api/scores/batch-delete-selected/`
- `POST /api/scores/batch-delete-filtered/`
- `POST /api/scores/batch-import/`

EXPORT：
- `GET /api/scores/download-template/`
- `GET /api/scores/batch-export/`
- `GET /api/scores/query-export/`
- `POST /api/scores/batch-export-selected/`

### 3.5 分析接口（/api/scores/*analysis*）

READ：
- `GET /api/scores/student-analysis-data/`
- `GET /api/scores/class-analysis-single/`
- `GET /api/scores/class-analysis-multi/`
- `GET /api/scores/class-analysis-grade/`

---

## 4. 前端权限策略（v1）

### 4.1 菜单显隐

- 所有登录用户可见：`Dashboard`、学生列表、考试列表、成绩查询、分析页面
- 学生写操作入口（新增、编辑、删除、批量写）：仅 `admin`、`staff` 可见
- 考试写操作入口（创建、编辑、删除）：仅 `admin`、`grade_manager`、`staff` 可见
- 成绩写操作入口（新增、批量编辑、删除、导入）：仅 `admin`、`grade_manager`、`staff` 可见
- `subject_teacher`：仅展示只读与导出相关入口

### 4.2 按钮可用性

- 不可操作角色：按钮隐藏优先；若需要展示则禁用并提示“当前角色无权限”
- 即使前端隐藏，后端仍必须返回 403 兜底

### 4.3 错误提示

统一建议文案：
- `403`：你当前账号无此操作权限，请联系管理员
- `401`：登录已失效，请重新登录

---

## 5. 后端实现约束（开发规范）

- 所有 ViewSet 必须显式定义 `get_permissions`
- 所有 `POST/PUT/PATCH/DELETE` 自定义 action 必须纳入 WRITE 权限分支
- 禁止仅依赖前端做权限控制
- 角色判断应集中在统一权限类中（建议路径：`school_management/users/permissions.py`）

建议统一权限类：
- `IsAdminOrGradeManager`
- `IsReadOnlyOrAdminOrGradeManager`

---

## 6. 测试验收清单（最小集）

每个核心 WRITE 接口至少覆盖：

- admin 调用 -> 200/201/204
- grade_manager 调用 -> 200/201/204
- staff 调用 -> 403
- subject_teacher 调用 -> 403
- 未登录调用 -> 401

优先补测接口：
- `/api/students/batch-delete/`
- `/api/students/batch-update-status/`
- `/api/students/batch-promote/`
- `/api/students/batch-import/`
- `/api/scores/manual-add/`
- `/api/scores/batch-edit-save/`
- `/api/scores/batch-delete-selected/`
- `/api/scores/batch-delete-filtered/`

---

## 7. 后续版本规划

- v2：加入数据范围权限（如级长仅能管理 `managed_grade`）
- v2：统一审计日志（记录角色、接口、操作对象、结果）
- v3：细粒度权限点（如“允许导入但不允许删除”）

---

## 8. 待你确认的点

- `subject_teacher` 与 `staff` 是否允许“导出”全部数据？允许
- `grade_manager` 是否立即启用“仅本年级”限制？暂不启用，后续版本再加
- `/api/dashboard/stats/` 是否纳入角色差异化统计范围？否

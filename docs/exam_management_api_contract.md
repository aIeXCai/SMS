# 考试管理 API 契约（冻结版）

- 版本：`v1`
- 冻结日期：`2026-03-13`
- 适用范围：考试列表、考试 CRUD、科目配置、默认科目拉取
- 基础路径：`/api/exams/`

> 说明：本文档用于锁定 Exam 模块前后端分离期间的接口行为，避免字段与请求结构漂移。

---

## 通用约定

### 认证
- 需登录态。
- 支持：
  - `Authorization: Bearer <token>`（JWT）
  - Session（同源场景）

### 权限
- 读操作：登录用户可访问。
- 写操作（新增/更新/删除）：仅 `admin`、`grade_manager`。

### 响应约定
- 列表接口（DRF 默认）：
  - 未启用分页时返回数组 `[]`。
  - 启用分页时返回 `{ count, results, ... }`。

---

## 1) 考试列表与筛选

### 1.1 考试列表
- `GET /api/exams/`

#### 查询参数
- `academic_year`：学年筛选
- `grade_level`：年级筛选
- `search`：按考试名称/描述模糊搜索
- `ordering`：支持 `date`、`name`（可带 `-`）
- `page`、`page_size`：分页

#### 返回字段（单条）
- `id`
- `name`
- `academic_year`
- `date`
- `grade_level`
- `description`
- `exam_subjects`（只读）
  - `id`
  - `exam`
  - `subject_code`
  - `subject_name`
  - `max_score`

---

## 2) 考试 CRUD

### 2.1 新增考试
- `POST /api/exams/`

#### 请求体（前端当前实现）
```json
{
  "academic_year": "2025-2026",
  "name": "期末考试",
  "date": "2026-01-20",
  "grade_level": "初一",
  "description": "可选",
  "subjects": [
    { "subject_code": "语文", "max_score": 120 },
    { "subject_code": "数学", "max_score": 120 }
  ]
}
```

### 2.2 获取单个考试
- `GET /api/exams/{id}/`

### 2.3 更新考试
- `PUT /api/exams/{id}/`
- `PATCH /api/exams/{id}/`

#### 更新行为约定（subjects）
- 当请求体包含 `subjects` 时：
  - 提交中不存在的旧科目会被移除。
  - 提交中存在的科目按 `subject_code` 更新或创建。
- 当请求体不包含 `subjects` 时：
  - 仅更新考试基本信息，不改动已有科目配置。

### 2.4 删除考试
- `DELETE /api/exams/{id}/`

---

## 3) 选项与默认科目

### 3.1 获取考试筛选选项
- `GET /api/exams/options/`

#### 返回
```json
{
  "academic_years": [{ "value": "2025-2026", "label": "2025-2026学年" }],
  "grade_levels": [{ "value": "初一", "label": "初一" }]
}
```

### 3.2 按年级获取默认科目
- `GET /api/exams/default-subjects/?grade_level=初一`

#### 返回
```json
{
  "subjects": [
    { "subject_code": "语文", "max_score": 120 },
    { "subject_code": "数学", "max_score": 120 }
  ],
  "all_subjects": [
    { "value": "语文", "label": "语文" },
    { "value": "数学", "label": "数学" }
  ]
}
```

---

## 4) 错误码

- `400`：参数错误/请求体不合法
- `401`：未认证
- `403`：无权限（非 admin/grade_manager 执行写操作）
- `404`：资源不存在
- `500`：服务器内部错误

---

## 5) 兼容策略（冻结）

- 前端以 `/api/exams/*` 为唯一数据源。
- Django 模板页入口（`/exams/*`）在后续路由迁移步骤中改为前端重定向层。

---

## 6) 变更流程要求

若调整本契约：
1. 先改本文档并注明变更日期与影响接口。
2. 前端同步改动并通过 `npm run build`。
3. 后端执行 `python manage.py check` 与 Exam 相关测试。
4. 更新 `MIGRATION_TRACKER.md` 状态。

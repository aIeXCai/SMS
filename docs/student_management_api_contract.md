# 学生管理 API 契约（冻结版）

- 版本：`v1`
- 冻结日期：`2026-03-12`
- 适用范围：学生列表、学生 CRUD、批量导入/删除/状态更新、批量升年级
- 基础路径：`/api/students/`

> 说明：本文档用于锁定 Student 模块前后端分离期间的接口行为，避免字段名和返回结构漂移。

---

## 通用约定

### 认证
- 需登录态。
- 支持：
  - `Authorization: Bearer <token>`（JWT）
  - Session（同源场景）

### 权限
- 读操作：登录用户可访问。
- 写操作（新增/编辑/删除/批量操作）：仅 `admin`、`grade_manager`。

### 响应约定
- 列表接口（DRF 默认）：
  - 未启用全局分页时返回数组 `[]`。
  - 若后续启用分页，前端应兼容 `results` 字段。
- 动作接口统一返回：
```json
{
  "success": true,
  "message": "..."
}
```

---

## 1) 学生列表与检索

### 1.1 学生列表
- `GET /api/students/`

#### 查询参数
- `search`：模糊搜索（姓名/学号/班级名）
- `status`：在校状态
- `current_class__grade_level`：年级
- `current_class__class_name`：班级名
- `ordering`：`student_id`、`name`、`entry_date`

#### 返回字段（单条）
- `id`
- `student_id`
- `name`
- `gender`
- `date_of_birth`
- `entry_date`
- `graduation_date`
- `id_card_number`
- `student_enrollment_number`
- `home_address`
- `guardian_name`
- `guardian_contact_phone`
- `status`
- `current_class`（只读对象）
  - `id`
  - `grade_level`
  - `class_name`

---

## 2) 单个学生 CRUD

### 2.1 新增学生
- `POST /api/students/`

#### 请求体（推荐）
```json
{
  "student_id": "2026001",
  "name": "张三",
  "gender": "男",
  "date_of_birth": "2010-09-01",
  "status": "在读",
  "id_card_number": "...",
  "student_enrollment_number": "...",
  "home_address": "...",
  "guardian_name": "...",
  "guardian_contact_phone": "...",
  "entry_date": "2026-09-01",
  "graduation_date": null,
  "current_class": {
    "grade_level": "初一",
    "class_name": "1班"
  }
}
```

> 兼容写法：也可传 `current_class_id`（班级主键）。

### 2.2 获取单个学生
- `GET /api/students/{id}/`

### 2.3 更新学生
- `PUT /api/students/{id}/`
- `PATCH /api/students/{id}/`

### 2.4 删除学生
- `DELETE /api/students/{id}/`

> 删除后会触发受影响考试排名更新任务（异步）。

---

## 3) 批量操作

### 3.1 批量删除
- `POST /api/students/batch-delete/`

#### 请求体
```json
{
  "student_ids": [1, 2, 3]
}
```

#### 返回
```json
{
  "success": true,
  "message": "成功删除 3 名学生。"
}
```

---

### 3.2 批量更新状态
- `POST /api/students/batch-update-status/`

#### 请求体
```json
{
  "student_ids": [1, 2, 3],
  "status": "毕业"
}
```

> 当状态为 `毕业` 时，后端会自动写入毕业日期（若原先未填）。

---

### 3.3 批量升年级
- `POST /api/students/batch-promote/`

#### 请求体
```json
{
  "student_ids": [1, 2, 3],
  "target_grade_level": "初二",
  "current_grade_level": "初一",
  "auto_create_classes": true
}
```

#### 返回（示例）
```json
{
  "success": true,
  "message": "成功将 3 名学生升入 初二",
  "updated_count": 3,
  "errors": []
}
```

---

## 4) 统计与元数据

### 4.1 统计信息
- `GET /api/students/stats/`

#### 返回
```json
{
  "total_students": 100,
  "active_students": 90,
  "graduated_students": 8,
  "suspended_students": 2,
  "status_choices": ["在读", "转学", "休学", "复学", "毕业"],
  "grade_level_choices": ["初一", "初二", "初三", "高一", "高二", "高三"],
  "class_name_choices": ["1班", "2班", "3班"]
}
```

---

## 5) 导入模板与批量导入

### 5.1 下载导入模板
- `GET /api/students/download-template/`
- 返回 Excel 文件流。

### 5.2 批量导入
- `POST /api/students/batch-import/`
- `multipart/form-data`：
  - `file`：`.xlsx` / `.xls`

#### 返回（示例）
```json
{
  "success": true,
  "imported_count": 10,
  "failed_count": 2,
  "success_messages": [],
  "error_messages": [],
  "warning_messages": [],
  "failed_rows": [
    {"row": 5, "error": "学号和姓名为必填字段"}
  ]
}
```

---

## 6) 错误码

- `400`：参数错误/请求体不合法
- `401`：未认证
- `403`：无权限（非 admin/grade_manager 执行写操作）
- `404`：资源不存在
- `500`：服务器内部错误

---

## 7) 兼容策略（冻结）

- 前端以 `/api/students/*` 为唯一数据源。
- Django 模板页面路由后续将改为重定向层（在 Student 分离第 3 步实施）。

---

## 8) 变更流程要求

若调整本契约：
1. 先改本文档并注明变更日期与影响接口。
2. 前端同步改动并通过 `npm run build`。
3. 后端执行 `python manage.py check` 与 Student 相关测试。
4. 更新 `MIGRATION_TRACKER.md` 状态。
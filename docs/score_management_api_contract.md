# 成绩管理 API 契约（提交1）

- 版本：`v1`
- 日期：`2026-03-12`
- 适用范围：成绩管理、查询、批量导入导出、批量编辑
- 基础路径：`/api/scores/`

> 说明：本契约用于替代 `score_management_views.py` 对应的后端能力，供前端 `scores/*` 页面调用。

---

## 通用约定

### 认证
- 需要登录态（`Authorization: Bearer <token>`）。

### 响应
- JSON 接口统一使用：
```json
{
  "success": true,
  "message": "...",
  "data": {}
}
```
- 列表接口（`GET /api/scores/`）返回分页结构：
```json
{
  "count": 0,
  "num_pages": 0,
  "current_page": 1,
  "results": []
}
```
- 导出/模板下载接口返回 Excel 文件流。

### 权限
- 只读接口：登录即可。
- 写操作（新增/编辑/删除/导入）：管理员或级长。

---

## 1. 成绩列表与查询

### 1.1 列表聚合查询
- `GET /api/scores/`
- 用途：替代旧 `score_list` 与 `score_query_results` 的聚合结果。
- 常用查询参数：
  - `student_id_filter`
  - `student_name_filter`
  - `exam_filter`
  - `subject_filter` / `subject`（支持多值）
  - `grade_filter`
  - `class_filter`
  - `academic_year_filter`
  - `date_from_filter`
  - `date_to_filter`
  - `sort_by`（`total_score_desc|total_score_asc|student_name|exam_date|grade_rank`）
  - `subject_sort`
  - `sort_order`（`asc|desc`）
  - `page`
  - `page_size`（10~100）
  - `dynamic_subjects`（`true/false`）

### 1.2 查询筛选项
- `GET /api/scores/options/`
- 返回：考试选项、年级、班级、科目、学年、排序选项等。

### 1.3 学生搜索
- `GET /api/scores/student-search/?q=关键字`
- 返回：学生搜索结果（用于录入/编辑选择）。

---

## 2. 成绩录入与编辑

### 2.1 手工录入（新增）
- `POST /api/scores/manual-add/`
- 请求体：
```json
{
  "student_id": 1,
  "exam_id": 2,
  "scores": {
    "语文": 120,
    "数学": 130
  }
}
```

### 2.2 批量编辑详情（读取）
- `GET /api/scores/batch-edit-detail/?student=1&exam=2`
- 返回：学生信息、考试信息、已有成绩、科目满分。

### 2.3 批量编辑保存
- `POST /api/scores/batch-edit-save/`
- 请求体：
```json
{
  "student_id": 1,
  "exam_id": 2,
  "scores": {
    "语文": 118,
    "数学": 126,
    "英语": ""
  }
}
```
- 说明：空字符串会删除对应科目成绩。

---

## 3. 导入导出

### 3.1 下载导入模板
- `GET /api/scores/download-template/`

### 3.2 批量导入
- `POST /api/scores/batch-import/`
- `multipart/form-data` 参数：
  - `exam`：考试 ID
  - `excel_file`：Excel 文件

### 3.3 导出当前筛选结果
- `GET /api/scores/batch-export/`
- 支持与 `GET /api/scores/` 相同筛选参数。

### 3.4 导出查询结果
- `GET /api/scores/query-export/`
- 支持与 `GET /api/scores/` 相同筛选参数。

### 3.5 导出选中记录
- `POST /api/scores/batch-export-selected/`
- 请求体：
```json
{
  "selected_records": ["studentId_examId", "1_12"]
}
```

---

## 4. 删除能力

### 4.1 删除选中记录
- `POST /api/scores/batch-delete-selected/`
- 请求体：
```json
{
  "selected_records": ["1_12", "3_12"]
}
```

### 4.2 按筛选条件批量删除（本次新增）
- `POST /api/scores/batch-delete-filtered/`
- 用途：替代旧 `score_batch_delete_filtered`。
- 支持参数：与 `GET /api/scores/` 相同筛选字段（通过 query string 传入）。
- 返回：`deleted_count`。

### 4.3 获取当前筛选下全部记录键
- `GET /api/scores/select-all-record-keys/`
- 返回：`record_keys`（格式 `studentId_examId`）。

---

## 5. 与分析相关接口（已冻结）

以下接口仍属于 `ScoreViewSet`，分析契约详见 `docs/analysis_api_contract.md`：
- `GET /api/scores/student-analysis-data/`
- `GET /api/scores/class-analysis-single/`
- `GET /api/scores/class-analysis-multi/`
- `GET /api/scores/class-analysis-grade/`

---

## 迁移建议（前端）

- 旧 `scores/*` Django 模板页逐步替换为前端路由页面。
- 旧 AJAX 及表单提交统一改为上述 `/api/scores/*`。
- 等 `urls.py` 中 `score_management_views` 相关路由全部改 redirect 后，可删除该文件。

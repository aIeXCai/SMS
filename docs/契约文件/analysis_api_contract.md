# 成绩分析 API 契约（冻结版）

- 版本：`v1`
- 冻结日期：`2026-03-12`
- 适用范围：前端分析页面与后端 `ScoreViewSet` 分析接口
- 基础路径：`/api/scores/`

> 说明：本文档用于锁定分析 API 请求/响应结构，避免前后端隐式耦合与字段漂移。

---

## 通用约定

### 认证
- 需携带 `Authorization: Bearer <token>`。

### 响应外层结构
- 成功：
```json
{
  "success": true,
  "data": { ... }
}
```
- 失败：
```json
{
  "success": false,
  "error": "错误描述"
}
```

### 空值策略（冻结）
- 数值型统计字段（总分、均分、人数等）：无值时返回 `0`。
- 列表字段：无值时返回 `[]`。
- 排名字段：无排名时返回 `null`。
- 日期字段：无日期时返回 `null`。

### 排序规则（冻结）
- 学生分析中的考试序列：按 `date` 升序，其次 `id` 升序。
- 单班分析的 `subject_stats`：按 `SCORE_SUBJECT_CHOICES` 固定顺序输出。
- 多班分析：按前端传入班级 ID 顺序输出。

---

## 1) 学生个人分析

- 路径：`GET /api/scores/student-analysis-data/`

### 请求参数
- `student_id`（必填）
- `exam_ids`（可选，逗号分隔）
- `exam_id`（可选，兼容参数，单考试）

> 参数规则：
> - 优先使用 `exam_ids`。
> - 若未传 `exam_ids` 且传 `exam_id`，使用 `exam_id`。
> - 两者都不传时，默认取该学生参与过的全部考试。

### 成功响应字段
`data` 结构：
- `student_info`
  - `id: number`
  - `student_id: string`
  - `name: string`
  - `grade_level: string`
  - `class_name: string`
- `exams: ExamData[]`
  - `id, name, academic_year, exam_date, grade_level`
  - `scores: SubjectScore[]`
    - `subject_name: string`
    - `score_value: number`
    - `full_score: number`
    - `grade_rank: number | null`
    - `class_rank: number | null`
    - `percentage: number`
  - `total_score: number`
  - `average_score: number`
  - `grade_total_rank: number | null`
  - `class_total_rank: number | null`
- `subjects: string[]`
- `trend_data: Record<string, TrendItem>`
  - 每科及 `total` 都包含：
    - `class_ranks: (number|null)[]`
    - `grade_ranks: (number|null)[]`
    - `scores: (number|null)[]`
    - `exam_names: string[]`
    - `exam_ids: number[]`
- `summary`
  - `total_exams: number`
  - `subjects_count: number`

### 错误码
- `400`：缺少学生 ID
- `404`：学生不存在 / 未找到指定考试
- `500`：服务器错误

---

## 2) 单班分析

- 路径：`GET /api/scores/class-analysis-single/`

### 请求参数
- `exam`（必填，考试 ID）
- `grade_level`（可选）
- `academic_year`（可选）
- `selected_classes`（可选，单选；若含 `all` 返回 400）
- `class_name`（可选，兼容参数；仅允许一个）

> 参数规则：
> - 优先取 `selected_classes[0]`。
> - 否则使用 `class_name`。
> - 两者都无时返回 400。

### 成功响应字段
`data` 结构：
- `selected_exam`
  - `id, name, academic_year, grade_level, grade_level_display`
- `selected_grade: string`
- `academic_year: string`
- `target_class`
  - `id, grade_level, class_name`
- `total_students: number`
- `class_avg_total: number`
- `class_max_total: number`
- `class_min_total: number`
- `subject_stats: SubjectStat[]`
  - `code, name, avg_score, actual_max_score, actual_min_score, count, exam_max_score`
- `student_rankings: object[]`
- `chart_data: object`

### 错误码
- `400`：参数缺失、班级参数不合法、年级不一致
- `404`：考试不存在/班级不存在
- `500`：服务器错误

---

## 3) 多班对比分析

- 路径：`GET /api/scores/class-analysis-multi/`

### 请求参数
- `exam`（必填）
- `grade_level`（可选）
- `academic_year`（可选）
- `selected_classes`（可选，多选）
- `class_name`（可选，兼容参数，逗号分隔）

> 参数规则：
> - 先取 `selected_classes`（过滤 `all`）。
> - 若为空，则解析 `class_name`。
> - 有效班级数 `<2` 返回 400。

### 成功响应字段
`data` 结构：
- `selected_exam`
- `selected_grade: string`
- `academic_year: string`
- `selected_classes: string[]`（格式：`<grade><class_name>`）
- `class_statistics: object[]`
- `subjects: object[]`
- `total_students: number`
- `subject_count: number`
- `highest_avg: number`
- `chart_data: object`

### 错误码
- `400`：参数格式错误/班级不足/年级不一致
- `404`：考试不存在
- `500`：服务器错误

---

## 4) 年级分析

- 路径：`GET /api/scores/class-analysis-grade/`

### 请求参数
- `exam`（必填）
- `grade_level`（必填）
- `academic_year`（可选）

### 成功响应字段
`data` 结构：
- `selected_exam`
- `selected_grade: string`
- `academic_year: string`
- `total_students: number`
- `total_classes: number`
- `grade_avg_score: number`
- `excellent_rate: number`
- `class_statistics: object[]`
- `subjects: object[]`
- `total_max_score: number`
- `chart_data: object`

### 错误码
- `400`：缺少考试参数/缺少年级参数
- `404`：考试不存在
- `500`：服务器错误

---

## 兼容参数策略（冻结）

为平稳迁移，以下兼容参数暂时保留：
- `student-analysis-data` 中 `exam_id`
- `class-analysis-single`/`class-analysis-multi` 中 `class_name`

后续计划：在 A-04（旧 AJAX 下线）完成后，评估移除这些兼容参数。

---

## 变更流程要求

若后续需要调整本契约：
1. 先更新本文件并标注变更日期与影响范围。
2. 前端同步修改并通过构建验证。
3. 后端执行 `manage.py check` + 分析相关测试。
4. 在 `MIGRATION_TRACKER.md` 补充变更记录。

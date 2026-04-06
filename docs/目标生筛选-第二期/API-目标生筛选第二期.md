# 目标生筛选第二期 API 文档（冻结版）

- 版本: v1
- 冻结日期: 2026-04-06
- 适用范围: 目标生高级筛选、规则管理、变化追踪（快照与对比）
- 基础路径: /api/

## 通用约定

### 认证
- 所有接口均要求登录态。
- 前端请求头: Authorization: Bearer <token>

### 权限
- 只读接口（GET）: 任意已登录用户可访问。
- 写接口（POST/PUT/PATCH/DELETE）: 仅 admin / grade_manager / staff 可访问。
- 权限不足时返回 403。

### 通用错误结构
```json
{
  "message": "错误说明"
}
```

常见状态码:
- 200: 成功
- 201: 创建成功
- 400: 参数错误
- 403: 无权限
- 404: 资源不存在或无访问权限
- 500: 服务器错误

---

## 1. 高级筛选

### 1.1 执行高级筛选
- 路径: POST /api/students/advanced-filter/
- 权限: admin / grade_manager / staff

请求体:
```json
{
  "exam_id": 12,
  "logic": "AND",
  "conditions": [
    {
      "subject": "total",
      "dimension": "grade",
      "operator": "top_n",
      "value": 100
    }
  ]
}
```

字段说明:
- exam_id: 考试 ID（必填）
- logic: AND 或 OR
- conditions: 条件数组（至少 1 条）
  - subject: total/chinese/math/english/physics/chemistry/biology/history/geography/politics
  - dimension: grade/class
  - operator: top_n/bottom_n/range
  - value:
    - top_n/bottom_n: 正整数
    - range: [起始名次, 结束名次]

成功响应:
```json
{
  "count": 2,
  "logic": "AND",
  "condition_columns": [
    {
      "index": 1,
      "subject": "total",
      "subject_label": "总分",
      "dimension": "grade"
    }
  ],
  "students": [
    {
      "student_id": 101,
      "student_number": "F001",
      "name": "甲同学",
      "cohort": "初中2026级",
      "class_name": "1班",
      "total_rank": 1,
      "condition_details": [
        {
          "condition_index": 1,
          "subject": "total",
          "subject_label": "总分",
          "score": 680,
          "rank": 1
        }
      ]
    }
  ]
}
```

失败示例:
```json
{
  "message": "exam_id 为必填项"
}
```

---

## 2. 规则管理

### 2.1 获取规则列表
- 路径: GET /api/filter-rules/
- 权限: 登录可访问
- 返回: 当前用户自己的规则列表

### 2.2 创建规则
- 路径: POST /api/filter-rules/
- 权限: admin / grade_manager / staff

请求体:
```json
{
  "name": "总分前50",
  "rule_type": "advanced",
  "rule_config": {
    "logic": "AND",
    "conditions": [
      {
        "subject": "total",
        "dimension": "grade",
        "operator": "top_n",
        "value": 50
      }
    ]
  }
}
```

校验约束:
- rule_type 仅支持 simple / advanced
- rule_config.logic 仅支持 AND / OR
- rule_config.conditions 必须是非空数组
- conditions 中每一项必须是合法筛选条件

### 2.3 获取规则详情
- 路径: GET /api/filter-rules/{id}/
- 权限: 登录可访问
- 资源范围: 仅当前用户自己的规则；他人规则返回 404

### 2.4 更新规则
- 路径: PUT/PATCH /api/filter-rules/{id}/
- 权限: admin / grade_manager / staff
- 资源范围: 仅当前用户自己的规则；他人规则返回 404

### 2.5 删除规则
- 路径: DELETE /api/filter-rules/{id}/
- 权限: admin / grade_manager / staff

成功响应:
```json
{
  "message": "规则删除成功"
}
```

---

## 3. 快照管理

### 3.1 获取快照列表
- 路径: GET /api/filter-snapshots/
- 权限: 登录可访问
- 返回: 当前用户自己的快照列表

关键字段:
- id
- snapshot_name
- exam_name
- exam_academic_year
- rule_name
- student_count
- created_at

### 3.2 创建快照
- 路径: POST /api/filter-snapshots/
- 权限: admin / grade_manager / staff

请求体:
```json
{
  "snapshot_name": "期中-总分前50",
  "exam_id": 12,
  "rule_id": 5,
  "rule_config_snapshot": {
    "logic": "AND",
    "conditions": [
      {
        "subject": "total",
        "dimension": "grade",
        "operator": "top_n",
        "value": 50
      }
    ]
  },
  "result_snapshot": {
    "student_ids": [101, 102, 103],
    "count": 3
  }
}
```

校验约束:
- result_snapshot 必须为对象
- student_ids 必须为正整数数组，且不能重复
- count 必须是非负整数，且与 student_ids 数量一致
- rule_id 若传入，必须属于当前用户

### 3.3 删除快照
- 路径: DELETE /api/filter-snapshots/{id}/
- 权限: admin / grade_manager / staff

成功响应:
```json
{
  "message": "快照删除成功"
}
```

---

## 4. 快照对比

### 4.1 对比两个快照
- 路径: POST /api/filter-snapshots/compare/
- 权限: admin / grade_manager / staff

请求体:
```json
{
  "baseline_snapshot_id": 11,
  "comparison_snapshot_id": 12
}
```

成功响应:
```json
{
  "baseline": {
    "id": 11,
    "exam_name": "期中考试",
    "snapshot_name": "期中-总分前50",
    "created_at": "2026-04-06T13:00:00Z"
  },
  "comparison": {
    "id": 12,
    "exam_name": "期末考试",
    "snapshot_name": "期末-总分前50",
    "created_at": "2026-04-06T13:05:00Z"
  },
  "changes": {
    "added": [
      {
        "student_id": 203,
        "cohort": "初中2026级",
        "name": "丙同学",
        "class_name": "1班",
        "old_rank": null,
        "new_rank": 15,
        "rank_change": null
      }
    ],
    "removed": [],
    "retained": [
      {
        "student_id": 101,
        "cohort": "初中2026级",
        "name": "甲同学",
        "class_name": "1班",
        "old_rank": 5,
        "new_rank": 8,
        "rank_change": -3
      }
    ]
  },
  "summary": {
    "added_count": 1,
    "removed_count": 0,
    "retained_count": 1,
    "retention_rate": "50.00%"
  }
}
```

错误示例:
```json
{
  "message": "baseline_snapshot_id 和 comparison_snapshot_id 为必填项"
}
```

---

## 5. 兼容与冻结说明

- 对比结果学生字段口径已统一为 cohort（不再输出 student_number）。
- 快照列表返回 exam_academic_year，用于前端显示“学年 + 考试名称”。
- 本文档冻结后，如接口字段新增或变更，需同步更新该文档并在 DEV 文档记录变更日期。

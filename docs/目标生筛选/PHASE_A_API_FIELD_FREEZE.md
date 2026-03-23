# 阶段A产出2：接口字段冻结清单

- 文档版本：v1.0
- 所属阶段：A 需求冻结
- 创建日期：2026-03-23
- 对应接口：POST /api/scores/target-students-query/
- 状态：待评审

---

## 1. 接口概览

1. 接口名称：目标生筛选查询
2. Method：POST
3. Path：/api/scores/target-students-query/
4. 鉴权：登录即可（所有已登录员工可用）
5. 幂等性：幂等（只读查询）

---

## 2. 请求字段冻结

## 2.1 Request Body

```json
{
  "grade_level": "初二",
  "exam_scope": {
    "type": "all_in_grade",
    "exam_ids": [],
    "date_from": null,
    "date_to": null
  },
  "metric": "total_score_rank_in_grade",
  "operator": "lte",
  "threshold": 50,
  "quantifier": "all",
  "k": null,
  "absent_policy": "strict_fail"
}
```

## 2.2 字段定义

1. grade_level
- 类型：string
- 必填：是
- 枚举：初一/初二/初三/高一/高二/高三

2. exam_scope.type
- 类型：string
- 必填：是
- 枚举：all_in_grade/selected_exam_ids/date_range

3. exam_scope.exam_ids
- 类型：number[]
- 必填：条件必填（type=selected_exam_ids）
- 约束：数组长度>=1

4. exam_scope.date_from
- 类型：string|null
- 必填：条件必填（type=date_range）
- 格式：YYYY-MM-DD

5. exam_scope.date_to
- 类型：string|null
- 必填：条件必填（type=date_range）
- 格式：YYYY-MM-DD

6. metric
- 类型：string
- 必填：是
- 第一期开启值：total_score_rank_in_grade

7. operator
- 类型：string
- 必填：是
- 第一期开启值：lte

8. threshold
- 类型：integer
- 必填：是
- 约束：> 0

9. quantifier
- 类型：string
- 必填：是
- 枚举：all/at_least

10. k
- 类型：integer|null
- 必填：quantifier=at_least 时必填
- 约束：> 0

11. absent_policy
- 类型：string
- 必填：是
- 枚举：strict_fail/ignore_absent

---

## 3. 响应字段冻结

## 3.1 Success Response

```json
{
  "success": true,
  "data": {
    "rule_summary": {
      "grade_level": "初二",
      "metric": "total_score_rank_in_grade",
      "operator": "lte",
      "threshold": 50,
      "quantifier": "all",
      "k": null,
      "absent_policy": "strict_fail"
    },
    "exam_count": 6,
    "matched_count": 18,
    "students": [
      {
        "student_pk": 1024,
        "student_id": "20240201",
        "name": "张三",
        "class_name": "3班",
        "hit_count": 6,
        "required_count": 6,
        "participated_count": 6,
        "missed_exam_count": 0
      }
    ]
  }
}
```

## 3.2 字段定义

1. success：boolean
2. data.rule_summary：规则回显
3. data.exam_count：目标考试场次
4. data.matched_count：命中学生数
5. data.students：命中学生列表
6. students[].required_count：
- strict_fail + all：等于 exam_count
- ignore_absent + all：等于 participated_count

---

## 4. 错误码冻结

1. 400 BAD_REQUEST
- 参数缺失或非法
- exam_scope解析后无考试
- threshold/k不合法

2. 403 FORBIDDEN
- 权限不足

3. 500 INTERNAL_SERVER_ERROR
- 服务异常

错误响应格式：

```json
{
  "success": false,
  "error": "错误描述"
}
```

---

## 5. 兼容与扩展策略

1. 第一阶段冻结字段，不允许前端透传未定义字段。
2. 第二阶段扩展时新增字段必须保持向后兼容：
- 新字段默认可选
- 不改变现有字段语义

---

## 6. Mock用例

## 用例A：每次都前50

```json
{
  "grade_level": "初二",
  "exam_scope": {"type": "all_in_grade"},
  "metric": "total_score_rank_in_grade",
  "operator": "lte",
  "threshold": 50,
  "quantifier": "all",
  "k": null,
  "absent_policy": "strict_fail"
}
```

## 用例B：至少3次前30

```json
{
  "grade_level": "初二",
  "exam_scope": {"type": "all_in_grade"},
  "metric": "total_score_rank_in_grade",
  "operator": "lte",
  "threshold": 30,
  "quantifier": "at_least",
  "k": 3,
  "absent_policy": "ignore_absent"
}
```

---

## 7. 评审签字

1. 产品：__________
2. 后端：__________
3. 前端：__________
4. 测试：__________

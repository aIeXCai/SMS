# 阶段B输出物：后端自测报告（目标生筛选）

- 文档版本：v1.0
- 创建日期：2026-03-23
- 对应阶段：阶段B（后端开发）
- 对应接口：POST /api/scores/target-students-query/

---

## 1. 自测范围

本次自测覆盖以下内容：

1. 新增服务层：
- 文件：school_management/students_grades/services/target_student_service.py
- 核心函数：
  - validate_rule_payload
  - build_exam_scope
  - build_candidate_students
  - compute_student_hits
  - apply_quantifier
  - execute_target_student_rule

2. 新增接口层：
- 文件：school_management/students_grades/api_views.py
- action：target_students_query

3. 权限口径：
- 所有已登录员工可用（IsAuthenticated）

---

## 2. 自动化测试执行

执行命令：

```bash
python manage.py test school_management.students_grades.tests.score.test_target_students_query -v 2
```

执行结果：

1. 总用例数：8
2. 通过：8
3. 失败：0
4. 总耗时：约1.026s

---

## 3. 用例覆盖清单

1. test_requires_authentication
- 验证未登录访问被拒绝（401/403）。

2. test_all_with_strict_fail
- 验证 all + strict_fail 仅命中全场满足且无缺考的学生。

3. test_all_with_ignore_absent
- 验证 all + ignore_absent 对缺考学生按参与场次判定。

4. test_at_least_with_ignore_absent
- 验证 at_least(k=2) + ignore_absent 命中逻辑。

5. test_invalid_k_for_strict_fail_returns_400
- 验证 strict_fail 场景下 k > exam_count 返回400。

6. test_empty_exam_scope_returns_400
- 验证 exam_scope 解析为空时返回400。

7. test_pagination_works
- 验证超大结果分页返回结构与分页元数据。

8. test_invalid_page_size_returns_400
- 验证分页参数越界时返回400。

---

## 4. 功能结论

1. 规则执行主链路可用。
2. 关键分支（all/at_least + strict_fail/ignore_absent）行为符合冻结口径。
3. 参数边界与错误返回符合预期（400 + success=false + error）。
4. 接口鉴权已按新要求放开到全体已登录员工。
5. 已支持分页参数 page/page_size，具备超大结果集保护能力。

---

## 5. 已知未覆盖项（后续补充建议）

1. exam_scope=selected_exam_ids 细粒度覆盖（合法/非法ID混合场景）。
2. exam_scope=date_range 日期格式非法场景。
3. threshold 非法值（<=0）与 metric/operator 非法值。
4. 超大考试范围上限（>50）返回400验证。
5. 并列排名样本的结果稳定性验证。

---

## 6. 下一步建议

1. 进入阶段C前端开发联调。
2. 在阶段D前补齐“未覆盖项”中的高优先级测试。
3. 如进入性能压测，增加1000学生 x 10场考试的接口耗时记录。
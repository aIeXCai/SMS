# 目标生筛选功能产品开发文档（第一期）

- 文档版本：v1.1
- 创建日期：2026-03-22
- 适用阶段：第一期（MVP）
- 适用项目：SMS 学生成绩管理系统

---

## 1. 背景与问题

当前系统已经具备以下能力：

1. 成绩数据管理（录入、导入、编辑、查询）。
2. 年级/班级/学科排名字段的自动计算与异步更新。
3. 按考试、年级、班级等维度的分析查询。

但在“目标生识别”场景中，仍存在明显空白：

1. 缺少可配置规则的筛选能力。
2. 无法表达“跨多次考试”的持续性条件。
3. 教务/年级组只能手工导出后再二次统计，效率低且误差高。

典型需求示例：

- 筛选“初二年级每次考试都在年级前50名”的学生。
- 筛选“最近5次考试至少3次进入年级前30名”的学生。

---

## 2. 目标与非目标

## 2.1 产品目标（第一期）

1. 支持基于现有排名字段进行“目标生”自动筛选。
2. 支持跨考试时序条件（每次满足、至少K次满足）。
3. 提供可复用的统一规则结构，避免一次性做复杂表达式引擎。
4. 查询结果可用于后续导出和教研跟踪。

## 2.2 非目标（第一期不做）

1. 不做自由表达式（如自定义脚本、任意逻辑树）。
2. 不做多规则组 AND/OR 复杂嵌套。
3. 不做规则自动推荐与机器学习预测。
4. 不做规则审批流。

---

## 3. 目标用户与使用场景

## 3.1 目标用户

1. 管理员。
2. 级长（年级管理员）。
3. 教务分析人员。

## 3.2 核心场景

1. 年级组制定拔尖生名单。
2. 班主任识别稳定优生。
3. 阶段性质量分析会议前快速产出名单。

---

## 4. 功能范围（第一期）

第一期仅支持“单条件规则 + 时序量词”，规则结构固定为：

1. 作用范围（Scope）：年级 + 考试集合。
2. 指标（Metric）：总分年级排名。
3. 比较条件（Condition）：小于等于阈值（<= N）。
4. 时序量词（Quantifier）：每次满足（ALL）或至少K次满足（AT_LEAST）。
5. 缺考策略（Absent Policy）：严格失败或忽略缺考。

---

## 5. 规则模型设计

## 5.1 规则请求结构

```json
{
  "grade_level": "初二",
  "exam_scope": {
    "type": "all_in_grade"
  },
  "metric": "total_score_rank_in_grade",
  "operator": "lte",
  "threshold": 50,
  "quantifier": "all",
  "k": null,
  "absent_policy": "strict_fail"
}
```

## 5.2 字段定义

1. grade_level
- 类型：string
- 必填
- 枚举：初一/初二/初三/高一/高二/高三

2. exam_scope
- 类型：object
- 必填
- 支持类型：
  - all_in_grade：该年级所有考试
  - selected_exam_ids：指定考试
  - date_range：按日期范围筛选该年级考试

3. metric
- 类型：string
- 必填
- 第一期开启值：total_score_rank_in_grade

4. operator
- 类型：string
- 必填
- 第一期开启值：lte

5. threshold
- 类型：number
- 必填
- 说明：阈值N，表示“前N名”

6. quantifier
- 类型：string
- 必填
- 枚举：all, at_least

7. k
- 类型：number|null
- 条件必填：quantifier=at_least

8. absent_policy
- 类型：string
- 必填
- 枚举：
  - strict_fail：缺考视为不满足
  - ignore_absent：缺考不计入分母

---

## 6. 规则执行口径（业务定义）

## 6.1 基础集合

1. 先根据 grade_level 与 exam_scope 生成目标考试集合 E。
2. 候选学生集合 S：该年级有学籍记录的在读学生（第一期建议默认在读，可配置扩展）。

## 6.2 单次考试命中判定

对每个学生 s 和考试 e：

- 若存在总分年级排名 rank(s,e)，则命中条件为 rank(s,e) <= threshold。
- 若不存在该考试数据（缺考），按 absent_policy 处理。

## 6.3 跨考试判定

1. quantifier = all
- strict_fail：要求命中次数 = |E|。
- ignore_absent：要求“参与考试中的命中率为100%”，且参与次数 >= 1。

2. quantifier = at_least
- strict_fail：要求命中次数 >= k，且考试集合固定为 E。
- ignore_absent：要求命中次数 >= k，缺考不计入失败。

## 6.4 边界规则

1. 若 E 为空，返回400（提示：该范围内无考试）。
2. 若 threshold <= 0，返回400。
3. 若 quantifier=at_least 且 k <= 0 或 k > |E|（strict_fail场景），返回400。
4. 排名并列按现有排名写入结果直接使用，不二次改写。

---

## 7. 接口设计（第一期）

## 7.1 查询接口

- Method：POST
- Path：/api/scores/target-students-query/
- 权限：登录即可（所有已登录员工可用）
- 说明：执行规则筛选并返回命中学生列表

请求体：使用第5章结构。

成功响应示例：

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

失败响应示例：

```json
{
  "success": false,
  "error": "该范围内无考试数据"
}
```

## 7.2 选项接口（可选，推荐）

- Method：GET
- Path：/api/scores/target-students-options/
- 说明：返回规则配置所需枚举与考试选项。

---

## 8. 后端实现方案

## 8.1 实现位置

1. View 层：ScoreViewSet 新增 action。
2. Service 层：新增规则执行函数（建议 placement：students_grades/services/target_student_service.py）。
3. 不改动现有 Score 表结构。

## 8.2 关键步骤

1. 参数校验。
2. 解析 exam_scope 生成 E。
3. 拉取该年级候选学生。
4. 基于 Score 聚合每个学生在 E 中的总分年级排名。
5. 计算 hit_count / participated_count / missed_exam_count。
6. 按 quantifier + absent_policy 判定是否命中。
7. 返回列表并支持排序（默认按 hit_count desc、missed_exam_count asc、student_id asc）。

## 8.3 性能建议

1. 仅查询所需字段（values / values_list）。
2. 避免循环内重复查询考试或学生。
3. 对考试范围做上限控制（例如最多50场，防止异常请求）。
4. 若后续规则复杂度提升，再引入“学生-考试聚合快照”。

---

## 9. 前端实现方案（第一期）

## 9.1 页面形式

建议新增页面或分析页内新Tab：目标生筛选。

## 9.2 最小交互组件

1. 年级选择。
2. 考试范围选择（全部/指定/日期范围）。
3. 阈值输入（前N名）。
4. 量词选择（每次都满足 / 至少K次）。
5. K值输入（条件显示）。
6. 缺考策略选择。
7. 查询按钮。
8. 结果表格与导出按钮（第一期可复用已有导出逻辑，或先仅展示）。

## 9.3 前端校验

1. threshold 必须为正整数。
2. at_least 模式下 k 必填且 > 0。
3. 日期范围合法（开始<=结束）。

---

## 10. 权限与安全

1. 查询接口对所有已登录员工开放。
2. 防止超大范围请求导致高负载：
- 考试数量上限。
- 分页返回（可选）。
3. 记录审计日志（可选）：谁在何时执行了何规则。

---

## 11. 异常处理与提示文案

1. 无考试数据：当前筛选范围内没有可用考试，请调整条件。
2. 参数非法：规则参数不合法，请检查后重试。
3. 无命中学生：已完成筛选，暂无符合条件的学生。
4. 服务异常：系统繁忙，请稍后重试。

---

## 12. 验收标准（UAT）

## 12.1 功能正确性

1. 场景A：初二每次考试前50，结果与人工核对一致。
2. 场景B：初二至少3次前30，结果正确。
3. 场景C：缺考策略切换后，名单变化符合定义。

## 12.2 边界测试

1. 无考试范围。
2. threshold 非法值。
3. k 大于考试场次。
4. 学生全体缺考。

## 12.3 性能目标（建议）

1. 年级1000人、考试10场：接口 P95 < 2s。
2. 年级2000人、考试20场：接口 P95 < 4s。

---

## 13. 里程碑与排期建议

1. D1-D2：需求冻结 + 接口契约确认。
2. D3-D5：后端 action + service 开发与自测。
3. D6-D7：前端页面开发。
4. D8：联调与修复。
5. D9：UAT与验收。
6. D10：灰度上线。

## 13.1 详细开发步骤（可执行）

阶段A：需求冻结（D1-D2）(FINISHED)

1. 召开规则口径评审会（产品+后端+前端+教务）。
2. 冻结以下口径：exam_scope、quantifier、absent_policy。
3. 准备并确认验收对照样本（至少3条规则，含缺考案例）。
4. 输出物：
- 规则口径确认记录。(PHASE_A_RULE_CALIBRATION.md)
- 接口字段冻结清单。(PHASE_A_API_FIELD_FREEZE.md)
- 验收样本对照表。(PHASE_A_UAT_SAMPLE.md)

阶段B：后端开发（D3-D5）(FINISHED)

1. 新增服务层（建议文件：students_grades/services/target_student_service.py）。(FINISHED)
2. 拆分函数：(FINISHED)
- build_exam_scope：解析考试范围。
- build_candidate_students：生成候选学生集合。
- compute_student_hits：计算命中次数和缺考次数。
- apply_quantifier：按规则判定是否命中。
3. 在 ScoreViewSet 增加 target-students-query action。(FINISHED)
4. 在 get_permissions 纳入该 action（防止权限遗漏）。(FINISHED)
5. 增加基础性能保护：(FINISHED)
- 考试范围上限建议50场。
- 超大结果集分批返回或分页（已支持分页参数 page/page_size，最大 page_size=1000）。
6. 输出物：(FINISHED)
- 可联调接口。（/api/scores/target-students-query/）
- 后端自测报告（准确性+边界+性能）。（PHASE_B_BACKEND_SELF_TEST_REPORT.md）

阶段C：前端开发（D6-D7）(IN_PROGRESS)

1. ~~实现规则配置区：年级、考试范围、阈值、量词、K值、缺考策略。~~ ✅ FINISHED
2. ~~实现参数联动：quantifier=at_least 时显示并校验 K。~~ ✅ FINISHED
3. 实现结果表：学号、姓名、班级、hit_count、required_count、participated_count、missed_exam_count。
4. 实现加载态、空态和错误态提示。（加载态✅ 错误态✅ 空态❌）
5. 输出物：
- 可交互页面。
- 前端自测清单。

阶段D：联调与UAT（D8-D9）

1. 用验收样本逐条比对接口输出。
2. 校验 strict_fail / ignore_absent 两种策略差异。
3. 校验边界：无考试、全缺考、k非法、阈值非法。
4. 输出物：
- 联调问题清单与闭环记录。
- UAT签字记录。

阶段E：灰度上线（D10）

1. 先对管理员灰度开放。
2. 观察24小时后对级长开放。
3. 监控指标：错误率、P95耗时、请求量。
4. 输出物：
- 灰度发布记录。
- 上线复盘纪要。

## 13.2 开发规划（WBS）

工作包WP-1：规则与契约冻结

1. 输入：本PRD草案。
2. 产出：冻结版字段与错误码。
3. 负责人建议：产品 + 后端。
4. 工时建议：1.5天。

工作包WP-2：规则引擎服务层

1. 输入：冻结版契约、现有 Score 排名数据。
2. 产出：可复用规则执行函数。
3. 负责人建议：后端。
4. 工时建议：1.5天。

工作包WP-3：接口接入与权限

1. 输入：规则服务函数。
2. 产出：/api/scores/target-students-query/。
3. 负责人建议：后端。
4. 工时建议：1天。

工作包WP-4：前端页面与交互

1. 输入：冻结版接口。
2. 产出：目标生筛选页面（MVP）。
3. 负责人建议：前端。
4. 工时建议：2天。

工作包WP-5：联调与UAT

1. 输入：前后端联调版本。
2. 产出：UAT通过版本。
3. 负责人建议：测试 + 教务。
4. 工时建议：1.5天。

工作包WP-6：上线与复盘

1. 输入：UAT通过版本。
2. 产出：灰度上线、监控与复盘。
3. 负责人建议：后端 + 产品。
4. 工时建议：0.5天。

## 13.3 每日推进计划（建议模板）

1. D1：完成需求口径评审与分歧闭环。
2. D2：完成接口字段冻结与验收样本准备。
3. D3：完成服务层骨架与参数校验。
4. D4：完成命中计算与量词判定。
5. D5：完成接口联通、权限接入和后端自测。
6. D6：完成前端规则面板与参数联动。
7. D7：完成结果展示与异常处理。
8. D8：完成联调修复与回归。
9. D9：完成UAT签字。
10. D10：灰度上线并观察监控。

## 13.4 上线门禁与回滚

上线门禁：

1. P0/P1缺陷清零。
2. UAT签字完成。
3. 接口性能达到目标（第12.3节）。

回滚预案：

1. 通过功能开关关闭目标生入口。
2. 前端隐藏入口并回退到分析页默认视图。
3. 第一阶段不写库，无数据回滚成本。

---

## 14. 风险与应对

1. 风险：考试范围定义不清导致争议。
- 应对：exam_scope 明确定义并在页面可视化显示已选考试。

2. 风险：缺考口径不统一。
- 应对：强制选择 absent_policy，并在结果中展示 missed_exam_count。

3. 风险：后续需求膨胀（多条件组合）。
- 应对：第一期锁定单条件，第二期再扩展规则树。

---

## 15. 第二期演进方向（预留）

1. 多条件组合（AND/OR）。
2. 支持学科维度规则（如数学级排前30）。
3. 连续K次、最近K次等更多量词。
4. 规则保存、命名、复用与共享。
5. 规则结果快照与历史对比。

---

## 16. 附录：示例规则

示例1：每次都前50

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

示例2：至少3次前30

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

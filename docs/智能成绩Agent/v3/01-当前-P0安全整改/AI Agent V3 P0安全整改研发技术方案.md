# AI Agent V3 P0 安全整改研发技术方案

> 角色：研发部  
> 日期：2026-07-13  
> 状态：待产品部评审  
> 对应 Brief：`AI Agent V3 P0安全整改需求 Brief.md`  
> 优先级：P0

---

## 一、需求理解

本次 V3 P0 安全整改不是新增 AI 能力，而是给现有 ReAct Agent 增加安全边界。

需要优先解决四类问题：

1. 所有 Agent Tool 必须统一执行现有成绩访问权限规则。
2. 分数、排名、人数、变化量等关键数字必须由后端确定性生成或校验。
3. 发送给 MiniMax 的学生数据必须保持最小必要。
4. V3 异常时只允许对白名单简单查询降级，复杂问题不得回退 V1。

当前代码现状：

- V3 ReAct 主流程集中在 `school_management/students_grades/ai_agent/agent.py`。
- Tool 注册和执行集中在 `school_management/students_grades/ai_agent/tools/registry.py`。
- 现有权限服务为 `school_management/students_grades/services/score_access_service.py`。
- 当前 Agent API 已做登录校验，但 Tool 内部尚未统一套用权限作用域。

---

## 二、实现阶段判断

当前任务属于：

**上线前 P0 安全整改阶段。**

原因：

- V3 已具备 ReAct Tool 调用能力。
- 后续计划扩大到全校教师使用。
- 涉及成绩权限、外部模型数据暴露、关键数字可信度和异常降级。
- 任一 P0 未完成，都不建议扩大使用范围。

---

## 三、技术可行性判断

本次整改可实现，且应作为一个安全版本整体交付。

有利条件：

- 已有 `ScoreAccessService`，可以复用现有权限口径。
- V3 Tool 注册入口集中，适合增加统一安全执行层。
- V3 API 入口集中，便于构建用户权限上下文。

主要风险：

- 当前 Tool 函数直接查 ORM，函数签名未携带用户权限上下文。
- 当前 LLM 可生成 Markdown 表格，关键数字存在被改写风险。
- 当前 V3 异常会直接回退 V1，复杂问题可能被误降级。

---

## 四、推荐技术方案

### 4.1 总体安全执行流程

建议改造为：

```text
身份认证
→ 构建 AgentSecurityContext
→ LLM 选择 Tool
→ SecureToolExecutor 校验 Tool
→ 参数标准化
→ 应用 ScoreAccessService 权限作用域
→ 执行确定性查询与计算
→ 生成结构化结果与 numeric_facts
→ 最小化发送给 MiniMax 的 Tool observation
→ LLM 生成非权威说明
→ NumericGuard 校验关键数字
→ AuditLogger 记录脱敏审计日志
→ 返回前端
```

任何 Tool 都不能绕过：

- 权限过滤
- 参数校验
- 结果最小化
- 审计记录

### 4.2 权限控制方案

新增统一权限上下文：

```python
@dataclass
class AgentSecurityContext:
    user_id: int
    role: str
    allowed_class_ids: list[int] | None
    is_unrestricted: bool
    deny_reason: str | None
```

权限规则沿用 `ScoreAccessService`：

| 角色 | Agent 可查询范围 | 配置缺失 |
|---|---|---|
| `admin` | 全校 | 不适用 |
| `staff` | 全校 | 不适用 |
| `grade_manager` | `managed_grade` 对应年级 | 拒绝 |
| `subject_teacher` | `teaching_classes` 对应班级 | 拒绝 |
| 未知角色 | 无 | 拒绝 |

越权或无权限统一返回：

```text
未找到符合条件且你有权限查看的数据，请检查查询范围或联系管理员。
```

返回中不得暴露：

- 目标学生是否存在。
- 目标考试是否存在。
- 目标所属班级或年级。
- 被拒绝的具体权限关系。

### 4.3 Tool 安全执行方案

将当前：

```python
execute(tool_name, args)
```

升级为：

```python
execute(tool_name, args, security_context, audit_context)
```

建议定义 Tool 元信息：

```python
@dataclass
class ToolSpec:
    name: str
    schema: dict
    handler: Callable
    allowed_roles: set[str]
    complexity: str
    fallback_allowed: bool
    returns_key_numbers: bool
```

执行规则：

1. 未注册 Tool 拒绝执行。
2. 未声明安全元信息的 Tool 不允许注册给 LLM。
3. Tool 参数中的 `student_id`、`exam_id`、`class_name`、`cohort` 只代表查询意图，不能作为授权依据。
4. 查询 `Student`、`Class`、`Exam`、`Score` 时必须应用 `ScoreAccessService.scope_*`。
5. 多轮上下文和追问 payload 中的对象也必须重新执行权限校验。

### 4.4 关键数字校验方案

后端结构化结果是唯一权威来源。

关键数字包括：

- 分数、总分、均分、最高分、最低分。
- 名次、总人数、并列关系。
- 分差、占比、权重、加权分。
- 分数变化量、排名变化量。
- 样本数量、考试数量、有效记录数量。

建议 Tool 返回分为三层：

```json
{
  "frontend_result": {
    "tables": [],
    "evidence": {}
  },
  "llm_observation": {
    "summary_facts": []
  },
  "numeric_facts": [
    {
      "key": "rank",
      "value": 3,
      "source": "tool:get_top_n.rows[2].rank"
    }
  ]
}
```

LLM 可以生成自然语言说明，但不能新增 Tool 结果中不存在的关键数字。

返回前由 `NumericGuard` 校验：

- LLM 文本中的关键数字必须能在 `numeric_facts` 中找到。
- LLM 文本和结构化表格冲突时，以结构化表格为准。
- 校验失败时不展示可疑结果。

校验失败返回：

```text
数据已经完成计算，但结果说明未能通过一致性校验。本次未展示结果，请重新生成。
```

### 4.5 MiniMax 数据最小化方案

新增 `ToolResultMinimizer`，控制发送给 MiniMax 的字段。

禁止发送：

- 学号。
- 手机号、邮箱、身份证号、家庭信息。
- 登录账号和权限配置详情。
- 与当前问题无关的学生名单和成绩明细。
- 数据库内部字段、原始 SQL、密钥、完整异常堆栈。

示例：Top N 场景只发送：

```json
{
  "result_type": "top_n",
  "exam_name": "期末",
  "scope_label": "初二格致班",
  "metric": "数学",
  "rows": [
    {
      "display_name": "张三",
      "class_name": "1班",
      "score": 100,
      "rank": 1
    }
  ],
  "valid_count": 42,
  "ranking_rule": "competition_rank"
}
```

不发送：

- 学号。
- 数据库 ID。
- 完整榜单。
- 无关学生成绩。
- 权限配置详情。

### 4.6 降级策略方案

新增 `FallbackPolicy`，移除无条件 V1 fallback。

允许降级白名单第一版只包含：

1. 明确考试、明确范围、明确 Top N 的单轮排名。
2. 明确学生、明确考试、明确排名范围的单学生排名。

禁止降级：

- 多轮追问。
- 学生趋势。
- 加权排名。
- 群体对比。
- 解释上一轮结果。
- 导出请求。
- 取消或重置。
- 权限失败。
- 数字校验失败。
- Tool 已执行后失败。
- 模糊考试、模糊学生、模糊范围。

禁止降级返回：

```text
AI 成绩分析服务暂时不可用。为了避免返回不准确的结果，本次没有执行降级查询，请稍后重试。
```

### 4.7 审计日志方案

新增脱敏审计日志，至少记录：

- `request_id`
- 用户 ID、角色
- 权限范围摘要
- 用户问题脱敏摘要
- Tool 名称、调用顺序、参数摘要、耗时
- 是否权限拒绝
- 是否数据最小化
- 是否数字校验
- 是否降级、降级原因、白名单类型
- 最终状态

不得记录：

- MiniMax API Key
- 完整成绩明细
- 学号
- 手机号、身份证号、邮箱
- 完整异常堆栈
- LLM 隐式推理过程

---

## 五、文件结构建议

```text
school_management/students_grades/ai_agent/
  agent.py
  service_v2.py
  tools/
    registry.py
  security/
    __init__.py
    context.py
    permissions.py
    secure_executor.py
    minimizer.py
    numeric_guard.py
    fallback_policy.py
    audit.py
```

关键文件说明：

| 文件 | 作用 |
|---|---|
| `context.py` | 构建当前用户的 Agent 权限上下文 |
| `permissions.py` | 封装 Agent 侧权限判断 |
| `secure_executor.py` | 唯一 Tool 安全执行入口 |
| `minimizer.py` | 最小化发送给 MiniMax 的 Tool 结果 |
| `numeric_guard.py` | 关键数字抽取和一致性校验 |
| `fallback_policy.py` | V3 到 V1 的白名单降级判断 |
| `audit.py` | 脱敏审计日志 |

---

## 六、实现步骤

1. 新增 `AgentSecurityContext`，在 Agent API 入口构建权限上下文。
2. 改造 `registry.execute`，统一传入 `security_context` 和 `audit_context`。
3. 给现有 8 个 Tool 套用权限过滤。
4. 拆分 Tool 返回结构：`frontend_result`、`llm_observation`、`numeric_facts`。
5. 改造 `agent.py`，禁止使用 LLM Markdown 表格作为权威表格。
6. 新增 `NumericGuard`，返回前校验关键数字。
7. 新增 `FallbackPolicy`，替换当前无条件 V1 fallback。
8. 新增脱敏审计日志。
9. 补权限、错数、脱敏、降级四类自动化测试。
10. 增加灰度和紧急关闭开关。

---

## 七、测试方案

研发自动化测试建议覆盖：

### 7.1 权限测试

- `admin/staff` 可查询全校。
- `grade_manager` 只能查询 `managed_grade`。
- `subject_teacher` 只能查询 `teaching_classes`。
- 权限配置缺失时拒绝。
- 多轮追问不能绕过权限。
- Tool 参数伪造班级或学生 ID 不能越权。

### 7.2 关键数字测试

- LLM 改写分数时拦截。
- LLM 新增不存在排名时拦截。
- LLM 表格与后端结构化表格冲突时拦截。
- 校验失败不得展示可疑结果。

### 7.3 数据最小化测试

- MiniMax payload 不包含学号。
- 不包含手机号、邮箱、身份证号。
- 不包含权限配置详情。
- Top N 不发送完整榜单。
- 群体对比只发送聚合指标。

### 7.4 降级测试

- 简单 Top N 可降级。
- 明确单学生排名可降级。
- 趋势、加权、群体对比禁止降级。
- 多轮追问禁止降级。
- 权限失败禁止降级。
- 数字校验失败禁止降级。

### 7.5 审计测试

- 记录 request_id、用户、角色、Tool 链路和最终状态。
- 不记录 API Key。
- 不记录完整成绩明细。
- 不记录敏感字段。

---

## 八、回滚方案

建议保留以下开关：

```text
AI_AGENT_V3_ENABLED=false
AI_AGENT_V3_SAFE_MODE=true
AI_AGENT_V3_FALLBACK_ENABLED=false
AI_AGENT_AUDIT_LOG_ENABLED=true
```

回滚策略：

| 场景 | 处理 |
|---|---|
| V3 整体异常 | 关闭 `AI_AGENT_V3_ENABLED` |
| 降级风险异常 | 关闭 `AI_AGENT_V3_FALLBACK_ENABLED` |
| 安全风险未定位 | 开启 `AI_AGENT_V3_SAFE_MODE`，仅保留白名单简单查询 |
| 审计问题 | 单独调整 `AI_AGENT_AUDIT_LOG_ENABLED` |

发布建议：

1. 测试环境全量开启。
2. 小范围教师灰度。
3. 观察越权拦截次数、数字校验失败率、V1 降级率、平均 Tool 次数、LLM 错误率。
4. 指标稳定后再扩大范围。

---

## 九、简化说明

本次不建议做：

- 独立 AI 治理平台。
- 全量 Prompt 安全系统。
- 新角色体系。
- 新增预测、评价、学情诊断。
- 前端对话系统重构。

当前 P0 重点是：

> 权限不能漏，数字不能假，数据不能多发，复杂问题不能错误降级。

---

## 十、产品反馈说明

当前需求已由产品部确认，可进入开发拆分和实现。

产品部确认口径：

1. `subject_teacher` 仅限制到任教班级，暂不限制任教学科，沿用现有 `teaching_classes` 权限模型。
2. 审计日志不保留学生明文姓名，使用学生内部 ID 和脱敏姓名；不得记录学号、完整成绩明细、原始 LLM 请求体及密钥。

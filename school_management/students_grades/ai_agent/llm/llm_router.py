"""LLM-based intent router using MiniMax M3 (OpenAI-compatible API).

Responsible for natural language understanding only — never touches data or
calculation. Returns structured intent JSON; on failure HybridIntentRouter
falls back to the deterministic RuleBasedIntentRouter.
"""

import json
import logging
import re

import requests
from django.conf import settings

# Legacy V2 schema constants (kept for remaining parse() method)
DIALOG_ACTS = ["new_task", "explain_result", "export_result", "reset", "unknown", "clarification_answer"]
SUPPORT_STATUSES = ["supported", "needs_clarification", "unsupported"]
TASK_TYPES = ["ranking", "trend", "student_trend", "weighted_ranking", "group_comparison", None]


def empty_intent(message):
    return {
        "dialog_act": "unknown",
        "task_type": None,
        "support_status": "needs_clarification",
        "confidence": 0.0,
        "entities": {},
        "missing_slots": ["intent"],
    }

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Current business context — lives here so the prompt stays accurate.
# Hard-coded for now (same source as business_groups.json).
# ---------------------------------------------------------------------------
BUSINESS_CONTEXT = """【学校班级分组规则】
数据库中没有"南山班""格致班""创新班"这些字段名，它们是人定的业务分组：

初中2024级（初二）:
  格致班 = 1班、2班、3班、4班、5班、6班
  南山班 = 7班、8班、9班、10班、11班、12班、13班
  创新班 = 14班、15班、16班、17班

初中2025级（初一或初二）:
  班级分组暂未配置，如用户提到这些年级的南山/格致/创新，需要提醒。

当用户提到分组名时，将其替换为对应的班级列表。
"""

# ---------------------------------------------------------------------------
# System prompt that instructs the LLM to output pure JSON intent.
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """你是一个成绩分析助手的意图解析器。你的唯一任务是理解用户问题并输出 JSON 意图描述。

## 输出格式（严格 JSON，不要 markdown 代码块）

{
  "dialog_act": "new_task | follow_up | explain_result | export_result | clarification_answer | reset | unknown",
  "task_type": "ranking | student_trend | group_comparison | weighted_ranking | unsupported | null",
  "support_status": "supported | needs_clarification | unsupported",
  "confidence": 0.0-1.0,
  "entities": {"student_name": null, "grade_level": null, "cohort": null},
  "target_scope": {"type": "class | business_group | grade", "name": null, "class_names": []},
  "exam_selector": {"exam_ids": [], "terms": ["期中","期末","latest"], "count": null},
  "subject_scope": {"subject": null},
  "ranking": {"top_n": null, "by": "total | subject"},
  "trend": {"time_range": "recent_N", "rank_scope": "class | grade | group | null"},
  "weighted": {"weights": []},
  "comparison": {"label_a": null, "label_b": null, "operation": "ratio | difference | cross_rank"},
  "context_patch": {},
  "missing_slots": [],
  "unsupported_type": null,
  "reason": ""
}

## dialog_act 含义

- new_task: 任何成绩分析任务（含上下文追问）。如果上一轮上下文存在，根据上下文补全用户未明说的字段（年级、考试范围、分析类型等），但替换用户明确改动的字段（学生名、科目名）。**无论任务多简单，始终输出完整的 JSON，不要只输出部分变更。**
- follow_up: 后续可能会废弃，统一用 new_task 带完整上下文
- explain_result: 问"为什么没排名""怎么算的"等结果解释
- export_result: 要求导出 Excel/文件
- clarification_answer: 用户回答了你上一轮的追问（如选年级、选考试范围）
- reset: 用户要清除上下文重新开始（"重新开始""取消"）
- unknown: 与成绩分析无关或无法确定意图的问题

## task_type 含义

- ranking: 排名查询（"前X名""排第几"）
- student_trend: 学生多次考试成绩/排名趋势变化
- group_comparison: 跨班级或班级vs业务分组的对比、占比、排位
- weighted_ranking: 多场考试加权排名（"期中期末 6:4"）
- unsupported: 明确不支持的功能（预测、分组内趋势等）
- null: 不需要任务类型的动作（解释、导出等）

## 分类规则

### 不支持的情况（task_type: "unsupported"）
1. 班级在业务分组内的多次排名趋势：如"810班在南山班历次排名变化"
   → unsupported_type: "class_group_trend"
2. 预测成绩："张三期末能考多少"
   → unsupported_type: "prediction"
3. 班级/分组进退步分析
   → unsupported_type: "group_progress"
4. 与成绩分析完全无关的闲聊
   → unsupported_type: "non_score_query"
5. 导出成绩但无上一轮结果
   → unsupported_type: "export_not_available"

### 需要追问的情况（support_status: "needs_clarification"）
- 只说了"我们班""这次""上次""最近"但未指明具体班级/考试 → missing_slots 填入缺失项
- 学生姓名不唯一（如两个"张三"）
- 不够明确的意图 → confidence < 0.5, dialog_act: "unknown"

**不要对明确信息追问**：如果用户说了"初二下学期期末模拟考"这种具体考试名称，直接设 support_status="supported"，把具体术语放进 exam_selector.terms，让后端去匹配。不要把 "exam" 放进 missing_slots。

### 询问类（不是成绩分析任务）
- "怎么导出Excel" → dialog_act: "export_result", task_type: null
- "为什么没排名" → dialog_act: "explain_result", task_type: null

#### 权重解析
- "期中期末 6:4 加权": task_type: "weighted_ranking", weighted: {weights: [60, 40]}（归一化到 0-1）
- "期中 60% 期末 40%": 同样处理
- 没给权重但要求加权: 需要追问, missing_slots: ["weight"]

#### 学生趋势中的排名范围
- 如果问题是"张三排名变化如何"没说是班内/年级/分组内的排名 → 需要追问 rank_scope
- 如果明确说了"张三年级排名" → trend.rank_scope: "grade"
- 没说排名只问分数趋势 → trend.rank_scope: null

#### 对比操作
- "对比一班和二班英语": task_type: "group_comparison", comparison.operation: "difference"
- "10班在南山班排第几": task_type: "group_comparison", comparison.operation: "cross_rank"
- "10班数学在南山班占比": task_type: "group_comparison", comparison.operation: "ratio"

## 关键原则

1. 只输出 JSON，不要有任何解释文字
2. confidence 反映你对意图理解的把握
3. 不确定就降 confidence 或设 dialog_act 为 "unknown"
4. **简略追问（"那数学呢""刘畅呢""期末模拟考呢"）→ dialog_act: "new_task"**
   - 根据上一轮上下文，补全用户未明说的所有字段，只替换用户明确改动的那一个
   - 输出完整 JSON，不要只输出部分字段
5. 成绩分析之外的问题标记为 unsupported
6. **target_scope 含义**：
   - 「初二14班李业升年级排名」 → target_scope.type='grade'（排名范围是年级），class_names 仅用于定位学生
   - 「初二14班前三」 → target_scope.type='class', class_names=['14班']（排名范围是班级）
   - 「初二格致班前三」 → target_scope.type='business_group', name='格致'"""


class LLMResponse:
    """Parsed LLM response for V3 ReAct agent loop."""

    def __init__(self, raw):
        self.raw = raw
        self.finish_reason = None
        self.text = None
        self.tool_calls = []
        self._parse()

    def _parse(self):
        choices = self.raw.get("choices") or []
        if not choices:
            return
        message = choices[0].get("message") or {}
        self.finish_reason = choices[0].get("finish_reason", "stop")
        self.text = (message.get("content") or "").strip()

        tc_list = message.get("tool_calls") or []
        for tc in tc_list:
            func = tc.get("function") or {}
            name = func.get("name", "")
            try:
                args = json.loads(func.get("arguments", "{}"))
            except json.JSONDecodeError:
                args = {}
            self.tool_calls.append({
                "id": tc.get("id", ""),
                "name": name,
                "arguments": args,
            })

    def is_tool_call(self):
        return len(self.tool_calls) > 0 and self.finish_reason == "tool_calls"

    def is_stop(self):
        return not self.tool_calls and self.text


class LLMIntentRouter:
    """Call MiniMax M3. Supports both V2 intent parsing and V3 function calling."""

    def __init__(self, model=None, api_key=None, base_url=None):
        self.model = model or settings.MINIMAX_MODEL
        self.api_key = api_key or settings.MINIMAX_API_KEY
        self.base_url = (base_url or settings.MINIMAX_BASE_URL).rstrip("/")

    # ---- V3: ReAct function-calling conversation ----
    def chat_with_tools(self, messages, tools):
        """Send a conversation (with tools) to LLM and return structured response.

        Args:
            messages: list of OpenAI-format messages (system/user/assistant/tool).
            tools: list of OpenAI tool schemas from registry.as_openai_schema().

        Returns:
            LLMResponse with parsed text / tool_calls.
        """
        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": messages,
            "tools": tools,
            "temperature": 0.0,
            "max_tokens": 16384,
            "thinking": {"type": "disabled"},
        }
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        return LLMResponse(response.json())

    # ---- V2: Intent parsing (preserved for V2 fallback) ----
    def parse(self, agent_context):
        """Return a structured intent dict, or None to trigger fallback."""
        message = (agent_context.get("message") or "").strip()
        if not message:
            return empty_intent(message)

        user_message = self._build_user_message(agent_context)

        try:
            response = self._call_api(user_message)
            intent = self._extract_json(response)
            if intent is None:
                return None
            # Merge with empty intent so missing keys are never None
            base = empty_intent(message)
            base.update(intent)
            return base
        except Exception:
            logger.exception("LLM intent router failed, falling back to rules")
            return None

    def _build_user_message(self, agent_context):
        """Build the user message with context for the LLM."""
        parts = [BUSINESS_CONTEXT]

        message = agent_context.get("message", "")
        parts.append(f"【用户问题】\n{message}")

        context = agent_context.get("raw_context") or {}
        active_task = context.get("active_task") or context.get("activeTask")
        if active_task and isinstance(active_task, dict):
            parts.append(f"【上一轮上下文（如有追问请利用）】\n{json.dumps(active_task, ensure_ascii=False)}")

        last_result = context.get("last_result") or context.get("lastResult")
        if last_result and isinstance(last_result, dict):
            evidence = last_result.get("evidence") or {}
            items = evidence.get("items") or []
            if items:
                parts.append(f"【上一轮结果证据】\n" + "\n".join(items[:5]))

        selection = context.get("last_selection") or {}
        if selection:
            parts.append(f"【用户上一轮选择】\n{json.dumps(selection, ensure_ascii=False)}")

        return "\n\n".join(parts)

    def _call_api(self, user_message):
        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            "temperature": 0.0,
            "max_tokens": 16384,
            "thinking": {"type": "disabled"},
        }
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        return response.json()

    def _extract_json(self, api_response):
        """Extract JSON intent from MiniMax API response."""
        # Log raw response for debugging
        logger.warning("MiniMax raw response: %s", json.dumps(api_response, ensure_ascii=False)[:2000])

        choices = api_response.get("choices") or []
        content = ""
        if choices:
            message = choices[0].get("message") or {}
            content = message.get("content", "")

        # Fallback for MiniMax native format
        if not content:
            content = api_response.get("reply") or api_response.get("text") or ""

        logger.warning("MiniMax content (first 500 chars): %s", content[:500])

        if not content:
            # Log full response keys to diagnose format mismatch
            logger.warning("MiniMax returned empty content. Response keys: %s", list(api_response.keys())[:20])
            return None

        # Strip  think XML tags (reasoning models may wrap chain-of-thought).
        # Handle both closed <think>...</think> and truncated <think>... (no close tag).
        content = re.sub(r"<think>[\s\S]*?(?:</think>|$)", "", content)

        # Strip markdown code fences
        content = content.strip()
        if content.startswith("```"):
            content = re.sub(r"^```(?:json)?\s*", "", content)
            content = re.sub(r"\s*```$", "", content)

        # Try direct parse first
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass

        # Fallback: extract first JSON object with balanced braces
        start = content.find("{")
        if start == -1:
            logger.warning("No JSON object found in content: %s", content[:200])
            return None

        depth = 0
        for i in range(start, len(content)):
            if content[i] == "{":
                depth += 1
            elif content[i] == "}":
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(content[start : i + 1])
                    except json.JSONDecodeError:
                        break

        logger.warning("Failed to extract JSON from content: %s", content[:200])
        return None

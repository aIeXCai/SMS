"""V3 ReAct Agent — LLM-driven tool-calling loop for score analysis.

Architecture:
    User message → LLM (with tools) → tool call → execute → result back → ...
    Loop continues until LLM returns a final answer or clarification.

The agent outputs the same ScoreAgentResponse format as V1/V2 so the frontend
and views.py need zero changes.
"""

import json
import logging
import re
import uuid

from django.conf import settings

from .llm.llm_router import LLMIntentRouter
from .security.audit import AgentAuditContext
from .security.context import build_agent_security_context
from .security.fallback_policy import fallback_unavailable_response, is_simple_v1_fallback_allowed
from .security.numeric_guard import has_structured_tables, validate_llm_text_numbers
from .security.secure_executor import SecureToolExecutor
from .service import ScoreAgentService
from .tools.registry import TOOL_REGISTRY, as_openai_schema

logger = logging.getLogger(__name__)

MAX_TURNS = 10

# ---------------------------------------------------------------------------
# System prompt — the LLM's "brain"
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """你是一个学校成绩分析助手，服务于白云实验学校的班主任和科任老师。你可以通过调用工具函数来查询和分析学生成绩数据。

## 你的角色
- 你是白云实验学校的成绩顾问
- 只回答与成绩分析相关的问题
- 遇到与成绩分析完全无关的问题（闲聊、讲笑话、问天气、写代码等），直接回复一句礼貌的引导，如"我只擅长成绩分析，请尝试问我排名、趋势或对比相关的问题。"，不要调用任何工具

## 工具调用规范
- 每次只调用一个工具（函数），等待返回结果后再决定下一步
- 如果工具返回了 error 字段，仔细阅读 suggestion 后修正参数重试一次
- 如果两次重试仍然 error，向用户说明遇到了什么问题并建议换一种问法
- 工具参数中的 exam_id、student_ids 等必须来自之前工具返回的结果，不能自己编造
- 如果一次工具调用就能回答用户问题，不要调用多余的工具

## 核心工作流

### 单人排名（用户提到了具体学生姓名）
查询路线：
  ① search_student(keyword="学生姓名") → 获取学生姓名和年级
  ② search_exam(keyword="考试名", grade_level="年级") → 获取考试 ID
  ③ get_student_rank(exam_id=XX, student_name="姓名") → 获取该学生排名

注意：get_student_rank 是查个人排名的工具，必须传 student_name。
get_top_n 是查群体榜单的工具，不要用于单人排名。

### 群体排名（用户问"前X名"但没提具体学生）
查询路线：
  ① search_exam(keyword="考试名") → 获取考试 ID
  ② get_top_n(exam_id=XX, scope_type="grade/business_group/class", top_n=X) → 获取榜单

注意：get_top_n 不需要 student_name 参数，返回的是多人列表。

## 防重复调用规则（重要）
- 记录你调用过的每个工具及其参数
- 如果打算再次调用同一个工具 + 完全相同的参数，**不要调用**，直接基于之前的返回结果给出回答
- 特别是：get_student_rank 查同一个学生+同一个考试不要重复调
- 如果连续 2 次调用同一工具参数不变，你应该能直接给出答案了

## 回答格式
- 用自然语言总结分析结果，配合 markdown 表格展示关键数据
- 排名结果采用表格，必须包含：排名、姓名、班级、分数。如果有学生人数信息加上"共XX人"
- 趋势结果必须包含表格，列：考试名称、日期、分数、排名、变化量（score_change 和 rank_change）
- 如果用户问的是单人排名，只返回该学生的排名，不要返回前N名列表
- 数字用中文习惯呈现，如"第 8 名"而不是"Rank 8"
- 表格列名用中文

## 追问策略
当搜索结果有歧义时（例如同名考试在多年级存在，或学生姓名匹配到多人），需要向用户追问。
追问必须使用以下精确格式：

[CLARIFY:你对用户的追问问题]
- label: "选项描述" | value: "唯一标识" | payload: {"exam_id": 42, "key2": "value2"}

例如搜索"期末"返回多场考试时：
[CLARIFY:找到 3 场期末考试，请选择你指的是哪一场？]
- label: "初二下学期期末模拟考（6月）" | value: "exam_42" | payload: {"exam_id": 42}
- label: "初二上学期期末模拟考（1月）" | value: "exam_15" | payload: {"exam_id": 15}

规则：
- 只列出最合理的 2-5 个选项，不要穷举
- 追问后等待用户选择，不要自行猜测
- payload 中携带后续操作需要的完整信息

## 多轮对话上下文继承
- 如果用户的追问（如"刘畅呢""数学呢"）只改变了部分信息，自动继承上一轮中没有被改变的参数（考试、排名范围、科目等）
- 如果用户的追问完全改变了场景（如从排名变成问考试列表），重新开始搜索

## 班级分组规则（重要）
数据库中没有"南山班""格致班""创新班"这些字段，它们是人为定义的业务分组：
初中2024级（当前初二）:
  格致班 = 1班、2班、3班、4班、5班、6班
  南山班 = 7班、8班、9班、10班、11班、12班、13班
  创新班 = 14班、15班、16班、17班
初中2025级（初一）:
  班级分组暂未配置。

当用户提到"格致班""南山班""创新班"时，使用 scope_type="business_group" 配合对应的 group_name。

## 数据呈现规范
- 表格前用一句话概括核心结论
- 变化量用正负号表示（+13.5 表示进步）
- 排名变化中正数表示排名上升（数字变小），如 rank_change=4 表示排名上升了 4 位"""

# ---------------------------------------------------------------------------
# Response helpers — produce ScoreAgentResponse format
# ---------------------------------------------------------------------------

def _answer(summary, tables=None, context=None, evidence=None, fallback_reason="basic_query_can_retry_simple_ranking_scope"):
    return {
        "type": "answer",
        "status": "success",
        "summary": summary,
        "tables": tables or [],
        "evidence": evidence or {},
        "context": context or {},
        "fallback": {"available": True, "reason": fallback_reason},
    }


def _clarify(message, options, context=None):
    return {
        "type": "clarification",
        "status": "needs_clarification",
        "question_id": f"q_v3_{uuid.uuid4().hex[:8]}",
        "message": message,
        "options": options,
        "allow_cancel": True,
        "context": context or {},
        "fallback": {"available": False, "reason": "llm_needs_clarification"},
    }


def _error(message, context=None, actions=None, fallback_available=True, fallback_reason="basic_query_can_retry"):
    return {
        "type": "error",
        "status": "tool_error",
        "message": message,
        "actions": actions or [{"type": "retry_agent", "label": "重试"}],
        "context": context or {},
        "fallback": {"available": fallback_available, "reason": fallback_reason},
    }


def _unsupported(message, reason="unsupported_intent"):
    return {
        "type": "unsupported",
        "status": "unsupported",
        "message": message,
        "fallback": {"available": False, "reason": reason},
    }


def _unknown(message):
    return {
        "type": "clarification",
        "status": "needs_clarification",
        "question_id": "q_intent_001",
        "message": message,
        "options": [],
        "allow_free_text": True,
        "allow_cancel": True,
        "context": {},
        "fallback": {"available": False, "reason": "intent_required"},
    }


# ---------------------------------------------------------------------------
# Main agent loop
# ---------------------------------------------------------------------------

def _parse_clarify(text):
    """Parse [CLARIFY:...] block and options from LLM text output.

    Returns (clarify_message, options) or (None, None) if no clarification found.
    """
    match = re.search(r"\[CLARIFY:\s*(.+?)\]", text, re.DOTALL)
    if not match:
        return None, None

    clarify_msg = match.group(1).strip()
    text_after = text[match.end():]

    # Parse option lines: "- label: "xxx" | value: "yyy" | payload: {...}"
    options = []
    for line in text_after.split("\n"):
        line = line.strip()
        if not line.startswith("- label:"):
            continue
        try:
            label_match = re.search(r'label:\s*"(.+?)"\s*\|', line)
            value_match = re.search(r'value:\s*"(.+?)"\s*\|', line)
            payload_match = re.search(r"payload:\s*(\{.+?\})\s*$", line)

            opt = {}
            if label_match:
                opt["label"] = label_match.group(1)
            if value_match:
                opt["value"] = value_match.group(1)
            if payload_match:
                try:
                    opt["payload"] = json.loads(payload_match.group(1))
                except json.JSONDecodeError:
                    continue
            if opt.get("label"):
                options.append(opt)
        except Exception:
            continue

    return (clarify_msg, options) if options else (clarify_msg, [])


def _parse_markdown_table(text):
    """Try to extract markdown tables from LLM text into frontend-compatible format.

    Returns list of {"title": str, "columns": [{"key":str, "label":str}], "rows": [{col: val}]}.
    """
    tables = []
    # Find table patterns: header line followed by separator line followed by data
    lines = text.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        # Check if this is a table header line (contains | and the next line is a separator)
        if "|" in line and i + 1 < len(lines):
            next_line = lines[i + 1].strip()
            if re.match(r"^\|[\s\-:|]+\|$", next_line):
                # Extract title (text right before the table, if any)
                title = ""
                if i > 0:
                    prev = lines[i - 1].strip()
                    if prev and "|" not in prev and not prev.startswith("[CLARIFY"):
                        title = prev

                # Parse header → frontend-compatible column objects
                header_cells = [c.strip() for c in line.split("|")[1:-1]]
                columns = [{"key": h, "label": h, "align": "left"} for h in header_cells]
                # Parse data rows → frontend-compatible object rows
                rows = []
                j = i + 2
                while j < len(lines):
                    data_line = lines[j].strip()
                    if not data_line or "|" not in data_line:
                        break
                    cells = [c.strip() for c in data_line.split("|")[1:-1]]
                    if cells and any(c for c in cells):
                        row_obj = {}
                        for idx, cell in enumerate(cells):
                            col_key = header_cells[idx] if idx < len(header_cells) else f"col_{idx}"
                            row_obj[col_key] = cell
                        rows.append(row_obj)
                    j += 1
                if columns and rows:
                    tables.append({"title": title, "columns": columns, "rows": rows})
                i = j
                continue
        i += 1
    return tables


def _tables_from_tool_results(tool_results):
    label_map = {
        "rank": "排名",
        "student_name": "学生姓名",
        "student_internal_id": "学生内部ID",
        "student_id": "学号",
        "class_name": "班级",
        "score": "分数",
        "total": "总人数",
        "total_valid": "有效人数",
        "valid_count": "有效人数",
        "exam_name": "考试名称",
        "exam_date": "考试日期",
        "metric": "科目 / 指标",
        "score_change": "分数变化",
        "rank_change": "排名变化",
        "weighted_score": "加权分",
        "exam_a_score": "第一场原始分",
        "exam_b_score": "第二场原始分",
        "exam_a_weight": "第一场权重",
        "exam_b_weight": "第二场权重",
        "object_name": "对比对象",
        "reference_name": "参照对象",
        "object_avg": "对象均值",
        "reference_avg": "参照均值",
        "diff": "差值",
        "ratio": "占比",
        "rank_in_reference": "群体内排名",
        "note": "备注",
    }
    tables = []
    for result in tool_results:
        if not isinstance(result, dict):
            continue
        rows = result.get("rows") or result.get("students")
        if not rows or not isinstance(rows, list):
            continue
        visible_rows = []
        for row in rows:
            if not isinstance(row, dict):
                continue
            visible_rows.append({key: value for key, value in row.items() if key != "student_id"})
        if not visible_rows:
            continue
        keys = list(visible_rows[0].keys())
        columns = [
            {
                "key": key,
                "label": label_map.get(key, key),
                "align": "right" if isinstance(visible_rows[0].get(key), (int, float)) else "left",
            }
            for key in keys
        ]
        tables.append({"title": "成绩分析结果", "columns": columns, "rows": visible_rows})
    return tables


def _build_messages(context, user_message, clarification_reply, history_messages):
    """Build the initial messages array for the LLM call.

    Args:
        context: dict from frontend (may contain messages history).
        user_message: current user message text.
        clarification_reply: structured reply to previous clarification.
        history_messages: previously accumulated messages (raw_context.messages).

    Returns messages list.
    """
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    # Inject conversation history (last 3 turns = 7 messages including tool results)
    if history_messages and isinstance(history_messages, list):
        recent = history_messages[-14:]  # up to 7 turns
        for msg in recent:
            if isinstance(msg, dict) and msg.get("role"):
                messages.append(msg)

    # Build user message
    user_content = user_message

    # If this is a clarification reply, prefix with context
    if clarification_reply and isinstance(clarification_reply, dict):
        # Preserve raw_message for context-aware replies
        raw_message = (context or {}).get("raw_message", "")
        actual_msg = raw_message if raw_message else user_message
        user_content = (
            f"用户在上一次追问中选择了：{clarification_reply.get('label') or clarification_reply.get('value')}。\n"
            f"用户的原始问题是：{actual_msg}\n"
            f"澄清信息 payload：{json.dumps(clarification_reply.get('payload') or {}, ensure_ascii=False)}\n"
            f"请基于此继续分析。"
        )

    messages.append({"role": "user", "content": user_content})
    return messages


def run_agent(user_message, context=None, clarification_reply=None, user=None):
    """ReAct agent loop. Returns ScoreAgentResponse dict.

    Args:
        user_message: raw user text.
        context: dict from frontend (conversation context).
        clarification_reply: dict from frontend (clarification answer).
        user: Django user (not used by agent, passed through to V1 fallback).

    Returns dict matching ScoreAgentResponse format.
    """
    context = context or {}
    security_context = build_agent_security_context(user)
    request_id = str(uuid.uuid4())
    audit_context = AgentAuditContext(request_id, security_context, user_message)

    if not security_context.allowed:
        audit_context.finish("permission_denied")
        return {
            "request_id": request_id,
            "type": "error",
            "status": "permission_denied",
            "message": "未找到符合条件且你有权限查看的数据，请检查查询范围或联系管理员。",
            "actions": [{"type": "retry_agent", "label": "重新生成"}],
            "fallback": {"available": False, "reason": "permission_denied"},
        }

    # --- Cancel / reset ---
    if user_message.strip() == "取消" or (clarification_reply or {}).get("value") == "取消":
        result = _unknown("已清空当前 AI 分析上下文，请重新提问。")
        audit_context.finish("cancelled")
        return result

    # --- Empty message ---
    if not user_message.strip():
        result = _unknown("请说明要分析的对象、考试和指标，例如「初二格致班期末前三」。")
        audit_context.finish("needs_clarification")
        return result

    history_messages = context.get("messages", [])
    tools = as_openai_schema()
    messages = _build_messages(context, user_message, clarification_reply, history_messages)
    executor = SecureToolExecutor(TOOL_REGISTRY)
    raw_tool_results = []
    numeric_facts = []
    tool_executed = False

    try:
        llm = LLMIntentRouter()
    except Exception:
        logger.exception("Failed to init LLM router")
        result = _controlled_fallback(
            user_message,
            context,
            clarification_reply,
            user,
            security_context,
            tool_executed=False,
            reason="llm_init_failed",
        )
        audit_context.finish(result.get("status", "error"), result.get("fallback", {}).get("reason"))
        return result

    # --- ReAct loop ---
    seen_calls = {}  # {(tool_name, args_hash): count}
    for turn in range(1, MAX_TURNS + 1):
        try:
            response = llm.chat_with_tools(messages, tools)
        except Exception as exc:
            logger.exception("LLM call failed at turn %d", turn)
            result = _controlled_fallback(
                user_message,
                context,
                clarification_reply,
                user,
                security_context,
                tool_executed=tool_executed,
                reason="llm_call_failed",
            )
            audit_context.finish(result.get("status", "error"), result.get("fallback", {}).get("reason"))
            return result

        # --- LLM wants to call a tool ---
        if response.is_tool_call():
            for tc in response.tool_calls:
                tool_name = tc["name"]
                tool_args = tc["arguments"]

                logger.info("Turn %d: LLM calls %s(%s)", turn, tool_name, json.dumps(tool_args, ensure_ascii=False)[:200])

                # Anti-infinite-loop: detect duplicate (tool, args) calls
                args_hash = json.dumps(tool_args, ensure_ascii=False, sort_keys=True)
                call_key = (tool_name, args_hash)
                seen_calls[call_key] = seen_calls.get(call_key, 0) + 1
                if seen_calls[call_key] >= 3:
                    logger.warning("Duplicate tool call detected: %s %s (x%d), aborting", tool_name, args_hash[:120], seen_calls[call_key])
                    return _error(
                        "分析似乎陷入了重复循环。请换一种更简洁的问法，例如「初二14班黄晨田年级排名」或「格致班期末前三」。",
                        context,
                    )

                wrapped_result = executor.execute(tool_name, tool_args, security_context, audit_context)
                tool_executed = True
                if wrapped_result.get("status") == "permission_denied":
                    audit_context.finish("permission_denied")
                    return {
                        "type": "error",
                        "status": "permission_denied",
                        "message": "未找到符合条件且你有权限查看的数据，请检查查询范围或联系管理员。",
                        "actions": [{"type": "retry_agent", "label": "重新生成"}],
                        "fallback": {"available": False, "reason": "permission_denied"},
                    }
                if "raw_result" in wrapped_result:
                    raw_tool_results.append(wrapped_result["raw_result"])
                    numeric_facts.extend(wrapped_result.get("numeric_facts") or [])
                    result = wrapped_result["llm_observation"]
                else:
                    result = wrapped_result

                # Append assistant's tool_call + tool result to messages
                messages.append({
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [{
                        "id": tc["id"],
                        "type": "function",
                        "function": {"name": tool_name, "arguments": json.dumps(tool_args, ensure_ascii=False)},
                    }],
                })
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": json.dumps(result, ensure_ascii=False),
                })
            continue  # next turn

        # --- LLM returned text answer ---
        if response.is_stop():
            text = response.text
            if not text:
                logger.warning("LLM returned empty content at turn %d", turn)
                if turn > 1:
                    result = _error("分析未完成，请换一种更明确的问法。", fallback_available=False, fallback_reason="llm_empty_after_tool")
                    audit_context.finish(result["status"], result["fallback"]["reason"])
                    return result
                result = _controlled_fallback(
                    user_message,
                    context,
                    clarification_reply,
                    user,
                    security_context,
                    tool_executed=tool_executed,
                    reason="llm_empty",
                )
                audit_context.finish(result.get("status", "error"), result.get("fallback", {}).get("reason"))
                return result

            # Check for clarification
            clarify_msg, clarify_options = _parse_clarify(text)
            if clarify_msg:
                new_context = {
                    "messages": messages[1:],  # exclude system prompt for storage
                    "raw_message": context.get("raw_message") or user_message,
                }
                result = _clarify(clarify_msg, clarify_options, new_context)
                audit_context.finish("needs_clarification")
                return result

            # Check for unsupported response (LLM refuses to answer)
            refusal_indicators = ["不支持", "无法回答", "不在我的能力范围", "请尝试问我排名"]
            if any(ind in text for ind in refusal_indicators):
                result = _unsupported(text, "llm_refused")
                audit_context.finish("unsupported")
                return result

            if not validate_llm_text_numbers(text, numeric_facts):
                result = _error(
                    "数据已经完成计算，但结果说明未能通过一致性校验。本次未展示结果，请重新生成。",
                    fallback_available=False,
                    fallback_reason="numeric_validation_failed",
                )
                audit_context.finish("numeric_validation_failed", "numeric_validation_failed")
                return result

            # LLM Markdown tables are not authoritative in V3 P0. Prefer
            # deterministic Tool rows and only parse Markdown when no Tool
            # produced structured result rows.
            tables = _tables_from_tool_results(raw_tool_results)
            if not tables and not has_structured_tables(raw_tool_results):
                tables = _parse_markdown_table(text)

            # Build evidence from the conversation
            evidence_items = []
            for msg in messages:
                if msg["role"] == "tool":
                    try:
                        tool_result = json.loads(msg["content"])
                        if tool_result.get("exam_name"):
                            evidence_items.append(f"数据来源：{tool_result['exam_name']}")
                    except (json.JSONDecodeError, KeyError):
                        pass

            evidence = {"items": evidence_items[:3], "summary": "数据来自系统考试成绩库"} if evidence_items else {}

            # Save context for next round
            next_context = {
                "messages": messages[1:],  # exclude system prompt
                "raw_message": user_message,
            }

            # Clean up summary: remove markdown tables (already in tables field) + [CLARIFY:] leftovers
            summary = re.sub(r"\[CLARIFY:.*?\]\n(- label:.*(\n|$))*", "", text)
            summary = re.sub(r"\|.*\|[\s\S]*?\n\n", "", summary).strip()

            result = _answer(summary, tables, next_context, evidence, fallback_reason="v3_success")
            result["numeric_facts"] = numeric_facts
            audit_context.finish("success")
            return result

        # --- LLM returned neither tool_call nor stop — unexpected ---
        logger.warning("LLM returned unexpected state: finish_reason=%s, text=%s",
                       response.finish_reason, (response.text or "")[:100])
        result = _error("分析遇到了意外情况，请重试或换一种问法。", fallback_available=False, fallback_reason="unexpected_llm_state")
        audit_context.finish(result["status"], result["fallback"]["reason"])
        return result

    # --- Exceeded max turns ---
    logger.warning("ReAct loop exceeded MAX_TURNS=%d", MAX_TURNS)
    result = _error("分析步骤过多，请换一种更简洁的方式提问，例如「初二14班黄晨田期末排名」。", context, fallback_available=False, fallback_reason="max_turns_exceeded")
    audit_context.finish(result["status"], result["fallback"]["reason"])
    return result


def _controlled_fallback(user_message, context, clarification_reply, user, security_context, tool_executed=False, reason=None):
    if not getattr(settings, "AI_AGENT_V3_FALLBACK_ENABLED", True):
        return fallback_unavailable_response()
    if not is_simple_v1_fallback_allowed(
        user_message,
        context=context,
        clarification_reply=clarification_reply,
        security_context=security_context,
        tool_executed=tool_executed,
        reason=reason,
    ):
        return fallback_unavailable_response()
    return _fallback_to_v1(user_message, context, clarification_reply, user)


def _fallback_to_v1(user_message, context, clarification_reply, user):
    """Controlled fallback to V1 rule engine when the whitelist allows it."""
    logger.info("V3 agent falling back to V1 rule engine")
    service = ScoreAgentService()
    try:
        return service.handle(
            message=user_message,
            context=context or {},
            clarification_reply=clarification_reply,
            user=user,
        )
    except Exception:
        logger.exception("V1 fallback also failed")
        return _error("成绩分析服务当前不可用，请稍后重试。", fallback_available=False, fallback_reason="fallback_failed")

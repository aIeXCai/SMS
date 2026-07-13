"""Controlled V3-to-V1 fallback policy."""

import re


COMPLEX_TOKENS = ("趋势", "变化", "加权", "对比", "导出", "解释", "为什么", "最近", "历次")


def fallback_unavailable_response():
    return {
        "type": "error",
        "status": "v3_unavailable_no_fallback",
        "message": "AI 成绩分析服务暂时不可用。为了避免返回不准确的结果，本次没有执行降级查询，请稍后重试。",
        "actions": [{"type": "retry_agent", "label": "重新生成"}],
        "fallback": {"available": False, "reason": "fallback_not_allowed"},
    }


def is_simple_v1_fallback_allowed(message, context=None, clarification_reply=None, security_context=None, tool_executed=False, reason=None):
    if not security_context or not security_context.allowed:
        return False
    if clarification_reply or tool_executed:
        return False
    if context and context.get("messages"):
        return False
    if reason in {"permission_denied", "numeric_validation_failed"}:
        return False

    text = (message or "").strip()
    if not text or any(token in text for token in COMPLEX_TOKENS):
        return False

    has_exam = any(token in text for token in ("期中", "期末", "月考", "模拟", "考试"))
    has_scope = any(token in text for token in ("班", "年级", "格致", "南山", "创新"))
    has_top_n = bool(re.search(r"前[一二三四五六七八九十\d]+", text))
    has_rank = "排名" in text or "排第几" in text
    has_student_like = bool(re.search(r"[\u4e00-\u9fa5]{2,4}", text))

    return bool(has_exam and has_scope and (has_top_n or (has_rank and has_student_like)))

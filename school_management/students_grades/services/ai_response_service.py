"""
Step 3 — AI Response Generation Service.

Takes the original user question and the real database query results (from
Step 2) and asks the LLM to compose a natural-language answer.  The LLM is
given a strict rule: never modify or invent numbers — all figures must come
from the provided data.

Usage:
    from school_management.students_grades.services.ai_response_service import (
        AIResponseService,
    )

    service = AIResponseService()
    answer = service.generate(question, data)
"""

import json
import logging
import re
from typing import Any, Dict

from .ai_minimax_client import call_minimax_safe

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Prompt
# ---------------------------------------------------------------------------

RESPONSE_SYSTEM_PROMPT = """\
You are a grade report writer for a school management system. The backend
has already queried the real database and retrieved accurate numbers. Your
job is to turn those numbers into a clear, natural-language answer for the
teacher who asked the question.

【CRITICAL RULES】
1. NEVER invent or modify numbers. Every figure must come from the provided
   data below. If a number is not in the data, do NOT guess it.
2. If the data is empty or marked as insufficient, say so honestly:
   "暂无相关记录" or "数据不足以完成该分析".
3. Use ↑↓ arrows to indicate score trends.
4. Be concise. Use bullet points for multiple items; keep paragraphs short.
5. End EVERY response with exactly this line:
   ⚠️ 数据均来自系统真实记录
6. Write in Chinese. Use a helpful, professional tone.

【Output format】
- Plain text, no markdown headers.
- Use bullet lines (• or -) for lists.
- Always include exam names AND dates when referencing specific scores.
  Example: "张三在2025-2026学年第二学期期中考试（2025-04-20）中数学得分78分。"
"""


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------

class AIResponseService:
    """Turn query results + question into a natural-language answer via LLM."""

    def generate(self, question: str, data: Any) -> str:
        """
        Generate a human-friendly answer from query results.

        Args:
            question: The original user question.
            data: The structured data returned by AIQueryExecutor.execute().

        Returns:
            A natural-language answer string ending with the disclaimer line.
        """
        # If data is None or empty, skip LLM and return hardcoded fallback
        if data is None or (isinstance(data, dict) and not data):
            return "暂无相关成绩记录，可能尚未录入或筛选条件不匹配。\n\n⚠️ 数据均来自系统真实记录"

        data_str = json.dumps(data, ensure_ascii=False, indent=2, default=str)

        user_prompt = (
            f"【用户问题】\n{question}\n\n"
            f"【查询结果数据】\n{data_str}\n\n"
            "请根据以上数据，用自然的中文回答用户的问题。"
        )

        try:
            raw = call_minimax_safe(
                user_prompt,
                system_prompt=RESPONSE_SYSTEM_PROMPT,
                temperature=0.3,
                max_tokens=1024,
            )
        except Exception as exc:
            logger.error("Response generation LLM call failed: %s", exc)
            return self._fallback_answer(data)

        answer = raw.strip()
        # Ensure the disclaimer is present
        if "⚠️ 数据均来自系统真实记录" not in answer:
            answer += "\n\n⚠️ 数据均来自系统真实记录"

        return answer

    # ------------------------------------------------------------------
    # Fallback
    # ------------------------------------------------------------------

    @staticmethod
    def _fallback_answer(data: Any) -> str:
        """Produce a plain-text answer without LLM when the LLM call fails."""
        if isinstance(data, dict):
            status = data.get("status", "")
            if status == "student_not_found":
                return data.get("answer", "未找到该学生档案。") + "\n\n⚠️ 数据均来自系统真实记录"
            if status == "subject_not_found":
                return data.get("answer", "暂无该科目成绩记录。") + "\n\n⚠️ 数据均来自系统真实记录"
            if status == "insufficient_data":
                return data.get("answer", "数据不足以完成该分析。") + "\n\n⚠️ 数据均来自系统真实记录"

            # Generic fallback: summarize data fields
            lines = ["查询结果如下："]
            for key, value in data.items():
                if isinstance(value, (int, float, str)):
                    lines.append(f"• {key}: {value}")
            lines.append("\n⚠️ 数据均来自系统真实记录")
            return "\n".join(lines)

        return f"查询结果：{data}\n\n⚠️ 数据均来自系统真实记录"

"""
Step 1 — AI Query Plan Generation Service.

Translates a natural-language question into a structured query plan (JSON)
by calling the MiniMax LLM.  The LLM only interprets intent — it never
generates numbers or touches the database.

Usage:
    from school_management.students_grades.services.ai_query_plan_service import (
        AIQueryPlanService,
    )

    service = AIQueryPlanService()
    plan = service.generate(question, role, teaching_classes, managed_grade)
"""

import json
import logging
import re
from typing import Any, Dict, List, Optional

from .ai_minimax_client import call_minimax_safe

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Prompt templates
# ---------------------------------------------------------------------------

QUERY_PLAN_SYSTEM_PROMPT = """\
You are a grade query planner. The user asks questions about student
grades in natural language. Your only job is to translate the question
into a structured JSON query plan. You MUST NOT invent numbers or guess
data.

【Database structure】
- Student: id (int), name (str), student_id (str, unique), grade_level (str),
  cohort (str), current_class_id (int → Class)
- Class: id (int), grade_level (str), class_name (str like "1班"), cohort (str)
- Exam: id (int), name (str), academic_year (str like "2025-2026"),
  date (YYYY-MM-DD), grade_level (cohort format like "初中2026级")
- Score: id (int), student_id (int), exam_id (int), subject (str),
  score_value (decimal), exam_subject_id (int, nullable)
- User: role (str: subject_teacher|grade_manager|staff|admin),
  managed_grade (str, nullable), teaching_classes (list of str)

【Permission context】
- Current user role: {role}
- Teaching classes (only subject_teacher): {teaching_classes}
- Managed grade (only grade_manager): {managed_grade}

【Available subjects】
语文 数学 英语 政治 历史 物理 化学 生物 地理 体育

【Grade level values】
初一 初二 初三 高一 高二 高三

【Output format — STRICT JSON ONLY, no markdown, no extra text】
{{
  "action": "compare|trend|average|top_bottom|decline|rank|pass_rate|permission_denied|irrelevant",
  "filters": {{
    "student_name": "student name or null",
    "class_name": "class name like '初三1班' or null",
    "subject": "subject name or null",
    "grade_level": "grade level or null",
    "timeframe": "本学期|本月|全部|YYYY-MM-DD~YYYY-MM-DD"
  }},
  "limit": 10,
  "requires_comparison": false,
  "requires_ranking": false,
  "requires_disambiguation": false,
  "ambiguous": null,
  "integrity_check": null
}}

【Action mapping】
- "how much difference" / "compare" / "change" → compare
- "trend" / "recent N times" / "this semester" → trend
- "average" / "mean score" → average
- "highest" / "lowest" / "top" / "who scored best" → top_bottom
- "declining" / "consecutive drop" / "getting worse" → decline
- "rank" / "ranking" → rank
- "pass rate" / "percentage passed" → pass_rate
- Question asks for data outside user's permission scope → permission_denied
- Question is NOT about grades at all → irrelevant

【Disambiguation rules】
- If the question uses ambiguous exam terms like "期中考","一模","期末考","上次考试"
  and the context does NOT pin down a specific exam, set requires_disambiguation=true
  and ambiguous={{ "type": "exam", "keyword": "<the ambiguous term>" }}.
- If a student name matches multiple students in the system, set
  requires_disambiguation=true and ambiguous={{ "type": "student", "keyword": "<name>" }}.
- IMPORTANT: Do NOT fill in matches[] — the backend queries the real database.
- "最近一次" is NOT ambiguous (it clearly means the most recent).

【Integrity check rules (optional)】
Only fill integrity_check if you can confidently predict potential data issues:
- If a compare/trend request only mentions one exam → predict has_enough=false
- Do NOT fabricate counts or alternatives.

【CRITICAL】
- Output ONLY valid JSON, no surrounding text or markdown fences.
- Use null (not "null") for empty fields in JSON.
- The "grade_level" filter must use values from the allowed list above.
"""


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------

class AIQueryPlanService:
    """Generates a structured query plan from a natural-language question."""

    def generate(
        self,
        question: str,
        role: str,
        teaching_classes: Optional[List[str]] = None,
        managed_grade: Optional[str] = None,
        exam_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Call MiniMax to produce a query plan for the given question.

        Args:
            question: The user's natural language query.
            role: User role string (subject_teacher, grade_manager, etc.).
            teaching_classes: Display names of classes the teacher teaches.
            managed_grade: The grade the grade_manager oversees.
            exam_id: Optional exam ID for disambiguation resolution.

        Returns:
            Parsed query plan dict.

        Raises:
            ValueError: If the LLM returns unparseable JSON after retry.
        """
        teaching_classes_str = ", ".join(teaching_classes) if teaching_classes else "(none)"
        managed_grade_str = managed_grade or "(none)"

        system_prompt = QUERY_PLAN_SYSTEM_PROMPT.format(
            role=role,
            teaching_classes=teaching_classes_str,
            managed_grade=managed_grade_str,
        )

        user_prompt = question
        if exam_id:
            user_prompt += f"\n\n(Resolved exam context: exam_id={exam_id})"

        # First attempt
        raw = self._call_llm(system_prompt, user_prompt)
        plan = self._parse_json(raw)

        if plan is not None:
            # Inject the resolved exam_id if provided
            if exam_id and plan.get("filters"):
                plan["filters"]["exam_id"] = exam_id
            return plan

        # Retry once with stricter instruction
        logger.warning("Query plan JSON parse failed on first attempt, retrying...")
        retry_prompt = (
            user_prompt
            + "\n\nIMPORTANT: Your previous response was not valid JSON. "
            "Please output ONLY a valid JSON object with no additional text."
        )
        raw = self._call_llm(system_prompt, retry_prompt)
        plan = self._parse_json(raw)

        if plan is not None:
            if exam_id and plan.get("filters"):
                plan["filters"]["exam_id"] = exam_id
            return plan

        raise ValueError(
            "AI 无法生成有效的查询计划，请尝试更具体的描述，"
            "如'张三数学成绩变化'或'初三1班数学平均分'"
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _call_llm(self, system_prompt: str, user_prompt: str) -> str:
        """Call MiniMax via the semaphore-gated safe client."""
        return call_minimax_safe(
            user_prompt,
            system_prompt=system_prompt,
            temperature=0.1,
            max_tokens=2048,
        )

    @staticmethod
    def _parse_json(raw: str) -> Optional[Dict[str, Any]]:
        """Try to extract and parse a JSON object from the LLM response."""
        if not raw or not raw.strip():
            return None

        text = raw.strip()

        # Strip markdown code fences if present
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\s*", "", text)
            text = re.sub(r"\s*```$", "", text)

        try:
            return json.loads(text)
        except json.JSONDecodeError:
            # Try to find a JSON object within the text
            match = re.search(r"\{.*\}", text, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group())
                except json.JSONDecodeError:
                    pass
        return None

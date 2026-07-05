"""
Tests for AIQueryPlanService — Step 1: natural-language → JSON query plan.

Acceptance criteria covered:
  - AC2: Permission context (role, teaching_classes, managed_grade) injected into prompt
  - AC8: JSON parse failure → retry once → friendly error on second failure
"""
import os
import sys

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "school_management.settings_sqlite_test")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))))
import django
django.setup()

import unittest
from unittest.mock import patch, Mock

from school_management.students_grades.services.ai_query_plan_service import (
    AIQueryPlanService,
    QUERY_PLAN_SYSTEM_PROMPT,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

VALID_PLAN_JSON = (
    '{"action":"compare","filters":{"student_name":"张三","subject":"数学"},'
    '"limit":10,"requires_comparison":true,"requires_ranking":false,'
    '"requires_disambiguation":false,"ambiguous":null,"integrity_check":null}'
)


class AIQueryPlanServiceTests(unittest.TestCase):
    """Tests for AIQueryPlanService.generate()."""

    def setUp(self):
        self.service = AIQueryPlanService()

    # ------------------------------------------------------------------
    # AC2: Permission context is injected into the system prompt
    # ------------------------------------------------------------------

    @patch("school_management.students_grades.services.ai_query_plan_service.call_minimax_safe")
    def test_injects_role_into_system_prompt(self, mock_llm):
        """role is formatted into the system prompt."""
        mock_llm.return_value = VALID_PLAN_JSON
        self.service.generate(
            question="张三数学成绩",
            role="subject_teacher",
            teaching_classes=["初三1班"],
            managed_grade=None,
        )
        call_args = mock_llm.call_args
        system_prompt = call_args.kwargs["system_prompt"]
        self.assertIn("subject_teacher", system_prompt)

    @patch("school_management.students_grades.services.ai_query_plan_service.call_minimax_safe")
    def test_injects_teaching_classes_into_system_prompt(self, mock_llm):
        """teaching_classes is formatted into the system prompt."""
        mock_llm.return_value = VALID_PLAN_JSON
        self.service.generate(
            question="test",
            role="subject_teacher",
            teaching_classes=["初三1班", "初三2班"],
            managed_grade=None,
        )
        system_prompt = mock_llm.call_args.kwargs["system_prompt"]
        self.assertIn("初三1班, 初三2班", system_prompt)

    @patch("school_management.students_grades.services.ai_query_plan_service.call_minimax_safe")
    def test_injects_managed_grade_into_system_prompt(self, mock_llm):
        """managed_grade is formatted into the system prompt."""
        mock_llm.return_value = VALID_PLAN_JSON
        self.service.generate(
            question="test",
            role="grade_manager",
            teaching_classes=None,
            managed_grade="初三",
        )
        system_prompt = mock_llm.call_args.kwargs["system_prompt"]
        self.assertIn("初三", system_prompt)

    @patch("school_management.students_grades.services.ai_query_plan_service.call_minimax_safe")
    def test_none_teaching_classes_becomes_none_string(self, mock_llm):
        """None teaching_classes should render as '(none)'."""
        mock_llm.return_value = VALID_PLAN_JSON
        self.service.generate(
            question="test", role="staff",
            teaching_classes=None, managed_grade=None,
        )
        system_prompt = mock_llm.call_args.kwargs["system_prompt"]
        self.assertIn("(none)", system_prompt)

    # ------------------------------------------------------------------
    # Normal responses
    # ------------------------------------------------------------------

    @patch("school_management.students_grades.services.ai_query_plan_service.call_minimax_safe")
    def test_returns_parsed_json(self, mock_llm):
        """When LLM returns valid JSON, it should be parsed and returned."""
        mock_llm.return_value = VALID_PLAN_JSON
        plan = self.service.generate(
            question="test", role="admin",
        )
        self.assertEqual(plan["action"], "compare")
        self.assertEqual(plan["filters"]["student_name"], "张三")

    @patch("school_management.students_grades.services.ai_query_plan_service.call_minimax_safe")
    def test_strips_json_code_fences(self, mock_llm):
        """Markdown code fences around JSON should be stripped."""
        mock_llm.return_value = '```json\n' + VALID_PLAN_JSON + '\n```'
        plan = self.service.generate(
            question="test", role="admin",
        )
        self.assertEqual(plan["action"], "compare")

    @patch("school_management.students_grades.services.ai_query_plan_service.call_minimax_safe")
    def test_injects_exam_id_into_filters(self, mock_llm):
        """When exam_id is provided, it is injected into plan filters."""
        mock_llm.return_value = VALID_PLAN_JSON
        plan = self.service.generate(
            question="test", role="admin", exam_id=42,
        )
        self.assertEqual(plan["filters"]["exam_id"], 42)

    @patch("school_management.students_grades.services.ai_query_plan_service.call_minimax_safe")
    def test_extracts_json_from_wrapped_text(self, mock_llm):
        """If JSON is wrapped in extra text, _parse_json should extract it."""
        mock_llm.return_value = (
            'Here is the plan:\n'
            + VALID_PLAN_JSON
            + '\nHope this helps.'
        )
        plan = self.service.generate(
            question="test", role="admin",
        )
        self.assertEqual(plan["action"], "compare")

    # ------------------------------------------------------------------
    # AC8: JSON parse failure → retry once → friendly error
    # ------------------------------------------------------------------

    @patch("school_management.students_grades.services.ai_query_plan_service.call_minimax_safe")
    def test_retries_once_on_parse_failure(self, mock_llm):
        """First response is invalid → retry; second is valid → return plan."""
        mock_llm.side_effect = [
            "not valid json at all {{broken",
            VALID_PLAN_JSON,
        ]
        plan = self.service.generate(
            question="test", role="admin",
        )
        self.assertEqual(mock_llm.call_count, 2)
        self.assertEqual(plan["action"], "compare")

    @patch("school_management.students_grades.services.ai_query_plan_service.call_minimax_safe")
    def test_raises_valueerror_on_double_failure(self, mock_llm):
        """Both attempts return unparseable → raise ValueError."""
        mock_llm.side_effect = [
            "not json",
            "still not json {{{",
        ]
        with self.assertRaises(ValueError) as ctx:
            self.service.generate(question="test", role="admin")
        self.assertIn("AI 无法生成有效的查询计划", str(ctx.exception))

    @patch("school_management.students_grades.services.ai_query_plan_service.call_minimax_safe")
    def test_retry_with_stricter_prompt(self, mock_llm):
        """On retry, the user prompt should include stricter instructions."""
        mock_llm.side_effect = ["bad json", VALID_PLAN_JSON]
        self.service.generate(question="test", role="admin")
        # Second call should have the stricter prompt
        retry_user_prompt = mock_llm.call_args_list[1].args[0]
        self.assertIn("IMPORTANT", retry_user_prompt)
        self.assertIn("previous response was not valid JSON", retry_user_prompt)

    @patch("school_management.students_grades.services.ai_query_plan_service.call_minimax_safe")
    def test_empty_response_causes_retry(self, mock_llm):
        """Empty LLM response should be treated as parse failure and retried."""
        mock_llm.side_effect = ["", VALID_PLAN_JSON]
        plan = self.service.generate(question="test", role="admin")
        self.assertEqual(mock_llm.call_count, 2)
        self.assertEqual(plan["action"], "compare")

    @patch("school_management.students_grades.services.ai_query_plan_service.call_minimax_safe")
    def test_whitespace_only_causes_retry(self, mock_llm):
        """Whitespace-only response should be treated as parse failure."""
        mock_llm.side_effect = ["   \n  \t ", VALID_PLAN_JSON]
        plan = self.service.generate(question="test", role="admin")
        self.assertEqual(mock_llm.call_count, 2)

    # ------------------------------------------------------------------
    # Edge cases
    # ------------------------------------------------------------------

    @patch("school_management.students_grades.services.ai_query_plan_service.call_minimax_safe")
    def test_exam_id_not_injected_if_no_filters(self, mock_llm):
        """If the plan has no filters key, exam_id should NOT crash."""
        mock_llm.return_value = (
            '{"action":"irrelevant","limit":10,'
            '"requires_comparison":false,"requires_ranking":false,'
            '"requires_disambiguation":false,"ambiguous":null,"integrity_check":null}'
        )
        plan = self.service.generate(
            question="what's the weather?", role="admin", exam_id=99,
        )
        self.assertEqual(plan["action"], "irrelevant")
        # exam_id should not appear if filters key is missing
        self.assertNotIn("filters", plan)

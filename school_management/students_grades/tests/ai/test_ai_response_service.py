"""
Tests for AIResponseService — Step 3: compose natural-language answer from data.

Covers:
  - LLM-based answer generation
  - Fallback when LLM fails
  - Disclaimer line enforcement
  - Empty/null data handling
"""
import os
import sys

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "school_management.settings_sqlite_test")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))))
import django
django.setup()

import unittest
from unittest.mock import patch

from school_management.students_grades.services.ai_response_service import (
    AIResponseService,
    RESPONSE_SYSTEM_PROMPT,
)


class AIResponseServiceTests(unittest.TestCase):
    """Tests for AIResponseService.generate()."""

    def setUp(self):
        self.service = AIResponseService()

    # ------------------------------------------------------------------
    # Normal LLM responses
    # ------------------------------------------------------------------

    @patch("school_management.students_grades.services.ai_response_service.call_minimax_safe")
    def test_generates_answer_from_data(self, mock_llm):
        """LLM should compose an answer from the provided data."""
        mock_llm.return_value = "张三数学平均分 80.0 分。\n\n⚠️ 数据均来自系统真实记录"
        data = {"average": 80.0, "max": 90.0, "min": 70.0}
        answer = self.service.generate("张三数学平均分？", data)
        self.assertIn("张三", answer)
        mock_llm.assert_called_once()

    @patch("school_management.students_grades.services.ai_response_service.call_minimax_safe")
    def test_appends_disclaimer_if_missing(self, mock_llm):
        """If LLM doesn't include the disclaimer, it should be appended."""
        mock_llm.return_value = "张三数学成绩为 80 分。"
        answer = self.service.generate("张三数学成绩？", {"average": 80.0})
        self.assertIn("⚠️ 数据均来自系统真实记录", answer)

    @patch("school_management.students_grades.services.ai_response_service.call_minimax_safe")
    def test_does_not_duplicate_disclaimer(self, mock_llm):
        """If LLM already includes disclaimer, it should not be duplicated."""
        mock_llm.return_value = "张三数学成绩为 80 分。\n\n⚠️ 数据均来自系统真实记录"
        answer = self.service.generate("test", {"average": 80.0})
        # Count occurrences
        self.assertEqual(answer.count("⚠️ 数据均来自系统真实记录"), 1)

    @patch("school_management.students_grades.services.ai_response_service.call_minimax_safe")
    def test_passes_question_and_data_to_llm(self, mock_llm):
        """Both the original question and data should be passed to LLM."""
        mock_llm.return_value = "answer\n\n⚠️ 数据均来自系统真实记录"
        data = {"key": "value"}
        self.service.generate("What is the score?", data)
        user_prompt = mock_llm.call_args.args[0]
        self.assertIn("What is the score?", user_prompt)
        self.assertIn('"key": "value"', user_prompt)

    @patch("school_management.students_grades.services.ai_response_service.call_minimax_safe")
    def test_uses_correct_system_prompt(self, mock_llm):
        """The system prompt should instruct the LLM to be a grade report writer."""
        mock_llm.return_value = "ok\n\n⚠️ 数据均来自系统真实记录"
        self.service.generate("test", {"a": 1})
        system_prompt = mock_llm.call_args.kwargs["system_prompt"]
        self.assertIn("grade report writer", system_prompt.lower())
        self.assertIn("CRITICAL RULES", system_prompt)

    # ------------------------------------------------------------------
    # Fallback when LLM fails
    # ------------------------------------------------------------------

    @patch("school_management.students_grades.services.ai_response_service.call_minimax_safe")
    def test_fallback_on_llm_exception(self, mock_llm):
        """When LLM call raises, fallback answer is returned."""
        mock_llm.side_effect = RuntimeError("API down")
        answer = self.service.generate(
            "test",
            {"status": "student_not_found", "answer": "未找到学生."},
        )
        self.assertIn("未找到学生", answer)
        self.assertIn("⚠️ 数据均来自系统真实记录", answer)

    @patch("school_management.students_grades.services.ai_response_service.call_minimax_safe")
    def test_fallback_for_subject_not_found(self, mock_llm):
        """Fallback preserves subject_not_found answer."""
        mock_llm.side_effect = RuntimeError("boom")
        data = {
            "status": "subject_not_found",
            "answer": "暂无数学成绩记录。",
        }
        answer = self.service.generate("test", data)
        self.assertIn("暂无数学成绩记录", answer)

    @patch("school_management.students_grades.services.ai_response_service.call_minimax_safe")
    def test_fallback_for_insufficient_data(self, mock_llm):
        """Fallback preserves insufficient_data answer."""
        mock_llm.side_effect = RuntimeError("boom")
        data = {
            "status": "insufficient_data",
            "answer": "数据不足以完成该分析。",
        }
        answer = self.service.generate("test", data)
        self.assertIn("数据不足以完成该分析", answer)

    @patch("school_management.students_grades.services.ai_response_service.call_minimax_safe")
    def test_fallback_generic_data_summary(self, mock_llm):
        """Fallback for generic success data produces a key-value summary."""
        mock_llm.side_effect = RuntimeError("boom")
        data = {"average": 85.5, "max": 100}
        answer = self.service.generate("test", data)
        self.assertIn("查询结果如下", answer)
        self.assertIn("average", answer)
        self.assertIn("⚠️ 数据均来自系统真实记录", answer)

    # ------------------------------------------------------------------
    # Empty / None data
    # ------------------------------------------------------------------

    def test_none_data_returns_fallback(self):
        """When data is None, skip LLM and return hardcoded fallback."""
        answer = self.service.generate("test", None)
        self.assertIn("暂无相关成绩记录", answer)
        self.assertIn("⚠️ 数据均来自系统真实记录", answer)

    def test_empty_dict_data_returns_fallback(self):
        """When data is an empty dict, skip LLM and return hardcoded fallback."""
        answer = self.service.generate("test", {})
        self.assertIn("暂无相关成绩记录", answer)

    @patch("school_management.students_grades.services.ai_response_service.call_minimax_safe")
    def test_non_dict_data_works(self, mock_llm):
        """Non-dict data should still be passed to LLM."""
        mock_llm.return_value = "ok\n\n⚠️ 数据均来自系统真实记录"
        answer = self.service.generate("test", "plain string data")
        self.assertIn("⚠️ 数据均来自系统真实记录", answer)

    # ------------------------------------------------------------------
    # Fallback with non-dict data
    # ------------------------------------------------------------------

    @patch("school_management.students_grades.services.ai_response_service.call_minimax_safe")
    def test_fallback_with_non_dict_data(self, mock_llm):
        """Fallback for non-dict data should still work."""
        mock_llm.side_effect = RuntimeError("boom")
        answer = self.service.generate("test", [1, 2, 3])
        self.assertIn("查询结果", answer)
        self.assertIn("⚠️ 数据均来自系统真实记录", answer)

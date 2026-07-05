"""
Tests for AIQueryView — POST /api/ai/query/ endpoint.

Acceptance criteria covered:
  - AC1: POST /api/ai/query/ receives {question}, returns {success, answer, data, status}
  - AC2: Permission context extracted from request.user automatically
  - AC8: Plan parse failure returns friendly error (via ValueError from service)
  - Integration pipeline: plan → execute → response
"""
import os
import sys

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "school_management.settings_sqlite_test")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))))
import django
django.setup()

import json
import unittest
from unittest.mock import patch, Mock
from datetime import date

from django.test import TestCase, Client
from django.contrib.auth import get_user_model

from school_management.students_grades.models import Class, Student, Exam, Score

User = get_user_model()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

VALID_PLAN = {
    "action": "compare",
    "filters": {"student_name": "张三", "subject": "数学"},
    "limit": 10,
    "requires_comparison": False,
    "requires_ranking": False,
    "requires_disambiguation": False,
    "ambiguous": None,
    "integrity_check": None,
}

PERMISSION_DENIED_PLAN = {
    "action": "permission_denied",
    "filters": {},
    "limit": 10,
    "requires_comparison": False,
    "requires_ranking": False,
    "requires_disambiguation": False,
    "ambiguous": None,
    "integrity_check": None,
}

IRRELEVANT_PLAN = {
    "action": "irrelevant",
    "filters": {},
    "limit": 10,
    "requires_comparison": False,
    "requires_ranking": False,
    "requires_disambiguation": False,
    "ambiguous": None,
    "integrity_check": None,
}

DISAMBIGUATION_PLAN = {
    "action": "compare",
    "filters": {"student_name": "张三"},
    "limit": 10,
    "requires_comparison": False,
    "requires_ranking": False,
    "requires_disambiguation": True,
    "ambiguous": {"type": "exam", "keyword": "月考"},
    "integrity_check": None,
}


class AIQueryViewIntegrationTests(TestCase):
    """Integration tests for POST /api/ai/query/ endpoint.

    These tests mock the LLM call (call_minimax_safe) but test the real
    pipeline: serializer validation → plan execution → response generation.
    """

    @classmethod
    def setUpTestData(cls):
        # Create test data
        cls.cls = Class.objects.create(
            grade_level="初三", class_name="1班", cohort="初中2026级"
        )
        cls.student = Student.objects.create(
            student_id="V001", name="张三", grade_level="初三",
            current_class=cls.cls,
        )
        cls.exam1 = Exam.objects.create(
            name="第一次月考", academic_year="2025-2026",
            grade_level="初中2026级", date=date(2025, 9, 15),
        )
        cls.exam2 = Exam.objects.create(
            name="第二次月考", academic_year="2025-2026",
            grade_level="初中2026级", date=date(2025, 10, 15),
        )
        Score.objects.create(
            student=cls.student, exam=cls.exam1, subject="数学", score_value=85
        )
        Score.objects.create(
            student=cls.student, exam=cls.exam2, subject="数学", score_value=95
        )

        # Create test users
        cls.admin_user = User.objects.create_user(
            username="ai_admin", password="pass123", role="admin",
        )
        cls.teacher_user = User.objects.create_user(
            username="ai_teacher", password="pass123",
            role="subject_teacher",
        )
        cls.staff_user = User.objects.create_user(
            username="ai_staff", password="pass123", role="staff",
        )

    def setUp(self):
        self.client = Client()

    # ------------------------------------------------------------------
    # AC1: POST /api/ai/query/ returns {success, answer, data, status}
    # ------------------------------------------------------------------

    @patch("school_management.students_grades.services.ai_query_plan_service.call_minimax_safe")
    @patch("school_management.students_grades.services.ai_response_service.call_minimax_safe")
    def test_successful_query_returns_expected_schema(self, mock_resp_llm, mock_plan_llm):
        """A valid query should return {success, answer, data, status}."""
        mock_plan_llm.return_value = json.dumps(VALID_PLAN)
        mock_resp_llm.return_value = "张三数学成绩从85分上升到95分。\n\n⚠️ 数据均来自系统真实记录"

        self.client.force_login(self.admin_user)
        response = self.client.post(
            "/api/ai/query/",
            data=json.dumps({"question": "张三数学成绩变化？"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn("success", body)
        self.assertIn("answer", body)
        self.assertIn("data", body)
        self.assertIn("status", body)
        self.assertTrue(body["success"])

    @patch("school_management.students_grades.services.ai_query_plan_service.call_minimax_safe")
    def test_endpoint_accepts_question_and_exam_id(self, mock_plan_llm):
        """The endpoint should accept question + optional exam_id."""
        mock_plan_llm.return_value = json.dumps(VALID_PLAN)

        self.client.force_login(self.admin_user)
        response = self.client.post(
            "/api/ai/query/",
            data=json.dumps({"question": "test", "exam_id": 99}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        # Verify exam_id was injected (check plan service received it)
        call_kwargs = mock_plan_llm.call_args
        # exam_id is appended to user_prompt text
        user_prompt = call_kwargs.args[0]  # first positional arg = user_prompt
        self.assertIn("exam_id=99", user_prompt)

    # ------------------------------------------------------------------
    # AC2: Permission context extracted from request.user automatically
    # ------------------------------------------------------------------

    @patch("school_management.students_grades.services.ai_query_plan_service.call_minimax_safe")
    @patch("school_management.students_grades.services.ai_response_service.call_minimax_safe")
    def test_permission_context_extracted_from_user(self, mock_resp_llm, mock_plan_llm):
        """role/teaching_classes/managed_grade should come from request.user, not request body."""
        mock_plan_llm.return_value = json.dumps(VALID_PLAN)
        mock_resp_llm.return_value = "ok\n\n⚠️ 数据均来自系统真实记录"

        self.cls.subject_teachers.add(self.teacher_user)

        self.client.force_login(self.teacher_user)
        response = self.client.post(
            "/api/ai/query/",
            data=json.dumps({"question": "test"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)

        # Verify the system prompt received the user's role
        system_prompt = mock_plan_llm.call_args.kwargs["system_prompt"]
        self.assertIn("subject_teacher", system_prompt)

    # ------------------------------------------------------------------
    # Authorization: unauthenticated requests rejected
    # ------------------------------------------------------------------

    def test_unauthenticated_request_rejected(self):
        """Requests without authentication should return 401/403."""
        response = self.client.post(
            "/api/ai/query/",
            data=json.dumps({"question": "test"}),
            content_type="application/json",
        )
        self.assertIn(response.status_code, [401, 403])

    # ------------------------------------------------------------------
    # Input validation
    # ------------------------------------------------------------------

    def test_missing_question_returns_400(self):
        """POST without 'question' field should return 400."""
        self.client.force_login(self.admin_user)
        response = self.client.post(
            "/api/ai/query/",
            data=json.dumps({}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        body = response.json()
        self.assertFalse(body["success"])

    # ------------------------------------------------------------------
    # AC8: Plan parse failure returns friendly error
    # ------------------------------------------------------------------

    @patch("school_management.students_grades.services.ai_query_plan_service.call_minimax_safe")
    @patch("school_management.students_grades.services.ai_response_service.call_minimax_safe")
    def test_plan_failure_returns_friendly_error(self, mock_resp_llm, mock_plan_llm):
        """When plan generation fails after retry, return friendly 200 with error."""
        # Both attempts fail to produce valid JSON
        mock_plan_llm.side_effect = ValueError(
            "AI 无法生成有效的查询计划，请尝试更具体的描述，"
            "如'张三数学成绩变化'或'初三1班数学平均分'"
        )
        # mock_resp_llm shouldn't be called at all

        self.client.force_login(self.admin_user)
        response = self.client.post(
            "/api/ai/query/",
            data=json.dumps({"question": "asdf@@@##!!"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertFalse(body["success"])
        self.assertEqual(body["status"], "plan_error")
        self.assertIn("AI 无法生成有效的查询计划", body["answer"])

    # ------------------------------------------------------------------
    # AC6: permission_denied in plan → rejected with hint
    # ------------------------------------------------------------------

    @patch("school_management.students_grades.services.ai_query_plan_service.call_minimax_safe")
    def test_permission_denied_from_plan(self, mock_plan_llm):
        """When LLM returns permission_denied action, endpoint rejects with hint."""
        mock_plan_llm.return_value = json.dumps(PERMISSION_DENIED_PLAN)

        self.client.force_login(self.teacher_user)
        response = self.client.post(
            "/api/ai/query/",
            data=json.dumps({"question": "所有学生的全部成绩"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["status"], "permission_denied")
        self.assertIn("无法查看", body["answer"])

    # ------------------------------------------------------------------
    # AC7: irrelevant action returns "只回答成绩相关问题"
    # ------------------------------------------------------------------

    @patch("school_management.students_grades.services.ai_query_plan_service.call_minimax_safe")
    def test_irrelevant_from_plan(self, mock_plan_llm):
        """When LLM returns irrelevant action, endpoint returns grades-only message."""
        mock_plan_llm.return_value = json.dumps(IRRELEVANT_PLAN)

        self.client.force_login(self.admin_user)
        response = self.client.post(
            "/api/ai/query/",
            data=json.dumps({"question": "今天天气怎么样？"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["status"], "irrelevant")
        self.assertEqual(body["answer"], "抱歉，我只回答成绩相关问题。")

    # ------------------------------------------------------------------
    # AC10: Disambiguation returns hardcoded answer, no LLM response
    # ------------------------------------------------------------------

    @patch("school_management.students_grades.services.ai_query_plan_service.call_minimax_safe")
    @patch("school_management.students_grades.services.ai_response_service.call_minimax_safe")
    def test_disambiguation_returns_hardcoded_answer(self, mock_resp_llm, mock_plan_llm):
        """Disambiguation should return early with candidates, NOT call response LLM."""
        mock_plan_llm.return_value = json.dumps(DISAMBIGUATION_PLAN)

        self.client.force_login(self.admin_user)
        response = self.client.post(
            "/api/ai/query/",
            data=json.dumps({"question": "张三月考成绩？"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["status"], "ambiguous")
        self.assertTrue(body.get("requires_disambiguation"))
        self.assertIn("candidates", body)
        # Response LLM should NOT have been called
        mock_resp_llm.assert_not_called()

    # ------------------------------------------------------------------
    # student_not_found / subject_not_found skip response LLM
    # ------------------------------------------------------------------

    @patch("school_management.students_grades.services.ai_query_plan_service.call_minimax_safe")
    @patch("school_management.students_grades.services.ai_response_service.call_minimax_safe")
    def test_student_not_found_skips_response_llm(self, mock_resp_llm, mock_plan_llm):
        """When executor returns student_not_found, response LLM should NOT be called."""
        plan = {
            "action": "compare",
            "filters": {"student_name": "不存在的人", "subject": "数学"},
            "limit": 10,
            "requires_comparison": False,
            "requires_ranking": False,
            "requires_disambiguation": False,
            "ambiguous": None,
            "integrity_check": None,
        }
        mock_plan_llm.return_value = json.dumps(plan)

        self.client.force_login(self.admin_user)
        response = self.client.post(
            "/api/ai/query/",
            data=json.dumps({"question": "test"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["status"], "student_not_found")
        mock_resp_llm.assert_not_called()

    @patch("school_management.students_grades.services.ai_query_plan_service.call_minimax_safe")
    @patch("school_management.students_grades.services.ai_response_service.call_minimax_safe")
    def test_insufficient_data_skips_response_llm(self, mock_resp_llm, mock_plan_llm):
        """When executor returns insufficient_data, response LLM should NOT be called."""
        plan = {
            "action": "compare",
            "filters": {"student_name": "张三", "subject": "体育"},
            "limit": 10,
            "requires_comparison": False,
            "requires_ranking": False,
            "requires_disambiguation": False,
            "ambiguous": None,
            "integrity_check": None,
        }
        mock_plan_llm.return_value = json.dumps(plan)

        self.client.force_login(self.admin_user)
        response = self.client.post(
            "/api/ai/query/",
            data=json.dumps({"question": "test"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        # For 张三 + 体育, we expect subject_not_found
        self.assertIn(body["status"], ["subject_not_found", "insufficient_data"])
        mock_resp_llm.assert_not_called()

    # ------------------------------------------------------------------
    # Edge case: URL with trailing slash
    # ------------------------------------------------------------------

    def test_endpoint_without_trailing_slash(self):
        """The endpoint should also work without trailing slash."""
        self.client.force_login(self.admin_user)

        with patch(
            "school_management.students_grades.services.ai_query_plan_service.call_minimax_safe"
        ) as mock_plan:
            with patch(
                "school_management.students_grades.services.ai_response_service.call_minimax_safe"
            ) as mock_resp:
                mock_plan.return_value = json.dumps(VALID_PLAN)
                mock_resp.return_value = "ok\n\n⚠️ 数据均来自系统真实记录"

                response = self.client.post(
                    "/api/ai/query",
                    data=json.dumps({"question": "test"}),
                    content_type="application/json",
                )
                self.assertEqual(response.status_code, 200)
                self.assertTrue(response.json()["success"])

    # ------------------------------------------------------------------
    # Non-JSON content type
    # ------------------------------------------------------------------

    @patch("school_management.students_grades.services.ai_query_plan_service.call_minimax_safe")
    def test_non_json_content_type(self, mock_plan_llm):
        """Requests with non-JSON content type should be handled or return error."""
        mock_plan_llm.return_value = json.dumps(IRRELEVANT_PLAN)
        self.client.force_login(self.admin_user)
        response = self.client.post(
            "/api/ai/query/",
            data="question=test",
            content_type="application/x-www-form-urlencoded",
        )
        # Should either accept form data or return 400/415
        self.assertIn(response.status_code, [200, 400, 415])

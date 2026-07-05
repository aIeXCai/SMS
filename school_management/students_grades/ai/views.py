"""
AI Query API endpoint.

POST /api/ai/query/

Orchestrates the three-step pipeline:
  1. Query plan generation (LLM interprets intent → JSON plan)
  2. Query execution (backend runs SQL, all numbers real)
  3. Response generation (LLM composes natural-language answer)

Permission context (teaching_classes, managed_grade) is extracted
automatically from request.user — the frontend does NOT send it.
"""

import logging

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from ..services.ai_query_plan_service import AIQueryPlanService
from ..services.ai_query_executor import AIQueryExecutor
from ..services.ai_response_service import AIResponseService
from .serializers import AIQueryRequestSerializer

logger = logging.getLogger(__name__)


class AIQueryView(APIView):
    """
    Accept a natural-language question and return a data-backed answer.

    Request:  { "question": "...", "exam_id": optional int }
    Response: { "success": bool, "answer": "...", "data": {...}, "status": "..." }
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        # --- Validate input ---
        req_serializer = AIQueryRequestSerializer(data=request.data)
        if not req_serializer.is_valid():
            return Response(
                {"success": False, "answer": "请提供有效的问题描述。"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        question = req_serializer.validated_data["question"]
        exam_id = req_serializer.validated_data.get("exam_id")

        user = request.user
        role = getattr(user, "role", "staff")
        managed_grade = getattr(user, "managed_grade", None) or None

        # Build teaching_classes list (display names)
        teaching_classes: list = []
        if hasattr(user, "teaching_classes"):
            for cls in user.teaching_classes.all():
                teaching_classes.append(str(cls))

        # ================================================================
        # Step 1 — Generate query plan via LLM
        # ================================================================
        plan_service = AIQueryPlanService()
        try:
            plan = plan_service.generate(
                question=question,
                role=role,
                teaching_classes=teaching_classes if teaching_classes else None,
                managed_grade=managed_grade,
                exam_id=exam_id,
            )
        except ValueError as exc:
            logger.warning("Query plan generation failed: %s", exc)
            return Response(
                {
                    "success": False,
                    "answer": str(exc),
                    "data": None,
                    "status": "plan_error",
                }
            )

        # Keep the raw question available to the deterministic backend
        # resolver. The resolver uses it for fuzzy business terms such as
        # "期中考" -> exams whose real names contain "期中".
        plan["_question"] = question
        if exam_id and plan.get("filters"):
            plan["filters"]["exam_id"] = exam_id
            plan["requires_disambiguation"] = False
            plan["ambiguous"] = None
        action = plan.get("action", "")

        # ================================================================
        # Quick-reject paths (permission_denied, irrelevant)
        # ================================================================
        if action == "permission_denied":
            answer = AIQueryExecutor._build_permission_denied_answer(
                role, teaching_classes if teaching_classes else None, managed_grade
            )
            return Response(
                {
                    "success": True,
                    "answer": answer,
                    "data": None,
                    "status": "permission_denied",
                }
            )

        if action == "irrelevant":
            return Response(
                {
                    "success": True,
                    "answer": "抱歉，我只回答成绩相关问题。",
                    "data": None,
                    "status": "irrelevant",
                }
            )

        # ================================================================
        # Disambiguation early return (PRD 3.5 — no DB score query)
        # ================================================================
        if plan.get("requires_disambiguation"):
            executor = AIQueryExecutor()
            disambig = executor.execute(plan, role, teaching_classes, managed_grade)
            return Response(
                {
                    "success": True,
                    "answer": disambig.get("answer", ""),
                    "data": None,
                    "status": "ambiguous",
                    "requires_disambiguation": True,
                    "candidates": disambig.get("candidates", []),
                }
            )

        # ================================================================
        # Step 2 — Execute query against the real database
        # ================================================================
        executor = AIQueryExecutor()
        exec_result = executor.execute(plan, role, teaching_classes, managed_grade)

        exec_status = exec_result.get("status", "")

        # If executor already produced a hardcoded answer (student_not_found,
        # subject_not_found, insufficient_data, permission_denied, unknown_action)
        # return it directly — no need for Step 3 LLM call.
        if exec_status in (
            "student_not_found",
            "subject_not_found",
            "insufficient_data",
            "permission_denied",
            "irrelevant",
            "unknown_action",
            "ambiguous",
        ):
            return Response(
                {
                    "success": exec_result.get("success", True),
                    "answer": exec_result.get("answer", exec_result.get("hint", "")),
                    "data": exec_result.get("data"),
                    "status": exec_status,
                }
            )

        # ================================================================
        # Step 3 — Compose natural-language answer via LLM
        # ================================================================
        response_service = AIResponseService()
        answer = response_service.generate(question, exec_result.get("data"))

        return Response(
            {
                "success": True,
                "answer": answer,
                "data": exec_result.get("data"),
                "status": exec_status or "success",
            }
        )

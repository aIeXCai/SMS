"""Score Agent facade — V3 ReAct agent with V1 fallback."""

import logging
import uuid

from django.conf import settings

from .service import ScoreAgentService

logger = logging.getLogger(__name__)


class ScoreAgentServiceV2:
    """Facade: routes to V3 ReAct agent; falls back to V1 on crash."""

    def __init__(self, base_service=None):
        self.base_service = base_service or ScoreAgentService()

    def handle(self, *, message, context=None, clarification_reply=None, user=None):
        return self._handle_v3(
            message=message,
            context=context,
            clarification_reply=clarification_reply,
            user=user,
        )

    # ---- V3: ReAct agent ----
    def _handle_v3(self, message, context, clarification_reply, user):
        from .agent import run_agent

        request_id = str(uuid.uuid4())
        try:
            result = run_agent(
                user_message=message,
                context=context or {},
                clarification_reply=clarification_reply,
                user=user,
            )
            result["request_id"] = request_id
            return result
        except Exception:
            logger.exception("V3 agent crashed, falling back to V1")
            return self._fallback_to_v1(request_id, message, context, clarification_reply, user)

    # ---- V1 fallback ----
    def _fallback_to_v1(self, request_id, message, context, clarification_reply, user):
        try:
            result = self.base_service.handle(
                message=message,
                context=context or {},
                clarification_reply=clarification_reply,
                user=user,
            )
            result["request_id"] = request_id
            return result
        except Exception:
            return {
                "request_id": request_id,
                "type": "error",
                "status": "tool_error",
                "message": "成绩分析服务当前不可用，请稍后重试。",
                "fallback": {"available": False, "reason": "agent_unhandled_exception"},
            }

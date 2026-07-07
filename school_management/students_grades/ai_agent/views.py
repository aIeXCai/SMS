"""DRF views for the score Agent."""

import logging

from django.conf import settings
from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .service import ScoreAgentService
from .service_v2 import ScoreAgentServiceV2

logger = logging.getLogger(__name__)


class ScoreAgentRequestSerializer(serializers.Serializer):
    message = serializers.CharField(required=True, max_length=500)
    conversation_id = serializers.CharField(required=False, allow_blank=True)
    context = serializers.JSONField(required=False)
    clarification_reply = serializers.JSONField(required=False)


class ScoreAgentQueryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ScoreAgentRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    "type": "error",
                    "status": "parse_error",
                    "message": "请提供有效的问题描述。",
                    "fallback": {"available": False, "reason": "invalid_request"},
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        service = ScoreAgentServiceV2() if (getattr(settings, 'AI_AGENT_V2_ENABLED', False) or getattr(settings, 'AI_AGENT_V3_ENABLED', False)) else ScoreAgentService()
        try:
            result = service.handle(
                message=serializer.validated_data["message"],
                context=serializer.validated_data.get("context") or {},
                clarification_reply=serializer.validated_data.get("clarification_reply"),
                user=request.user,
            )
        except Exception as exc:  # pragma: no cover - defensive API guard
            logger.exception("Score Agent failed: %s", exc)
            return Response(
                {
                    "type": "error",
                    "status": "tool_error",
                    "message": "这次分析没有成功完成，可能是数据范围过大或计算步骤过多。",
                    "actions": [{"type": "retry_agent", "label": "重新生成"}],
                    "fallback": {
                        "available": False,
                        "reason": "agent_unhandled_exception",
                    },
                }
            )

        return Response(result)

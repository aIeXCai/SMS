"""Desensitized audit logging for V3 score Agent."""

import hashlib
import json
import logging
import time

from django.conf import settings

from .minimizer import mask_name

logger = logging.getLogger("school_management.ai_agent.audit")


class AgentAuditContext:
    def __init__(self, request_id, security_context, message):
        self.request_id = request_id
        self.security_context = security_context
        self.message_hash = hashlib.sha256((message or "").encode("utf-8")).hexdigest()[:16]
        self.started_at = time.monotonic()
        self.tool_calls = []
        self.status = "started"
        self.fallback_reason = None

    def record_tool(self, tool_name, args, status, duration_ms):
        self.tool_calls.append(
            {
                "tool": tool_name,
                "args": self._sanitize_args(args),
                "status": status,
                "duration_ms": round(duration_ms, 2),
            }
        )

    def finish(self, status, fallback_reason=None):
        if not getattr(settings, "AI_AGENT_AUDIT_LOG_ENABLED", True):
            return
        self.status = status
        self.fallback_reason = fallback_reason
        payload = {
            "request_id": self.request_id,
            "user_id": self.security_context.user_id if self.security_context else None,
            "role": self.security_context.role if self.security_context else None,
            "scope": self.security_context.scope_summary() if self.security_context else None,
            "message_hash": self.message_hash,
            "tool_calls": self.tool_calls,
            "status": status,
            "fallback_reason": fallback_reason,
            "duration_ms": round((time.monotonic() - self.started_at) * 1000, 2),
        }
        logger.info("score_agent_audit %s", json.dumps(payload, ensure_ascii=False))

    def _sanitize_args(self, args):
        clean = {}
        for key, value in (args or {}).items():
            if key in {"student_id", "student_ids"}:
                continue
            if key in {"student_name", "name", "keyword"} and isinstance(value, str):
                clean[key] = mask_name(value)
            else:
                clean[key] = value
        return clean

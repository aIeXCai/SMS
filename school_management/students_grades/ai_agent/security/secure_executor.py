"""Secure Tool execution layer for V3."""

import time

from .minimizer import minimize_tool_result
from .numeric_guard import extract_numeric_facts
from .permissions import AgentPermissionError, permission_denied_result


class SecureToolExecutor:
    def __init__(self, registry):
        self.registry = registry

    def execute(self, tool_name, tool_args, security_context, audit_context=None):
        started_at = time.monotonic()
        status = "success"
        try:
            info = self.registry.get(tool_name)
            if not info:
                status = "unknown_tool"
                return {"error": f"未知工具: {tool_name}", "suggestion": f"可用工具: {list(self.registry.keys())}"}
            if not security_context or not security_context.allowed:
                status = "permission_denied"
                return permission_denied_result()

            result = info["func"](**(tool_args or {}), security_context=security_context)
            if not isinstance(result, dict):
                result = {"result": result}
            if result.get("status") == "permission_denied":
                status = "permission_denied"
                return permission_denied_result()

            minimized = minimize_tool_result(tool_name, result)
            return {
                "raw_result": result,
                "llm_observation": minimized,
                "numeric_facts": extract_numeric_facts(result),
            }
        except AgentPermissionError:
            status = "permission_denied"
            return permission_denied_result()
        except Exception as exc:
            status = "tool_error"
            return {
                "error": f"工具 {tool_name} 执行失败",
                "suggestion": "请检查参数是否正确，必要时重新搜索",
                "debug_reason": exc.__class__.__name__,
            }
        finally:
            if audit_context:
                audit_context.record_tool(
                    tool_name,
                    tool_args or {},
                    status,
                    (time.monotonic() - started_at) * 1000,
                )

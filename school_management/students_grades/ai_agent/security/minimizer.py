"""Minimize Tool observations before they are sent to MiniMax."""

import re

SENSITIVE_KEYS = {
    "student_id",
    "student_ids",
    "id_card",
    "phone",
    "mobile",
    "email",
    "account",
    "password",
    "api_key",
    "raw_sql",
    "sql",
    "stack",
    "traceback",
    "raw_request_body",
    "request_body",
    "body",
    "secret",
    "secret_key",
    "token",
    "access_token",
    "refresh_token",
    "authorization",
    "apikey",
    "api_key",
    "key",
}

SENSITIVE_KEY_PARTS = (
    "secret",
    "token",
    "authorization",
    "api_key",
    "apikey",
    "password",
    "raw_request",
    "request_body",
)


def _normalize_key(key):
    text = str(key or "")
    snake = re.sub(r"(?<!^)(?=[A-Z])", "_", text).lower()
    return re.sub(r"[^a-z0-9_]", "_", snake).strip("_")


def _is_sensitive_key(key):
    normalized = _normalize_key(key)
    return normalized in SENSITIVE_KEYS or any(part in normalized for part in SENSITIVE_KEY_PARTS)


def mask_name(name):
    if not name:
        return ""
    text = str(name)
    if len(text) <= 1:
        return "*"
    if len(text) == 2:
        return text[0] + "*"
    return text[0] + "*" * (len(text) - 2) + text[-1]


def _sanitize(value):
    if isinstance(value, dict):
        clean = {}
        for key, item in value.items():
            if _is_sensitive_key(key):
                continue
            if key == "name" or key == "student_name":
                clean[key] = mask_name(item)
            elif key == "students" and isinstance(item, list):
                clean[key] = [_sanitize(row) for row in item[:10]]
            elif key == "rows" and isinstance(item, list):
                clean[key] = [_sanitize(row) for row in item[:10]]
            else:
                clean[key] = _sanitize(item)
        return clean
    if isinstance(value, list):
        return [_sanitize(item) for item in value[:20]]
    return value


def minimize_tool_result(tool_name, result):
    if not isinstance(result, dict):
        return result
    minimized = _sanitize(result)
    if tool_name in {"get_top_n", "compute_weighted"} and isinstance(minimized.get("rows"), list):
        minimized["rows"] = minimized["rows"][:10]
    return minimized

"""
MiniMax API client with semaphore-based concurrency control.

Usage:
    from school_management.students_grades.services.ai_minimax_client import call_minimax, call_minimax_safe

    # Direct call (no concurrency limit)
    reply = call_minimax("Hello")

    # Safe call (max 5 concurrent, gated by threading.Semaphore)
    reply = call_minimax_safe("Hello")

gunicorn note:
    Because concurrency is already bounded by Semaphore(5) within the process,
    running more than 1 gunicorn worker defeats the limit — 2 workers would allow
    up to 10 concurrent API calls.  Start gunicorn with:

        gunicorn school_management.wsgi:application --workers 1 --bind 0.0.0.0:8000
"""

import os
import logging
import threading
from typing import Optional

import requests

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

MINIMAX_API_KEY = os.getenv("MINIMAX_API_KEY", "")
MINIMAX_BASE_URL = os.getenv(
    "MINIMAX_BASE_URL",
    "https://api.minimax.chat/v1/text/chatcompletion_v2",
)
DEFAULT_TIMEOUT = 60  # seconds (M2.7 is a reasoning model, needs extra time)
DEFAULT_MODEL = "MiniMax-M2.7"

# ---------------------------------------------------------------------------
# Semaphore — global per-process gate
# ---------------------------------------------------------------------------

_MAX_CONCURRENT = int(os.getenv("MINIMAX_MAX_CONCURRENT", "5"))
_semaphore = threading.Semaphore(_MAX_CONCURRENT)


def call_minimax(
    prompt: str,
    *,
    model: str = DEFAULT_MODEL,
    system_prompt: Optional[str] = None,
    temperature: float = 0.1,
    max_tokens: int = 4096,
    timeout: int = DEFAULT_TIMEOUT,
    api_key: Optional[str] = None,
) -> str:
    """
    Call MiniMax chat completion API and return the assistant's text reply.

    Args:
        prompt: User message text.
        model: MiniMax model name.
        system_prompt: Optional system-level instruction.
        temperature: Sampling temperature (0-1).
        max_tokens: Maximum tokens in the response.
        timeout: HTTP timeout in seconds (default 30).
        api_key: Override API key (falls back to MINIMAX_API_KEY env var).

    Returns:
        The text content of the first assistant choice.

    Raises:
        requests.Timeout: If the request exceeds *timeout* seconds.
        requests.HTTPError: On non-2xx responses.
        ValueError: If MINIMAX_API_KEY is not configured.
    """
    key = api_key or MINIMAX_API_KEY
    if not key:
        raise ValueError(
            "MINIMAX_API_KEY is not set. "
            "Export it as an environment variable or pass api_key=."
        )

    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }

    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    logger.info("=" * 60)
    logger.info(">>> LLM REQUEST: model=%s, timeout=%ds, max_tokens=%d", model, timeout, max_tokens)
    logger.info(">>> SYSTEM PROMPT:\n%s", system_prompt or "(none)")
    logger.info(">>> USER PROMPT:\n%s", prompt[:2000])

    resp = requests.post(
        MINIMAX_BASE_URL,
        json=payload,
        headers=headers,
        timeout=timeout,
    )
    resp.raise_for_status()

    data = resp.json()

    # MiniMax returns: {"choices": [{"message": {"content": "..."}}], ...}
    try:
        content = data["choices"][0]["message"]["content"]
        reasoning = data["choices"][0]["message"].get("reasoning_content", "")
        usage = data.get("usage", {})
        logger.info("<<< LLM RESPONSE: tokens=%s, content_len=%d, reasoning_len=%d",
                     usage.get("total_tokens", "?"), len(content or ""), len(reasoning))
        logger.info("<<< REASONING:\n%s", reasoning[:1000] if reasoning else "(none)")
        logger.info("<<< CONTENT:\n%s", (content or "")[:2000])
        logger.info("=" * 60)
        return content
    except (KeyError, IndexError, TypeError) as exc:
        logger.error("Unexpected MiniMax response shape: %s", data)
        raise ValueError(f"Failed to parse MiniMax response: {exc}") from exc


def call_minimax_safe(
    prompt: str,
    *,
    model: str = DEFAULT_MODEL,
    system_prompt: Optional[str] = None,
    temperature: float = 0.1,
    max_tokens: int = 4096,
    timeout: int = DEFAULT_TIMEOUT,
    api_key: Optional[str] = None,
) -> str:
    """
    Same as :func:`call_minimax` but gated by ``threading.Semaphore(5)``.

    At most ``_MAX_CONCURRENT`` threads may hold the semaphore simultaneously;
    additional callers block until a slot is released.
    """
    acquired = _semaphore.acquire(timeout=timeout * 2)
    if not acquired:
        raise RuntimeError(
            f"MiniMax semaphore acquire timed out after {timeout * 2}s "
            f"(max concurrent: {_MAX_CONCURRENT})"
        )
    try:
        return call_minimax(
            prompt,
            model=model,
            system_prompt=system_prompt,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=timeout,
            api_key=api_key,
        )
    finally:
        _semaphore.release()

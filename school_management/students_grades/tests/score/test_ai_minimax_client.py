"""
Tests for ai_minimax_client — MiniMax API client with semaphore concurrency control.
"""
import os
import sys

# Configure Django before any project imports
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "school_management.settings")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))))
import django
django.setup()

import threading
import unittest
from unittest.mock import patch, MagicMock, Mock

import requests

# Import the module under test (once Django is configured)
from school_management.students_grades.services.ai_minimax_client import (
    call_minimax,
    call_minimax_safe,
    DEFAULT_TIMEOUT,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_mock_response(status_code=200, json_data=None):
    """Build a requests.Response mock with given status and JSON body."""
    mock_resp = MagicMock(spec=requests.Response)
    mock_resp.status_code = status_code
    mock_resp.json.return_value = json_data
    mock_resp.raise_for_status = Mock()
    if status_code >= 400:
        http_error = requests.HTTPError(f"{status_code} Error")
        mock_resp.raise_for_status.side_effect = http_error
    return mock_resp


# ---------------------------------------------------------------------------
# call_minimax tests
# ---------------------------------------------------------------------------

class CallMinimaxTests(unittest.TestCase):
    """Tests for the core call_minimax() function."""

    def setUp(self):
        # Ensure a dummy API key is set so most tests pass the key check
        os.environ["MINIMAX_API_KEY"] = "test-key-12345"

    def tearDown(self):
        os.environ.pop("MINIMAX_API_KEY", None)

    def test_normal_response_returns_content(self):
        """call_minimax should parse the standard MiniMax response shape."""
        mock_resp = _make_mock_response(200, {
            "choices": [{"message": {"content": "Hello, world!"}}]
        })

        with patch(
            "school_management.students_grades.services.ai_minimax_client.requests.post",
            return_value=mock_resp,
        ) as mock_post:
            result = call_minimax("Hi")

        self.assertEqual(result, "Hello, world!")
        mock_post.assert_called_once()
        # Verify payload structure
        call_kwargs = mock_post.call_args.kwargs
        self.assertEqual(call_kwargs["timeout"], 30)  # default
        json_body = call_kwargs["json"]
        self.assertIn("model", json_body)
        self.assertEqual(json_body["messages"][-1]["content"], "Hi")

    def test_raises_valueerror_when_no_api_key(self):
        """call_minimax must raise ValueError if MINIMAX_API_KEY is unset."""
        # Patch the module-level MINIMAX_API_KEY to empty
        with patch(
            "school_management.students_grades.services.ai_minimax_client.MINIMAX_API_KEY",
            "",
        ):
            with self.assertRaises(ValueError) as ctx:
                call_minimax("prompt")
            self.assertIn("MINIMAX_API_KEY", str(ctx.exception))

    def test_uses_explicit_api_key_over_env(self):
        """Explicit api_key parameter should override the env var."""
        mock_resp = _make_mock_response(200, {
            "choices": [{"message": {"content": "ok"}}]
        })

        with patch(
            "school_management.students_grades.services.ai_minimax_client.requests.post",
            return_value=mock_resp,
        ) as mock_post:
            call_minimax("prompt", api_key="explicit-key")

        headers = mock_post.call_args.kwargs["headers"]
        self.assertEqual(headers["Authorization"], "Bearer explicit-key")

    def test_includes_system_prompt_when_provided(self):
        """When system_prompt is given, a system role message is prepended."""
        mock_resp = _make_mock_response(200, {
            "choices": [{"message": {"content": "ok"}}]
        })

        with patch(
            "school_management.students_grades.services.ai_minimax_client.requests.post",
            return_value=mock_resp,
        ) as mock_post:
            call_minimax("prompt", system_prompt="You are helpful.")

        messages = mock_post.call_args.kwargs["json"]["messages"]
        self.assertEqual(len(messages), 2)
        self.assertEqual(messages[0]["role"], "system")
        self.assertEqual(messages[0]["content"], "You are helpful.")

    def test_timeout_30_seconds_by_default(self):
        """Requests.post timeout parameter must be 30 by default."""
        mock_resp = _make_mock_response(200, {
            "choices": [{"message": {"content": "ok"}}]
        })

        with patch(
            "school_management.students_grades.services.ai_minimax_client.requests.post",
            return_value=mock_resp,
        ) as mock_post:
            call_minimax("prompt")

        self.assertEqual(mock_post.call_args.kwargs["timeout"], 30)

    def test_raises_on_http_error(self):
        """On non-2xx status, raise_for_status() propagates the HTTPError."""
        mock_resp = _make_mock_response(500, {})

        with patch(
            "school_management.students_grades.services.ai_minimax_client.requests.post",
            return_value=mock_resp,
        ):
            with self.assertRaises(requests.HTTPError):
                call_minimax("prompt")

    def test_raises_valueerror_on_malformed_response(self):
        """If the response JSON lacks expected keys, a ValueError is raised."""
        mock_resp = _make_mock_response(200, {"unexpected": "shape"})

        with patch(
            "school_management.students_grades.services.ai_minimax_client.requests.post",
            return_value=mock_resp,
        ):
            with self.assertRaises(ValueError) as ctx:
                call_minimax("prompt")
            self.assertIn("Failed to parse MiniMax response", str(ctx.exception))

    def test_raises_valueerror_on_empty_choices(self):
        """Empty choices list should also trigger parse error."""
        mock_resp = _make_mock_response(200, {"choices": []})

        with patch(
            "school_management.students_grades.services.ai_minimax_client.requests.post",
            return_value=mock_resp,
        ):
            with self.assertRaises(ValueError):
                call_minimax("prompt")

    def test_respects_custom_timeout(self):
        """Custom timeout value should be passed through to requests.post."""
        mock_resp = _make_mock_response(200, {
            "choices": [{"message": {"content": "ok"}}]
        })

        with patch(
            "school_management.students_grades.services.ai_minimax_client.requests.post",
            return_value=mock_resp,
        ) as mock_post:
            call_minimax("prompt", timeout=15)

        self.assertEqual(mock_post.call_args.kwargs["timeout"], 15)

    def test_timeout_exception_propagates(self):
        """requests.Timeout must bubble up to the caller."""
        with patch(
            "school_management.students_grades.services.ai_minimax_client.requests.post",
            side_effect=requests.Timeout("timed out"),
        ):
            with self.assertRaises(requests.Timeout):
                call_minimax("prompt")

    def test_api_key_not_hardcoded(self):
        """MINIMAX_API_KEY must come from os.getenv, not a hardcoded literal."""
        import inspect
        import school_management.students_grades.services.ai_minimax_client as mod

        source = inspect.getsource(mod)
        # The module must use os.getenv("MINIMAX_API_KEY"...) — not a hardcoded string
        self.assertIn('os.getenv("MINIMAX_API_KEY"', source,
                       "MINIMAX_API_KEY should be read via os.getenv, not hardcoded")
        # Verify no hardcoded real-looking API key present
        self.assertNotIn('eyJ', source, "Hardcoded JWT-like token detected")

    def test_api_key_patchable_at_module_level(self):
        """Patching the module-level MINIMAX_API_KEY should affect the call."""
        mock_resp = _make_mock_response(200, {
            "choices": [{"message": {"content": "ok"}}]
        })

        with patch(
            "school_management.students_grades.services.ai_minimax_client.MINIMAX_API_KEY",
            "env-provided-key",
        ):
            with patch(
                "school_management.students_grades.services.ai_minimax_client.requests.post",
                return_value=mock_resp,
            ) as mock_post:
                call_minimax("prompt")

            headers = mock_post.call_args.kwargs["headers"]
            self.assertEqual(headers["Authorization"], "Bearer env-provided-key")


# ---------------------------------------------------------------------------
# call_minimax_safe tests — concurrency gating via Semaphore(5)
# ---------------------------------------------------------------------------

class CallMinimaxSafeTests(unittest.TestCase):
    """Tests for call_minimax_safe() semaphore-based concurrency control."""

    def setUp(self):
        os.environ["MINIMAX_API_KEY"] = "test-key-12345"

    def tearDown(self):
        os.environ.pop("MINIMAX_API_KEY", None)

    def test_calls_minimax_on_success(self):
        """call_minimax_safe should delegate to call_minimax and return its result."""
        mock_resp = _make_mock_response(200, {
            "choices": [{"message": {"content": "gated response"}}]
        })

        with patch(
            "school_management.students_grades.services.ai_minimax_client.requests.post",
            return_value=mock_resp,
        ):
            result = call_minimax_safe("test prompt")

        self.assertEqual(result, "gated response")

    def test_semaphore_released_after_call(self):
        """Semaphore must be released even if the underlying call succeeds."""
        mock_resp = _make_mock_response(200, {
            "choices": [{"message": {"content": "ok"}}]
        })

        from school_management.students_grades.services.ai_minimax_client import _semaphore

        with patch(
            "school_management.students_grades.services.ai_minimax_client.requests.post",
            return_value=mock_resp,
        ):
            before = _semaphore._value
            call_minimax_safe("p")
            after = _semaphore._value

        self.assertEqual(before, after, "semaphore should be released after call")

    def test_semaphore_released_on_error(self):
        """Semaphore must be released even when call_minimax raises."""
        from school_management.students_grades.services.ai_minimax_client import _semaphore

        with patch(
            "school_management.students_grades.services.ai_minimax_client.requests.post",
            side_effect=requests.Timeout("boom"),
        ):
            before = _semaphore._value
            try:
                call_minimax_safe("p")
            except requests.Timeout:
                pass
            after = _semaphore._value

        self.assertEqual(before, after, "semaphore must be released on error too")

    def test_concurrent_calls_limited(self):
        """No more than _MAX_CONCURRENT threads can call minimax simultaneously."""
        import time
        from school_management.students_grades.services.ai_minimax_client import _MAX_CONCURRENT

        count = [0]
        max_observed = [0]
        lock = threading.Lock()
        # Event-based gate: threads block inside fake_post until released
        inner_gate = threading.Event()
        results = []

        def fake_post(*args, **kwargs):
            with lock:
                count[0] += 1
                if count[0] > max_observed[0]:
                    max_observed[0] = count[0]
            # All threads that enter must wait here, so we observe the peak count
            inner_gate.wait(timeout=15)
            with lock:
                count[0] -= 1
            return _make_mock_response(200, {
                "choices": [{"message": {"content": "ok"}}]
            })

        def worker():
            try:
                results.append(call_minimax_safe("prompt", timeout=10))
            except Exception as e:
                results.append(e)

        with patch(
            "school_management.students_grades.services.ai_minimax_client.requests.post",
            side_effect=fake_post,
        ):
            threads = [threading.Thread(target=worker) for _ in range(8)]
            for t in threads:
                t.start()
            # Give threads time to enter semaphore and reach inner_gate
            time.sleep(2)

            # At this point, at most _MAX_CONCURRENT threads can be inside fake_post
            self.assertLessEqual(
                max_observed[0], _MAX_CONCURRENT,
                f"Observed {max_observed[0]} concurrent calls, max allowed is {_MAX_CONCURRENT}",
            )

            # Release all threads
            inner_gate.set()
            for t in threads:
                t.join(timeout=15)

        self.assertEqual(len(results), 8)
        self.assertTrue(all(r == "ok" for r in results),
                        f"Expected all 'ok' but got {results}")

    def test_semaphore_acquire_timeout_raises(self):
        """If semaphore cannot be acquired in timeout*2 seconds, RuntimeError is raised."""
        from school_management.students_grades.services.ai_minimax_client import (
            _semaphore,
            _MAX_CONCURRENT,
        )

        # Exhaust all permits
        for _ in range(_MAX_CONCURRENT):
            acquired = _semaphore.acquire(timeout=1)
            self.assertTrue(acquired, "Should be able to acquire all permits")

        try:
            with self.assertRaises(RuntimeError) as ctx:
                call_minimax_safe("prompt", timeout=0.1)
            self.assertIn("semaphore acquire timed out", str(ctx.exception))
        finally:
            for _ in range(_MAX_CONCURRENT):
                _semaphore.release()

    def test_max_concurrent_read_from_env(self):
        """_MAX_CONCURRENT should respect MINIMAX_MAX_CONCURRENT env var."""
        import importlib
        import school_management.students_grades.services.ai_minimax_client as mod

        with patch.dict(os.environ, {"MINIMAX_MAX_CONCURRENT": "3"}, clear=False):
            reloaded = importlib.reload(mod)
            try:
                self.assertEqual(reloaded._MAX_CONCURRENT, 3)
            finally:
                # Restore original module state by reloading without the env override
                importlib.reload(mod)

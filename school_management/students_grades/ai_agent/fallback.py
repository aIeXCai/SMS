"""Reliable fallback policy for the score Agent."""

COMPLEX_ANALYSIS_TYPES = {
    "weighted",
    "trend",
    "comparison",
    "business_group_ranking",
}


def build_fallback(analysis_type, *, scope_type=None, reason=None):
    """Return the fallback descriptor consumed by the frontend."""
    if analysis_type in COMPLEX_ANALYSIS_TYPES or scope_type == "business_group":
        return {
            "available": False,
            "reason": reason or "complex_analysis_cannot_use_basic_query",
        }

    if analysis_type == "ranking" and scope_type in {"class", "grade"}:
        return {
            "available": True,
            "reason": "basic_query_can_retry_simple_ranking_scope",
        }

    return {
        "available": False,
        "reason": reason or "basic_query_not_reliable_for_this_request",
    }


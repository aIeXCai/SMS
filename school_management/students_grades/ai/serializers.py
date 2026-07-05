"""Serializers for the AI query API."""
from rest_framework import serializers


class AIQueryRequestSerializer(serializers.Serializer):
    """POST /api/ai/query/ request body."""

    question = serializers.CharField(
        required=True,
        max_length=500,
        help_text="Natural-language query about student grades",
    )
    exam_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="Resolved exam ID for disambiguation follow-up",
    )


class AIQueryResponseSerializer(serializers.Serializer):
    """POST /api/ai/query/ response body."""

    success = serializers.BooleanField()
    answer = serializers.CharField(allow_blank=True, required=False)
    data = serializers.JSONField(allow_null=True, required=False)
    status = serializers.CharField(required=False, allow_blank=True)
    requires_disambiguation = serializers.BooleanField(required=False, default=False)
    candidates = serializers.ListField(required=False, default=list)
    hint = serializers.CharField(required=False, allow_blank=True)

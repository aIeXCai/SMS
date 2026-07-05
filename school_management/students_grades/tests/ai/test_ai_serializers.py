"""Tests for AI query serializers."""
import os
import sys

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "school_management.settings_sqlite_test")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))))
import django
django.setup()

import unittest

from school_management.students_grades.ai.serializers import (
    AIQueryRequestSerializer,
    AIQueryResponseSerializer,
)


class AIQueryRequestSerializerTests(unittest.TestCase):
    """Tests for AIQueryRequestSerializer."""

    def test_valid_request_with_question_only(self):
        """Accepts a request with just the question field."""
        serializer = AIQueryRequestSerializer(data={"question": "张三数学成绩"})
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_valid_request_with_question_and_exam_id(self):
        """Accepts a request with question and optional exam_id."""
        serializer = AIQueryRequestSerializer(
            data={"question": "张三数学成绩", "exam_id": 42}
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data["exam_id"], 42)

    def test_missing_question_returns_invalid(self):
        """Rejects requests without the question field."""
        serializer = AIQueryRequestSerializer(data={})
        self.assertFalse(serializer.is_valid())
        self.assertIn("question", serializer.errors)

    def test_empty_question_returns_invalid(self):
        """Rejects empty question strings."""
        serializer = AIQueryRequestSerializer(data={"question": ""})
        self.assertFalse(serializer.is_valid())

    def test_question_too_long_returns_invalid(self):
        """Rejects questions exceeding max_length=500."""
        serializer = AIQueryRequestSerializer(data={"question": "x" * 501})
        self.assertFalse(serializer.is_valid())

    def test_exam_id_null_is_accepted(self):
        """Null exam_id should be accepted as valid."""
        serializer = AIQueryRequestSerializer(
            data={"question": "test", "exam_id": None}
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)


class AIQueryResponseSerializerTests(unittest.TestCase):
    """Tests for AIQueryResponseSerializer — output schema contract."""

    def test_valid_success_response(self):
        """The serializer accepts a full success response."""
        data = {
            "success": True,
            "answer": "张三数学平均分为 85.5",
            "data": {"average": 85.5},
            "status": "success",
        }
        serializer = AIQueryResponseSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_disambiguation_response(self):
        """Response with requires_disambiguation and candidates."""
        data = {
            "success": True,
            "answer": "找到了多次期中考试，请问您指的是哪一次？",
            "data": None,
            "status": "ambiguous",
            "requires_disambiguation": True,
            "candidates": [
                {"exam_id": 1, "name": "期中考试", "date": "2025-11-01"},
                {"exam_id": 2, "name": "期中考试", "date": "2025-04-01"},
            ],
        }
        serializer = AIQueryResponseSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_student_not_found_response(self):
        """Response for student_not_found status."""
        data = {
            "success": True,
            "answer": "未找到李四的学生档案",
            "data": None,
            "status": "student_not_found",
            "hint": "未找到该学生档案",
        }
        serializer = AIQueryResponseSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)

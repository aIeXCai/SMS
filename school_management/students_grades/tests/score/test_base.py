"""Shared test base utilities for students_grades score tests.

Provides a minimal BaseTestCase with a client initializer and small helpers.
Other test modules may still define their own setUp when they need different fixtures.
"""
from django.test import TestCase, Client


class BaseTestCase(TestCase):
    """Lightweight base test case providing a Django test client."""

    def setUp(self):
        # Many tests create their own client, but providing one here is convenient.
        self.client = Client()

    # Small helper example (not strictly required) to reverse length of tests later.
    @staticmethod
    def ensure_list(value):
        if value is None:
            return []
        if isinstance(value, (list, tuple)):
            return list(value)
        return [value]

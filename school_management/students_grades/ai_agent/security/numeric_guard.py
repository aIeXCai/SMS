"""Deterministic numeric result helpers for V3 Agent responses."""

import re

NUMERIC_STRING_PATTERN = re.compile(r"^-?\d+(?:\.\d+)?%?$")


def extract_numeric_facts(result):
    facts = []

    def walk(value, path):
        if isinstance(value, dict):
            for key, item in value.items():
                walk(item, f"{path}.{key}" if path else key)
        elif isinstance(value, list):
            for index, item in enumerate(value):
                walk(item, f"{path}[{index}]")
        elif isinstance(value, (int, float)) and not isinstance(value, bool):
            facts.append({"path": path, "value": value})
        elif isinstance(value, str):
            text = value.strip()
            if NUMERIC_STRING_PATTERN.match(text):
                numeric_text = text.rstrip("%")
                number = float(numeric_text) if "." in numeric_text else int(numeric_text)
                facts.append({"path": path, "value": number, "raw_value": value})

    walk(result, "")
    return facts


def has_structured_tables(tool_results):
    for result in tool_results:
        if isinstance(result, dict):
            if result.get("rows") or result.get("students"):
                return True
    return False


def validate_llm_text_numbers(text, numeric_facts):
    """Allow LLM prose only if every visible number can be traced to Tool facts.

    This deliberately stays conservative. If a response has no structured Tool
    numbers, plain prose with no numbers is allowed.
    """
    values = {str(fact["value"]) for fact in numeric_facts}
    values |= {str(int(fact["value"])) for fact in numeric_facts if isinstance(fact["value"], float) and fact["value"].is_integer()}
    visible_numbers = re.findall(r"(?<![\w.])\d+(?:\.\d+)?(?![\w.])", text or "")
    return all(number in values for number in visible_numbers)

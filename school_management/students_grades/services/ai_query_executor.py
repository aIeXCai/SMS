"""
Step 2 — AI Query Executor.

Takes a structured query plan (from Step 1) and executes it against the
real database.  All numbers come from SQL queries — the LLM is never asked
to compute or recall values.

Handles:
- Permission boundary enforcement
- Disambiguation (returns DB candidates without querying scores)
- Completeness checks (student_not_found, subject_not_found, insufficient_data)
- Six action types: compare, trend, average, top_bottom, decline, pass_rate
- rank action: ranks classes within a grade by average score

Usage:
    from school_management.students_grades.services.ai_query_executor import (
        AIQueryExecutor,
    )

    executor = AIQueryExecutor()
    result = executor.execute(plan, user_context)
"""

import logging
import re
from datetime import date
from typing import Any, Dict, List, Optional, Tuple

from django.db import models
from django.db.models import Avg, Count, Max, Min, Q, Sum
from django.db.models.functions import Coalesce

from ..models.exam import Exam
from ..models.score import Score
from ..models.student import Class, Student

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Normalize alternate grade-level names to the system's GRADE_CHOICES values
GRADE_NORMALIZE_MAP: Dict[str, str] = {
    "七年级": "初一",
    "八年级": "初二",
    "九年级": "初三",
    "十年级": "高一",
    "十一年级": "高二",
    "十二年级": "高三",
}

# Reverse map for display
_NORMALIZE_REVERSE: Dict[str, str] = {v: k for k, v in GRADE_NORMALIZE_MAP.items()}

VALID_GRADE_LEVELS = frozenset({"初一", "初二", "初三", "高一", "高二", "高三"})

_CHINESE_CLASS_NUMBERS: Dict[str, str] = {
    "一": "1",
    "二": "2",
    "三": "3",
    "四": "4",
    "五": "5",
    "六": "6",
    "七": "7",
    "八": "8",
    "九": "9",
    "十": "10",
}

_RELATIVE_LATEST_EXAM_TERMS = ("最近一次", "最近的考试", "上次考试", "上一次考试", "这次考试", "本次考试", "这次", "本次")
_FUZZY_EXAM_TERMS = (
    "期中集团联考",
    "期末集团联考",
    "期中考试",
    "期末考试",
    "期中考",
    "期末考",
    "期中",
    "期末",
    "集团联考",
    "联考",
    "月考",
    "开学考",
    "一模",
    "二模",
    "三模",
)

# ---------------------------------------------------------------------------
# Disambiguation answer templates (backend hardcoded, per PRD 3.5)
# ---------------------------------------------------------------------------

_DISAMBIGUATION_ANSWERS = {
    "exam": '找到了多次"{keyword}"考试，请问您指的是哪一次？',
    "student": '找到了多名学生叫"{keyword}"，请问您指的是？',
    "timeframe": "找到了多个符合条件的考试，请问您指的是哪个时间段？",
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _normalize_grade(grade: Optional[str]) -> Optional[str]:
    """Normalize alternate grade names (e.g. 九年级→初三) to system values."""
    if not grade:
        return None
    return GRADE_NORMALIZE_MAP.get(grade, grade)


def _compute_timeframe_dates(timeframe: Optional[str]) -> Tuple[Optional[date], Optional[date]]:
    """Convert a timeframe string to (start_date, end_date) or (None, None)."""
    if not timeframe or timeframe == "全部":
        return None, None

    import calendar

    today = date.today()

    if timeframe == "本学期":
        # Rough semester boundaries (Chinese school year)
        if today.month >= 9:
            # First semester: Sep 1 - Jan 31 (next year)
            return date(today.year, 9, 1), date(today.year + 1, 1, 31)
        elif today.month <= 1:
            # First semester carry-over
            return date(today.year - 1, 9, 1), date(today.year, 1, 31)
        else:
            # Second semester: Feb 1 - Jul 31
            return date(today.year, 2, 1), date(today.year, 7, 31)

    if timeframe == "本月":
        _, last_day = calendar.monthrange(today.year, today.month)
        return date(today.year, today.month, 1), date(today.year, today.month, last_day)

    if "~" in timeframe:
        parts = timeframe.split("~")
        try:
            return date.fromisoformat(parts[0].strip()), date.fromisoformat(parts[1].strip())
        except (ValueError, IndexError):
            logger.warning("Unparseable timeframe: %s", timeframe)
            return None, None

    return None, None


def _get_user_class_ids(
    role: str,
    teaching_classes: Optional[List[str]],
    managed_grade: Optional[str],
) -> Optional[List[int]]:
    """
    Return the list of Class IDs the user is allowed to see.

    Returns None for unrestricted roles (admin/staff) — meaning no filter.
    Returns an empty list if the user has no scope → no results.
    """
    if role in ("admin", "staff"):
        return None  # unrestricted

    if role == "grade_manager":
        grade = _normalize_grade(managed_grade)
        if not grade or grade not in VALID_GRADE_LEVELS:
            return []
        return list(Class.objects.filter(grade_level=grade).values_list("id", flat=True))

    if role == "subject_teacher":
        if not teaching_classes:
            return []
        # teaching_classes are display names like "初三1班"
        # Parse them into grade_level + class_name and look up Class objects
        ids = []
        for tc_name in teaching_classes:
            cls = _find_class_by_display_name(tc_name)
            if cls:
                ids.append(cls.id)
        return ids if ids else []

    return []


def _find_class_by_display_name(display_name: str) -> Optional[Class]:
    """Parse a display name like '初三1班' and find the matching Class."""
    import re

    match = re.match(r"^(.+?)(\d+班)$", display_name)
    if not match:
        return None
    grade_part, class_part = match.groups()
    grade = _normalize_grade(grade_part) or grade_part
    try:
        return Class.objects.get(grade_level=grade, class_name=class_part)
    except Class.DoesNotExist:
        return None
    except Class.MultipleObjectsReturned:
        return Class.objects.filter(grade_level=grade, class_name=class_part).first()


def _normalize_class_part(value: Optional[str]) -> Optional[str]:
    """Normalize colloquial class names like 一班/1班 into the DB class_name."""
    if not value:
        return None
    text = str(value).strip()
    match = re.match(r"^([一二三四五六七八九十]|\d+)班$", text)
    if not match:
        return None
    raw_num = match.group(1)
    num = _CHINESE_CLASS_NUMBERS.get(raw_num, raw_num)
    return f"{num}班"


def _exam_search_terms(keyword: str) -> List[str]:
    """Expand colloquial exam names into broad DB search terms."""
    if not keyword:
        return []

    text = str(keyword).strip()
    terms = [text]

    replacements = {
        "期中考试": "期中",
        "期中考": "期中",
        "期末考试": "期末",
        "期末考": "期末",
        "期中集团联考": "期中",
        "期末集团联考": "期末",
        "集团联考": "联考",
    }
    if text in replacements:
        terms.append(replacements[text])

    for suffix in ("考试", "考"):
        if text.endswith(suffix) and len(text) > len(suffix):
            terms.append(text[:-len(suffix)])
            break

    deduped: List[str] = []
    for term in terms:
        if term and term not in deduped:
            deduped.append(term)
    return deduped


def _extract_exam_keyword(question: Optional[str], filters: Dict[str, Any]) -> Optional[str]:
    """Get an exam keyword from structured filters or the original question."""
    for key in ("exam_keyword", "exam_name", "exam"):
        value = filters.get(key)
        if value:
            return str(value).strip()

    text = str(question or "")
    for term in _FUZZY_EXAM_TERMS:
        if term in text:
            return term
    return None


def _mentions_latest_exam(question: Optional[str], filters: Dict[str, Any]) -> bool:
    """Whether the user referred to a relative latest/current exam."""
    keyword = str(filters.get("exam_keyword") or filters.get("exam_name") or "")
    text = f"{question or ''} {keyword}"
    return any(term in text for term in _RELATIVE_LATEST_EXAM_TERMS)


# ---------------------------------------------------------------------------
# Executor
# ---------------------------------------------------------------------------

class AIQueryExecutor:
    """Execute a query plan against the Score/Student/Exam tables."""

    # Public result statuses (matching PRD 3.6)
    class Status:
        SUCCESS = "success"
        STUDENT_NOT_FOUND = "student_not_found"
        SUBJECT_NOT_FOUND = "subject_not_found"
        INSUFFICIENT_DATA = "insufficient_data"
        AMBIGUOUS = "ambiguous"
        PERMISSION_DENIED = "permission_denied"
        IRRELEVANT = "irrelevant"
        UNKNOWN_ACTION = "unknown_action"

    def execute(
        self,
        plan: Dict[str, Any],
        role: str,
        teaching_classes: Optional[List[str]] = None,
        managed_grade: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Main entry point.  Routes the plan to the correct handler.

        Returns a dict with keys: success, status, data, hint (optional),
        answer (for disambiguation, hardcoded).
        """
        action = plan.get("action", "")
        filters = plan.get("filters") or {}

        # Build permission scope before any DB-backed resolution so even
        # disambiguation candidates stay inside the user's visible classes.
        class_ids = _get_user_class_ids(role, teaching_classes, managed_grade)

        # --- Disambiguation (PRD 3.5) ---
        if plan.get("requires_disambiguation"):
            return self._handle_disambiguation(plan, class_ids)

        # --- Explicit rejection ---
        if action == "permission_denied":
            return {
                "success": True,
                "status": self.Status.PERMISSION_DENIED,
                "data": None,
                "hint": "您没有权限查看该数据。",
                "answer": self._build_permission_denied_answer(
                    role, teaching_classes, managed_grade
                ),
            }

        if action == "irrelevant":
            return {
                "success": True,
                "status": self.Status.IRRELEVANT,
                "data": None,
                "answer": "抱歉，我只回答成绩相关问题。",
            }

        # --- Resolve colloquial business terms before execution ---
        resolved = self._resolve_filters(plan, filters, class_ids)
        if resolved is not None:
            return resolved

        # --- Route to handler ---
        handlers = {
            "compare": self._execute_compare,
            "trend": self._execute_trend,
            "average": self._execute_average,
            "top_bottom": self._execute_top_bottom,
            "decline": self._execute_decline,
            "rank": self._execute_rank,
            "pass_rate": self._execute_pass_rate,
        }

        handler = handlers.get(action)
        if handler is None:
            return {
                "success": True,
                "status": self.Status.UNKNOWN_ACTION,
                "data": None,
                "hint": f"未知的查询动作: {action}",
                "answer": "抱歉，我无法理解该查询类型，请尝试更具体的描述。",
            }

        return handler(filters, class_ids, plan.get("limit", 10))

    # ------------------------------------------------------------------
    # Disambiguation
    # ------------------------------------------------------------------

    def _handle_disambiguation(
        self,
        plan: Dict[str, Any],
        class_ids: Optional[List[int]] = None,
    ) -> Dict[str, Any]:
        """Query the DB for real candidates; return with hardcoded answer."""
        ambiguous = plan.get("ambiguous") or {}
        amb_type = ambiguous.get("type", "exam")
        keyword = ambiguous.get("keyword", "")
        filters = plan.get("filters") or {}

        candidates: List[Dict[str, Any]] = []

        if amb_type == "exam":
            candidates = self._find_ambiguous_exams(keyword, filters, class_ids)
        elif amb_type == "student":
            candidates = self._find_ambiguous_students(keyword, filters, class_ids)

        answer = _DISAMBIGUATION_ANSWERS.get(
            amb_type, _DISAMBIGUATION_ANSWERS["timeframe"]
        ).format(keyword=keyword)

        return {
            "success": True,
            "status": self.Status.AMBIGUOUS,
            "requires_disambiguation": True,
            "candidates": candidates,
            "answer": answer,
            "data": None,
        }

    def _find_ambiguous_exams(
        self,
        keyword: str,
        filters: Dict[str, Any],
        class_ids: Optional[List[int]] = None,
    ) -> List[Dict[str, Any]]:
        """Find exams matching the ambiguous keyword within the student/class context."""
        # Build OR query: match any of the search terms
        name_q = Q()
        for term in _exam_search_terms(keyword):
            name_q |= Q(name__icontains=term)

        qs = Exam.objects.filter(name_q)
        if class_ids is not None:
            qs = qs.filter(score__student__current_class_id__in=class_ids)

        student_name = filters.get("student_name")
        if student_name:
            qs = qs.filter(score__student__name=student_name)

        class_name = filters.get("class_name")
        if class_name:
            match = re.match(r"^(.+?)(\d+班)$", class_name)
            if match:
                grade_part, class_part = match.groups()
                grade = _normalize_grade(grade_part) or grade_part
                qs = qs.filter(
                    score__student__current_class__grade_level=grade,
                    score__student__current_class__class_name=class_part,
                )

        grade_level = filters.get("grade_level")
        if grade_level and not class_name:
            grade = _normalize_grade(grade_level) or grade_level
            if grade in VALID_GRADE_LEVELS:
                qs = qs.filter(score__student__current_class__grade_level=grade)

        qs = qs.distinct().order_by("-date")[:10]

        return [
            {
                "exam_id": e.id,
                "name": e.name,
                "date": e.date.isoformat() if e.date else None,
                "academic_year": e.academic_year,
            }
            for e in qs
        ]

    def _find_ambiguous_students(
        self,
        keyword: str,
        filters: Dict[str, Any],
        class_ids: Optional[List[int]] = None,
    ) -> List[Dict[str, Any]]:
        """Find students with the same name."""
        qs = Student.objects.filter(name=keyword)
        if class_ids is not None:
            qs = qs.filter(current_class_id__in=class_ids)

        class_name = filters.get("class_name")
        if class_name:
            match = re.match(r"^(.+?)(\d+班)$", class_name)
            if match:
                grade_part, class_part = match.groups()
                grade = _normalize_grade(grade_part) or grade_part
                qs = qs.filter(
                    current_class__grade_level=grade,
                    current_class__class_name=class_part,
                )

        qs = qs[:20]

        return [
            {
                "student_id": s.student_id,
                "name": s.name,
                "grade_level": s.grade_level,
                "class_name": str(s.current_class) if s.current_class else None,
            }
            for s in qs
        ]

    # ------------------------------------------------------------------
    # Fuzzy resolver
    # ------------------------------------------------------------------

    def _resolve_filters(
        self,
        plan: Dict[str, Any],
        filters: Dict[str, Any],
        class_ids: Optional[List[int]],
    ) -> Optional[Dict[str, Any]]:
        """
        Resolve colloquial filters into DB-native filters.

        Returns an early response when user input still needs disambiguation;
        otherwise mutates filters in-place and returns None.
        """
        self._resolve_class_filter(filters, class_ids)

        question = plan.get("_question")
        if filters.get("exam_id"):
            return None

        if _mentions_latest_exam(question, filters):
            latest = self._find_latest_exam(filters, class_ids)
            if latest:
                filters["exam_id"] = latest.id
            return None

        exam_keyword = _extract_exam_keyword(question, filters)
        if not exam_keyword:
            return None

        candidates = self._find_ambiguous_exams(exam_keyword, filters, class_ids)
        if len(candidates) == 1:
            filters["exam_id"] = candidates[0]["exam_id"]
            filters["resolved_exam_name"] = candidates[0]["name"]
            return None
        if len(candidates) > 1:
            return {
                "success": True,
                "status": self.Status.AMBIGUOUS,
                "requires_disambiguation": True,
                "candidates": candidates,
                "answer": _DISAMBIGUATION_ANSWERS["exam"].format(keyword=exam_keyword),
                "data": None,
            }
        return None

    def _resolve_class_filter(
        self,
        filters: Dict[str, Any],
        class_ids: Optional[List[int]],
    ) -> None:
        """Resolve 一班/1班 into 初三1班 when scope makes it clear."""
        class_name = filters.get("class_name")
        class_part = _normalize_class_part(class_name)
        if not class_part:
            return

        qs = Class.objects.filter(class_name=class_part)
        if class_ids is not None:
            qs = qs.filter(id__in=class_ids)

        grade_level = _normalize_grade(filters.get("grade_level"))
        if grade_level in VALID_GRADE_LEVELS:
            qs = qs.filter(grade_level=grade_level)

        matches = list(qs.order_by("grade_level", "class_name")[:2])
        if len(matches) == 1:
            filters["class_name"] = str(matches[0])
            filters["grade_level"] = matches[0].grade_level

    def _find_latest_exam(
        self,
        filters: Dict[str, Any],
        class_ids: Optional[List[int]],
    ) -> Optional[Exam]:
        """Find the latest visible exam for the current resolved filters."""
        score_qs = self._build_score_qs(filters, class_ids)
        exam_ids = score_qs.values_list("exam_id", flat=True).distinct()
        return Exam.objects.filter(id__in=exam_ids).order_by("-date", "-id").first()

    # ------------------------------------------------------------------
    # Permission hint
    # ------------------------------------------------------------------

    @staticmethod
    def _build_permission_denied_answer(
        role: str,
        teaching_classes: Optional[List[str]],
        managed_grade: Optional[str],
    ) -> str:
        scope_desc = ""
        if role == "subject_teacher" and teaching_classes:
            scope_desc = "，".join(teaching_classes)
        elif role == "grade_manager" and managed_grade:
            scope_desc = managed_grade
        return f"您无法查看该数据。您当前的权限范围：{scope_desc}。"

    # ------------------------------------------------------------------
    # Base queryset builder
    # ------------------------------------------------------------------

    def _build_score_qs(
        self,
        filters: Dict[str, Any],
        class_ids: Optional[List[int]],
    ) -> models.QuerySet:
        """Build a Score queryset with common filters applied."""
        qs = Score.objects.select_related("student", "exam", "student__current_class")

        # Permission scope
        if class_ids is not None:
            qs = qs.filter(student__current_class_id__in=class_ids)

        # Student filter
        student_name = filters.get("student_name")
        if student_name:
            qs = qs.filter(student__name=student_name)

        # Subject filter
        subject = filters.get("subject")
        if subject:
            qs = qs.filter(subject=subject)

        # Grade level filter
        grade_level = filters.get("grade_level")
        if grade_level:
            grade_level = _normalize_grade(grade_level) or grade_level
            if grade_level in VALID_GRADE_LEVELS:
                qs = qs.filter(student__current_class__grade_level=grade_level)

        # Class name filter (e.g. "初三1班" → grade_level="初三", class_name="1班")
        class_name = filters.get("class_name")
        if class_name:
            import re
            match = re.match(r"^(.+?)(\d+班)$", class_name)
            if match:
                grade_part, class_part = match.groups()
                grade = _normalize_grade(grade_part) or grade_part
                qs = qs.filter(
                    student__current_class__grade_level=grade,
                    student__current_class__class_name=class_part,
                )

        # Exam ID filter (used for disambiguation resolution)
        exam_id = filters.get("exam_id")
        if exam_id:
            qs = qs.filter(exam_id=exam_id)

        # Timeframe filter
        timeframe = filters.get("timeframe")
        start_date, end_date = _compute_timeframe_dates(timeframe)
        if start_date:
            qs = qs.filter(exam__date__gte=start_date)
        if end_date:
            qs = qs.filter(exam__date__lte=end_date)

        return qs

    # ------------------------------------------------------------------
    # Action: compare  (PRD 4.4)
    # ------------------------------------------------------------------

    def _execute_compare(
        self,
        filters: Dict[str, Any],
        class_ids: Optional[List[int]],
        limit: int = 10,
    ) -> Dict[str, Any]:
        """Compare first and last score for a student+subject combo."""
        student_name = filters.get("student_name")
        subject = filters.get("subject")

        # Completeness: student check
        if student_name:
            student_qs = Student.objects.all()
            if class_ids is not None:
                student_qs = student_qs.filter(current_class_id__in=class_ids)
            if not student_qs.filter(name=student_name).exists():
                return self._make_student_not_found(student_name)

        # Total score comparison (no subject, or subject explicitly "总分")
        if not subject or subject == "总分":
            return self._execute_compare_total(filters, class_ids)

        qs = self._build_score_qs(filters, class_ids)
        qs = qs.order_by("exam__date")

        count = qs.count()

        # Completeness: subject check
        if count == 0:
            return self._make_subject_not_found(
                student_name, subject, filters, class_ids
            )

        # Completeness: insufficient data
        if count < 2:
            first = qs.first()
            return {
                "success": True,
                "status": self.Status.INSUFFICIENT_DATA,
                "data": self._score_to_record(first),
                "hint": "仅有一条记录，无法对比变化",
            }

        first = qs.first()
        last = qs.last()
        diff = float(last.score_value) - float(first.score_value)

        return {
            "success": True,
            "status": self.Status.SUCCESS,
            "data": {
                "first": self._score_to_record(first),
                "last": self._score_to_record(last),
                "diff": round(diff, 2),
                "trend": "up" if diff > 0 else "down" if diff < 0 else "stable",
                "record_count": count,
            },
        }

    def _execute_compare_total(
        self,
        filters: Dict[str, Any],
        class_ids: Optional[List[int]],
    ) -> Dict[str, Any]:
        """Compare first and last total score across all exams for a student."""
        student_name = filters.get("student_name")

        # Get the student's scores grouped by exam, summed
        qs = self._build_score_qs(filters, class_ids)
        totals = (
            qs.values("exam_id", "exam__name", "exam__date", "student__name", "student__student_id", "student__current_class__grade_level", "student__current_class__class_name")
            .annotate(total_score=Sum("score_value"))
            .order_by("exam__date")
        )

        records = list(totals)
        count = len(records)

        if count == 0:
            return self._make_subject_not_found(
                student_name, None, filters, class_ids
            )

        if count < 2:
            rec = records[0]
            return {
                "success": True,
                "status": self.Status.INSUFFICIENT_DATA,
                "data": self._total_record(rec),
                "hint": "仅有一条记录，无法对比变化",
            }

        first = records[0]
        last = records[-1]
        diff = float(last["total_score"]) - float(first["total_score"])

        return {
            "success": True,
            "status": self.Status.SUCCESS,
            "data": {
                "first": self._total_record(first),
                "last": self._total_record(last),
                "diff": round(diff, 2),
                "trend": "up" if diff > 0 else "down" if diff < 0 else "stable",
                "record_count": count,
            },
        }

    @staticmethod
    def _total_record(row: Dict[str, Any]) -> Dict[str, Any]:
        """Build a total-score record dict from a grouped row."""
        return {
            "student_name": row["student__name"],
            "student_id": row["student__student_id"],
            "exam_name": row["exam__name"],
            "exam_date": row["exam__date"].isoformat() if row["exam__date"] else None,
            "subject": "总分",
            "score": round(float(row["total_score"]), 2),
            "max_score": None,
            "class_name": (
                f"{row['student__current_class__grade_level']}{row['student__current_class__class_name']}"
                if row.get("student__current_class__grade_level") else ""
            ),
        }

    # ------------------------------------------------------------------
    # Action: trend
    # ------------------------------------------------------------------

    def _execute_trend(
        self,
        filters: Dict[str, Any],
        class_ids: Optional[List[int]],
        limit: int = 10,
    ) -> Dict[str, Any]:
        """Return a student's score trend for one or all subjects."""
        student_name = filters.get("student_name")
        subject = filters.get("subject")

        # Completeness: student check
        if student_name:
            student_qs = Student.objects.all()
            if class_ids is not None:
                student_qs = student_qs.filter(current_class_id__in=class_ids)
            if not student_qs.filter(name=student_name).exists():
                return self._make_student_not_found(student_name)

        qs = self._build_score_qs(filters, class_ids)
        qs = qs.order_by("exam__date", "subject")

        if subject:
            scores = list(qs[:limit])
        else:
            scores = list(qs)

        if not scores:
            return self._make_subject_not_found(
                student_name, subject, filters, class_ids
            )

        # Group by (subject) if no subject filter
        if subject:
            records = [self._score_to_record(s) for s in scores]
            return {
                "success": True,
                "status": self.Status.SUCCESS,
                "data": {
                    "subject": subject,
                    "records": records,
                    "record_count": len(records),
                },
            }

        # Multi-subject trend
        from collections import defaultdict

        by_subject: Dict[str, list] = defaultdict(list)
        for s in scores:
            by_subject[s.subject].append(self._score_to_record(s))

        return {
            "success": True,
            "status": self.Status.SUCCESS,
            "data": {
                "subjects": dict(by_subject),
                "total_records": len(scores),
            },
        }

    # ------------------------------------------------------------------
    # Action: average
    # ------------------------------------------------------------------

    def _execute_average(
        self,
        filters: Dict[str, Any],
        class_ids: Optional[List[int]],
        limit: int = 10,
    ) -> Dict[str, Any]:
        """Compute average score for a class/subject combo."""
        qs = self._build_score_qs(filters, class_ids)

        if not qs.exists():
            return {
                "success": True,
                "status": self.Status.INSUFFICIENT_DATA,
                "data": None,
                "hint": "暂无相关成绩记录",
            }

        agg = qs.aggregate(
            avg_score=Avg("score_value"),
            max_score=Max("score_value"),
            min_score=Min("score_value"),
            student_count=Count("student_id", distinct=True),
            total_count=Count("id"),
        )

        return {
            "success": True,
            "status": self.Status.SUCCESS,
            "data": {
                "average": round(float(agg["avg_score"] or 0), 2),
                "max": float(agg["max_score"] or 0),
                "min": float(agg["min_score"] or 0),
                "student_count": agg["student_count"],
                "total_records": agg["total_count"],
            },
        }

    # ------------------------------------------------------------------
    # Action: top_bottom
    # ------------------------------------------------------------------

    def _execute_top_bottom(
        self,
        filters: Dict[str, Any],
        class_ids: Optional[List[int]],
        limit: int = 10,
    ) -> Dict[str, Any]:
        """Find the highest and lowest scoring students."""
        qs = self._build_score_qs(filters, class_ids)

        if not qs.exists():
            return {
                "success": True,
                "status": self.Status.INSUFFICIENT_DATA,
                "data": None,
                "hint": "暂无相关成绩记录",
            }

        ordered = qs.order_by("-score_value")
        top = list(ordered[:limit])
        bottom = list(ordered.reverse()[:limit]) if qs.count() > limit else []

        # Deduplicate students (keep highest per student)
        top_unique: List[Dict[str, Any]] = []
        seen = set()
        for s in top:
            if s.student_id not in seen:
                seen.add(s.student_id)
                top_unique.append(self._score_to_record(s))

        bottom_unique: List[Dict[str, Any]] = []
        seen_b = set()
        for s in bottom:
            if s.student_id not in seen_b:
                seen_b.add(s.student_id)
                bottom_unique.append(self._score_to_record(s))

        return {
            "success": True,
            "status": self.Status.SUCCESS,
            "data": {
                "top": top_unique,
                "bottom": list(reversed(bottom_unique)),
                "total_records": qs.count(),
            },
        }

    # ------------------------------------------------------------------
    # Action: decline  (PRD emphasis: total_score trend, NOT grade_rank)
    # ------------------------------------------------------------------

    def _execute_decline(
        self,
        filters: Dict[str, Any],
        class_ids: Optional[List[int]],
        limit: int = 10,
    ) -> Dict[str, Any]:
        """
        Find students with consecutive total-score declines across recent exams.

        Per PRD: decline is based on the absolute total_score trend, NOT grade_rank.
        grade_rank is affected by overall exam difficulty and should not be the
        basis for "退步" detection.
        """
        base_qs = self._build_score_qs(filters, class_ids)

        if not base_qs.exists():
            return {
                "success": True,
                "status": self.Status.INSUFFICIENT_DATA,
                "data": None,
                "hint": "暂无相关成绩记录，无法判断退步趋势",
            }

        # Get total scores per student per exam
        totals = (
            base_qs.values("student_id", "student__name", "exam_id", "exam__name", "exam__date")
            .annotate(total_score=Sum("score_value"))
            .order_by("student_id", "exam__date")
        )

        # Group by student
        from collections import defaultdict

        by_student: Dict[int, list] = defaultdict(list)
        for row in totals:
            by_student[row["student_id"]].append(
                {
                    "exam": row["exam__name"],
                    "date": row["exam__date"].isoformat() if row["exam__date"] else None,
                    "total_score": round(float(row["total_score"]), 2),
                }
            )

        # Check for consecutive decline (at least 3 exams, all decreasing)
        declining: List[Dict[str, Any]] = []
        min_exams_for_decline = 3

        for student_id, exam_scores in by_student.items():
            if len(exam_scores) < min_exams_for_decline:
                continue

            # Check last min_exams_for_decline exams for consecutive decline
            recent = exam_scores[-min_exams_for_decline:]
            scores_only = [e["total_score"] for e in recent]

            is_declining = all(
                scores_only[i] > scores_only[i + 1]
                for i in range(len(scores_only) - 1)
            )

            if is_declining:
                # Find student name from first entry
                name = next(
                    (row["student__name"] for row in totals if row["student_id"] == student_id),
                    f"ID:{student_id}",
                )
                # Get student info for class name
                try:
                    student = Student.objects.select_related("current_class").get(id=student_id)
                    class_display = (
                        f"{student.current_class.grade_level}{student.current_class.class_name}"
                        if student.current_class
                        else "未分班"
                    )
                except Student.DoesNotExist:
                    class_display = "未知"

                declining.append(
                    {
                        "student_name": name,
                        "student_id": student_id,
                        "class_name": class_display,
                        "recent_totals": recent,
                        "trend": [-round(scores_only[i] - scores_only[i + 1], 2)
                                  for i in range(len(scores_only) - 1)],
                    }
                )

        # Sort by magnitude of decline (largest drop first)
        declining.sort(
            key=lambda x: sum(abs(d) for d in x.get("trend", [])),
            reverse=True,
        )
        declining = declining[:limit]

        if not declining:
            return {
                "success": True,
                "status": self.Status.SUCCESS,
                "data": {
                    "declining_students": [],
                    "message": "未发现连续退步的学生",
                    "checked_students": len(by_student),
                },
            }

        return {
            "success": True,
            "status": self.Status.SUCCESS,
            "data": {
                "declining_students": declining,
                "total_declining": len(declining),
                "checked_students": len(by_student),
            },
        }

    # ------------------------------------------------------------------
    # Action: rank
    # ------------------------------------------------------------------

    def _execute_rank(
        self,
        filters: Dict[str, Any],
        class_ids: Optional[List[int]],
        limit: int = 10,
    ) -> Dict[str, Any]:
        """Rank classes by average score, or a single student's grade rank."""
        student_name = filters.get("student_name")

        if student_name:
            return self._execute_student_rank(filters, class_ids)

        return self._execute_class_rank(filters, class_ids, limit)

    def _execute_student_rank(
        self,
        filters: Dict[str, Any],
        class_ids: Optional[List[int]],
    ) -> Dict[str, Any]:
        """Get a single student's total-score grade rank for their most recent exam."""
        student_name = filters.get("student_name")

        # Find the student
        student_qs = Student.objects.all()
        if class_ids is not None:
            student_qs = student_qs.filter(current_class_id__in=class_ids)
        try:
            student = student_qs.get(name=student_name)
        except Student.DoesNotExist:
            return self._make_student_not_found(student_name)
        except Student.MultipleObjectsReturned:
            student = student_qs.filter(name=student_name).first()

        # Build queryset for this student's scores, find most recent exam
        score_qs = Score.objects.filter(student=student)
        if class_ids is not None:
            score_qs = score_qs.filter(student__current_class_id__in=class_ids)

        subject = filters.get("subject")
        if subject:
            score_qs = score_qs.filter(subject=subject)

        exam_id = filters.get("exam_id")
        if exam_id:
            score_qs = score_qs.filter(exam_id=exam_id)

        latest_score = score_qs.order_by("-exam__date").first()
        if not latest_score:
            return {
                "success": True,
                "status": self.Status.INSUFFICIENT_DATA,
                "data": None,
                "hint": "该学生暂无成绩记录",
            }

        exam = latest_score.exam

        # If no subject filter, compute total score for this student in this exam
        if not subject:
            total = score_qs.filter(exam=exam).aggregate(
                total=Sum("score_value")
            )["total"]
            total_score = round(float(total or 0), 2)
            # Get total_score_rank from any subject record (they all carry the same total rank)
            sample = score_qs.filter(exam=exam).first()
            grade_rank = sample.total_score_rank_in_grade if sample else None
            class_rank = sample.total_score_rank_in_class if sample else None
        else:
            total_score = float(latest_score.score_value)
            grade_rank = latest_score.grade_rank_in_subject
            class_rank = None

        class_display = (
            f"{student.current_class.grade_level}{student.current_class.class_name}"
            if student.current_class
            else "未分班"
        )

        return {
            "success": True,
            "status": self.Status.SUCCESS,
            "data": {
                "student_name": student.name,
                "exam_name": exam.name,
                "exam_date": exam.date.isoformat() if exam.date else None,
                "class_name": class_display,
                "total_score": total_score,
                "grade_rank": grade_rank,
                "class_rank": class_rank,
                "subject": subject,
            },
        }

    def _execute_class_rank(
        self,
        filters: Dict[str, Any],
        class_ids: Optional[List[int]],
        limit: int = 10,
    ) -> Dict[str, Any]:
        """Rank classes by average score in a subject/grade."""
        qs = self._build_score_qs(filters, class_ids)

        if not qs.exists():
            return {
                "success": True,
                "status": self.Status.INSUFFICIENT_DATA,
                "data": None,
                "hint": "暂无相关成绩记录",
            }

        # Group by class and compute average
        class_avgs = (
            qs.values(
                "student__current_class_id",
                "student__current_class__grade_level",
                "student__current_class__class_name",
            )
            .annotate(avg_score=Avg("score_value"), student_count=Count("student_id", distinct=True))
            .order_by("-avg_score")
        )

        subject = filters.get("subject", "全部科目")

        rankings = []
        for rank_idx, row in enumerate(class_avgs[:limit], start=1):
            grade = row.get("student__current_class__grade_level", "")
            name = row.get("student__current_class__class_name", "")
            rankings.append(
                {
                    "rank": rank_idx,
                    "class_name": f"{grade}{name}" if grade and name else "未知班级",
                    "avg_score": round(float(row["avg_score"]), 2),
                    "student_count": row["student_count"],
                }
            )

        return {
            "success": True,
            "status": self.Status.SUCCESS,
            "data": {
                "subject": subject,
                "rankings": rankings,
                "total_classes": class_avgs.count(),
            },
        }

    # ------------------------------------------------------------------
    # Action: pass_rate
    # ------------------------------------------------------------------

    def _execute_pass_rate(
        self,
        filters: Dict[str, Any],
        class_ids: Optional[List[int]],
        limit: int = 10,
    ) -> Dict[str, Any]:
        """
        Compute pass rate (score >= 60% of max_score) for a class/subject.

        Where exam_subject is available, use its max_score.  Otherwise fall
        back to a default of 100.  Iterate per-record for accuracy — class
        sizes are small enough that this is not a performance concern.
        """
        qs = self._build_score_qs(filters, class_ids)
        qs = qs.select_related("exam_subject")

        total = qs.count()
        if total == 0:
            return {
                "success": True,
                "status": self.Status.INSUFFICIENT_DATA,
                "data": None,
                "hint": "暂无相关成绩记录",
            }

        passed = 0
        for score in qs:
            max_score = score.get_max_score()
            if max_score > 0 and float(score.score_value) >= float(max_score) * 0.6:
                passed += 1

        rate = round(passed / total * 100, 2) if total > 0 else 0

        return {
            "success": True,
            "status": self.Status.SUCCESS,
            "data": {
                "pass_count": passed,
                "total_count": total,
                "pass_rate": rate,
            },
        }

    # ------------------------------------------------------------------
    # Completeness helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _make_student_not_found(student_name: str) -> Dict[str, Any]:
        return {
            "success": True,
            "status": AIQueryExecutor.Status.STUDENT_NOT_FOUND,
            "data": None,
            "hint": "未找到该学生档案，请检查姓名或学号是否正确",
            "answer": f"未找到{student_name}的学生档案，请检查姓名是否正确，或尝试搜索其他学生。",
        }

    @staticmethod
    def _make_subject_not_found(
        student_name: Optional[str],
        subject: Optional[str],
        filters: Dict[str, Any],
        class_ids: Optional[List[int]],
    ) -> Dict[str, Any]:
        """Build a subject_not_found response with available alternatives."""
        alternative_qs = Score.objects.all()
        if class_ids is not None:
            alternative_qs = alternative_qs.filter(student__current_class_id__in=class_ids)
        if student_name:
            alternative_qs = alternative_qs.filter(student__name=student_name)

        # Find which subjects the student has scores for
        subjects = (
            alternative_qs.values("subject")
            .annotate(cnt=Count("id"))
            .order_by("-cnt")
        )

        alternatives = [
            {"subject": s["subject"], "count": s["cnt"]} for s in subjects
        ]

        subject_str = subject or "该科目"

        if alternatives:
            alt_desc = "、".join(
                f"{a['subject']}{a['count']}次" for a in alternatives[:5]
            )
            answer = f"暂无{student_name or '该学生'}{subject_str}成绩记录。该学生目前有以下科目成绩：{alt_desc}。"
        else:
            answer = f"暂无{student_name or '该学生'}的任何成绩记录，可能尚未录入。"

        return {
            "success": True,
            "status": AIQueryExecutor.Status.SUBJECT_NOT_FOUND,
            "data": {"available_subjects": alternatives},
            "hint": "该学生无此科目成绩，但有其他科目记录",
            "answer": answer,
        }

    # ------------------------------------------------------------------
    # Utility
    # ------------------------------------------------------------------

    @staticmethod
    def _score_to_record(score: Score) -> Dict[str, Any]:
        """Convert a Score model instance to a serializable dict."""
        return {
            "student_name": score.student.name,
            "student_id": score.student.student_id,
            "exam_name": score.exam.name,
            "exam_date": score.exam.date.isoformat() if score.exam.date else None,
            "subject": score.subject,
            "score": float(score.score_value),
            "max_score": score.get_max_score(),
            "class_name": (
                f"{score.student.current_class.grade_level}{score.student.current_class.class_name}"
                if score.student.current_class
                else ""
            ),
        }

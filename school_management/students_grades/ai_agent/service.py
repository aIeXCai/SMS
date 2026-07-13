"""MVP score Agent orchestration service."""

import logging
import re
import uuid

from django.db.models import Q

from .fallback import build_fallback
from .security.context import build_agent_security_context
from .security.permissions import (
    AgentPermissionError,
    PERMISSION_DENIED_MESSAGE,
    allowed_exam_ids,
    scope_students,
)
from .tools.comparison_tool import calculate_group_comparison
from .tools.group_tool import resolve_business_group
from .tools.ranking_tool import calculate_ranking
from .tools.score_tool import CHINESE_NUMBERS, find_student, get_exam_subjects
from .tools.trend_tool import calculate_student_trend
from .tools.weighted_tool import calculate_weighted
from ..models.exam import Exam
from ..models.score import SUBJECT_CHOICES
from ..models.student import Student

GRADE_LEVELS = ("初一", "初二", "初三", "高一", "高二", "高三")
GROUP_NAMES = ("格致", "南山", "创新")
SUBJECTS = tuple(value for value, _ in SUBJECT_CHOICES)
TREND_PATTERNS = ("趋势", "变化", "历次")

logger = logging.getLogger(__name__)
CLASS_ALIAS_PATTERN = re.compile(r"(?<!\d)([789]\d{2})班")
CLASS_PATTERN = re.compile(r"(?<!\d)(?:初[一二三]|[789]年级)?\s*(\d{1,2}班)")


def _number_from_text(value, default=None):
    if not value:
        return default
    if value.isdigit():
        return int(value)
    return CHINESE_NUMBERS.get(value, default)


def _parse_weight(value):
    text = value.replace("%", "")
    try:
        number = float(text)
    except ValueError:
        return None
    if "%" in value:
        return number
    return number


class ScoreAgentService:
    """Coordinate parsing, clarification, deterministic tools, and formatting."""

    def handle(self, *, message, context=None, clarification_reply=None, user=None):
        context = dict(context or {})
        request_id = str(uuid.uuid4())
        self._security_context = build_agent_security_context(user) if user is not None else None

        if self._security_context is not None and not self._security_context.allowed:
            return self._permission_denied(request_id)

        if message.strip() == "取消" or (clarification_reply or {}).get("value") == "取消":
            return {
                "request_id": request_id,
                "conversation_id": context.get("conversation_id"),
                "type": "cancelled",
                "status": "cancelled",
                "message": "已取消当前追问。",
                "context": {},
                "fallback": {"available": False, "reason": "cancelled"},
            }

        parse_message = message
        if clarification_reply and context.get("raw_message"):
            parse_message = context["raw_message"]
        parsed = self._parse(parse_message, context)
        parsed = self._apply_clarification(parsed, clarification_reply)

        # Build compact parse summary
        parts = [parsed.get("analysis_type", "?")]
        for key, label in [("grade_level", ""), ("subject", ""), ("group_name", ""), ("class_names", "班"),
                           ("cohort", ""), ("top_n", "top")]:
            val = parsed.get(key)
            if val and val != "None":
                parts.append(f"{label}{val}" if label else str(val))
        exam = parsed.get("exam_terms")
        if exam:
            parts.append("/".join(exam))
        weight = parsed.get("weights")
        if weight:
            parts.append(f"w{'/'.join(str(w) for w in weight)}")
        special_response = self._handle_special_intent(parsed, request_id)
        if special_response:
            return special_response

        if parsed["analysis_type"] == "trend":
            return self._handle_trend(parsed, request_id)

        cohort_response = self._ensure_cohort(parsed, request_id)
        if cohort_response:
            return cohort_response

        scope_response = self._build_scope(parsed, request_id)
        if scope_response.get("type") == "clarification":
            return scope_response
        if scope_response.get("type") == "error":
            return scope_response
        scope = scope_response["scope"]
        try:
            scope = self._secure_scope(scope)
        except AgentPermissionError:
            return self._permission_denied(request_id)
        if parsed["analysis_type"] == "weighted":
            return self._handle_weighted(parsed, scope, request_id)
        if parsed["analysis_type"] == "trend":
            return self._handle_trend(parsed, scope, request_id)
        if parsed["analysis_type"] == "comparison":
            return self._handle_comparison(parsed, scope, request_id)
        return self._handle_ranking(parsed, scope, request_id)

    def _parse(self, message, context):
        text = message.strip()
        parsed = dict(context or {})
        parsed["raw_message"] = text

        if parsed.pop("_from_v2", False):
            return parsed

        parsed["has_trend_expression"] = self._has_trend_expression(text)

        if "加权" in text:
            parsed["analysis_type"] = "weighted"
        elif parsed["has_trend_expression"] and re.search(r"[\u4e00-\u9fa5]{2,4}", text):
            parsed["analysis_type"] = "trend"
        elif any(token in text for token in ("对比", "排第几", "均分", "占比")):
            parsed["analysis_type"] = "comparison"
        else:
            parsed["analysis_type"] = parsed.get("analysis_type") or "ranking"

        for grade in GRADE_LEVELS:
            if grade in text:
                parsed["grade_level"] = grade
                break

        for subject in SUBJECTS:
            if subject in text:
                parsed["subject"] = subject
                break

        for group_name in GROUP_NAMES:
            if group_name in text:
                parsed["group_name"] = group_name
                parsed["target_scope"] = {"type": "business_group", "name": group_name}
                break

        class_aliases = CLASS_ALIAS_PATTERN.findall(text)
        if class_aliases:
            parsed["ambiguous_class_aliases"] = [f"{item}班" for item in class_aliases]

        class_names = [
            item.replace(" ", "")
            for item in CLASS_PATTERN.findall(text)
            if item.replace(" ", "") not in parsed.get("ambiguous_class_aliases", [])
        ]
        if class_names:
            parsed["class_names"] = class_names
            if not parsed.get("target_scope"):
                parsed["target_scope"] = {"type": "class", "class_name": class_names[0]}

        top_match = re.search(r"前([一二三四五六七八九十]|\d+)", text)
        parsed["top_n"] = _number_from_text(top_match.group(1), 3) if top_match else parsed.get("top_n", 3)
        recent_count_match = re.search(r"最近\s*([一二三四五六七八九十]|\d+)\s*次", text)
        if recent_count_match:
            parsed["time_range"] = f"recent_{_number_from_text(recent_count_match.group(1), 5)}"

        weight_match = re.search(r"(\d+(?:\.\d+)?%?)\s*[:：]\s*(\d+(?:\.\d+)?%?)", text)
        if weight_match:
            parsed["weights"] = [_parse_weight(weight_match.group(1)), _parse_weight(weight_match.group(2))]

        if not parsed.get("exam_terms"):  # respect V2 context if already set
            if "期中" in text and "期末" in text:
                parsed["exam_terms"] = ["期中", "期末"]
            elif "期中" in text:
                parsed["exam_terms"] = ["期中"]
            elif "期末" in text:
                parsed["exam_terms"] = ["期末"]
            elif any(token in text for token in ("最近一次", "这次", "本次")):
                parsed["exam_terms"] = ["latest"]

        if any(token in text for token in ("班内排名", "班级排名")):
            parsed["rank_scope"] = "class"
        elif "年级排名" in text:
            parsed["rank_scope"] = "grade"
        elif "分组" in text and "排名" in text:
            parsed["rank_scope"] = "group"

        if parsed["analysis_type"] == "trend":
            parsed["student_name"] = self._resolve_student_name(text, parsed)

        return parsed

    def _has_trend_expression(self, text):
        if any(token in text for token in TREND_PATTERNS):
            return True
        recent_match = re.search(r"最近\s*([一二三四五六七八九十]|\d+)\s*次", text)
        if not recent_match:
            return False
        count = _number_from_text(recent_match.group(1), 0)
        return count > 1

    def _resolve_student_name(self, text, parsed):
        """Resolve student names from DB before falling back to regex parsing."""
        students = Student.objects.exclude(status='毕业')
        if self._security_context is not None:
            students = scope_students(self._security_context, students)
        if parsed.get("cohort"):
            students = students.filter(cohort=parsed["cohort"])

        names = (
            students.exclude(name="")
            .values_list("name", flat=True)
            .distinct()
            .order_by("name")
        )
        for name in sorted(names, key=len, reverse=True):
            if name and name in text:
                return name

        cleaned = text
        for subject in SUBJECTS:
            cleaned = cleaned.replace(subject, " ")
        for token in ("最近", "历次", "趋势", "变化", "排名", "成绩", "从", "到", "现在", "次"):
            cleaned = cleaned.replace(token, " ")

        fallback = re.search(r"([\u4e00-\u9fa5]{2,4})", cleaned)
        if not fallback:
            return parsed.get("student_name")
        candidate = fallback.group(1)
        # If we inherited a student name from context, only accept DB-verified matches
        inherited = parsed.get("student_name")
        if inherited:
            students = Student.objects.exclude(status='毕业').filter(name=candidate)
            if self._security_context is not None:
                students = scope_students(self._security_context, students)
            if parsed.get("cohort"):
                students = students.filter(cohort=parsed["cohort"])
            if students.exists():
                return candidate
            return inherited
        return candidate

    def _handle_special_intent(self, parsed, request_id):
        if parsed.get("analysis_type") != "trend":
            return None

        has_group = bool(parsed.get("group_name"))
        has_class = bool(parsed.get("class_names") or parsed.get("ambiguous_class_aliases"))
        rank_or_average = any(token in parsed.get("raw_message", "") for token in ("排名", "排第几", "均分", "总分"))
        if not (has_class and parsed.get("has_trend_expression") and (has_group or rank_or_average)):
            return None

        if parsed.get("ambiguous_class_aliases"):
            alias = parsed["ambiguous_class_aliases"][0]
            return self._clarification(
                request_id,
                "class_normalization",
                f"请确认“{alias}”是否指“初二10班”或“8年级10班”。当前暂不支持班级排名趋势，但可以查询某一次考试的分组内排名。",
                [
                    {"label": "初二10班", "value": "初二10班"},
                    {"label": "8年级10班", "value": "8年级10班"},
                ],
                parsed,
                question_id="q_class_normalization_001",
                status="need_class_normalization",
                fallback_reason="ambiguous_class_alias",
            )

        return {
            "request_id": request_id,
            "type": "unsupported",
            "status": "unsupported_class_trend",
            "message": "当前暂不支持班级在业务分组内的多次考试排名趋势分析。你可以先查询某一次考试的排名，或查看两个群体在某次考试中的均分对比。",
            "suggestions": [
                "初二10班在南山班中，最近一次考试总分均分排第几？",
                "初二10班和初二南山班，最近一次考试总分均分对比如何？",
            ],
            "fallback": {
                "available": False,
                "reason": "class_group_trend_not_supported",
            },
        }

    def _apply_clarification(self, parsed, clarification_reply):
        if not clarification_reply:
            return parsed
        payload = clarification_reply.get("payload") or {}
        value = clarification_reply.get("value")
        if payload.get("exam_id"):
            parsed["exam_ids"] = [payload["exam_id"]]
        elif clarification_reply.get("question_id", "").startswith("q_exam") and value:
            parsed["exam_ids"] = [int(value)]
        elif clarification_reply.get("question_id", "").startswith("q_cohort"):
            parsed["cohort"] = value
        elif clarification_reply.get("question_id", "").startswith("q_rank_scope"):
            parsed["rank_scope"] = value
        elif clarification_reply.get("question_id", "").startswith("q_group_scope"):
            parsed["group_name"] = value
            parsed["target_scope"] = {"type": "business_group", "name": value}
        elif clarification_reply.get("question_id", "").startswith("q_subject_mismatch"):
            if value == "common_subjects":
                parsed["use_common_subjects"] = True
        return parsed

    def _ensure_cohort(self, parsed, request_id):
        if parsed.get("cohort"):
            return None

        grade = parsed.get("grade_level")
        if not grade:
            return None

        students = Student.objects.exclude(status='毕业').filter(grade_level=grade, cohort__isnull=False)
        if self._security_context is not None:
            students = scope_students(self._security_context, students)
        cohorts = list(
            students
            .exclude(cohort="")
            .values_list("cohort", flat=True)
            .distinct()
            .order_by("cohort")
        )
        if len(cohorts) == 1:
            parsed["cohort"] = cohorts[0]
            return None
        if len(cohorts) > 1:
            return self._clarification(
                request_id,
                "cohort",
                "同一年级存在多个 cohort，请选择本次查询使用的 cohort。",
                [{"label": item, "value": item} for item in cohorts],
                parsed,
                question_id="q_cohort_001",
            )
        return None

    def _build_scope(self, parsed, request_id):
        target = parsed.get("target_scope") or {}
        cohort = parsed.get("cohort")

        if target.get("type") == "business_group":
            group = resolve_business_group(cohort, target.get("name"))
            if group["status"] != "success":
                return self._error(
                    request_id,
                    group.get("message", "业务分组配置不可用。"),
                    "unsupported",
                    "business_group_ranking",
                    "business_group",
                )
            return {
                "scope": {
                    "type": "business_group",
                    "cohort": cohort,
                    "group_name": target["name"],
                    "label": f"{cohort}{target['name']}班",
                    "class_ids": group["class_ids"],
                    "class_names": group["class_names"],
                }
            }

        if target.get("type") == "grade":
            if cohort:
                return {"scope": {"type": "grade", "cohort": cohort, "label": cohort}}
            return self._error(request_id, "请先说明要查询的年级。", "parse_error", parsed.get("analysis_type"))

        class_names = parsed.get("class_names") or []
        if class_names:
            return {
                "scope": {
                    "type": "class",
                    "cohort": cohort,
                    "class_name": class_names[0],
                    "label": f"{parsed.get('grade_level') or ''}{class_names[0]}",
                }
            }

        if cohort:
            return {"scope": {"type": "grade", "cohort": cohort, "label": cohort}}

        return self._error(request_id, "请先说明要查询的年级、班级或业务分组。", "parse_error", parsed.get("analysis_type"))

    def _secure_scope(self, scope):
        context = self._security_context
        if context is None or context.is_unrestricted:
            return scope

        permitted = set(context.allowed_class_ids or [])
        scope_type = scope.get("type")
        if scope_type == "grade":
            secure = dict(scope)
            secure["type"] = "business_group"
            secure["class_ids"] = sorted(permitted)
            return secure
        if scope_type == "class":
            class_ids = list(
                Student.objects.filter(
                    cohort=scope.get("cohort"),
                    current_class__class_name=scope.get("class_name"),
                    current_class_id__in=permitted,
                ).values_list("current_class_id", flat=True).distinct()
            )
            if not class_ids:
                raise AgentPermissionError(PERMISSION_DENIED_MESSAGE)
            secure = dict(scope)
            secure["type"] = "business_group"
            secure["class_ids"] = class_ids
            return secure
        if scope_type == "business_group":
            class_ids = sorted(set(scope.get("class_ids") or []) & permitted)
            if not class_ids:
                raise AgentPermissionError(PERMISSION_DENIED_MESSAGE)
            secure = dict(scope)
            secure["class_ids"] = class_ids
            return secure
        raise AgentPermissionError(PERMISSION_DENIED_MESSAGE)

    def _resolve_exams(self, parsed, request_id, required_count=1):
        if parsed.get("exam_ids") and len(parsed["exam_ids"]) >= required_count:
            query = Exam.objects.filter(id__in=parsed["exam_ids"])
            if self._security_context is not None and not self._security_context.is_unrestricted:
                query = query.filter(id__in=allowed_exam_ids(self._security_context))
            exams = list(query.order_by("date", "id"))
            if len(exams) >= required_count:
                return exams[:required_count], None

        terms = parsed.get("exam_terms") or []
        cohort = parsed.get("cohort")
        exams = []
        for term in terms[:required_count]:
            query = Exam.objects.all()
            if self._security_context is not None and not self._security_context.is_unrestricted:
                query = query.filter(id__in=allowed_exam_ids(self._security_context))
            if cohort:
                query = query.filter(grade_level=cohort)
            if term == "latest":
                candidates = list(query.order_by("-date", "-id")[:1])
            else:
                candidates = list(query.filter(name__icontains=term).order_by("-date", "-id")[:5])

            # Disambiguate by semester if multiple candidates match
            if len(candidates) > 1:
                message = (parsed.get("raw_message") or "").lower()
                semester_term = None
                if "下学期" in message or re.search(r"[初高中一二三]\s*下", message):
                    semester_term = "下学期"
                elif "上学期" in message or re.search(r"[初高中一二三]\s*上", message):
                    semester_term = "上学期"
                if semester_term:
                    filtered = [item for item in candidates if semester_term in item.name]
                    if filtered:
                        candidates = filtered

            if len(candidates) == 1:
                exams.append(candidates[0])
            elif len(candidates) > 1:
                return None, self._clarification(
                    request_id,
                    "exam",
                    f"找到了多场“{term}”相关考试，请选择要分析的考试。",
                    [
                        {
                            "label": f"{item.academic_year or ''} {item.name} · {item.grade_level} · {item.date}",
                            "value": str(item.id),
                            "payload": {"exam_id": item.id},
                        }
                        for item in candidates
                    ],
                    parsed,
                    question_id="q_exam_001",
                )

        if len(exams) >= required_count:
            return exams[:required_count], None

        query = Exam.objects.all()
        if self._security_context is not None and not self._security_context.is_unrestricted:
            query = query.filter(id__in=allowed_exam_ids(self._security_context))
        if cohort:
            query = query.filter(grade_level=cohort)
        candidates = list(query.order_by("-date", "-id")[:5])
        return None, self._clarification(
            request_id,
            "exam",
            "请先选择要分析的考试。",
            [
                {
                    "label": f"{item.academic_year or ''} {item.name} · {item.grade_level} · {item.date}",
                    "value": str(item.id),
                    "payload": {"exam_id": item.id},
                }
                for item in candidates
            ],
            parsed,
            question_id="q_exam_001",
        )

    def _handle_ranking(self, parsed, scope, request_id):
        exams, clarification = self._resolve_exams(parsed, request_id)
        if clarification:
            return clarification
        exam = exams[0]
        student_name = parsed.get("student_name")
        logger.warning(
            "[handle_ranking] request_id=%s scope=%s subject=%s student_name=%s exam=%s(%s)",
            request_id,
            scope,
            parsed.get("subject"),
            student_name,
            exam.id,
            exam.name,
        )
        result = calculate_ranking(
            exam, scope,
            subject=parsed.get("subject"),
            top_n=parsed.get("top_n", 3),
            student_name=student_name,
        )
        logger.warning(
            "[handle_ranking] request_id=%s result rows=%s student_mode=%s",
            request_id,
            len(result.get("rows", [])),
            result.get("student_mode"),
        )
        if not result["rows"]:
            return self._empty(request_id, "没有找到符合条件的有效成绩数据。", parsed["analysis_type"], scope["type"])
        metric = parsed.get("subject") or "总分"

        if result.get("student_mode"):
            row = result["rows"][0]
            rank_str = f"第{row['rank']}名" if row['rank'] != "-" else "无排名数据"
            return self._answer(
                request_id,
                f"{row['student_name']}（{row['class_name']}）在 {scope.get('label')} {exam.academic_year or ''} {exam.name} 的{metric}{rank_str}（共{row['total']}人）。",
                "排名结果",
                [
                    {"key": "rank", "label": "排名", "align": "right"},
                    {"key": "total", "label": "总人数", "align": "right"},
                    {"key": "student_name", "label": "学生姓名"},
                    {"key": "student_id", "label": "学号"},
                    {"key": "class_name", "label": "班级"},
                    {"key": "score", "label": metric, "align": "right"},
                ],
                result["rows"],
                [
                    f"考试：{exam.academic_year or ''} {exam.name}",
                    f"范围：{scope.get('label')}",
                    f"科目：{metric}",
                    "排名口径：竞争排名；同分按班级、学号排序",
                    f"排除数据：缺考 / NULL / 未录入 {result['excluded_count']} 条",
                ],
                parsed=parsed,
            )

        return self._answer(
            request_id,
            f"{scope.get('label')} {exam.academic_year or ''} {exam.name}{metric}前{parsed.get('top_n', 3)}名如下。",
            "排名结果",
            [
                {"key": "rank", "label": "排名", "align": "right"},
                {"key": "student_name", "label": "学生姓名"},
                {"key": "student_id", "label": "学号"},
                {"key": "class_name", "label": "班级"},
                {"key": "score", "label": metric, "align": "right"},
                {"key": "note", "label": "备注"},
            ],
            result["rows"],
            [
                f"考试：{exam.academic_year or ''} {exam.name}",
                f"范围：{scope.get('label')}",
                f"科目：{metric}",
                "排名口径：竞争排名；同分按班级、学号排序",
                f"排除数据：缺考 / NULL / 未录入 {result['excluded_count']} 条",
            ],
            parsed=parsed,
        )

    def _handle_weighted(self, parsed, scope, request_id):
        if not parsed.get("weights"):
            return self._clarification(
                request_id,
                "weight",
                "请说明两场考试的权重，例如 6:4。",
                [],
                parsed,
                question_id="q_weight_001",
            )
        exams, clarification = self._resolve_exams(parsed, request_id, required_count=2)
        if clarification:
            return clarification
        subjects = [parsed["subject"]] if parsed.get("subject") else None
        result = calculate_weighted(exams[0], exams[1], parsed["weights"], scope, subjects=subjects, top_n=parsed.get("top_n", 3))
        if result["status"] == "subject_mismatch":
            if parsed.get("use_common_subjects"):
                result = calculate_weighted(
                    exams[0],
                    exams[1],
                    parsed["weights"],
                    scope,
                    subjects=result["common_subjects"],
                    top_n=parsed.get("top_n", 3),
                )
            else:
                return self._subject_mismatch(request_id, result, parsed)
        if not result.get("rows"):
            return self._empty(request_id, "没有找到可用于加权计算的有效成绩数据。", "weighted", scope["type"])
        return self._answer(
            request_id,
            f"按{exams[0].name} {round(result['weights'][0] * 100, 1)}%、{exams[1].name} {round(result['weights'][1] * 100, 1)}% 计算后，{scope.get('label')}加权前{parsed.get('top_n', 3)}名如下。",
            "加权结果",
            [
                {"key": "rank", "label": "排名", "align": "right"},
                {"key": "student_name", "label": "学生姓名"},
                {"key": "class_name", "label": "班级"},
                {"key": "exam_a_score", "label": f"{exams[0].name}原始分", "align": "right"},
                {"key": "exam_a_weight", "label": f"{exams[0].name}权重"},
                {"key": "exam_b_score", "label": f"{exams[1].name}原始分", "align": "right"},
                {"key": "exam_b_weight", "label": f"{exams[1].name}权重"},
                {"key": "weighted_score", "label": "加权分", "align": "right"},
                {"key": "note", "label": "备注"},
            ],
            result["rows"],
            [
                f"考试：{exams[0].academic_year or ''} {exams[0].name}、{exams[1].academic_year or ''} {exams[1].name}",
                f"范围：{scope.get('label')}",
                f"科目：{parsed.get('subject') or '总分 / 有效科目'}",
                f"权重：{exams[0].name} {round(result['weights'][0] * 100, 1)}%，{exams[1].name} {round(result['weights'][1] * 100, 1)}%",
                f"排除数据：缺考 / NULL / 未录入 {result['excluded_count']} 条",
            ],
            parsed=parsed,
        )

    def _handle_trend(self, parsed, request_id):
        student_name = parsed.get("student_name")
        if not student_name:
            return self._error(request_id, "请说明要查看哪位学生的趋势。", "parse_error", "trend")
        student_query = Student.objects.select_related("current_class").exclude(status='毕业').filter(name__icontains=student_name).order_by("id")
        if self._security_context is not None:
            student_query = scope_students(self._security_context, student_query)
        matches = list(student_query[:8])
        student = matches[0] if len(matches) == 1 else None
        if not student:
            return self._clarification(
                request_id,
                "student_identity",
                f"未能唯一确定学生“{student_name}”，请补充学号、班级或更完整姓名。",
                [],
                parsed,
                question_id="q_student_identity_001",
                status="need_student_identity",
                fallback_reason="student_not_unique",
            )

        parsed["cohort"] = parsed.get("cohort") or student.cohort
        if not parsed.get("rank_scope") and "排名" in parsed.get("raw_message", ""):
            return self._clarification(
                request_id,
                "rank_scope",
                "请确认查看哪种排名范围。",
                [
                    {"label": "班内排名", "value": "class"},
                    {"label": "年级排名", "value": "grade"},
                    {"label": "分组内排名", "value": "group"},
                ],
                parsed,
                question_id="q_rank_scope_001",
                status="need_rank_scope",
                fallback_reason="rank_scope_required",
            )

        scope = None
        if parsed.get("rank_scope") == "group":
            if not parsed.get("target_scope") or parsed.get("target_scope", {}).get("type") != "business_group":
                return self._clarification(
                    request_id,
                    "group_scope",
                    "请确认查看哪个业务分组内的排名。",
                    [{"label": f"{name}班", "value": name} for name in GROUP_NAMES],
                    parsed,
                    question_id="q_group_scope_001",
                    status="need_group_scope",
                    fallback_reason="group_scope_required",
                )
            scope_response = self._build_scope(parsed, request_id)
            if scope_response.get("type") == "clarification":
                return scope_response
            if scope_response.get("type") == "error":
                return scope_response
            scope = scope_response["scope"]
            try:
                scope = self._secure_scope(scope)
            except AgentPermissionError:
                return self._permission_denied(request_id)

        exams = self._resolve_trend_exams(student, limit=5)
        result = calculate_student_trend(student, exams, subject=parsed.get("subject"), rank_scope=parsed.get("rank_scope"), group_scope=scope)
        if not result["rows"]:
            return self._empty(request_id, "没有找到该学生可用于趋势分析的有效成绩数据。", "trend", scope.get("type") if scope else "student")
        return self._answer(
            request_id,
            f"{student.name}最近 {len(result['rows'])} 次{parsed.get('subject') or '总分'}成绩趋势如下。",
            "趋势结果",
            [
                {"key": "exam_name", "label": "考试名称"},
                {"key": "exam_date", "label": "考试日期"},
                {"key": "metric", "label": "科目 / 指标"},
                {"key": "score", "label": "分数", "align": "right"},
                {"key": "rank", "label": "排名", "align": "right"},
                {"key": "score_change", "label": "较上次变化", "align": "right"},
                {"key": "rank_change", "label": "排名变化", "align": "right"},
            ],
            result["rows"],
            [
                f"学生：{student.name}（{student.student_id}）",
                f"考试范围：最近 {len(result['rows'])} 次考试",
                f"科目：{parsed.get('subject') or '总分'}",
                "趋势口径：按考试日期升序计算较上次变化",
            ],
            parsed=parsed,
        )

    def _resolve_trend_exams(self, student, limit=5):
        """Pick recent comparable exams, excluding outlier subject structures."""
        query = Exam.objects.filter(grade_level=student.cohort)
        if self._security_context is not None and not self._security_context.is_unrestricted:
            query = query.filter(id__in=allowed_exam_ids(self._security_context))
        candidates = list(query.order_by("-date", "-id"))
        if not candidates:
            return []

        subject_sets = {}
        for exam in candidates:
            key = tuple(sorted(get_exam_subjects(exam)))
            subject_sets.setdefault(key, []).append(exam)

        dominant_key = max(subject_sets, key=lambda key: len(subject_sets[key]))
        comparable = [exam for exam in candidates if tuple(sorted(get_exam_subjects(exam))) == dominant_key]
        recent = comparable[:limit]
        recent.reverse()
        return recent

    def _handle_comparison(self, parsed, scope, request_id):
        exams, clarification = self._resolve_exams(parsed, request_id)
        if clarification:
            return clarification
        exam = exams[0]
        class_names = parsed.get("class_names") or []
        if scope["type"] == "business_group" and class_names:
            object_scope = {
                "type": "class",
                "cohort": scope["cohort"],
                "class_name": class_names[0],
                "label": class_names[0],
            }
            reference_scope = scope
        elif len(class_names) >= 2:
            object_scope = {"type": "class", "cohort": parsed.get("cohort"), "class_name": class_names[0], "label": class_names[0]}
            reference_scope = {"type": "class", "cohort": parsed.get("cohort"), "class_name": class_names[1], "label": class_names[1]}
        else:
            return self._error(request_id, "请说明要对比的两个班级或班级与业务分组。", "parse_error", "comparison")
        result = calculate_group_comparison(exam, object_scope, reference_scope, subject=parsed.get("subject"))
        if result["status"] != "success":
            return self._empty(request_id, "没有找到可用于跨群体对比的有效成绩数据。", "comparison", scope["type"])
        return self._answer(
            request_id,
            f"{object_scope['label']} {parsed.get('subject') or '总分'}均分与 {reference_scope['label']} 对比如下。",
            "跨群体对比结果",
            [
                {"key": "object_name", "label": "对比对象"},
                {"key": "reference_name", "label": "参照对象"},
                {"key": "metric", "label": "指标"},
                {"key": "object_avg", "label": "对象均值", "align": "right"},
                {"key": "reference_avg", "label": "参照均值", "align": "right"},
                {"key": "diff", "label": "差值", "align": "right"},
                {"key": "ratio", "label": "占比", "align": "right"},
                {"key": "rank_in_reference", "label": "群体内排名", "align": "right"},
                {"key": "valid_count", "label": "有效人数", "align": "right"},
            ],
            result["rows"],
            [
                f"考试：{exam.academic_year or ''} {exam.name}",
                f"对比对象：{object_scope['label']}",
                f"参照对象：{reference_scope['label']}",
                f"科目：{parsed.get('subject') or '总分'}",
                "统计口径：缺考 / NULL / 未录入不参与均分，真实 0 分参与统计",
            ],
            parsed=parsed,
        )

    def _clarification(
        self,
        request_id,
        clarification_type,
        message,
        options,
        parsed,
        question_id,
        status="needs_clarification",
        fallback_reason="needs_clarification",
    ):
        context = dict(parsed)
        context["pending_question"] = clarification_type
        return {
            "request_id": request_id,
            "type": "clarification",
            "status": status,
            "question_id": question_id,
            "clarification_type": clarification_type,
            "message": message,
            "options": options,
            "allow_free_text": True,
            "allow_cancel": True,
            "context": context,
            "fallback": {"available": False, "reason": fallback_reason},
        }

    def _subject_mismatch(self, request_id, result, parsed):
        return {
            "request_id": request_id,
            "type": "clarification",
            "status": "needs_clarification",
            "question_id": "q_subject_mismatch_001",
            "clarification_type": "subject_mismatch",
            "message": "两场考试科目不完全一致，暂不能直接用各自总分加权。",
            "details": {
                "common_subjects": result["common_subjects"],
                "only_exam_a": result["only_exam_a"],
                "only_exam_b": result["only_exam_b"],
            },
            "options": [
                {"label": "只按共同科目计算", "value": "common_subjects"},
                {"label": "重新选择考试 / 科目", "value": "reselect"},
                {"label": "我来指定科目", "value": "custom_subjects"},
            ],
            "allow_free_text": True,
            "allow_cancel": True,
            "context": parsed,
            "fallback": {"available": False, "reason": "subject_mismatch_pending"},
        }

    def _answer(self, request_id, summary, title, columns, rows, evidence_items, parsed=None):
        result = {
            "request_id": request_id,
            "type": "answer",
            "status": "success",
            "summary": summary,
            "tables": [{"title": title, "columns": columns, "rows": rows}],
            "evidence": {"collapsed_by_default": True, "items": evidence_items},
            "fallback": {"available": False, "reason": "success"},
        }
        if parsed:
            result["context"] = parsed
        return result

    def _empty(self, request_id, message, analysis_type, scope_type):
        return {
            "request_id": request_id,
            "type": "empty",
            "status": "empty_result",
            "message": message,
            "actions": [{"type": "refine_query", "label": "重新输入条件"}],
            "fallback": build_fallback(analysis_type, scope_type=scope_type, reason="empty_result"),
        }

    def _error(self, request_id, message, status, analysis_type=None, scope_type=None):
        fallback = build_fallback(analysis_type, scope_type=scope_type)
        actions = [{"type": "retry_agent", "label": "重新生成"}]
        if fallback.get("available"):
            actions.append({"type": "basic_query_retry", "label": "用基础查询重试"})
        return {
            "request_id": request_id,
            "type": "error",
            "status": status,
            "message": message,
            "actions": actions,
            "fallback": fallback,
        }

    def _permission_denied(self, request_id):
        return {
            "request_id": request_id,
            "type": "error",
            "status": "permission_denied",
            "message": PERMISSION_DENIED_MESSAGE,
            "actions": [{"type": "retry_agent", "label": "重新生成"}],
            "fallback": {"available": False, "reason": "permission_denied"},
        }

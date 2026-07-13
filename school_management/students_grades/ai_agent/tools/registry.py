"""V3 Tool Registry — wraps existing calculation tools as LLM-callable functions.

Each tool has:
  - A Python function that executes the real logic (thin wrapper over tools/*)
  - An OpenAI-compatible function schema (name + description + parameters)
  - Parameter validation with clear error messages for LLM retry

LLM only sees the schema — docstrings here are for developers, schema descriptions
are what the LLM reads.
"""

import json
import logging

from django.db.models import Q

from ...models.exam import Exam
from ...models.score import Score
from ...models.student import Student
from ..security.permissions import (
    AgentPermissionError,
    PERMISSION_DENIED_MESSAGE,
    allowed_exam_ids,
    scope_students,
)
from . import comparison_tool, group_tool, ranking_tool, score_tool, trend_tool, weighted_tool

logger = logging.getLogger(__name__)


def _permission_error():
    return {"error": PERMISSION_DENIED_MESSAGE, "status": "permission_denied"}


def _visible_students(qs, security_context):
    if security_context is None:
        return qs
    return scope_students(security_context, qs)


def _get_visible_exam(exam_id, security_context):
    try:
        exam = Exam.objects.get(id=exam_id)
    except Exam.DoesNotExist:
        return None
    if security_context is None or security_context.is_unrestricted:
        return exam
    if exam.id not in allowed_exam_ids(security_context):
        raise AgentPermissionError(PERMISSION_DENIED_MESSAGE)
    return exam


def _secure_scope(scope, security_context):
    if security_context is None or security_context.is_unrestricted:
        return scope

    permitted = set(security_context.allowed_class_ids or [])
    scope_type = scope.get("type")
    if scope_type == "grade":
        return {
            "type": "business_group",
            "cohort": scope.get("cohort"),
            "class_ids": sorted(permitted),
        }

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
        return {
            "type": "business_group",
            "cohort": scope.get("cohort"),
            "class_ids": class_ids,
        }

    if scope_type == "business_group":
        class_ids = sorted(set(scope.get("class_ids") or []) & permitted)
        if not class_ids:
            raise AgentPermissionError(PERMISSION_DENIED_MESSAGE)
        secure = dict(scope)
        secure["class_ids"] = class_ids
        return secure

    raise AgentPermissionError(PERMISSION_DENIED_MESSAGE)

# ---------------------------------------------------------------------------
# Tool implementations — thin wrappers over existing functions
# ---------------------------------------------------------------------------


def search_student(keyword=None, grade_level=None, class_name=None, security_context=None):
    """Search students by name or ID."""
    if not keyword:
        return {"error": "keyword 参数不能为空", "suggestion": "请提供学生姓名或其片段"}

    students_qs = _visible_students(Student.objects.select_related("current_class").exclude(status='毕业'), security_context).filter(
        Q(name__icontains=keyword) | Q(student_id__icontains=keyword)
    )
    if grade_level:
        students_qs = students_qs.filter(grade_level=grade_level)
    if class_name:
        students_qs = students_qs.filter(current_class__class_name=class_name)

    students = list(students_qs.order_by("id")[:10])
    return {
        "found": len(students) > 0,
        "total_count": len(students),
        "students": [
            {
                "id": s.id,
                "name": s.name,
                "grade_level": s.grade_level or "",
                "cohort": s.cohort or "",
                "class_name": s.current_class.class_name if s.current_class else "",
                "status": s.status,
            }
            for s in students
        ],
    }


def search_exam(keyword=None, grade_level=None, semester=None, limit=10, security_context=None):
    """Search exams by name + grade."""
    if not keyword:
        return {"error": "keyword 参数不能为空", "suggestion": "请提供考试名称关键字如「期末模拟」"}

    exams_qs = Exam.objects.filter(name__icontains=keyword)
    if security_context is not None and not security_context.is_unrestricted:
        exams_qs = exams_qs.filter(id__in=allowed_exam_ids(security_context))
    if grade_level:
        # Map grade display name (e.g. "初二") to cohort values (e.g. "初中2024级")
        # by querying the database instead of hardcoding.
        grade_cohorts = list(
            Exam.objects.filter(grade_level__isnull=False)
            .values_list("grade_level", flat=True)
            .distinct()
        )
        target_cohorts = []
        for gc in grade_cohorts:
            if (
                (grade_level == "初一" and gc.endswith("2025级"))
                or (grade_level == "初二" and gc.endswith("2024级"))
                or (grade_level == "初三" and gc.endswith("2023级"))
                or (grade_level == "高一" and gc.startswith("高中") and gc.endswith("2027级"))
                or (grade_level == "高二" and gc.startswith("高中") and gc.endswith("2026级"))
                or (grade_level == "高三" and gc.startswith("高中") and gc.endswith("2025级"))
            ):
                target_cohorts.append(gc)
        if target_cohorts:
            exams_qs = exams_qs.filter(grade_level__in=target_cohorts)
        else:
            # Grade display name has no matching cohort in DB → no results
            exams_qs = exams_qs.none()

    if semester and semester in ("上学期", "下学期"):
        semester_keyword = semester
        exams_qs = exams_qs.filter(name__icontains=semester_keyword)

    exams_qs = exams_qs.order_by("-date")[:max(limit, 20)]
    exams = list(exams_qs)
    return {
        "found": len(exams) > 0,
        "total_count": len(exams),
        "exams": [
            {
                "id": e.id,
                "name": e.name,
                "academic_year": e.academic_year or "",
                "date": e.date.strftime("%Y-%m-%d") if e.date else "",
                "grade_level": e.grade_level or "",
            }
            for e in exams
        ],
    }


def get_scores(exam_id=None, student_ids=None, subjects=None, security_context=None):
    """Get scores for students in an exam."""
    if not exam_id:
        return {"error": "exam_id 参数不能为空", "suggestion": "请先调用 search_exam 获取考试 ID"}
    if not student_ids:
        return {"error": "student_ids 参数不能为空", "suggestion": "请先调用 search_student 获取学生 ID"}

    try:
        exam = _get_visible_exam(exam_id, security_context)
    except AgentPermissionError:
        return _permission_error()
    if not exam:
        return {"error": f"未找到 ID 为 {exam_id} 的考试", "suggestion": "请重新调用 search_exam 获取有效考试 ID"}

    students_qs = _visible_students(Student.objects.filter(id__in=student_ids).select_related("current_class"), security_context)
    students = list(students_qs)
    if not students:
        return _permission_error()

    grouped = score_tool.scores_by_student(exam, students, subjects)
    max_score = 0
    for es in exam.exam_subjects.all():
        if subjects is None or es.subject_code in subjects:
            max_score += float(es.max_score)

    result_students = []
    for s in students:
        subject_scores = grouped.get(s.id, {})
        total = sum(subject_scores.values()) if subject_scores else 0
        result_students.append({
            "student_name": s.name,
            "student_internal_id": s.id,
            "total_score": score_tool.format_number(total) if subject_scores else None,
            "subjects": {k: score_tool.format_number(v) for k, v in subject_scores.items()},
        })

    all_empty = all(not grouped.get(s.id) for s in students)
    return {
        "exam_name": exam.name,
        "students": result_students,
        "exam_total_max": max_score,
        "data_completeness": "empty" if all_empty else "partial" if any(not grouped.get(s.id) for s in students) else "full",
    }


def get_student_rank(exam_id=None, student_name=None, scope_type="grade", subject=None, group_name=None, security_context=None):
    """Query a single student's rank in a specific exam.

    Use this when the user asks about a specific named student's ranking.
    Never use this to get a top-N list — use get_top_n for that.
    """
    if not exam_id:
        return {"error": "exam_id 参数不能为空", "suggestion": "请先调用 search_exam 获取考试 ID"}
    if not student_name:
        return {"error": "student_name 参数不能为空", "suggestion": "请先调用 search_student 获取学生姓名"}

    try:
        exam = _get_visible_exam(exam_id, security_context)
    except AgentPermissionError:
        return _permission_error()
    if not exam:
        return {"error": f"未找到 ID 为 {exam_id} 的考试", "suggestion": "请重新调用 search_exam"}

    # Resolve student (exclude graduates)
    student = _visible_students(Student.objects.exclude(status='毕业'), security_context).filter(name=student_name).first()
    if not student:
        return _permission_error()

    cohort = student.cohort or exam.grade_level
    if not cohort:
        return {"error": "无法确定年级(cohort)", "suggestion": "请先确认学生的年级信息"}

    # Build scope
    if scope_type == "class":
        class_name = student.current_class.class_name if student.current_class else None
        if not class_name:
            return {"error": "无法确定学生所在班级", "suggestion": "该学生可能未分班，请尝试年级排名"}
        scope = {"type": "class", "cohort": cohort, "class_name": class_name}
    elif scope_type == "business_group":
        if not group_name:
            return {"error": "业务分组排名需要 group_name 参数", "suggestion": "可选值：格致、南山、创新"}
        resolved = group_tool.resolve_business_group(cohort, group_name)
        if resolved["status"] != "success":
            return {"error": resolved.get("message", f"分组 {group_name} 解析失败"), "suggestion": "请检查分组名称是否正确"}
        scope = {"type": "business_group", "cohort": cohort, "class_ids": resolved["class_ids"]}
    else:
        scope = {"type": "grade", "cohort": cohort}

    try:
        scope = _secure_scope(scope, security_context)
        result = ranking_tool.calculate_ranking(
            exam=exam, scope=scope, subject=subject, top_n=1, student_name=student_name,
        )
    except AgentPermissionError:
        return _permission_error()
    if "valid_count" in result and "total_valid" not in result:
        result["total_valid"] = result["valid_count"]
    return result


def get_top_n(exam_id=None, scope_type="grade", subject=None, top_n=3, group_name=None, cohort=None, class_name=None, security_context=None):
    """Query the top N students in a specified scope.

    Use this when the user asks for "前X名" or "排名前三" without naming a
    specific student. Do NOT pass student_name — this tool returns a list.
    """
    if not exam_id:
        return {"error": "exam_id 参数不能为空", "suggestion": "请先调用 search_exam 获取考试 ID"}
    if not scope_type:
        return {"error": "scope_type 参数不能为空", "suggestion": "请指定排名范围：class/grade/business_group"}

    try:
        exam = _get_visible_exam(exam_id, security_context)
    except AgentPermissionError:
        return _permission_error()
    if not exam:
        return {"error": f"未找到 ID 为 {exam_id} 的考试", "suggestion": "请重新调用 search_exam"}

    if not cohort:
        cohort = exam.grade_level
    if not cohort:
        return {"error": "无法确定年级(cohort)", "suggestion": "请先确认考试的年级信息"}

    # Build scope
    if scope_type == "class":
        if not class_name:
            return {"error": "班级排名需要 class_name 参数", "suggestion": "请提供班级名如\"14班\""}
        scope = {"type": "class", "cohort": cohort, "class_name": class_name}
    elif scope_type == "business_group":
        if not group_name:
            return {"error": "业务分组排名需要 group_name 参数", "suggestion": "可选值：格致、南山、创新"}
        resolved = group_tool.resolve_business_group(cohort, group_name)
        if resolved["status"] != "success":
            return {"error": resolved.get("message", f"分组 {group_name} 解析失败"), "suggestion": "请检查分组名称是否正确"}
        scope = {"type": "business_group", "cohort": cohort, "class_ids": resolved["class_ids"]}
    else:
        scope = {"type": "grade", "cohort": cohort}

    try:
        scope = _secure_scope(scope, security_context)
        result = ranking_tool.calculate_ranking(
            exam=exam, scope=scope, subject=subject, top_n=top_n,
        )
    except AgentPermissionError:
        return _permission_error()
    if "valid_count" in result and "total_valid" not in result:
        result["total_valid"] = result["valid_count"]
    return result


def compute_trend(student_name=None, exam_ids=None, subject=None, rank_scope=None, security_context=None):
    """Compute score/rank trend across exams."""
    if not student_name:
        return {"error": "student_name 参数不能为空", "suggestion": "请提供要分析的学生姓名"}
    if not exam_ids:
        return {"error": "exam_ids 参数不能为空", "suggestion": "请先调用 search_exam 获取考试 ID 列表"}

    student = _visible_students(Student.objects.exclude(status='毕业'), security_context).filter(name=student_name).first()
    if not student:
        return _permission_error()

    try:
        visible_exam_ids = [exam.id for exam in (_get_visible_exam(exam_id, security_context) for exam_id in exam_ids) if exam]
    except AgentPermissionError:
        return _permission_error()
    exams = list(Exam.objects.filter(id__in=visible_exam_ids).order_by("date"))
    if not exams:
        return {"error": "未找到指定的考试", "suggestion": "请重新调用 search_exam"}

    result = trend_tool.calculate_student_trend(
        student=student,
        exams=exams,
        subject=subject,
        rank_scope=rank_scope,
    )
    result["student_name"] = student_name
    result["student_internal_id"] = student.id

    # Generate summary for Brief AC-4
    rows = result.get("rows", [])
    valid_count = result.get("valid_count", 0)
    metric = subject or "总分"
    if valid_count >= 2 and rows:
        first = rows[0]
        last = rows[-1]
        score_change = last.get("score_change", "-")
        rank_change = last.get("rank_change", "-")
        parts = [f"{student_name} 最近 {valid_count} 次考试{metric}趋势："]
        if isinstance(score_change, (int, float)):
            direction = "上升" if score_change > 0 else "下降" if score_change < 0 else "不变"
            parts.append(f"分数从 {first['score']} 变为 {last['score']}（{direction} {abs(score_change)} 分）")
        if rank_scope and isinstance(rank_change, (int, float)):
            direction = "上升" if rank_change > 0 else "下降" if rank_change < 0 else "不变"
            parts.append(f"排名从第 {first['rank']} 变成第 {last['rank']}（{direction} {abs(rank_change)} 位）")
        result["summary"] = "。".join(parts) + "。"
    else:
        result["summary"] = f"{student_name} 的{metric}趋势数据不足，无法分析。"

    return result


def compute_weighted(
    exam_a_id=None, exam_b_id=None, weight_a=None, weight_b=None,
    scope_type="grade", cohort=None, class_name=None, group_name=None,
    subjects=None, top_n=3, security_context=None,
):
    """Weighted ranking across two exams."""
    if not exam_a_id or not exam_b_id:
        return {"error": "需要两场考试的 ID", "suggestion": "请先调用 search_exam 获取两场考试的 ID"}
    if weight_a is None or weight_b is None:
        return {"error": "需要两个权重值", "suggestion": "例如 weight_a=60, weight_b=40 表示 6:4 加权"}

    try:
        exam_a = _get_visible_exam(exam_a_id, security_context)
        exam_b = _get_visible_exam(exam_b_id, security_context)
    except AgentPermissionError:
        return _permission_error()
    if not exam_a or not exam_b:
        return {"error": "考试 ID 无效", "suggestion": "请重新调用 search_exam"}

    if not cohort:
        cohort = exam_a.grade_level or exam_b.grade_level
    if not cohort:
        return {"error": "无法确定年级", "suggestion": "请确认考试对应的年级"}

    # Build scope
    if scope_type == "class":
        if not class_name:
            return {"error": "班级排名需要 class_name 参数"}
        scope = {"type": "class", "cohort": cohort, "class_name": class_name}
    elif scope_type == "business_group":
        if not group_name:
            return {"error": "业务分组排名需要 group_name 参数"}
        resolved = group_tool.resolve_business_group(cohort, group_name)
        if resolved["status"] != "success":
            return {"error": resolved.get("message", ""), "suggestion": "请检查分组名称"}
        scope = {"type": "business_group", "cohort": cohort, "class_ids": resolved["class_ids"]}
    else:
        scope = {"type": "grade", "cohort": cohort}

    try:
        scope = _secure_scope(scope, security_context)
        result = weighted_tool.calculate_weighted(
            exam_a=exam_a, exam_b=exam_b,
            weights=[weight_a, weight_b],
            scope=scope,
            subjects=subjects,
            top_n=top_n,
        )
    except AgentPermissionError:
        return _permission_error()
    return result


def compute_comparison(
    exam_id=None, object_scope_type=None, reference_scope_type=None,
    cohort=None, object_class_name=None, object_group_name=None,
    reference_class_name=None, reference_group_name=None, subject=None, security_context=None,
):
    """Cross-group comparison."""
    if not exam_id:
        return {"error": "exam_id 参数不能为空", "suggestion": "请先调用 search_exam 获取考试 ID"}
    if not object_scope_type or not reference_scope_type:
        return {"error": "需要指定比较双方的范围类型"}
    if not cohort:
        return {"error": "cohort 参数不能为空", "suggestion": "请确认年级"}

    try:
        exam = _get_visible_exam(exam_id, security_context)
    except AgentPermissionError:
        return _permission_error()
    if not exam:
        return {"error": f"未找到 ID 为 {exam_id} 的考试", "suggestion": "请重新调用 search_exam"}

    def _build_scope(st, cn, gn):
        if st == "class":
            return {"type": "class", "cohort": cohort, "class_name": cn}
        elif st == "business_group":
            resolved = group_tool.resolve_business_group(cohort, gn)
            if resolved["status"] != "success":
                return None
            return {"type": "business_group", "cohort": cohort, "class_ids": resolved["class_ids"], "class_names": resolved["class_names"]}
        return {"type": "grade", "cohort": cohort}

    obj_scope = _build_scope(object_scope_type, object_class_name, object_group_name)
    ref_scope = _build_scope(reference_scope_type, reference_class_name, reference_group_name)
    if obj_scope is None or ref_scope is None:
        return {"error": "分组解析失败", "suggestion": "请检查分组名称"}

    try:
        obj_scope = _secure_scope(obj_scope, security_context)
        ref_scope = _secure_scope(ref_scope, security_context)
        return comparison_tool.calculate_group_comparison(
            exam=exam, object_scope=obj_scope, reference_scope=ref_scope, subject=subject,
        )
    except AgentPermissionError:
        return _permission_error()


# ---------------------------------------------------------------------------
# Tool registry — maps name → (function, OpenAI schema)
# ---------------------------------------------------------------------------

TOOL_REGISTRY = {
    "search_student": {
        "func": search_student,
        "schema": {
            "name": "search_student",
            "description": (
                "在全校学生库中模糊搜索学生。当用户提到学生姓名但不确定具体学生时调用。"
                "也用于确定学生所在班级和年级。"
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "keyword": {
                        "type": "string",
                        "description": "学生姓名或学号片段，支持模糊匹配。例如「黄」会匹配「黄晨田」「黄子轩」。",
                    },
                    "grade_level": {
                        "type": "string",
                        "enum": ["初一", "初二", "初三", "高一", "高二", "高三"],
                        "description": "年级筛选，如「初二」。可选，不传则搜索全部年级。",
                    },
                    "class_name": {
                        "type": "string",
                        "description": "班级筛选，如「14班」。可选，不传则不限制班级。",
                    },
                },
                "required": ["keyword"],
            },
        },
    },
    "search_exam": {
        "func": search_exam,
        "schema": {
            "name": "search_exam",
            "description": (
                "按名称关键字和年级搜索考试。当用户提到「期末考」「期中」「模拟考」「月考」"
                "等考试名称时调用。返回考试 ID 供后续工具使用。"
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "keyword": {
                        "type": "string",
                        "description": "考试名称关键字。例如「期末模拟」会匹配「初二下学期期末模拟考」。",
                    },
                    "grade_level": {
                        "type": "string",
                        "enum": ["初一", "初二", "初三", "高一", "高二", "高三"],
                        "description": "年级筛选。用户说「初二期末」时传入「初二」。可选。",
                    },
                    "semester": {
                        "type": "string",
                        "enum": ["上学期", "下学期"],
                        "description": "学期筛选。用户说「初一下学期期末」时传入「下学期」。可选。",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "返回上限，默认 10。",
                    },
                },
                "required": ["keyword"],
            },
        },
    },
    "get_scores": {
        "func": get_scores,
        "schema": {
            "name": "get_scores",
            "description": (
                "获取指定学生在指定考试中的各科成绩和总分。在调用 compute_rank 或 "
                "compute_trend 之前调用，作为数据准备步骤。返回每科分数和总分。"
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "exam_id": {
                        "type": "integer",
                        "description": "考试 ID，来自 search_exam 返回结果。",
                    },
                    "student_ids": {
                        "type": "array",
                        "items": {"type": "integer"},
                        "description": "学生 ID 列表，来自 search_student 返回结果。支持 1 到 N 个学生。",
                    },
                    "subjects": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "科目列表，如 [语文,数学,英语]。可选，不传则返回所有科目。",
                    },
                },
                "required": ["exam_id", "student_ids"],
            },
        },
    },
    "get_student_rank": {
        "func": get_student_rank,
        "schema": {
            "name": "get_student_rank",
            "description": (
                "查询单个具体学生在指定考试中的排名。当用户问「黄晨田排第几」「李业升期末排名」"
                "等带上具体学生姓名的问题时调用。student_name 必须从 search_student 的结果中获取。"
                "这是查单人排名的专用工具，不要用这个工具查前N名列表——查前N名请用 get_top_n。"
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "exam_id": {"type": "integer", "description": "考试 ID，来自 search_exam。"},
                    "student_name": {
                        "type": "string",
                        "description": "学生姓名（精确匹配），来自 search_student。必填——这个工具是查特定学生的。",
                    },
                    "scope_type": {
                        "type": "string",
                        "enum": ["class", "grade", "business_group"],
                        "description": "排名范围。class=班级排名，grade=年级排名（默认），business_group=业务分组排名。",
                    },
                    "subject": {"type": "string", "description": "可选，指定科目如「数学」。不传时按总分排名。"},
                    "group_name": {
                        "type": "string",
                        "enum": ["格致", "南山", "创新"],
                        "description": "业务分组名称。仅 scope_type=business_group 时需要。",
                    },
                },
                "required": ["exam_id", "student_name"],
            },
        },
    },
    "get_top_n": {
        "func": get_top_n,
        "schema": {
            "name": "get_top_n",
            "description": (
                "查询指定范围内的前 N 名学生排名。当用户问「前X名」「排名前三」「格致班前十」"
                "等需要榜单的问题时调用。不需要传 student_name——这是查群体榜单的工具。"
                "如果用户问的是特定学生的排名，请用 get_student_rank 而不是这个工具。"
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "exam_id": {"type": "integer", "description": "考试 ID，来自 search_exam。"},
                    "scope_type": {
                        "type": "string",
                        "enum": ["class", "grade", "business_group"],
                        "description": "排名范围。class=班级，grade=年级（默认），business_group=业务分组。",
                    },
                    "subject": {"type": "string", "description": "可选，指定科目如「数学」。不传时按总分排名。"},
                    "top_n": {"type": "integer", "description": "返回前 N 名，默认 3。"},
                    "group_name": {
                        "type": "string",
                        "enum": ["格致", "南山", "创新"],
                        "description": "业务分组名称。仅 scope_type=business_group 时需要。",
                    },
                    "cohort": {"type": "string", "description": "年级 cohort，如「初中2024级」。可选，不传时从考试推断。"},
                    "class_name": {"type": "string", "description": "班级名。仅 scope_type=class 时需要，如「14班」。"},
                },
                "required": ["exam_id", "scope_type"],
            },
        },
    },
    "compute_trend": {
        "func": compute_trend,
        "schema": {
            "name": "compute_trend",
            "description": (
                "计算单个学生在多次考试中的成绩和排名变化趋势。当用户问「最近X次」「变化」"
                "「趋势」「进步退步」时调用。返回每次考试的分数、排名、以及与上一次相比的变化量。"
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "student_name": {
                        "type": "string",
                        "description": "学生姓名（精确匹配）。",
                    },
                    "exam_ids": {
                        "type": "array",
                        "items": {"type": "integer"},
                        "description": "考试 ID 列表，按时间从早到晚排列。来自 search_exam 的多次调用。",
                    },
                    "subject": {
                        "type": "string",
                        "description": "可选，指定科目如「数学」。不传时按总分计算趋势。",
                    },
                    "rank_scope": {
                        "type": "string",
                        "enum": ["class", "grade"],
                        "description": "排名范围。class=班级排名，grade=年级排名。不传则只返回分数变化不计算排名。",
                    },
                },
                "required": ["student_name", "exam_ids"],
            },
        },
    },
    "compute_weighted": {
        "func": compute_weighted,
        "schema": {
            "name": "compute_weighted",
            "description": "计算两场考试按权重加权后的排名。当用户要求「期中期末6:4加权」「期中60%期末40%」等加权排名时调用。",
            "parameters": {
                "type": "object",
                "properties": {
                    "exam_a_id": {"type": "integer", "description": "第一场考试 ID（如期中考试）。"},
                    "exam_b_id": {"type": "integer", "description": "第二场考试 ID（如期末考试）。"},
                    "weight_a": {"type": "number", "description": "第一场考试权重（如 60 表示 60%）。"},
                    "weight_b": {"type": "number", "description": "第二场考试权重（如 40 表示 40%）。"},
                    "scope_type": {
                        "type": "string",
                        "enum": ["class", "grade", "business_group"],
                        "description": "排名范围，默认 grade。",
                    },
                    "cohort": {"type": "string", "description": "年级 cohort，如「初中2024级」。可选，不传时从考试推断。"},
                    "class_name": {"type": "string", "description": "班级名，仅 scope_type=class 时需要。"},
                    "group_name": {"type": "string", "enum": ["格致", "南山", "创新"], "description": "分组名，仅 scope_type=business_group 时需要。"},
                    "subjects": {"type": "array", "items": {"type": "string"}, "description": "科目列表，可选。不传则用两场考试共有的科目。"},
                    "top_n": {"type": "integer", "description": "返回前 N 名，默认 3。"},
                },
                "required": ["exam_a_id", "exam_b_id", "weight_a", "weight_b"],
            },
        },
    },
    "compute_comparison": {
        "func": compute_comparison,
        "schema": {
            "name": "compute_comparison",
            "description": "计算两个群体在指定考试中的均分对比。当用户问「对比」「X班在Y班中排第几」「占比」等跨群体比较时调用。",
            "parameters": {
                "type": "object",
                "properties": {
                    "exam_id": {"type": "integer", "description": "考试 ID。"},
                    "object_scope_type": {
                        "type": "string",
                        "enum": ["class", "grade", "business_group"],
                        "description": "比较对象（左侧）的范围类型。",
                    },
                    "reference_scope_type": {
                        "type": "string",
                        "enum": ["class", "grade", "business_group"],
                        "description": "参照对象（右侧）的范围类型。",
                    },
                    "cohort": {"type": "string", "description": "年级 cohort，如「初中2024级」。"},
                    "object_class_name": {"type": "string", "description": "比较对象的班级名，仅 object_scope_type=class 时需要。"},
                    "object_group_name": {"type": "string", "enum": ["格致", "南山", "创新"], "description": "比较对象的分组名，仅 object_scope_type=business_group 时需要。"},
                    "reference_class_name": {"type": "string", "description": "参照对象的班级名。"},
                    "reference_group_name": {"type": "string", "enum": ["格致", "南山", "创新"], "description": "参照对象的分组名。"},
                    "subject": {"type": "string", "description": "指定科目，可选。不传时按总分对比。"},
                },
                "required": ["exam_id", "object_scope_type", "reference_scope_type", "cohort"],
            },
        },
    },
}


# ---------------------------------------------------------------------------
# Registry API
# ---------------------------------------------------------------------------

def as_openai_schema():
    """Return list of tool schemas in OpenAI function-calling format."""
    return [
        {"type": "function", "function": info["schema"]}
        for info in TOOL_REGISTRY.values()
    ]


def execute(tool_name, tool_args, security_context=None):
    """Execute a tool and return its result dict.

    Returns {"error": "...", "suggestion": "..."} on failure so LLM can retry.
    """
    info = TOOL_REGISTRY.get(tool_name)
    if not info:
        return {"error": f"未知工具: {tool_name}", "suggestion": f"可用工具: {list(TOOL_REGISTRY.keys())}"}

    try:
        kwargs = dict(tool_args or {})
        if security_context is not None:
            kwargs["security_context"] = security_context
        result = info["func"](**kwargs)
        if not isinstance(result, dict):
            result = {"result": result}
        return result
    except Exception as exc:
        logger.exception("Tool %s failed", tool_name)
        return {
            "error": f"工具 {tool_name} 执行失败: {exc}",
            "suggestion": "请检查参数是否正确，必要时重新搜索",
        }

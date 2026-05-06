import type { RuleForm, QueryPayload, ExamScopeType } from "./types";

/** Parse URL searchParams into RuleForm + selected exam IDs */
export function parseParams(sp: URLSearchParams): { form: RuleForm; ids: string[] } {
  const form: RuleForm = {
    grade_level: sp.get("grade_level") || "",
    exam_scope: {
      type: (sp.get("exam_scope_type") as ExamScopeType) || "all_in_grade",
      exam_ids: sp.get("exam_ids")?.split(","),
      date_from: sp.get("date_from") || undefined,
      date_to: sp.get("date_to") || undefined,
    },
    metric: "total_score_rank_in_grade",
    operator: "lte",
    threshold: sp.get("threshold") || "",
    quantifier: (sp.get("quantifier") as "all" | "at_least") || "all",
    k: sp.get("k") || "",
    absent_policy: (sp.get("absent_policy") as "strict_fail" | "ignore_absent") || "strict_fail",
  };
  const ids =
    form.exam_scope.type === "selected_exam_ids" && form.exam_scope.exam_ids
      ? form.exam_scope.exam_ids
      : [];
  return { form, ids };
}

/** Build URL query string from form state */
export function buildQueryString(form: RuleForm, selectedExamIds: string[]): string {
  const p = new URLSearchParams();
  p.set("grade_level", form.grade_level);
  p.set("exam_scope_type", form.exam_scope.type);
  if (form.exam_scope.type === "selected_exam_ids" && selectedExamIds.length > 0)
    p.set("exam_ids", selectedExamIds.join(","));
  if (form.exam_scope.type === "date_range") {
    if (form.exam_scope.date_from) p.set("date_from", form.exam_scope.date_from);
    if (form.exam_scope.date_to) p.set("date_to", form.exam_scope.date_to);
  }
  p.set("threshold", form.threshold);
  p.set("quantifier", form.quantifier);
  if (form.quantifier === "at_least") p.set("k", form.k);
  p.set("absent_policy", form.absent_policy);
  return p.toString();
}

/** Build API payload from form state */
export function buildPayload(form: RuleForm, selectedExamIds: string[], threshold: number): QueryPayload {
  const payload: QueryPayload = {
    grade_level: form.grade_level,
    exam_scope: { type: form.exam_scope.type },
    metric: form.metric,
    operator: form.operator,
    threshold,
    quantifier: form.quantifier,
    absent_policy: form.absent_policy,
  };
  if (form.exam_scope.type === "selected_exam_ids") payload.exam_scope.exam_ids = selectedExamIds;
  else if (form.exam_scope.type === "date_range") {
    payload.exam_scope.date_from = form.exam_scope.date_from;
    payload.exam_scope.date_to = form.exam_scope.date_to;
  }
  if (form.quantifier === "at_least") payload.k = parseInt(form.k, 10);
  return payload;
}

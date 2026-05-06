import type { RuleForm, Message } from "./types";

/**
 * Validate the form and build URLSearchParams for navigation.
 * Returns either {ok, params} on success or {ok, message} on failure.
 */
export function validateAndBuildQuery(
  form: RuleForm,
  selectedExamIds: string[]
):
  | { ok: true; params: URLSearchParams }
  | { ok: false; message: Message } {
  if (!form.grade_level)
    return {
      ok: false,
      message: { id: Date.now(), type: "info", text: "请选择年级" },
    };

  const thresholdNum = parseInt(form.threshold, 10);
  if (!form.threshold || isNaN(thresholdNum) || thresholdNum <= 0)
    return {
      ok: false,
      message: { id: Date.now(), type: "info", text: "前N名阈值必须为正整数" },
    };

  if (form.exam_scope.type === "selected_exam_ids" && selectedExamIds.length === 0)
    return {
      ok: false,
      message: { id: Date.now(), type: "info", text: "请选择至少一个考试" },
    };

  if (form.exam_scope.type === "date_range") {
    if (!form.exam_scope.date_from || !form.exam_scope.date_to)
      return {
        ok: false,
        message: { id: Date.now(), type: "info", text: "请填写完整的日期范围" },
      };
    if (form.exam_scope.date_from > form.exam_scope.date_to)
      return {
        ok: false,
        message: {
          id: Date.now(),
          type: "info",
          text: "开始日期不能晚于结束日期",
        },
      };
  }

  if (form.quantifier === "at_least") {
    const kNum = parseInt(form.k, 10);
    if (!form.k || isNaN(kNum) || kNum <= 0)
      return {
        ok: false,
        message: { id: Date.now(), type: "info", text: "K值必须为正整数" },
      };
  }

  const params = new URLSearchParams();
  params.set("grade_level", form.grade_level);
  params.set("exam_scope_type", form.exam_scope.type);
  if (form.exam_scope.type === "selected_exam_ids" && selectedExamIds.length > 0)
    params.set("exam_ids", selectedExamIds.join(","));
  if (form.exam_scope.type === "date_range") {
    if (form.exam_scope.date_from) params.set("date_from", form.exam_scope.date_from);
    if (form.exam_scope.date_to) params.set("date_to", form.exam_scope.date_to);
  }
  params.set("threshold", form.threshold);
  params.set("quantifier", form.quantifier);
  if (form.quantifier === "at_least") params.set("k", form.k);
  params.set("absent_policy", form.absent_policy);

  return { ok: true, params };
}

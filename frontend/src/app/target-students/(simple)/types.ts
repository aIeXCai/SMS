export type Option = { value: string; label: string };

export type ExamScopeType = "all_in_grade" | "selected_exam_ids" | "date_range";

export type ExamScope = {
  type: ExamScopeType;
  exam_ids?: string[];
  date_from?: string;
  date_to?: string;
};

export type RuleForm = {
  grade_level: string;
  exam_scope: ExamScope;
  metric: "total_score_rank_in_grade";
  operator: "lte";
  threshold: string;
  quantifier: "all" | "at_least";
  k: string;
  absent_policy: "strict_fail" | "ignore_absent";
};

export const EMPTY_RULE: RuleForm = {
  grade_level: "",
  exam_scope: { type: "all_in_grade" },
  metric: "total_score_rank_in_grade",
  operator: "lte",
  threshold: "",
  quantifier: "all",
  k: "",
  absent_policy: "strict_fail",
};

export const QUANTIFIER_OPTIONS: Option[] = [
  { value: "all", label: "每次都满足" },
  { value: "at_least", label: "至少K次满足" },
];

export const ABSENT_POLICY_OPTIONS: Option[] = [
  { value: "strict_fail", label: "缺考视为不达标" },
  { value: "ignore_absent", label: "忽略缺考" },
];

export const EXAM_SCOPE_OPTIONS: Option[] = [
  { value: "all_in_grade", label: "该年级所有考试" },
  { value: "selected_exam_ids", label: "指定考试" },
  { value: "date_range", label: "日期范围" },
];

export type Message = {
  id: number;
  type: "success" | "danger" | "info";
  text: string;
};

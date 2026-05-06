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

export type QueryPayload = {
  grade_level: string;
  exam_scope: {
    type: ExamScopeType;
    exam_ids?: string[];
    date_from?: string;
    date_to?: string;
  };
  metric: string;
  operator: string;
  threshold: number;
  quantifier: string;
  k?: number;
  absent_policy: string;
};

export type StudentRecord = {
  student_pk: number;
  student_id: string;
  name: string;
  cohort: string;
  grade_level: string;
  grade_level_display: string;
  class_name: string | null;
  hit_count: number;
  required_count: number;
  participated_count: number;
  missed_exam_count: number;
  avg_rank: number | null;
};

export type ResultData = {
  rule_summary: {
    grade_level: string;
    metric: string;
    operator: string;
    threshold: number;
    quantifier: string;
    k: number | null;
    absent_policy: string;
  };
  exam_count: number;
  matched_count: number;
  students: StudentRecord[];
  pagination?: {
    page: number;
    page_size: number;
    total: number;
    num_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
};

export type Msg = { id: number; type: "success" | "danger" | "info"; text: string };

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

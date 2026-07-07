export interface AIClarificationOption {
  label: string;
  value: string;
  payload?: Record<string, unknown>;
}

export interface AIResultColumn {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
}

export interface AIResultTableData {
  title: string;
  columns: AIResultColumn[];
  rows: Array<Record<string, string | number | null>>;
}

export interface AIEvidence {
  collapsed_by_default: boolean;
  items: string[];
}

export interface AIFallback {
  available: boolean;
  reason: string;
}

export interface AIAction {
  type: "retry_agent" | "basic_query_retry" | "refine_query";
  label: string;
}

export interface AIClarificationReply {
  question_id: string;
  value: string;
  label?: string;
  payload?: Record<string, unknown>;
}

export interface ScoreAgentResponse {
  request_id: string;
  conversation_id?: string;
  type: "answer" | "clarification" | "error" | "empty" | "cancelled" | "unsupported" | "explanation";
  status: string;
  message?: string;
  summary?: string;
  question_id?: string;
  clarification_type?: string;
  options?: AIClarificationOption[];
  allow_free_text?: boolean;
  allow_cancel?: boolean;
  details?: {
    common_subjects?: string[];
    only_exam_a?: string[];
    only_exam_b?: string[];
  };
  context?: Record<string, unknown>;
  tables?: AIResultTableData[];
  evidence?: AIEvidence;
  actions?: AIAction[];
  fallback?: AIFallback;
}

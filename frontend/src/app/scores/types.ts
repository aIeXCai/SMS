export type Option = { value: string; label: string };

export type ScoreRow = {
  record_key: string;
  student_id: number;
  exam_id: number;
  student: {
    student_id: string;
    name: string;
    grade_level: string;
    grade_level_display: string;
  };
  class: {
    class_name: string | null;
  };
  exam: {
    id: number;
    name: string;
    academic_year: string;
    date: string;
  };
  scores: Record<string, number>;
};

export type ScoreListResponse = {
  count: number;
  num_pages: number;
  current_page: number;
  has_previous: boolean;
  has_next: boolean;
  previous_page: number | null;
  next_page: number | null;
  start_index: number;
  end_index: number;
  page_size: number;
  results: ScoreRow[];
  all_subjects: string[];
};

export type ScoreOptions = {
  exams: Option[];
  grade_levels: Option[];
  class_name_choices: Option[];
  subjects: Option[];
  all_subjects: string[];
  per_page_options: number[];
};

export type SelectAllKeysResponse = {
  success: boolean;
  count: number;
  record_keys: string[];
};

export type Filters = {
  student_id_filter: string;
  student_name_filter: string;
  exam_filter: string;
  grade_filter: string;
  class_filter: string;
  subject_filter: string;
};

export const EMPTY_FILTERS: Filters = {
  student_id_filter: "",
  student_name_filter: "",
  exam_filter: "",
  grade_filter: "",
  class_filter: "",
  subject_filter: "",
};

export type ResultModalState = {
  show: boolean;
  type: "success" | "error";
  title: string;
  subtitle: string;
  message: string;
};

export type ImportResult = {
  success: boolean;
  message: string;
  imported_count: number;
  failed_count: number;
  execution_time?: number;
  error_details?: Array<{
    row: number;
    student_id: string;
    student_name: string;
    errors: string[];
  }>;
};

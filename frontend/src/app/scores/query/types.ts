export type Option = { value: string; label: string };

export type ScoreRow = {
  record_key: string;
  student_id: number;
  exam_id: number;
  total_score: number;
  grade_rank: number | null;
  student: {
    student_id: string;
    name: string;
    grade_level_display: string;
  };
  class: {
    class_name: string | null;
  };
  exam: {
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
  has_previous?: boolean;
  has_next?: boolean;
  previous_page?: number | null;
  next_page?: number | null;
  start_index?: number;
  end_index?: number;
  page_size: number;
  results: ScoreRow[];
  all_subjects: string[];
};

export type ScoreOptions = {
  exams: Option[];
  academic_years: Option[];
  sort_by_options: Option[];
  grade_levels: Option[];
  class_name_choices: Option[];
  subjects: Option[];
};

export type Filters = {
  student_name_filter: string;
  academic_year_filter: string;
  exam_filter: string;
  grade_filter: string;
  class_filter: string;
  date_from_filter: string;
  date_to_filter: string;
  sort_by: string;
  subject_filters: string[];
};

export const EMPTY_FILTERS: Filters = {
  student_name_filter: "",
  academic_year_filter: "",
  exam_filter: "",
  grade_filter: "",
  class_filter: "",
  date_from_filter: "",
  date_to_filter: "",
  sort_by: "",
  subject_filters: [],
};

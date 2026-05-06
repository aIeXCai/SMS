// Types shared by grade analysis page and its sub-components

export type SubjectItem = {
  code: string;
  name: string;
  max_score: number;
};

export type ClassStatistic = {
  class_name: string;
  student_count: number;
  avg_total: number;
  max_total: number;
  min_total: number;
  excellent_rate: number;
  good_rate: number;
  pass_rate: number;
  subject_averages: number[];
};

export type ChartDataPayload = {
  class_names: string[];
  class_averages: number[];
  subject_names: string[];
  subject_averages: number[];
  subject_max_scores: number[];
  score_ranges: string[];
  score_distribution: number[];
  class_grade_distribution: Record<string, number[]>;
  difficulty_coefficients: number[];
  total_max_score: number;
  total_scores: number[];
};

export type AnalysisData = {
  selected_exam: {
    id: number;
    name: string;
    academic_year: string;
    grade_level: string;
    grade_level_display: string;
  };
  selected_grade: string;
  academic_year: string;
  total_students: number;
  total_classes: number;
  grade_avg_score: number;
  excellent_rate: number;
  class_statistics: ClassStatistic[];
  subjects: SubjectItem[];
  total_max_score: number;
  chart_data: ChartDataPayload;
};

export type SortState = {
  column: number;
  direction: "asc" | "desc";
};

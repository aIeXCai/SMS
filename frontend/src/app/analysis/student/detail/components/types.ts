// Types shared by student analysis detail page and its sub-components

export type SubjectScore = {
  subject_name: string;
  score_value: number;
  full_score: number;
  grade_rank: number | null;
  class_rank: number | null;
};

export type ExamData = {
  id: number;
  name: string;
  academic_year: string;
  exam_date: string | null;
  grade_level: string;
  scores: SubjectScore[];
  total_score: number;
  average_score: number;
  grade_total_rank: number | null;
  class_total_rank: number | null;
};

export type TrendItem = {
  class_ranks: Array<number | null>;
  grade_ranks: Array<number | null>;
  scores: Array<number | null>;
  exam_names: string[];
  exam_ids: number[];
};

export type AnalysisData = {
  student_info: {
    id: number;
    student_id: string;
    name: string;
    grade_level: string;
    class_name: string;
  };
  exams: ExamData[];
  subjects: string[];
  trend_data: Record<string, TrendItem>;
  summary: {
    total_exams: number;
    subjects_count: number;
  };
};

/** Extract school-year display text from exam data */
export function getExamDisplayText(exam: ExamData): string {
  let yearText = exam.academic_year;
  if (!yearText && exam.exam_date) {
    const yr = Number(exam.exam_date.substring(0, 4));
    const mo = Number(exam.exam_date.substring(5, 7));
    yearText = mo >= 9 ? `${yr}-${yr + 1}` : `${yr - 1}-${yr}`;
  }
  return exam.name;
}

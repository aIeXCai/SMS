export type Option = { value: string; label: string };

export type StudentItem = {
  id: number;
  student_id: string;
  name: string;
  grade_level: string;
  grade_level_display: string;
  class_name: string;
  display: string;
};

export type ScoreOptions = {
  exams: Option[];
  subjects: Option[];
};

export type DuplicateInfo = {
  duplicate_subjects: string[];
  student_id: number;
  exam_id: number;
};

export type ResultModalState = {
  show: boolean;
  type: "success" | "error";
  title: string;
  subtitle: string;
  message: string;
};

export const INITIAL_RESULT_MODAL: ResultModalState = {
  show: false,
  type: "success",
  title: "操作结果",
  subtitle: "",
  message: "",
};

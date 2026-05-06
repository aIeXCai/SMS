export type SubjectOption = { value: string; label: string };

export type EditDetail = {
  student: {
    id: number;
    name: string;
    student_id: string;
    grade_level: string;
    grade_level_display: string;
    class_name: string;
  };
  exam: {
    id: number;
    name: string;
    academic_year: string;
    date: string;
  };
  subjects: SubjectOption[];
  existing_scores: Record<string, number>;
  subject_max_scores: Record<string, number>;
};

export type ResultModalState = {
  show: boolean;
  type: "success" | "error";
  title: string;
  subtitle: string;
  message: string;
};

export const EMPTY_RESULT_MODAL: ResultModalState = {
  show: false,
  type: "success",
  title: "操作结果",
  subtitle: "",
  message: "",
};

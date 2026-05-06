export type Student = {
  id: number;
  student_id: string;
  name: string;
  gender: string | null;
  current_class: {
    id: number;
    grade_level: string;
    cohort: string;
    class_name: string;
  } | null;
  status: string;
  graduation_date?: string;
  id_card_number?: string;
  student_enrollment_number?: string;
  home_address?: string;
  guardian_name?: string;
  guardian_contact_phone?: string;
};

export type Stats = {
  total_students: number;
  active_students: number;
  graduated_students: number;
  suspended_students: number;
  status_choices: string[];
  grade_level_choices: string[];
  cohort_choices: string[];
  class_name_choices: string[];
};

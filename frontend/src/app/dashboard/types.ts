export type DashboardStats = {
  student_count: number;
  class_count: number;
  exam_count: number;
  score_count: number;
  coverage?: {
    scope?: string;
    label?: string;
    grade_level?: string;
    class_names?: string[];
  };
};

export type Exam = {
  id: number;
  name: string;
  academic_year: string | null;
  grade_level: string;
  date: string;
  description: string | null;
};

export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string | null;
  color: string;
  extendedProps?: {
    type?: string;
    grade?: string;
    location?: string;
    visibility?: string;
  };
};

export type TaskItem = {
  title: string;
  detail: string;
  href: string;
  cta: string;
  tone: "teal" | "amber" | "blue";
};

export const EMPTY_STATS: DashboardStats = {
  student_count: 0,
  class_count: 0,
  exam_count: 0,
  score_count: 0,
};

export const QUICK_ACTIONS = [
  { href: "/scores", label: "录入成绩", hint: "进入单条或批量录入" },
  { href: "/exams/create", label: "新建考试", hint: "建立本次考试框架" },
  { href: "/scores/query", label: "成绩查询", hint: "按学生或考试查询" },
  { href: "/analysis/class-grade", label: "分析预警", hint: "查看班级与年级趋势" },
];

import type { DashboardStats, Exam, CalendarEvent, TaskItem } from "./types";

export function formatDate(value: string) {
  return new Date(value).toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getExamStatus(date: string) {
  const examDate = new Date(date);
  const today = new Date();
  const diffDays = Math.ceil((examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays > 2) {
    return { label: "待开始", tone: "blue" as const, action: "查看考试" };
  }
  if (diffDays >= -7) {
    return { label: "近期考试", tone: "amber" as const, action: "继续跟进" };
  }
  return { label: "已归档", tone: "teal" as const, action: "查看结果" };
}

export function buildTasks(stats: DashboardStats, exams: Exam[], events: CalendarEvent[]): TaskItem[] {
  const items: TaskItem[] = [];
  const firstExam = exams[0];
  const firstEvent = events[0];

  if (firstExam) {
    items.push({
      title: "最近考试需要跟进",
      detail: `${firstExam.name} · ${firstExam.grade_level} · ${formatDate(firstExam.date)}`,
      href: "/exams",
      cta: "进入考试",
      tone: "teal",
    });
  }

  items.push({
    title: stats.score_count > 0 ? "成绩工作台已积累数据" : "系统还缺少成绩数据",
    detail:
      stats.score_count > 0
        ? `当前已有 ${stats.score_count.toLocaleString()} 条成绩记录，可继续录入或查询。`
        : "现在最值得做的事，是先完成第一批成绩录入。",
    href: stats.score_count > 0 ? "/scores/query" : "/scores/add",
    cta: stats.score_count > 0 ? "查看成绩" : "开始录入",
    tone: "amber",
  });

  if (firstEvent) {
    items.push({
      title: "近期校历需要确认",
      detail: `${firstEvent.title} · ${formatDateTime(firstEvent.start)}`,
      href: "/exams",
      cta: "查看安排",
      tone: "blue",
    });
  } else {
    items.push({
      title: "本月考试安排待核对",
      detail: `本月共有 ${stats.exam_count} 场考试记录，建议检查考试配置与录入节奏。`,
      href: "/exams",
      cta: "核对考试",
      tone: "blue",
    });
  }

  return items.slice(0, 3);
}

export function buildLatestExamAnalysisHref(exam?: Exam, userRole?: string) {
  // 科任教师 + 级长：跳转到分析选择页，由下拉框限制其可见范围
  if (userRole === "subject_teacher" || userRole === "grade_manager") {
    return "/analysis/class-grade";
  }
  // 其他角色：有考试则直接进结果页，无考试则到选择页
  if (!exam) {
    return "/analysis/class-grade";
  }
  const params = new URLSearchParams();
  if (exam.academic_year) {
    params.set("academic_year", exam.academic_year);
  }
  params.set("exam", String(exam.id));
  params.set("grade_level", exam.grade_level);
  return `/analysis/class-grade/grade?${params.toString()}`;
}

export function getLatestArchivedExam(exams: Exam[]) {
  const now = Date.now();
  const archived = exams.filter((exam) => {
    const examTime = new Date(exam.date).getTime();
    return !Number.isNaN(examTime) && examTime < now;
  });

  if (archived.length === 0) {
    return undefined;
  }

  return [...archived].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
}

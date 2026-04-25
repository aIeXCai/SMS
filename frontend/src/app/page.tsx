"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

type DashboardStats = {
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

type Exam = {
  id: number;
  name: string;
  academic_year: string | null;
  grade_level: string;
  date: string;
  description: string | null;
};

type CalendarEvent = {
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

type TaskItem = {
  title: string;
  detail: string;
  href: string;
  cta: string;
  tone: "teal" | "amber" | "blue";
};

const EMPTY_STATS: DashboardStats = {
  student_count: 0,
  class_count: 0,
  exam_count: 0,
  score_count: 0,
};

const QUICK_ACTIONS = [
  { href: "/scores", label: "录入成绩", hint: "进入单条或批量录入" },
  { href: "/exams/create", label: "新建考试", hint: "建立本次考试框架" },
  { href: "/scores/query", label: "成绩查询", hint: "按学生或考试查询" },
  { href: "/analysis/class-grade", label: "分析预警", hint: "查看班级与年级趋势" },
];

function getBackendBaseUrl() {
  if (typeof window === "undefined") {
    return "http://localhost:8000";
  }
  return `http://${window.location.hostname}:8000`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getExamStatus(date: string) {
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

function buildTasks(stats: DashboardStats, exams: Exam[], events: CalendarEvent[]): TaskItem[] {
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

function buildLatestExamAnalysisHref(exam?: Exam) {
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

function getLatestArchivedExam(exams: Exam[]) {
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

export default function DashboardPage() {
  const { user, loading, token } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [recentExams, setRecentExams] = useState<Exam[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
  const [isPageReady, setIsPageReady] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user || !token) {
      return;
    }

    const backendBaseUrl = getBackendBaseUrl();

    const fetchDashboardData = async () => {
      try {
        const [statsResponse, examsResponse, eventsResponse] = await Promise.all([
          fetch(`${backendBaseUrl}/api/dashboard/stats/?token=${encodeURIComponent(token)}`),
          fetch(`${backendBaseUrl}/api/exams/?page=1&page_size=4`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch(`${backendBaseUrl}/api/dashboard/events/?token=${encodeURIComponent(token)}`),
        ]);

        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setStats({
            student_count: Number(statsData.student_count || 0),
            class_count: Number(statsData.class_count || 0),
            exam_count: Number(statsData.exam_count || 0),
            score_count: Number(statsData.score_count || 0),
            coverage: statsData.coverage || undefined,
          });
        }

        if (examsResponse.ok) {
          const examsData = await examsResponse.json();
          const exams = Array.isArray(examsData?.results) ? examsData.results : Array.isArray(examsData) ? examsData : [];
          setRecentExams(exams.slice(0, 4));
        }

        if (eventsResponse.ok) {
          const eventsData = await eventsResponse.json();
          const events = Array.isArray(eventsData?.events) ? eventsData.events : [];
          const upcoming = events
            .filter((event: CalendarEvent) => new Date(event.start).getTime() >= Date.now() - 24 * 60 * 60 * 1000)
            .sort((a: CalendarEvent, b: CalendarEvent) => new Date(a.start).getTime() - new Date(b.start).getTime())
            .slice(0, 3);
          setUpcomingEvents(upcoming);
        }
      } catch (error) {
        console.error("dashboard fetch failed", error);
      } finally {
        setIsPageReady(true);
      }
    };

    fetchDashboardData();
  }, [user, token]);

  if (loading || !user || !isPageReady) {
    return (
      <div className="home-loading">
        <div className="home-spinner" />
        <style jsx>{`
          .home-loading {
            min-height: calc(100vh - 60px);
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .home-spinner {
            width: 38px;
            height: 38px;
            border-radius: 999px;
            border: 3px solid rgba(9, 94, 76, 0.12);
            border-top-color: #0f766e;
            animation: spin 0.8s linear infinite;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  const displayName = user.name?.trim() || user.username;
  const tasks = buildTasks(stats, recentExams, upcomingEvents);
  const latestArchivedExam = getLatestArchivedExam(recentExams);
  const latestExamAnalysisHref = buildLatestExamAnalysisHref(latestArchivedExam);
  const teachingClassNames = user.teaching_classes?.map((item) => item.display_name) || [];
  const classCoverageText =
    teachingClassNames.length > 0
      ? teachingClassNames.slice(0, 4).join("、")
      : stats.coverage?.class_names?.slice(0, 4).join("、") || "暂未分配任教班级";

  const summaryText =
    user.role === "grade_manager" && user.managed_grade
      ? `你现在看到的是 ${user.managed_grade} 的工作面板。当前涉及 ${stats.class_count} 个班级、${stats.student_count} 名学生，最近的考试与分析都会优先围绕这个年级展开。`
      : user.role === "subject_teacher"
        ? `你现在看到的是自己的任教工作面板。当前关联 ${stats.class_count} 个班级、${stats.student_count} 名学生，首页优先展示你最可能马上要处理的成绩工作。`
        : `你现在看到的是全校工作台。当前有 ${stats.class_count} 个班级、${stats.student_count} 名学生，本月已有 ${stats.exam_count} 场考试进入系统。`;

  const coverageLabel =
    user.role === "grade_manager" && user.managed_grade
      ? `${user.managed_grade}级长视角`
      : user.role === "subject_teacher"
        ? "任教班级视角"
        : "全校视角";

  const coverageValue =
    user.role === "subject_teacher"
      ? classCoverageText
      : `${stats.student_count.toLocaleString()} 名学生 / ${stats.class_count.toLocaleString()} 个班级`;

  const roleTitle =
    user.role === "admin"
      ? "管理员"
      : user.role === "grade_manager"
        ? "级长"
        : user.role === "subject_teacher"
          ? "科任老师"
          : "教辅人员";

  return (
    <div className="workspace-home">
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="hero-kicker">工作台</span>
          <h1>今天先把最重要的事做完。</h1>
          <p>{summaryText}</p>
          <div className="hero-actions">
            <Link href="/scores" className="primary-action">
              录入成绩
            </Link>
            <Link href={latestExamAnalysisHref} className="secondary-action">
              查看最近考试
            </Link>
          </div>
        </div>
        <div className="hero-side">
          <div className="identity-card">
            <span className="identity-label">{roleTitle}</span>
            <strong>{displayName}</strong>
            <div className="identity-metric">
              <span className="identity-metric-label">{coverageLabel}</span>
              <span className="identity-metric-value">{coverageValue}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <span className="section-label">第一屏</span>
            <h2>今日待办</h2>
          </div>
          <p>首页不再告诉你系统有多大，只告诉你下一步该做什么。</p>
        </div>
        <div className="task-grid">
          {tasks.map((task) => (
            <article key={task.title} className={`task-card tone-${task.tone}`}>
              <div className="task-badge" />
              <h3>{task.title}</h3>
              <p>{task.detail}</p>
              <Link href={task.href}>{task.cta}</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="content-grid">
        <article className="panel">
          <div className="panel-header">
            <div>
              <span className="section-label">核心对象</span>
              <h2>最近考试</h2>
            </div>
            <Link href="/exams" className="text-link">
              查看全部
            </Link>
          </div>

          <div className="exam-list">
            {recentExams.length === 0 ? (
              <div className="empty-state">
                <h3>还没有考试数据</h3>
                <p>先建立考试，再让首页真正变成工作台。</p>
                <Link href="/exams/create">新建考试</Link>
              </div>
            ) : (
              recentExams.map((exam) => {
                const status = getExamStatus(exam.date);
                return (
                  <div key={exam.id} className="exam-row">
                    <div className="exam-main">
                      <div className="exam-topline">
                        <h3>{exam.name}</h3>
                        <span className={`pill pill-${status.tone}`}>{status.label}</span>
                      </div>
                      <p>
                        {exam.grade_level}
                        {exam.academic_year ? ` · ${exam.academic_year}` : ""}
                      </p>
                    </div>
                    <div className="exam-side">
                      <span>{formatDate(exam.date)}</span>
                      <Link href="/exams">{status.action}</Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <span className="section-label">近期节奏</span>
              <h2>系统提醒</h2>
            </div>
          </div>

          <div className="signal-stack">
            <div className="signal-card">
              <span className="signal-dot teal" />
              <div>
                <h3>成绩数据规模</h3>
                <p>当前系统内共有 {stats.score_count.toLocaleString()} 条成绩记录，可直接进入查询或分析。</p>
              </div>
            </div>

            <div className="signal-card">
              <span className="signal-dot amber" />
              <div>
                <h3>本月考试节奏</h3>
                <p>{stats.exam_count > 0 ? `本月已登记 ${stats.exam_count} 场考试，建议优先核对录入与发布时间。` : "本月还没有考试记录，建议先建立考试台账。"}</p>
              </div>
            </div>

            <div className="signal-card">
              <span className="signal-dot blue" />
              <div>
                <h3>近期校历</h3>
                <p>
                  {upcomingEvents.length > 0
                    ? `${upcomingEvents[0].title} 将在 ${formatDateTime(upcomingEvents[0].start)} 开始。`
                    : "目前没有读取到近期校历事件，可在后续扩展为更强的任务提醒。"}
                </p>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="content-grid lower-grid">
        <article className="panel">
          <div className="panel-header">
            <div>
              <span className="section-label">快捷入口</span>
              <h2>常用操作</h2>
            </div>
          </div>
          <div className="quick-grid">
            {QUICK_ACTIONS.map((action) => (
              <Link key={action.href} href={action.href} className="quick-card">
                <strong>{action.label}</strong>
                <span>{action.hint}</span>
              </Link>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <span className="section-label">系统状态</span>
              <h2>当前概况</h2>
            </div>
          </div>
          <div className="status-list">
            <div className="status-row">
              <span>学生档案</span>
              <strong>{stats.student_count.toLocaleString()} 人</strong>
            </div>
            <div className="status-row">
              <span>班级数量</span>
              <strong>{stats.class_count.toLocaleString()} 个</strong>
            </div>
            <div className="status-row">
              <span>最近校历事件</span>
              <strong>{upcomingEvents.length > 0 ? upcomingEvents.length : 0} 项</strong>
            </div>
          </div>
        </article>
      </section>

      <style jsx>{`
        .workspace-home {
          display: grid;
          gap: 24px;
          color: #172026;
        }

        .hero-panel {
          position: relative;
          display: grid;
          grid-template-columns: minmax(0, 2.1fr) minmax(280px, 0.9fr);
          gap: 20px;
          padding: 28px;
          border-radius: 28px;
          overflow: hidden;
          background:
            radial-gradient(circle at top right, rgba(92, 111, 255, 0.12), transparent 26%),
            radial-gradient(circle at bottom left, rgba(255, 255, 255, 0.72), transparent 30%),
            linear-gradient(145deg, #f7f8fb 0%, #eef1f6 52%, #e8edf3 100%);
          border: 1px solid rgba(112, 125, 149, 0.18);
          box-shadow: 0 24px 64px rgba(29, 38, 52, 0.08);
        }

        .hero-panel::after {
          content: "";
          position: absolute;
          inset: auto -80px -140px auto;
          width: 260px;
          height: 260px;
          border-radius: 999px;
          background: rgba(77, 92, 122, 0.08);
          filter: blur(6px);
        }

        .hero-copy,
        .hero-side,
        .panel,
        .task-card {
          position: relative;
          z-index: 1;
        }

        .hero-kicker,
        .section-label {
          display: inline-flex;
          align-items: center;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #58677d;
        }

        .hero-copy h1,
        .section-heading h2,
        .panel-header h2 {
          margin: 10px 0 0;
          font-size: 34px;
          line-height: 1.05;
          font-weight: 700;
          color: #141922;
        }

        .hero-copy p,
        .section-heading p {
          margin: 16px 0 0;
          max-width: 620px;
          font-size: 16px;
          line-height: 1.7;
          color: #5d6778;
        }

        .hero-side {
          display: grid;
          gap: 16px;
          align-content: space-between;
        }

        .identity-card,
        .task-card,
        .panel {
          background: rgba(255, 255, 255, 0.86);
          border: 1px solid rgba(255, 255, 255, 0.72);
          box-shadow: 0 18px 40px rgba(26, 33, 46, 0.06);
        }

        .identity-card {
          display: grid;
          gap: 6px;
          padding: 18px 20px;
          border-radius: 22px;
        }

        .identity-label {
          font-size: 12px;
          color: #7a8698;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .identity-card strong {
          font-size: 22px;
          color: #151b25;
        }

        .identity-card span:last-child {
          color: #5e6878;
        }

        .identity-metric {
          display: grid;
          gap: 4px;
          margin-top: 10px;
          padding-top: 12px;
          border-top: 1px solid rgba(106, 118, 138, 0.16);
        }

        .identity-metric-label {
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #7a8698;
        }

        .identity-metric-value {
          font-size: 14px;
          line-height: 1.6;
          color: #273142;
        }

        .hero-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 20px;
        }

        :global(a.primary-action),
        :global(a.secondary-action),
        .task-card a,
        .empty-state a,
        .text-link,
        .exam-side a {
          text-decoration: none;
          transition: all 0.2s ease;
        }

        :global(a.primary-action),
        :global(a.primary-action:link),
        :global(a.primary-action:visited),
        :global(a.primary-action:hover),
        :global(a.primary-action:active) {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          min-width: 124px;
          padding: 0 16px;
          border-radius: 12px;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.08), transparent),
            linear-gradient(135deg, #161b24 0%, #242c39 54%, #30384a 100%);
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: -0.01em;
          text-decoration: none !important;
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            0 10px 18px rgba(20, 27, 37, 0.14);
        }

        :global(a.secondary-action),
        :global(a.secondary-action:link),
        :global(a.secondary-action:visited),
        :global(a.secondary-action:hover),
        :global(a.secondary-action:active),
        .task-card a,
        .empty-state a,
        .exam-side a {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          min-width: 144px;
          padding: 0 16px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.72);
          color: #2f3a4b;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: -0.01em;
          text-decoration: none !important;
          border: 1px solid rgba(115, 128, 151, 0.18);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.52),
            0 8px 16px rgba(34, 44, 62, 0.05);
          backdrop-filter: blur(10px);
        }

        .section-block {
          display: grid;
          gap: 16px;
        }

        .section-heading,
        .panel-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 16px;
        }

        .section-heading h2,
        .panel-header h2 {
          font-size: 24px;
        }

        .section-heading p {
          margin: 0;
          max-width: 420px;
          font-size: 14px;
        }

        .task-grid,
        .content-grid,
        .quick-grid {
          display: grid;
          gap: 16px;
        }

        .task-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .task-card {
          display: grid;
          gap: 14px;
          padding: 22px;
          border-radius: 24px;
        }

        .task-badge {
          width: 42px;
          height: 6px;
          border-radius: 999px;
          background: #0f766e;
        }

        .task-card h3,
        .panel h3 {
          margin: 0;
          font-size: 19px;
          color: #12241f;
        }

        .task-card p,
        .signal-card p,
        .empty-state p,
        .exam-main p {
          margin: 0;
          color: #536863;
          line-height: 1.65;
        }

        .tone-teal .task-badge {
          background: #0f766e;
        }

        .tone-amber .task-badge {
          background: #c97b18;
        }

        .tone-blue .task-badge {
          background: #2563eb;
        }

        .content-grid {
          grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.95fr);
        }

        .lower-grid {
          grid-template-columns: minmax(0, 1.15fr) minmax(280px, 0.85fr);
        }

        .panel {
          display: grid;
          gap: 18px;
          padding: 24px;
          border-radius: 24px;
        }

        .text-link {
          color: #0f766e;
          font-weight: 600;
        }

        .exam-list,
        .signal-stack,
        .status-list {
          display: grid;
          gap: 12px;
        }

        .exam-row,
        .signal-card,
        .status-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 16px 18px;
          border-radius: 18px;
          background: #f7faf9;
          border: 1px solid #e4efeb;
        }

        .exam-main,
        .signal-card > div {
          min-width: 0;
        }

        .exam-topline {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 6px;
        }

        .pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 28px;
          padding: 0 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
        }

        .pill-blue {
          background: #e8f1ff;
          color: #1d4ed8;
        }

        .pill-amber {
          background: #fff3df;
          color: #b45309;
        }

        .pill-teal {
          background: #e8f7f4;
          color: #0f766e;
        }

        .exam-side {
          display: grid;
          justify-items: end;
          gap: 10px;
          font-size: 14px;
          color: #546963;
          white-space: nowrap;
        }

        .empty-state {
          display: grid;
          gap: 12px;
          padding: 18px;
          border-radius: 18px;
          background: #f7faf9;
          border: 1px dashed #c7ddd7;
        }

        .signal-card {
          align-items: flex-start;
          justify-content: flex-start;
        }

        .signal-dot {
          width: 11px;
          height: 11px;
          margin-top: 7px;
          border-radius: 999px;
          flex-shrink: 0;
        }

        .signal-dot.teal {
          background: #0f766e;
        }

        .signal-dot.amber {
          background: #c97b18;
        }

        .signal-dot.blue {
          background: #2563eb;
        }

        .quick-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .quick-card {
          display: grid;
          gap: 8px;
          padding: 18px;
          border-radius: 18px;
          text-decoration: none;
          color: #12241f;
          background: linear-gradient(180deg, #ffffff 0%, #f7faf9 100%);
          border: 1px solid #e4efeb;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .quick-card span {
          color: #586d67;
          font-size: 14px;
          line-height: 1.6;
        }

        .status-row {
          padding-block: 18px;
        }

        .status-row span {
          color: #536863;
        }

        .status-row strong {
          color: #12241f;
        }

        .primary-action:hover,
        .secondary-action:hover,
        .task-card a:hover,
        .empty-state a:hover,
        .text-link:hover,
        .exam-side a:hover,
        .quick-card:hover {
          transform: translateY(-1px);
        }

        :global(a.primary-action:hover) {
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.1),
            0 12px 22px rgba(20, 27, 37, 0.18);
        }

        :global(a.secondary-action:hover) {
          background: rgba(255, 255, 255, 0.84);
          border-color: rgba(91, 104, 127, 0.22);
        }

        .quick-card:hover {
          box-shadow: 0 12px 24px rgba(18, 48, 43, 0.08);
        }

        @media (max-width: 1100px) {
          .task-grid,
          .content-grid,
          .lower-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 768px) {
          .workspace-home {
            gap: 18px;
          }

          .hero-panel,
          .panel,
          .task-card {
            padding: 18px;
            border-radius: 20px;
          }

          .hero-panel {
            grid-template-columns: 1fr;
          }

          .hero-copy h1 {
            font-size: 28px;
          }

          .section-heading,
          .panel-header,
          .exam-row,
          .status-row {
            align-items: flex-start;
            flex-direction: column;
          }

          .quick-grid {
            grid-template-columns: 1fr;
          }

          .exam-side {
            justify-items: start;
            white-space: normal;
          }
        }
      `}</style>
    </div>
  );
}

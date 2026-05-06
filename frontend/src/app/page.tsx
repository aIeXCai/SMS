"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import type { DashboardStats, Exam, CalendarEvent } from "./dashboard/types";
import { EMPTY_STATS } from "./dashboard/types";
import {
  buildTasks,
  buildLatestExamAnalysisHref,
  getLatestArchivedExam,
} from "./dashboard/utils";
import LoadingSpinner from "./dashboard/components/LoadingSpinner";
import HeroPanel from "./dashboard/components/HeroPanel";
import RecentExams from "./dashboard/components/RecentExams";
import SystemSignals from "./dashboard/components/SystemSignals";
import QuickActions from "./dashboard/components/QuickActions";
import SystemStatus from "./dashboard/components/SystemStatus";
import TaskGrid from "./dashboard/components/TaskGrid";

export default function DashboardPage() {
  const { user, loading } = useAuth();
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
    if (!user) {
      return;
    }

    const fetchDashboardData = async () => {
      try {
        const [statsData, examsData, eventsData] = await Promise.all([
          api.get<DashboardStats>('/dashboard/stats/').catch(() => null),
          api.get<{ results?: Exam[] } | Exam[]>('/exams/', { page: '1', page_size: '4' }).catch(() => null),
          api.get<{ events?: CalendarEvent[] }>('/dashboard/events/').catch(() => null),
        ]);

        if (statsData) {
          setStats({
            student_count: Number(statsData.student_count || 0),
            class_count: Number(statsData.class_count || 0),
            exam_count: Number(statsData.exam_count || 0),
            score_count: Number(statsData.score_count || 0),
            coverage: statsData.coverage || undefined,
          });
        }

        if (examsData) {
          const exams = Array.isArray((examsData as { results?: Exam[] }).results)
            ? (examsData as { results?: Exam[] }).results!
            : Array.isArray(examsData)
              ? (examsData as Exam[])
              : [];
          setRecentExams(exams.slice(0, 4));
        }

        if (eventsData) {
          const events = Array.isArray((eventsData as { events?: CalendarEvent[] }).events)
            ? (eventsData as { events?: CalendarEvent[] }).events!
            : [];
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
  }, [user]);

  if (loading || !user || !isPageReady) {
    return <LoadingSpinner />;
  }

  const displayName = user.name?.trim() || user.username;
  const tasks = buildTasks(stats, recentExams, upcomingEvents);
  const latestArchivedExam = getLatestArchivedExam(recentExams);
  const latestExamAnalysisHref = buildLatestExamAnalysisHref(latestArchivedExam, user.role);
  const teachingClassNames = user.teaching_classes?.map((item) => item.display_name) || [];
  const classCoverageText =
    teachingClassNames.length > 0
      ? teachingClassNames.join("、")
      : stats.coverage?.class_names?.join("、") || "暂未分配任教班级";

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
      <HeroPanel
        displayName={displayName}
        roleTitle={roleTitle}
        summaryText={summaryText}
        coverageLabel={coverageLabel}
        coverageValue={coverageValue}
        latestExamAnalysisHref={latestExamAnalysisHref}
      />

      <TaskGrid tasks={tasks} />

      <section className="content-grid">
        <RecentExams exams={recentExams} />
        <SystemSignals stats={stats} events={upcomingEvents} />
      </section>

      <section className="content-grid lower-grid">
        <QuickActions />
        <SystemStatus stats={stats} events={upcomingEvents} />
      </section>

      <style jsx>{`
        .workspace-home {
          display: grid;
          gap: 24px;
          color: #172026;
        }

        .content-grid {
          display: grid;
          gap: 16px;
          grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.95fr);
        }

        .lower-grid {
          grid-template-columns: minmax(0, 1.15fr) minmax(280px, 0.85fr);
        }

        @media (max-width: 1100px) {
          .content-grid,
          .lower-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 768px) {
          .workspace-home {
            gap: 18px;
          }
        }
      `}</style>
    </div>
  );
}

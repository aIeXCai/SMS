"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

/* ─── Animated counter hook ─── */
function useAnimatedCounter(target: number, duration: number = 1500) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (target === 0) { setCount(0); return; }
    let startTime: number | null = null;
    let rafId: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(target * eased));
      if (progress < 1) rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [target, duration]);

  return count;
}

/* ─── Types ─── */
type DashboardStats = {
  student_count: number;
  class_count: number;
  exam_count: number;
  score_count: number;
};

const DEFAULT_STATS: DashboardStats = {
  student_count: 0,
  class_count: 0,
  exam_count: 0,
  score_count: 0,
};

const QUICK_ACTIONS = [
  {
    href: "/students",
    label: "学生管理",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    href: "/exams",
    label: "考试管理",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
  },
  {
    href: "/scores",
    label: "成绩录入",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9"/>
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
      </svg>
    ),
  },
  {
    href: "/scores/query",
    label: "成绩查询",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    ),
  },
];

const SYSTEM_STATUS = [
  { label: "服务运行正常", ok: true },
  { label: "数据库连接正常", ok: true },
  { label: "异步任务队列运行中", ok: true },
];

const STAT_CONFIG = [
  { key: "student_count" as const, label: "学生总数", icon: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
    </svg>
  ), accent: "#01876c", bg: "#e8f7f4" },
  { key: "class_count" as const, label: "班级数量", icon: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ), accent: "#0369a1", bg: "#e8f4fc" },
  { key: "exam_count" as const, label: "本月考试", icon: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  ), accent: "#b45309", bg: "#fef3e2" },
  { key: "score_count" as const, label: "成绩记录", icon: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ), accent: "#7c3aed", bg: "#f3effe" },
];

/* ─── Stat card ─── */
const StatCard = React.memo(function StatCard({
  icon, label, value, accent, bg, delay,
}: {
  icon: React.ReactNode; label: string; value: number;
  accent: string; bg: string; delay: number;
}) {
  const animatedValue = useAnimatedCounter(value, 1400);
  return (
    <div className="db-stat-card" style={{ animationDelay: `${delay}ms` }}>
      <div className="stat-icon-bg" style={{ background: bg, color: accent }}>
        {icon}
      </div>
      <div className="stat-info">
        <span className="stat-num" style={{ color: accent }}>{animatedValue.toLocaleString()}</span>
        <span className="stat-name">{label}</span>
      </div>
    </div>
  );
});

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [now, setNow] = useState(new Date());
  const [stats, setStats] = useState<DashboardStats>(DEFAULT_STATS);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (!loading && !user) router.replace("/login"); }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    const fetchDashboardStats = async () => {
      try {
        const token = localStorage.getItem("accessToken");
        const hostname = window.location.hostname;
        const url = token
          ? `http://${hostname}:8000/api/dashboard/stats/?token=${encodeURIComponent(token)}`
          : `http://${hostname}:8000/api/dashboard/stats/`;
        const response = await fetch(url);
        if (!response.ok) return;
        const data = await response.json();
        setStats({ student_count: Number(data.student_count || 0), class_count: Number(data.class_count || 0), exam_count: Number(data.exam_count || 0), score_count: Number(data.score_count || 0) });
      } catch { /* silent */ }
    };
    fetchDashboardStats();
    const poller = setInterval(fetchDashboardStats, 30000);
    return () => clearInterval(poller);
  }, [user]);

  const roleName = useMemo(() => {
    if (!user) return "";
    if (user.role === "admin") return "管理员";
    if (user.role === "grade_manager") return "级长";
    if (user.role === "subject_teacher") return "科任老师";
    return "教辅人员";
  }, [user]);

  const displayName = useMemo(() => {
    if (!user) return "";
    return `${user.last_name ?? ""}${user.first_name ?? ""}`.trim() || user.username;
  }, [user]);

  const dateText = now.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
  const timeText = now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const hour = now.getHours();
  const greeting = hour < 12 ? "上午好" : hour < 18 ? "下午好" : "晚上好";

  if (loading || !user) {
    return (
      <div className="db-loading">
        <div className="db-spinner" />
        <style>{`
          .db-loading { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f5f9f8; }
          .db-spinner { width: 36px; height: 36px; border: 2.5px solid #e0ece9; border-top-color: #01876c; border-radius: 50%; animation: spin 0.75s linear infinite; }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  return (
    <div className={`db-root ${mounted ? "in" : ""}`}>

      {/* ── Page header ── */}
      <div className="db-page-head">
        {/* Background decoration */}
        <div className="db-head-bg">
          <div className="db-head-orb db-head-orb-1" />
          <div className="db-head-orb db-head-orb-2" />
          <div className="db-head-grid" />
        </div>

        <div className="db-head-inner">
          <div className="db-head-left">
            <div className="db-head-greeting">{greeting}，{displayName}</div>
            <h1 className="db-page-title">数据概览</h1>
            <p className="db-page-date">{dateText}</p>
            <div className="db-head-tags">
              <span className="db-tag">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
                白云实验学校
              </span>
              <span className="db-tag">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                {roleName}
              </span>
            </div>
          </div>
          <div className="db-head-right">
            <div className="db-user-card">
              <div className="db-user-card-avatar">
                <i className="fas fa-user" />
                <div className="db-user-card-online" />
              </div>
              <div className="db-user-card-info">
                <span className="db-user-card-name">{displayName}</span>
                <span className="db-user-card-role">{roleName}</span>
              </div>
            </div>
            <div className="db-clock-card">
              <div className="db-clock-top">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span className="db-clock-label">当前时间</span>
              </div>
              <span className="db-clock-time">{timeText}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="db-stats-row">
        {STAT_CONFIG.map((s, i) => (
          <StatCard key={s.key} icon={s.icon} label={s.label} accent={s.accent} bg={s.bg} value={stats[s.key]} delay={60 + i * 80} />
        ))}
      </div>

      {/* ── Content ── */}
      <div className="db-content">

        {/* ── Left ── */}
        <div className="db-col-main">

          {/* Quick actions */}
          <div className="db-card" style={{ animationDelay: "440ms" }}>
            <div className="db-card-head">
              <div className="db-accent-bar teal" />
              <h2 className="db-card-title">快捷操作</h2>
            </div>
            <div className="db-quick-grid">
              {QUICK_ACTIONS.map((a, i) => (
                <Link key={a.href} href={a.href} className="db-quick-item" style={{ animationDelay: `${500 + i * 65}ms` }}>
                  <div className="db-quick-icon">{a.icon}</div>
                  <span className="db-quick-label">{a.label}</span>
                  <svg className="db-quick-arrow" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </Link>
              ))}
            </div>
          </div>

          {/* Announcement */}
          <div className="db-card" style={{ animationDelay: "530ms" }}>
            <div className="db-card-head">
              <div className="db-accent-bar blue" />
              <h2 className="db-card-title">系统公告</h2>
            </div>
            <div className="db-announce">
              <span className="db-badge">最新</span>
              <p className="db-announce-text">欢迎使用新版学校管理系统！系统已完成学生、考试、成绩三大模块前后端分离重构，数据结构更清晰，响应速度提升显著。</p>
              <div className="db-announce-meta">
                <span>📅 2026-04-10</span>
                <span>👤 系统管理员</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right ── */}
        <div className="db-col-side">

          {/* Profile */}
          <div className="db-card db-card-profile" style={{ animationDelay: "490ms" }}>
            <div className="db-profile">
              <div className="db-profile-avatar">
                <i className="fas fa-user" />
              </div>
              <div className="db-profile-info">
                <span className="db-profile-name">{displayName}</span>
                <span className="db-profile-role">{roleName}</span>
              </div>
              <div className="db-profile-online" />
            </div>
            <div className="db-profile-fields">
              <div className="db-field-row">
                <span className="db-field-label">账号</span>
                <span className="db-field-value">{user.username}</span>
              </div>
              <div className="db-field-row">
                <span className="db-field-label">管理范围</span>
                <span className="db-field-value">{user.managed_grade || "全校"}</span>
              </div>
            </div>
          </div>

          {/* System status */}
          <div className="db-card" style={{ animationDelay: "580ms" }}>
            <div className="db-card-head">
              <div className="db-accent-bar amber" />
              <h2 className="db-card-title">系统状态</h2>
              <div className="db-status-pill">
                <span className="db-pill-dot" />
                全部正常
              </div>
            </div>
            <div className="db-status-list">
              {SYSTEM_STATUS.map((item, i) => (
                <div key={item.label} className="db-status-row" style={{ animationDelay: `${630 + i * 70}ms` }}>
                  <div className="db-status-check">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <span className="db-status-label">{item.label}</span>
                  <span className="db-status-badge">在线</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500&display=swap');

        /* ── Variables ── */
        :root {
          --db-bg: #f0f5f3;
          --db-surface: #ffffff;
          --db-border: #e2e8e5;
          --db-border-hover: #c8d9d3;
          --db-accent: #01876c;
          --db-accent-light: #e8f7f4;
          --db-accent-mid: #b8ddd5;
          --db-text: #1a2820;
          --db-text-secondary: #5a6b63;
          --db-text-muted: #8fa398;
          --db-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
          --db-shadow-md: 0 4px 12px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.04);
          --db-radius: 16px;
          --db-radius-sm: 10px;
          --db-font: 'Outfit', 'Noto Sans SC', sans-serif;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }
        a { text-decoration: none; color: inherit; }

        /* ── Root ── */
        .db-root {
          background: var(--db-bg);
          color: var(--db-text);
          font-family: var(--db-font);
          padding: 28px 32px 48px;
          min-height: 100vh;
          opacity: 0;
          transform: translateY(10px);
          transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .db-root.in { opacity: 1; transform: translateY(0); }

        /* ── Page header ── */
        /* ── Page header ── */
        .db-page-head {
          position: relative;
          background: linear-gradient(135deg, #01876c 0%, #02a080 40%, #0369a1 100%);
          border-radius: 20px;
          margin-bottom: 28px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(1,135,108,0.25);
        }
        .db-head-bg {
          position: absolute; inset: 0; pointer-events: none;
        }
        .db-head-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(60px);
          opacity: 0.25;
        }
        .db-head-orb-1 {
          width: 300px; height: 300px;
          background: rgba(255,255,255,0.15);
          top: -100px; right: -50px;
        }
        .db-head-orb-2 {
          width: 200px; height: 200px;
          background: rgba(255,255,255,0.1);
          bottom: -80px; left: 30%;
        }
        .db-head-grid {
          position: absolute; inset: 0;
          background-image: linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);
          background-size: 40px 40px;
        }
        .db-head-inner {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 28px 36px;
        }
        .db-head-left { display: flex; flex-direction: column; gap: 4px; }
        .db-head-greeting {
          font-size: 1rem;
          color: rgba(255,255,255,0.8);
          font-weight: 500;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .db-page-title {
          font-family: var(--db-font);
          font-size: 2.4rem;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.02em;
          text-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        .db-page-date { font-size: 1rem; color: rgba(255,255,255,0.7); }
        .db-head-tags { display: flex; gap: 10px; margin-top: 10px; flex-wrap: wrap; }
        .db-tag {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 0.88rem;
          color: rgba(255,255,255,0.8);
          background: rgba(255,255,255,0.12);
          border: 1px solid rgba(255,255,255,0.18);
          padding: 3px 10px;
          border-radius: 20px;
          backdrop-filter: blur(4px);
        }
        .db-head-right { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
        .db-user-card {
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(255,255,255,0.12);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 14px;
          padding: 10px 18px;
          backdrop-filter: blur(8px);
        }
        .db-user-card-avatar {
          position: relative;
          width: 42px; height: 42px;
          border-radius: 11px;
          background: rgba(255,255,255,0.2);
          border: 1px solid rgba(255,255,255,0.3);
          display: flex; align-items: center; justify-content: center;
          color: #fff;
          font-size: 1rem;
          flex-shrink: 0;
        }
        .db-user-card-online {
          position: absolute;
          bottom: -2px; right: -2px;
          width: 10px; height: 10px;
          border-radius: 50%;
          background: #4ade80;
          border: 2px solid #01876c;
        }
        .db-user-card-info { display: flex; flex-direction: column; gap: 2px; }
        .db-user-card-name { font-family: var(--db-font); font-size: 1.1rem; font-weight: 700; color: #fff; }
        .db-user-card-role { font-size: 0.82rem; color: rgba(255,255,255,0.7); }
        .db-clock-card {
          background: rgba(255,255,255,0.12);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 14px;
          padding: 9px 18px;
          backdrop-filter: blur(8px);
          text-align: center;
        }
        .db-clock-top {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          color: rgba(255,255,255,0.6);
          margin-bottom: 3px;
        }
        .db-clock-label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; }
        .db-clock-time {
          display: block;
          font-family: var(--db-font);
          font-size: 1.4rem;
          font-weight: 700;
          color: #fff;
          letter-spacing: 0.05em;
          line-height: 1;
        }

        /* ── Stats ── */
        .db-stats-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }
        @media (max-width: 1100px) { .db-stats-row { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 600px)  { .db-stats-row { grid-template-columns: 1fr; } }

        .db-stat-card {
          background: var(--db-surface);
          border: 1px solid var(--db-border);
          border-radius: var(--db-radius);
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          box-shadow: var(--db-shadow);
          opacity: 0;
          transform: translateY(14px);
          animation: db-rise 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          transition: box-shadow 0.22s ease, transform 0.22s ease, border-color 0.22s ease;
        }
        .db-stat-card:hover { box-shadow: var(--db-shadow-md); transform: translateY(-2px); border-color: var(--db-border-hover); }
        @keyframes db-rise { to { opacity: 1; transform: translateY(0); } }

        .stat-icon-bg {
          width: 50px; height: 50px;
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          transition: transform 0.3s ease;
        }
        .db-stat-card:hover .stat-icon-bg { transform: scale(1.06); }
        .stat-info { display: flex; flex-direction: column; gap: 3px; }
        .stat-num {
          font-family: var(--db-font);
          font-size: 2.2rem;
          font-weight: 700;
          line-height: 1;
          letter-spacing: -0.03em;
        }
        .stat-name { font-size: 0.9rem; color: var(--db-text-muted); font-weight: 500; letter-spacing: 0.03em; }

        /* ── Content grid ── */
        .db-content {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 22px;
        }
        @media (max-width: 1024px) { .db-content { grid-template-columns: 1fr; } }
        .db-col-main, .db-col-side { display: flex; flex-direction: column; gap: 22px; }

        /* ── Card ── */
        .db-card {
          background: var(--db-surface);
          border: 1px solid var(--db-border);
          border-radius: var(--db-radius);
          padding: 24px;
          box-shadow: var(--db-shadow);
          opacity: 0;
          transform: translateY(14px);
          animation: db-rise 0.55s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          transition: box-shadow 0.22s ease, border-color 0.22s ease;
        }
        .db-card:hover { box-shadow: var(--db-shadow-md); border-color: var(--db-border-hover); }

        .db-card-head {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 18px;
        }
        .db-accent-bar { width: 3px; height: 18px; border-radius: 3px; flex-shrink: 0; }
        .db-accent-bar.teal  { background: linear-gradient(180deg, #01876c, #02a888); }
        .db-accent-bar.blue  { background: linear-gradient(180deg, #0369a1, #0284c7); }
        .db-accent-bar.amber { background: linear-gradient(180deg, #b45309, #d97706); }
        .db-card-title { font-family: var(--db-font); font-size: 1.1rem; font-weight: 700; color: var(--db-text); margin: 0; }

        /* ── Status pill ── */
        .db-status-pill {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 0.72rem;
          color: var(--db-accent);
          font-weight: 600;
          background: var(--db-accent-light);
          padding: 3px 10px;
          border-radius: 20px;
          border: 1px solid var(--db-accent-mid);
        }
        .db-pill-dot {
          width: 5px; height: 5px;
          border-radius: 50%;
          background: var(--db-accent);
          animation: db-pulse 2.5s ease-in-out infinite;
        }
        @keyframes db-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

        /* ── Quick actions ── */
        .db-quick-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
        @media (max-width: 600px) { .db-quick-grid { grid-template-columns: 1fr; } }

        .db-quick-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 13px 14px;
          background: var(--db-bg);
          border: 1px solid var(--db-border);
          border-radius: var(--db-radius-sm);
          opacity: 0;
          transform: translateX(-8px);
          animation: db-slide 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          transition: all 0.2s ease;
        }
        .db-quick-item:hover {
          background: var(--db-accent-light);
          border-color: var(--db-accent-mid);
          transform: translateX(2px);
        }
        .db-quick-item:hover .db-quick-arrow { color: var(--db-accent); transform: translateX(3px); }
        @keyframes db-slide { to { opacity: 1; transform: translateX(0); } }
        .db-quick-icon {
          width: 38px; height: 38px;
          border-radius: 9px;
          background: var(--db-surface);
          border: 1px solid var(--db-border);
          display: flex; align-items: center; justify-content: center;
          color: var(--db-accent);
          flex-shrink: 0;
          transition: background 0.2s, border-color 0.2s;
        }
        .db-quick-item:hover .db-quick-icon { background: var(--db-accent-light); border-color: var(--db-accent-mid); }
        .db-quick-label { flex: 1; font-size: 1rem; font-weight: 500; color: var(--db-text); }
        .db-quick-arrow { color: var(--db-text-muted); transition: all 0.2s ease; }

        /* ── Announcement ── */
        .db-announce {
          background: linear-gradient(135deg, #f0f7ff 0%, #f8faff 100%);
          border: 1px solid #ddeeff;
          border-radius: var(--db-radius-sm);
          padding: 18px;
        }
        .db-badge {
          display: inline-flex;
          align-items: center;
          background: linear-gradient(135deg, #0369a1, #0284c7);
          color: #fff;
          font-size: 0.66rem;
          font-weight: 700;
          padding: 3px 10px;
          border-radius: 20px;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          margin-bottom: 10px;
        }
        .db-announce-text { font-size: 0.97rem; color: var(--db-text-secondary); line-height: 1.75; margin: 0 0 14px; }
        .db-announce-meta { display: flex; gap: 16px; font-size: 0.82rem; color: var(--db-text-muted); }

        /* ── Profile ── */
        .db-card-profile {
          background: linear-gradient(145deg, var(--db-accent-light) 0%, var(--db-surface) 50%);
          border-color: var(--db-accent-mid);
        }
        .db-profile {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 18px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--db-border);
        }
        .db-profile-avatar {
          width: 46px; height: 46px;
          border-radius: 12px;
          background: var(--db-accent);
          display: flex; align-items: center; justify-content: center;
          color: #fff;
          font-size: 1.1rem;
          flex-shrink: 0;
          box-shadow: 0 3px 10px rgba(1,135,108,0.35);
        }
        .db-profile-info { display: flex; flex-direction: column; gap: 2px; flex: 1; }
        .db-profile-name { font-family: var(--db-font); font-size: 1.2rem; font-weight: 700; color: var(--db-text); }
        .db-profile-role { font-size: 0.88rem; color: var(--db-accent); font-weight: 500; }
        .db-profile-online {
          width: 9px; height: 9px;
          border-radius: 50%;
          background: var(--db-accent);
          box-shadow: 0 0 0 3px rgba(1,135,108,0.12);
          animation: db-pulse 2.5s ease-in-out infinite;
          flex-shrink: 0;
        }
        .db-profile-fields { display: flex; flex-direction: column; gap: 8px; }
        .db-field-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 9px 12px;
          background: rgba(255,255,255,0.7);
          border: 1px solid var(--db-border);
          border-radius: var(--db-radius-sm);
        }
        .db-field-label { font-size: 0.88rem; color: var(--db-text-muted); }
        .db-field-value { font-size: 0.96rem; font-weight: 500; color: var(--db-text); }

        /* ── Status ── */
        .db-status-list { display: flex; flex-direction: column; gap: 7px; }
        .db-status-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          background: var(--db-bg);
          border: 1px solid var(--db-border);
          border-radius: var(--db-radius-sm);
          opacity: 0;
          transform: translateX(-6px);
          animation: db-slide 0.35s ease forwards;
          transition: background 0.2s, border-color 0.2s;
        }
        .db-status-row:hover { background: var(--db-accent-light); border-color: var(--db-accent-mid); }
        .db-status-check {
          width: 24px; height: 24px;
          border-radius: 7px;
          background: var(--db-accent-light);
          border: 1px solid var(--db-accent-mid);
          display: flex; align-items: center; justify-content: center;
          color: var(--db-accent);
          flex-shrink: 0;
        }
        .db-status-label { flex: 1; font-size: 0.95rem; color: var(--db-text-secondary); }
        .db-status-badge {
          font-size: 0.7rem;
          font-weight: 600;
          color: var(--db-accent);
          background: var(--db-accent-light);
          padding: 2px 9px;
          border-radius: 20px;
        }

        /* ── Responsive ── */
        @media (max-width: 768px) {
          .db-root { padding: 16px 16px 40px; }
          .db-head-inner { flex-direction: column; gap: 16px; align-items: flex-start; }
          .db-head-right { width: 100%; justify-content: space-between; }
          .db-page-head { border-radius: 16px; }
        }
        @media (max-width: 480px) {
          .db-user-card { display: none; }
        }
      `}</style>
    </div>
  );
}

"use client";

import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [now, setNow] = useState(new Date());
  const [stats, setStats] = useState<DashboardStats>(DEFAULT_STATS);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;

    const fetchDashboardStats = async () => {
      try {
        const token = localStorage.getItem("accessToken");
        const hostname = window.location.hostname;
        const backendBaseUrl = `http://${hostname}:8000`;
        const url = token
          ? `${backendBaseUrl}/api/dashboard/stats/?token=${encodeURIComponent(token)}`
          : `${backendBaseUrl}/api/dashboard/stats/`;

        const response = await fetch(url);
        if (!response.ok) return;

        const data = await response.json();
        setStats({
          student_count: Number(data.student_count || 0),
          class_count: Number(data.class_count || 0),
          exam_count: Number(data.exam_count || 0),
          score_count: Number(data.score_count || 0),
        });
      } catch {
      }
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

  if (loading || !user) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "70vh", color: "#666" }}>
        加载中...
      </div>
    );
  }

  const dateText = now.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
  const timeText = now.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div style={{ background: "#f8f9fa", minHeight: "calc(100vh - 2rem)" }}>
      <div style={{ background: "#fff", padding: 20, borderRadius: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.05)", marginBottom: 25, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h4 style={{ margin: 0, fontWeight: 700, color: "#222" }}>系统首页</h4>
          <p style={{ margin: "8px 0 0", color: "#666" }}>今天是 {dateText}，祝您工作愉快！</p>
        </div>
        <div style={{ background: "#f3f4f6", borderRadius: 999, padding: "8px 14px", color: "#111", fontWeight: 700 }}>
          {timeText}
        </div>
      </div>

      <div className="dashboard-grid" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <div>
          <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16, marginBottom: 16 }}>
            {[
              { label: "学生总数", value: stats.student_count, icon: "👨‍🎓", bg: "#e8f5f3", color: "#01876c" },
              { label: "班级数量", value: stats.class_count, icon: "🏫", bg: "#e3f2fd", color: "#1976d2" },
              { label: "本月考试", value: stats.exam_count, icon: "📝", bg: "#fff3e0", color: "#f57c00" },
              { label: "成绩记录", value: stats.score_count, icon: "📊", bg: "#f3e5f5", color: "#7b1fa2" },
            ].map((item) => (
              <div key={item.label} style={{ background: "#fff", borderRadius: 12, padding: 20, textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
                <div style={{ width: 56, height: 56, margin: "0 auto 12px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: item.bg, color: item.color, fontSize: 24 }}>
                  {item.icon}
                </div>
                <div style={{ fontSize: 32, fontWeight: 700, color: "#333", lineHeight: 1 }}>{item.value}</div>
                <div style={{ marginTop: 8, color: "#666" }}>{item.label}</div>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 16 }}>
            <h5 style={{ borderLeft: "4px solid #01876c", paddingLeft: 10, marginBottom: 12 }}>快捷操作</h5>
            <div className="quick-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
              {[
                { href: "/students", icon: "👥", label: "学生管理" },
                { href: "/exams", icon: "📋", label: "考试管理" },
                { href: "/scores", icon: "✏️", label: "成绩录入" },
                { href: "/scores/query", icon: "🔎", label: "成绩查询" },
              ].map((action) => (
                <Link key={action.href} href={action.href} style={{ border: "1px solid #e0e0e0", background: "#fff", borderRadius: 12, textAlign: "center", padding: "18px 12px", textDecoration: "none", color: "#555" }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{action.icon}</div>
                  <div>{action.label}</div>
                </Link>
              ))}
            </div>
          </div>

          <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.05)", padding: 20 }}>
            <h5 style={{ marginTop: 0 }}>系统公告</h5>
            <div style={{ background: "#e3f2fd", color: "#0f172a", borderRadius: 10, padding: 12 }}>
              欢迎使用新版学校管理系统！系统已完成学生、考试、成绩三大模块前后端分离。
            </div>
          </div>
        </div>

        <div>
          <div style={{ background: "linear-gradient(135deg, #01876c 0%, #00695c 100%)", color: "#fff", borderRadius: 12, padding: 20, marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
              <div style={{ width: 50, height: 50, borderRadius: "50%", background: "rgba(255,255,255,0.9)", color: "#00695c", display: "flex", alignItems: "center", justifyContent: "center", marginRight: 12, fontSize: 22 }}>
                👤
              </div>
              <div>
                <div style={{ fontWeight: 700 }}>{user.first_name || user.username}</div>
                <small style={{ opacity: 0.9 }}>{roleName}</small>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 8, padding: 8 }}>
                <small style={{ opacity: 0.8 }}>账号</small>
                <div style={{ fontWeight: 700 }}>{user.username}</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 8, padding: 8 }}>
                <small style={{ opacity: 0.8 }}>负责范围</small>
                <div style={{ fontWeight: 700 }}>{user.managed_grade || "全校"}</div>
              </div>
            </div>
          </div>

          <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.05)", padding: 20 }}>
            <h5 style={{ marginTop: 0 }}>系统状态</h5>
            {[
              "服务运行正常",
              "数据库连接正常",
              "异步任务队列运行中",
            ].map((status) => (
              <div key={status} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, color: "#333" }}>
                <span>{status}</span>
                <span style={{ color: "#16a34a" }}>●</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 1200px) {
          .dashboard-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 900px) {
          .stats-grid,
          .quick-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
      `}</style>
    </div>
  );
}

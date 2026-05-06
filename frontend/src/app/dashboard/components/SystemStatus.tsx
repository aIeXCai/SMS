"use client";

import type { DashboardStats, CalendarEvent } from "../types";

type Props = {
  stats: DashboardStats;
  events: CalendarEvent[];
};

export default function SystemStatus({ stats, events }: Props) {
  return (
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
          <strong>{events.length > 0 ? events.length : 0} 项</strong>
        </div>
      </div>

      <style jsx>{`
        .panel {
          position: relative;
          z-index: 1;
          display: grid;
          gap: 18px;
          padding: 24px;
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.86);
          border: 1px solid rgba(255, 255, 255, 0.72);
          box-shadow: 0 18px 40px rgba(26, 33, 46, 0.06);
        }

        .panel-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 16px;
        }

        .panel-header h2 {
          margin: 10px 0 0;
          font-size: 24px;
          line-height: 1.05;
          font-weight: 700;
          color: #141922;
        }

        .section-label {
          display: inline-flex;
          align-items: center;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #58677d;
        }

        .status-list {
          display: grid;
          gap: 12px;
        }

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

        .status-row span {
          color: #536863;
        }

        .status-row strong {
          color: #12241f;
        }

        @media (max-width: 768px) {
          .panel {
            padding: 18px;
            border-radius: 20px;
          }

          .panel-header,
          .status-row {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>
    </article>
  );
}

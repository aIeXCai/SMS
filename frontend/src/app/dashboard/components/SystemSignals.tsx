"use client";

import type { DashboardStats, CalendarEvent } from "../types";
import { formatDateTime } from "../utils";

type Props = {
  stats: DashboardStats;
  events: CalendarEvent[];
};

export default function SystemSignals({ stats, events }: Props) {
  return (
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
            <p>
              {stats.exam_count > 0
                ? `本月已登记 ${stats.exam_count} 场考试，建议优先核对录入与发布时间。`
                : "本月还没有考试记录，建议先建立考试台账。"}
            </p>
          </div>
        </div>

        <div className="signal-card">
          <span className="signal-dot blue" />
          <div>
            <h3>近期校历</h3>
            <p>
              {events.length > 0
                ? `${events[0].title} 将在 ${formatDateTime(events[0].start)} 开始。`
                : "目前没有读取到近期校历事件，可在后续扩展为更强的任务提醒。"}
            </p>
          </div>
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

        .signal-stack {
          display: grid;
          gap: 12px;
        }

        .signal-card {
          display: flex;
          align-items: flex-start;
          justify-content: flex-start;
          gap: 16px;
          padding: 16px 18px;
          border-radius: 18px;
          background: #f7faf9;
          border: 1px solid #e4efeb;
        }

        .signal-card > div {
          min-width: 0;
        }

        .signal-card h3 {
          margin: 0;
          font-size: 19px;
          color: #12241f;
        }

        .signal-card p {
          margin: 0;
          color: #536863;
          line-height: 1.65;
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

        @media (max-width: 768px) {
          .panel {
            padding: 18px;
            border-radius: 20px;
          }

          .panel-header {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>
    </article>
  );
}

"use client";

import Link from "next/link";
import type { TaskItem } from "../types";

interface TaskGridProps {
  tasks: TaskItem[];
}

export default function TaskGrid({ tasks }: TaskGridProps) {
  return (
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
      <style jsx>{`
        .section-block {
          display: grid;
          gap: 16px;
        }

        .section-heading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 16px;
        }

        .section-heading h2 {
          margin: 10px 0 0;
          font-size: 24px;
          line-height: 1.05;
          font-weight: 700;
          color: #141922;
        }

        .section-heading p {
          margin: 0;
          max-width: 420px;
          font-size: 14px;
          line-height: 1.7;
          color: #5d6778;
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

        .task-grid {
          display: grid;
          gap: 16px;
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .task-card {
          position: relative;
          z-index: 1;
          display: grid;
          gap: 14px;
          padding: 22px;
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.86);
          border: 1px solid rgba(255, 255, 255, 0.72);
          box-shadow: 0 18px 40px rgba(26, 33, 46, 0.06);
        }

        .task-badge {
          width: 42px;
          height: 6px;
          border-radius: 999px;
          background: #0f766e;
        }

        .task-card h3 {
          margin: 0;
          font-size: 19px;
          color: #12241f;
        }

        .task-card p {
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

        .task-card :global(a) {
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
          text-decoration: none;
          transition: all 0.2s ease;
          border: 1px solid rgba(115, 128, 151, 0.18);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.52),
            0 8px 16px rgba(34, 44, 62, 0.05);
          backdrop-filter: blur(10px);
        }

        .task-card :global(a:hover) {
          transform: translateY(-1px);
          background: rgba(255, 255, 255, 0.84);
          border-color: rgba(91, 104, 127, 0.22);
        }

        @media (max-width: 1100px) {
          .task-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 768px) {
          .section-heading {
            align-items: flex-start;
            flex-direction: column;
          }

          .task-card {
            padding: 18px;
            border-radius: 20px;
          }
        }
      `}</style>
    </section>
  );
}

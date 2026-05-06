"use client";

import Link from "next/link";
import { QUICK_ACTIONS } from "../types";

export default function QuickActions() {
  return (
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

        .quick-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        :global(a.quick-card),
        :global(a.quick-card:link),
        :global(a.quick-card:visited),
        :global(a.quick-card:hover),
        :global(a.quick-card:active) {
          display: grid;
          gap: 8px;
          padding: 18px;
          border-radius: 18px;
          text-decoration: none !important;
          color: #12241f;
          background: linear-gradient(180deg, #ffffff 0%, #f7faf9 100%);
          border: 1px solid #e4efeb;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        :global(a.quick-card strong) {
          color: #12241f;
          font-weight: 600;
          font-size: 16px;
        }

        :global(a.quick-card span) {
          color: #586d67;
          font-size: 14px;
          line-height: 1.6;
        }

        :global(a.quick-card:hover) {
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(29, 38, 52, 0.1);
          border-color: #c8d9d3;
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

          .quick-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </article>
  );
}

"use client";

import Link from "next/link";
import type { Exam } from "../types";
import { formatDate, getExamStatus } from "../utils";

type Props = {
  exams: Exam[];
};

export default function RecentExams({ exams }: Props) {
  return (
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
        {exams.length === 0 ? (
          <div className="empty-state">
            <h3>还没有考试数据</h3>
            <p>先建立考试，再让首页真正变成工作台。</p>
            <Link href="/exams/create">新建考试</Link>
          </div>
        ) : (
          exams.map((exam) => {
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

        .text-link {
          color: #0f766e;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.2s ease;
        }

        .text-link:hover {
          transform: translateY(-1px);
        }

        .exam-list {
          display: grid;
          gap: 12px;
        }

        .exam-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 16px 18px;
          border-radius: 18px;
          background: #f7faf9;
          border: 1px solid #e4efeb;
        }

        .exam-main {
          min-width: 0;
        }

        .exam-topline {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 6px;
        }

        .panel h3 {
          margin: 0;
          font-size: 19px;
          color: #12241f;
        }

        .exam-main p {
          margin: 0;
          color: #536863;
          line-height: 1.65;
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
          transition: all 0.2s ease;
        }

        .exam-side a:hover {
          transform: translateY(-1px);
          background: rgba(255, 255, 255, 0.84);
          border-color: rgba(91, 104, 127, 0.22);
        }

        .empty-state {
          display: grid;
          gap: 12px;
          padding: 18px;
          border-radius: 18px;
          background: #f7faf9;
          border: 1px dashed #c7ddd7;
        }

        .empty-state h3 {
          margin: 0;
          font-size: 19px;
          color: #12241f;
        }

        .empty-state p {
          margin: 0;
          color: #536863;
          line-height: 1.65;
        }

        .empty-state a {
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
          transition: all 0.2s ease;
        }

        .empty-state a:hover {
          transform: translateY(-1px);
        }

        @media (max-width: 1100px) {
          .exam-list {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 768px) {
          .panel {
            padding: 18px;
            border-radius: 20px;
          }

          .panel-header,
          .exam-row {
            align-items: flex-start;
            flex-direction: column;
          }

          .exam-side {
            justify-items: start;
            white-space: normal;
          }
        }
      `}</style>
    </article>
  );
}

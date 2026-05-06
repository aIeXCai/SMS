"use client";

import type { ScoreRow } from "../types";

interface Props {
  isLoading: boolean;
  rows: ScoreRow[];
  allSubjects: string[];
  totalCount: number;
  startIndex: number;
  endIndex: number;
  numPages: number;
  subjectSort: string;
  sortOrder: "asc" | "desc";
  onSort: (target: string, defaultOrder?: "asc" | "desc") => void;
  onExport: () => void;
  onQuery: () => void;
}

function renderSortBtn(
  target: string,
  defaultOrder: "asc" | "desc",
  subjectSort: string,
  sortOrder: "asc" | "desc",
  onSort: (target: string, defaultOrder?: "asc" | "desc") => void,
) {
  const active = subjectSort === target;
  const arrow = active ? (sortOrder === "desc" ? "▼" : "▲") : (defaultOrder === "desc" ? "▼" : "▲");
  return (
    <button type="button" className={`sort-btn ${active ? "active" : ""}`} onClick={() => onSort(target, defaultOrder)}>
      {arrow}
    </button>
  );
}

export default function QueryResultsTable({
  isLoading, rows, allSubjects, totalCount, startIndex, endIndex, numPages,
  subjectSort, sortOrder, onSort, onExport, onQuery,
}: Props) {
  if (isLoading) {
    return (
      <div className="text-center py-5">
        <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" role="status"></div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="empty-state">
        <i className="fas fa-search"></i>
        <h4 className="mt-3">暂无查询结果</h4>
        <p className="text-gray-500">请设置查询条件后点击查询按钮，或者调整查询条件重新搜索</p>
        <button type="button" className="app-btn-primary mt-3" onClick={onQuery}>
          <i className="fas fa-search mr-2"></i>开始查询
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="stats-summary">
        <div className="flex flex-wrap items-center">
          <div className="shrink-0">
            <div className="stats-icon"><i className="fas fa-chart-bar"></i></div>
          </div>
          <div className="flex-1">
            <h5 className="mb-1">查询统计</h5>
            <p className="mb-0">
              共找到 <strong className="text-blue-600">{totalCount}</strong> 条记录
              {numPages > 1 ? <>（当前显示第 <strong>{startIndex}</strong> - <strong>{endIndex}</strong> 条）</> : null}
            </p>
          </div>
          <div className="shrink-0">
            <button type="button" className="app-btn-primary" onClick={onExport}>
              <i className="fas fa-file-excel mr-1"></i>导出Excel
            </button>
          </div>
        </div>
      </div>

      <div className="app-table-wrapper">
        <div className="app-table-scroll query-table-scroll">
          <table className="app-table frozen-table">
            <thead>
              <tr>
                <th className="frozen-col col-name">姓名</th>
                <th className="frozen-col col-grade">年级</th>
                <th className="frozen-col col-class">班级</th>
                <th className="frozen-col col-exam">考试</th>
                {allSubjects.map((subject) => (
                  <th key={subject} className="score-cell sort-header">
                    {subject} {renderSortBtn(subject, "desc", subjectSort, sortOrder, onSort)}
                  </th>
                ))}
                <th className="sort-header">总分 {renderSortBtn("total_score", "desc", subjectSort, sortOrder, onSort)}</th>
                <th className="sort-header">级排 {renderSortBtn("grade_rank", "asc", subjectSort, sortOrder, onSort)}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.record_key}>
                  <td className="student-info frozen-col col-name">{row.student.name}</td>
                  <td className="frozen-col col-grade">{row.student.grade_level_display}</td>
                  <td className="frozen-col col-class">{row.class.class_name || "N/A"}</td>
                  <td className="frozen-col col-exam" title={row.exam.name}>
                    <span className="exam-text">{row.exam.name}</span>
                  </td>
                  {allSubjects.map((s) => (
                    <td key={`${row.record_key}_${s}`} className="score-cell">
                      {row.scores[s] !== undefined ? row.scores[s] : <span className="text-gray-500">-</span>}
                    </td>
                  ))}
                  <td className="total-score">{row.total_score ?? "-"}</td>
                  <td className="rank-cell">{row.grade_rank ?? <span className="text-gray-500">-</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

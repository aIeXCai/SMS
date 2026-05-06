"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { ScoreRow } from "../types";

interface ScoreTableProps {
  rows: ScoreRow[];
  allSubjects: string[];
  selected: Record<string, boolean>;
  allFilteredSelected: boolean;
  currentPageIndeterminate: boolean;
  isSelectingAll: boolean;
  totalCount: number;
  canScoreWrite: boolean;
  onToggleSelectAll: () => void;
  onToggleOne: (key: string) => void;
}

export default function ScoreTable({
  rows,
  allSubjects,
  selected,
  allFilteredSelected,
  currentPageIndeterminate,
  isSelectingAll,
  totalCount,
  canScoreWrite,
  onToggleSelectAll,
  onToggleOne,
}: ScoreTableProps) {
  const selectAllRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = currentPageIndeterminate;
    }
  }, [currentPageIndeterminate]);

  return (
    <div className="app-table-wrapper">
      <div className="app-table-scroll">
        <table className="app-table">
          <thead>
            <tr>
              <th style={{ width: "50px" }}>
                {canScoreWrite && (
                  <input
                    className="rounded border-gray-300"
                    type="checkbox"
                    checked={allFilteredSelected}
                    disabled={isSelectingAll || totalCount === 0}
                    ref={selectAllRef}
                    onChange={onToggleSelectAll}
                  />
                )}
              </th>
              <th>学号</th>
              <th>学生姓名</th>
              <th>年级</th>
              <th>班级</th>
              <th>考试名称</th>
              {allSubjects.map((subject) => (
                <th key={subject}>{subject}</th>
              ))}
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.record_key}>
                <td>
                  {canScoreWrite && (
                    <input
                      className="rounded border-gray-300"
                      type="checkbox"
                      checked={!!selected[row.record_key]}
                      onChange={() => onToggleOne(row.record_key)}
                    />
                  )}
                </td>
                <td>{row.student.student_id}</td>
                <td>{row.student.name}</td>
                <td>{row.student.grade_level_display}</td>
                <td>{row.class.class_name || "N/A"}</td>
                <td>{row.exam.name}</td>
                {allSubjects.map((subject) => (
                  <td key={`${row.record_key}_${subject}`}>
                    {row.scores[subject] !== undefined ? (
                      <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">
                        {row.scores[subject]}
                      </span>
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                  </td>
                ))}
                <td>
                  {canScoreWrite ? (
                    <Link
                      href={`/scores/batch-edit?student=${row.student_id}&exam=${row.exam_id}`}
                      className="bg-yellow-500 text-white text-sm px-2 py-1 rounded hover:bg-yellow-600 transition-colors"
                    >
                      <i className="fas fa-edit"></i> 编辑成绩
                    </Link>
                  ) : (
                    <span className="text-gray-500">只读</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

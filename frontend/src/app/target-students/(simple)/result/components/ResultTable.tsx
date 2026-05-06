"use client";

import type { ResultData, StudentRecord } from "../types";
import ResultPagination from "./ResultPagination";

interface Props {
  result: ResultData;
  students: StudentRecord[];
  currentPage: number;
  pageSize: number;
  totalPages: number;
  sortField: "avg_rank" | null;
  sortDirection: "asc" | "desc";
  onSort: (field: "avg_rank") => void;
  onPageChange: (page: number) => void;
}

export default function ResultTable({
  result,
  students,
  currentPage,
  pageSize,
  totalPages,
  sortField,
  sortDirection,
  onSort,
  onPageChange,
}: Props) {
  return (
    <div className="card filter-card mt-3">
      <div className="card-header flex justify-between items-center">
        <h5 className="mb-0">
          <i className="fas fa-list mr-2"></i>筛选结果
        </h5>
        <span className="badge bg-primary fs-6">
          共 {result.matched_count} 名目标生
        </span>
      </div>
      <div className="p-4">
        {/* Rule summary */}
        <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded mb-3">
          <strong>规则摘要：</strong>
          {result.rule_summary.grade_level} | 前 {result.rule_summary.threshold} 名 |
          {result.rule_summary.quantifier === "all"
            ? "每次都满足"
            : `至少${result.rule_summary.k}次满足`}{" "}
          | 考试数量：{result.exam_count}
        </div>

        {students.length === 0 ? (
          <div className="text-center py-5">
            <i className="fas fa-search fa-3x text-muted mb-3"></i>
            <h5 className="text-gray-500">暂无符合条件的学生</h5>
            <p className="text-gray-500">请尝试调整筛选条件</p>
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="table table-hover table-bordered align-middle result-table">
                <thead className="table-light">
                  <tr>
                    <th className="text-center" style={{ width: "70px" }}>
                      序号
                    </th>
                    <th className="text-center">姓名</th>
                    <th className="text-center">入学年级</th>
                    <th className="text-center">年级</th>
                    <th className="text-center">班级</th>
                    <th className="text-center">参加考试次数</th>
                    <th className="text-center">满足条件次数</th>
                    <th className="text-center">缺考次数</th>
                    <th
                      className="text-center sortable-header"
                      onClick={() => onSort("avg_rank")}
                      style={{ cursor: "pointer", minWidth: "100px" }}
                    >
                      <span>
                        平均排名
                        <i
                          className={`fas fa-caret-down ml-1 ${
                            sortField === "avg_rank" ? "text-warning" : "text-white-50"
                          }`}
                        ></i>
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student, index) => (
                    <tr key={student.student_pk}>
                      <td className="text-center text-muted">
                        {(currentPage - 1) * pageSize + index + 1}
                      </td>
                      <td className="text-center fw-medium">{student.name}</td>
                      <td className="text-center">{student.cohort || "-"}</td>
                      <td className="text-center">
                        {student.grade_level_display || student.grade_level || "-"}
                      </td>
                      <td className="text-center">{student.class_name || "-"}</td>
                      <td className="text-center">
                        <span className="badge bg-secondary">{student.participated_count}</span>
                      </td>
                      <td className="text-center">
                        <span className="badge bg-success">{student.hit_count}</span>
                      </td>
                      <td className="text-center">
                        <span className="badge bg-warning">{student.missed_exam_count}</span>
                      </td>
                      <td className="text-center">
                        {student.avg_rank !== null ? (
                          <span className="badge bg-info">{student.avg_rank}</span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ResultPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={onPageChange}
            />
          </>
        )}

        <style jsx>{`
          .sortable-header {
            user-select: none;
            transition: background-color 0.2s;
          }
          .sortable-header:hover {
            background-color: rgba(255, 255, 255, 0.15);
          }
        `}</style>
      </div>
    </div>
  );
}

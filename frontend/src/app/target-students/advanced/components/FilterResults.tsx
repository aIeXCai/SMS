import { Fragment, useMemo, useState } from "react";

type ConditionColumn = {
  index: number;
  subject: string;
  subject_label: string;
  dimension: "grade" | "class";
};

type StudentConditionDetail = {
  condition_index: number;
  subject: string;
  subject_label: string;
  score: number | null;
  rank: number | null;
};

type FilterStudent = {
  student_id: number;
  student_number: string;
  name: string;
  cohort: string;
  class_name: string;
  total_rank: number | null;
  condition_details: StudentConditionDetail[];
};

type FilterResultsProps = {
  students: FilterStudent[];
  columns: ConditionColumn[];
};

type SortConfig =
  | { type: "score"; index: number; direction: "asc" | "desc" }
  | { type: "rank"; index: number; direction: "asc" | "desc" }
  | null;

export default function FilterResults({ students, columns }: FilterResultsProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);

  const sortedStudents = useMemo(() => {
    if (!sortConfig) {
      return students;
    }

    const next = [...students];

    if (sortConfig.type === "score") {
      next.sort((a, b) => {
        const aDetail = a.condition_details.find((item) => item.condition_index === sortConfig.index);
        const bDetail = b.condition_details.find((item) => item.condition_index === sortConfig.index);

        const aScore = aDetail?.score;
        const bScore = bDetail?.score;

        if (aScore === null || aScore === undefined) return 1;
        if (bScore === null || bScore === undefined) return -1;

        const compare = aScore - bScore;
        return sortConfig.direction === "asc" ? compare : -compare;
      });
      return next;
    }

    next.sort((a, b) => {
      const aDetail = a.condition_details.find((item) => item.condition_index === sortConfig.index);
      const bDetail = b.condition_details.find((item) => item.condition_index === sortConfig.index);

      const aRank = aDetail?.rank;
      const bRank = bDetail?.rank;

      if (aRank === null || aRank === undefined) return 1;
      if (bRank === null || bRank === undefined) return -1;

      const compare = aRank - bRank;
      return sortConfig.direction === "asc" ? compare : -compare;
    });

    return next;
  }, [students, sortConfig]);

  const toggleSort = (type: "score" | "rank", index: number) => {
    setSortConfig((prev) => {
      if (!prev || prev.type !== type || prev.index !== index) {
        return { type, index, direction: "asc" };
      }
      return {
        type,
        index,
        direction: prev.direction === "asc" ? "desc" : "asc",
      };
    });
  };

  const getCaretClass = (type: "score" | "rank", index: number) => {
    if (!sortConfig || sortConfig.type !== type || sortConfig.index !== index) {
      return "fas fa-sort text-white/50 ms-1";
    }
    return sortConfig.direction === "asc"
      ? "fas fa-sort-up text-yellow-500 ms-1"
      : "fas fa-sort-down text-yellow-500 ms-1";
  };

  const formatScore = (score: number | null | undefined): string => {
    if (score === null || score === undefined) {
      return "-";
    }
    if (Number.isInteger(score)) {
      return `${score}`;
    }
    return score.toFixed(1);
  };

  if (students.length === 0) {
    return (
      <div className="text-center py-5">
        <i className="fas fa-search fa-3x text-gray-500 mb-3"></i>
        <h5 className="text-gray-500">暂无符合条件的学生</h5>
        <p className="text-gray-500">请返回调整筛选条件后重试</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse [&_tr:hover]:bg-gray-50 table-bordered align-middle result-table">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-center" style={{ width: "70px" }}>序号</th>
            <th className="text-center">姓名</th>
            <th className="text-center">入学年级</th>
            <th className="text-center">班级</th>
            {columns.map((column) => (
              <Fragment key={`head-${column.index}`}>
                <th
                  className="text-center sortable-header"
                  style={{ minWidth: "130px", cursor: "pointer" }}
                  onClick={() => toggleSort("score", column.index)}
                >
                  {column.subject_label}
                  <i className={getCaretClass("score", column.index)}></i>
                </th>
                <th
                  className="text-center sortable-header"
                  style={{ minWidth: "130px", cursor: "pointer" }}
                  onClick={() => toggleSort("rank", column.index)}
                >
                  {column.subject_label}排名
                  <i className={getCaretClass("rank", column.index)}></i>
                </th>
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedStudents.map((student, rowIndex) => (
            <tr key={student.student_id}>
              <td className="text-center text-gray-500">{rowIndex + 1}</td>
              <td className="text-center font-medium">{student.name}</td>
              <td className="text-center">{student.cohort || "-"}</td>
              <td className="text-center">{student.class_name || "-"}</td>
              {columns.map((column) => {
                const detail = student.condition_details.find((item) => item.condition_index === column.index);
                return (
                  <Fragment key={`row-${student.student_id}-condition-${column.index}`}>
                    <td className="text-center">
                      {formatScore(detail?.score)}
                    </td>
                    <td className="text-center">
                      {typeof detail?.rank === "number" ? (
                        <span className="bg-cyan-100 text-cyan-800 text-xs px-2 py-0.5 rounded">{detail.rank}</span>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                  </Fragment>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

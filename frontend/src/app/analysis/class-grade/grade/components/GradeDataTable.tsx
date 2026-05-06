"use client";

import type { ClassStatistic, SubjectItem, SortState } from "./types";

type Props = {
  classStatistics: ClassStatistic[];
  subjects: SubjectItem[];
  sortState: SortState;
  onSort: (column: number) => void;
};

function sortClassName(sortState: SortState, column: number): string {
  if (sortState.column !== column) return "";
  return sortState.direction === "asc" ? "sort-asc" : "sort-desc";
}

function getSortIconClass(sortState: SortState, column: number): string {
  if (sortState.column !== column) return "fas fa-sort sort-icon";
  return sortState.direction === "asc" ? "fas fa-sort-up sort-icon" : "fas fa-sort-down sort-icon";
}

export default function GradeDataTable({ classStatistics, subjects, sortState, onSort }: Props) {
  if (!classStatistics.length) return null;

  return (
    <div className="flex flex-wrap">
      <div className="w-full">
        <div className="chart-card">
          <div className="card-header"><h5><i className="fas fa-table"></i> 年级详细数据统计</h5></div>
          <div className="card-body">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse table-modern [&_tbody_tr]:bg-white [&_tbody_tr:nth-child(even)]:bg-gray-100 [&_tbody_tr:hover]:bg-green-100" id="gradeComparisonTable">
                <thead>
                  <tr>
                    <th className="px-4 py-2.5 text-sm min-w-[85px] sticky left-0 z-10">班级</th>
                    <th className="px-4 py-2.5 text-sm w-[60px]">人数</th>
                    <th className={`sortable px-4 py-2.5 text-sm ${sortClassName(sortState, 2)}`} onClick={() => onSort(2)}>平均分 <i className={getSortIconClass(sortState, 2)}></i></th>
                    <th className={`sortable px-4 py-2.5 text-sm ${sortClassName(sortState, 3)}`} onClick={() => onSort(3)}>最高分 <i className={getSortIconClass(sortState, 3)}></i></th>
                    <th className={`sortable px-4 py-2.5 text-sm ${sortClassName(sortState, 4)}`} onClick={() => onSort(4)}>最低分 <i className={getSortIconClass(sortState, 4)}></i></th>
                    <th className={`sortable px-4 py-2.5 text-sm ${sortClassName(sortState, 5)}`} onClick={() => onSort(5)}>优秀率 <i className={getSortIconClass(sortState, 5)}></i></th>
                    <th className={`sortable px-4 py-2.5 text-sm ${sortClassName(sortState, 6)}`} onClick={() => onSort(6)}>良好率 <i className={getSortIconClass(sortState, 6)}></i></th>
                    <th className={`sortable px-4 py-2.5 text-sm ${sortClassName(sortState, 7)}`} onClick={() => onSort(7)}>及格率 <i className={getSortIconClass(sortState, 7)}></i></th>
                    {subjects.map((subject, i) => (
                      <th key={subject.code} className={`sortable px-4 py-2.5 text-sm ${sortClassName(sortState, i + 8)}`} onClick={() => onSort(i + 8)}>
                        {subject.name} <i className={getSortIconClass(sortState, i + 8)}></i>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody id="gradeTableBody">
                  {classStatistics.map((row, rowIndex) => (
                    <tr key={`${row.class_name}-${rowIndex}`} className="border-b border-gray-100">
                      <td className="px-4 py-2 min-w-[80px] sticky left-0 bg-inherit"><strong>{row.class_name}</strong></td>
                      <td className="px-4 py-2 w-[60px]">{row.student_count}</td>
                      <td className="px-4 py-2" data-value={row.avg_total}>{Number(row.avg_total || 0).toFixed(1)}</td>
                      <td className="px-4 py-2" data-value={row.max_total}>{Number(row.max_total || 0).toFixed(1)}</td>
                      <td className="px-4 py-2" data-value={row.min_total}>{Number(row.min_total || 0).toFixed(1)}</td>
                      <td className="px-4 py-2" data-value={row.excellent_rate}>{Number(row.excellent_rate || 0).toFixed(1)}%</td>
                      <td className="px-4 py-2" data-value={row.good_rate}>{Number(row.good_rate || 0).toFixed(1)}%</td>
                      <td className="px-4 py-2" data-value={row.pass_rate}>{Number(row.pass_rate || 0).toFixed(1)}%</td>
                      {row.subject_averages.map((avg, i) => (
                        <td className="px-4 py-2" key={`${row.class_name}-${i}`} data-value={avg}>{Number(avg || 0).toFixed(1)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-sm text-gray-500 leading-relaxed">
              <strong>注：</strong>优秀率=(特优人数+优秀人数)/总人数；良好率=(特优人数+优秀人数+良好人数)/总人数；及格率=(特优人数+优秀人数+良好人数+及格人数)/总人数
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

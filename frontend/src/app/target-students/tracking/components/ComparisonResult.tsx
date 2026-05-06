"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import UnifiedModal from "../../components/UnifiedModal";

type SnapshotMeta = {
  id: number;
  exam_name: string;
  snapshot_name: string;
  created_at: string;
};

type StudentChangeItem = {
  student_id: number;
  cohort: string | null;
  name: string;
  class_name: string;
  old_rank: number | null;
  new_rank: number | null;
  rank_change: number | null;
};

export type SnapshotComparisonResult = {
  baseline: SnapshotMeta;
  comparison: SnapshotMeta;
  changes: {
    added: StudentChangeItem[];
    removed: StudentChangeItem[];
    retained: StudentChangeItem[];
  };
  summary: {
    added_count: number;
    removed_count: number;
    retained_count: number;
    retention_rate: string;
  };
};

type ComparisonResultProps = {
  result: SnapshotComparisonResult | null;
  loading: boolean;
  error: string | null;
};

const sanitizeSheetName = (name: string) => {
  const cleaned = name.replace(/[\\/?*\[\]:]/g, "_").trim();
  return (cleaned || "Sheet").slice(0, 31);
};

const buildExportRows = (rows: StudentChangeItem[]) =>
  rows.map((item, index) => ({
    序号: index + 1,
    姓名: item.name || "-",
    年级: item.cohort || "-",
    班级: item.class_name || "-",
    基准排名: item.old_rank ?? "-",
    对比排名: item.new_rank ?? "-",
    排名变化: item.rank_change ?? "-",
  }));

const exportSingleTable = (title: string, rows: StudentChangeItem[]) => {
  if (!rows.length) {
    return false;
  }

  const worksheet = XLSX.utils.json_to_sheet(buildExportRows(rows));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sanitizeSheetName(title));

  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  XLSX.writeFile(workbook, `${title}_${datePart}.xlsx`);
  return true;
};

const exportAllTables = (result: SnapshotComparisonResult) => {
  const workbook = XLSX.utils.book_new();
  const sections: Array<{ title: string; rows: StudentChangeItem[] }> = [
    { title: "新增名单", rows: result.changes.added || [] },
    { title: "退出名单", rows: result.changes.removed || [] },
    { title: "保留名单", rows: result.changes.retained || [] },
  ];

  sections.forEach((section) => {
    const worksheet = XLSX.utils.json_to_sheet(buildExportRows(section.rows));
    XLSX.utils.book_append_sheet(workbook, worksheet, sanitizeSheetName(section.title));
  });

  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  XLSX.writeFile(workbook, `快照对比结果_${datePart}.xlsx`);
};

const formatDateTime = (value: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

const rankChangeBadge = (delta: number | null) => {
  if (delta === null || delta === undefined) {
    return <span className="text-gray-500">-</span>;
  }

  if (delta > 0) {
    return <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">+{delta}</span>;
  }

  if (delta < 0) {
    return <span className="bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded">{delta}</span>;
  }

  return <span className="bg-gray-100 text-gray-800 text-xs px-2 py-0.5 rounded">0</span>;
};

function ChangeTable({
  title,
  icon,
  rows,
}: {
  title: string;
  icon: string;
  rows: StudentChangeItem[];
}) {
  const [rankSortDirection, setRankSortDirection] = useState<"asc" | "desc">("desc");
  const [modalOpen, setModalOpen] = useState(false);

  const sortedRows = useMemo(() => {
    const next = [...rows];
    next.sort((a, b) => {
      const aValue = a.rank_change;
      const bValue = b.rank_change;

      const aNull = aValue === null || aValue === undefined;
      const bNull = bValue === null || bValue === undefined;

      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;

      const delta = aValue - bValue;
      return rankSortDirection === "asc" ? delta : -delta;
    });
    return next;
  }, [rows, rankSortDirection]);

  const rankSortIcon = rankSortDirection === "asc" ? "fas fa-sort-up" : "fas fa-sort-down";

  return (
    <div className="bg-white rounded-lg shadow filter-card h-100">
      <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h6 className="mb-0 inline-flex items-center font-semibold" style={{ minHeight: 30, fontSize: "1rem" }}>
            <i className={`${icon} mr-2`}></i>
            {title}
          </h6>
          <span
            className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded inline-flex items-center"
            style={{ minHeight: 30, fontSize: "0.9rem", padding: "0 10px", borderRadius: 8 }}
          >
            {rows.length} 人
          </span>
        </div>
        <div>
          <button
            type="button"
            className="bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 transition-colors text-sm"
            onClick={() => {
              const ok = exportSingleTable(title, rows);
              if (!ok) {
                setModalOpen(true);
              }
            }}
          >
            <i className="fas fa-file-excel mr-1"></i>导出 Excel
          </button>
        </div>
      </div>
      <div className="p-4">
        {rows.length === 0 ? (
          <div className="text-center py-4 text-gray-500 small">暂无数据</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse [&_tr:hover]:bg-gray-50 table-bordered align-middle result-table mb-0">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-center" style={{ width: "64px" }}>序号</th>
                  <th className="text-center">姓名</th>
                  <th className="text-center">年级</th>
                  <th className="text-center">班级</th>
                  <th className="text-center" style={{ width: "92px" }}>基准排名</th>
                  <th className="text-center" style={{ width: "92px" }}>对比排名</th>
                    <th
                      className="text-center"
                      style={{ width: "92px", cursor: "pointer" }}
                      onClick={() => setRankSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))}
                    >
                      排名变化
                      <i className={`${rankSortIcon} ml-1 text-yellow-500`}></i>
                    </th>
                </tr>
              </thead>
              <tbody>
                  {sortedRows.map((item, index) => (
                  <tr key={item.student_id}>
                    <td className="text-center text-gray-500">{index + 1}</td>
                    <td className="text-center font-medium">{item.name || "-"}</td>
                    <td className="text-center">{item.cohort || "-"}</td>
                    <td className="text-center">{item.class_name || "-"}</td>
                    <td className="text-center">{item.old_rank ?? "-"}</td>
                    <td className="text-center">{item.new_rank ?? "-"}</td>
                    <td className="text-center">{rankChangeBadge(item.rank_change)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <UnifiedModal
        open={modalOpen}
        variant="info"
        title="导出提示"
        message={`${title}暂无可导出数据`}
        onConfirm={() => setModalOpen(false)}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}

export default function ComparisonResult({ result, loading, error }: ComparisonResultProps) {
  if (loading) {
    return (
      <div className="text-center py-5 text-gray-500">
        <span className="animate-spin h-3 w-3 border-2 border-blue-600 border-t-transparent rounded-full mr-2 inline-block align-[-0.125em]"></span>
        正在计算快照差异...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded mb-0" role="alert">
        <i className="fas fa-triangle-exclamation mr-2"></i>
        {error}
      </div>
    );
  }

  if (!result) {
    return (
      <div className="text-center py-5 text-gray-500">
        <i className="fas fa-code-compare fa-2x mb-3 text-gray-500"></i>
        <p className="mb-1">请选择基准快照与对比快照后，点击"开始对比分析"。</p>
        <p className="text-sm mb-0">结果将展示新增、退出、保留名单及排名变化。</p>
      </div>
    );
  }

  return (
    <div>
      <div className="comparison-meta mb-3">
        <div className="flex justify-between items-center mb-2">
          <div className="text-sm text-gray-500">对比结果导出</div>
          <button
            type="button"
            className="bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 transition-colors text-sm"
            onClick={() => exportAllTables(result)}
          >
            <i className="fas fa-file-export mr-1"></i>全部导出
          </button>
        </div>
        <div className="text-sm text-gray-500 mb-2">
          基准：{result.baseline.snapshot_name}（{result.baseline.exam_name}，{formatDateTime(result.baseline.created_at)}）
        </div>
        <div className="text-sm text-gray-500 mb-2">
          对比：{result.comparison.snapshot_name}（{result.comparison.exam_name}，{formatDateTime(result.comparison.created_at)}）
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">新增 {result.summary.added_count}</span>
          <span className="bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded">退出 {result.summary.removed_count}</span>
          <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">保留 {result.summary.retained_count}</span>
          <span className="bg-gray-100 text-gray-800 text-xs px-2 py-0.5 rounded">保留率 {result.summary.retention_rate}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 md:gap-4">
        <div className="w-full">
          <ChangeTable title="新增名单" icon="fas fa-user-plus text-green-600" rows={result.changes.added || []} />
        </div>
        <div className="w-full">
          <ChangeTable title="退出名单" icon="fas fa-user-minus text-red-600" rows={result.changes.removed || []} />
        </div>
        <div className="w-full">
          <ChangeTable title="保留名单" icon="fas fa-user-check text-blue-600" rows={result.changes.retained || []} />
        </div>
      </div>
    </div>
  );
}

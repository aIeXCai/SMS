"use client";

import { useEffect, useMemo, useState } from "react";

export type FilterSnapshot = {
  id: number;
  snapshot_name: string;
  exam_name: string;
  exam_academic_year: string | null;
  student_count: number;
  created_at: string;
};

type SnapshotListProps = {
  snapshots: FilterSnapshot[];
  loading: boolean;
  error: string | null;
  baselineSnapshotId: number | null;
  comparisonSnapshotId: number | null;
  deletingSnapshotId?: number | null;
  onSelectBaseline: (snapshotId: number) => void;
  onSelectComparison: (snapshotId: number) => void;
  onDeleteSnapshot: (snapshotId: number) => void;
};

const PAGE_SIZE = 10;

export default function SnapshotList({
  snapshots,
  loading,
  error,
  baselineSnapshotId,
  comparisonSnapshotId,
  deletingSnapshotId = null,
  onSelectBaseline,
  onSelectComparison,
  onDeleteSnapshot,
}: SnapshotListProps) {
  const [page, setPage] = useState(1);

  const sortedSnapshots = useMemo(() => {
    return [...snapshots].sort((a, b) => {
      const aTs = new Date(a.created_at).getTime();
      const bTs = new Date(b.created_at).getTime();
      const safeA = Number.isNaN(aTs) ? 0 : aTs;
      const safeB = Number.isNaN(bTs) ? 0 : bTs;
      return safeB - safeA;
    });
  }, [snapshots]);

  const totalPages = Math.max(1, Math.ceil(sortedSnapshots.length / PAGE_SIZE));

  useEffect(() => {
    // 删除快照后若总页数减少，自动回退到有效页，避免出现空白页。
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const pagedSnapshots = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedSnapshots.slice(start, start + PAGE_SIZE);
  }, [sortedSnapshots, page]);

  if (loading) {
    return (
      <div className="text-center py-5 text-gray-500">
        <span className="animate-spin h-3 w-3 border-2 border-blue-600 border-t-transparent rounded-full mr-2 inline-block align-[-0.125em]"></span>
        正在加载快照列表...
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

  if (sortedSnapshots.length === 0) {
    return (
      <div className="text-center py-5 text-gray-500">
        <i className="fas fa-folder-open fa-2x mb-3 text-gray-500"></i>
        <p className="mb-1">当前暂无快照。</p>
        <p className="text-sm mb-0">请先前往高级筛选结果页保存快照，再回到本页选择对比对象。</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse [&_tr:hover]:bg-gray-50 table-bordered align-middle snapshot-table mb-0">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-center" style={{ width: "70px" }}>序号</th>
              <th className="text-center" style={{ width: "300px" }}>快照名称</th>
              <th className="text-center" style={{ width: "340px" }}>考试</th>
              <th className="text-center" style={{ width: "70px" }}>人数</th>
              <th className="text-center" style={{ width: "280px" }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {pagedSnapshots.map((snapshot, index) => {
              const isBaseline = baselineSnapshotId === snapshot.id;
              const isComparison = comparisonSnapshotId === snapshot.id;
              return (
                <tr key={snapshot.id}>
                  <td className="text-center text-gray-500">{(page - 1) * PAGE_SIZE + index + 1}</td>
                  <td className="text-center">
                    <div className="font-medium">{snapshot.snapshot_name}</div>
                  </td>
                  <td className="text-center">{snapshot.exam_name || "-"}</td>
                  <td className="text-center">{snapshot.student_count}</td>
                  <td className="text-center">
                    <div className="flex justify-center items-center gap-2">
                      <button
                        type="button"
                        className={`text-sm px-2 py-1 rounded transition-colors ${isBaseline ? "bg-green-600 text-white hover:bg-green-700" : "border border-green-300 text-green-600 hover:bg-green-50"}`}
                        onClick={() => onSelectBaseline(snapshot.id)}
                      >
                        {isBaseline ? "已选基准" : "设为基准"}
                      </button>
                      <button
                        type="button"
                        className={`text-sm px-2 py-1 rounded transition-colors ${isComparison ? "bg-blue-600 text-white hover:bg-blue-700" : "border border-blue-300 text-blue-600 hover:bg-blue-50"}`}
                        onClick={() => onSelectComparison(snapshot.id)}
                      >
                        {isComparison ? "已选对比" : "设为对比"}
                      </button>
                      <button
                        type="button"
                        className="border border-red-300 text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors text-sm"
                        onClick={() => onDeleteSnapshot(snapshot.id)}
                        disabled={deletingSnapshotId === snapshot.id}
                        title="删除快照"
                        aria-label="删除快照"
                      >
                        {deletingSnapshotId === snapshot.id ? (
                          <span className="animate-spin h-3 w-3 border-2 border-blue-600 border-t-transparent rounded-full inline-block align-[-0.125em]" aria-hidden="true"></span>
                        ) : (
                          <i className="fas fa-trash"></i>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <nav className="flex justify-center mt-3">
          <ul className="pagination mb-0">
            <li className={`page-item ${page === 1 ? "disabled" : ""}`}>
              <button className="page-link" onClick={() => setPage(1)}>首页</button>
            </li>
            <li className={`page-item ${page === 1 ? "disabled" : ""}`}>
              <button className="page-link" onClick={() => setPage((p) => Math.max(1, p - 1))}>上一页</button>
            </li>
            <li className="page-item active">
              <span className="page-link">第 {page} / {totalPages} 页</span>
            </li>
            <li className={`page-item ${page === totalPages ? "disabled" : ""}`}>
              <button className="page-link" onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>下一页</button>
            </li>
            <li className={`page-item ${page === totalPages ? "disabled" : ""}`}>
              <button className="page-link" onClick={() => setPage(totalPages)}>末页</button>
            </li>
          </ul>
        </nav>
      )}
    </>
  );
}

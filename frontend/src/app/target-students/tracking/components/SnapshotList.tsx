"use client";

import { useMemo, useState } from "react";

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
  const pagedSnapshots = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedSnapshots.slice(start, start + PAGE_SIZE);
  }, [sortedSnapshots, page]);

  if (loading) {
    return (
      <div className="text-center py-5 text-secondary">
        <span className="spinner-border spinner-border-sm me-2"></span>
        正在加载快照列表...
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger mb-0" role="alert">
        <i className="fas fa-triangle-exclamation me-2"></i>
        {error}
      </div>
    );
  }

  if (sortedSnapshots.length === 0) {
    return (
      <div className="text-center py-5 text-secondary">
        <i className="fas fa-folder-open fa-2x mb-3 text-muted"></i>
        <p className="mb-1">当前暂无快照。</p>
        <p className="small mb-0">请先前往高级筛选结果页保存快照，再回到本页选择对比对象。</p>
      </div>
    );
  }

  return (
    <>
      <div className="table-responsive">
        <table className="table table-hover table-bordered align-middle snapshot-table mb-0">
          <thead className="table-light">
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
                  <td className="text-center text-muted">{(page - 1) * PAGE_SIZE + index + 1}</td>
                  <td className="text-center">
                    <div className="fw-medium">{snapshot.snapshot_name}</div>
                  </td>
                  <td className="text-center">
                    {snapshot.exam_academic_year
                      ? `${snapshot.exam_academic_year} ${snapshot.exam_name || "-"}`
                      : snapshot.exam_name || "-"}
                  </td>
                  <td className="text-center">{snapshot.student_count}</td>
                  <td className="text-center">
                    <div className="d-flex justify-content-center align-items-center gap-2">
                      <button
                        type="button"
                        className={`btn btn-sm ${isBaseline ? "btn-success" : "btn-outline-success"}`}
                        onClick={() => onSelectBaseline(snapshot.id)}
                      >
                        {isBaseline ? "已选基准" : "设为基准"}
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm ${isComparison ? "btn-primary" : "btn-outline-primary"}`}
                        onClick={() => onSelectComparison(snapshot.id)}
                      >
                        {isComparison ? "已选对比" : "设为对比"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm px-2"
                        onClick={() => onDeleteSnapshot(snapshot.id)}
                        disabled={deletingSnapshotId === snapshot.id}
                        title="删除快照"
                        aria-label="删除快照"
                      >
                        {deletingSnapshotId === snapshot.id ? (
                          <span className="spinner-border spinner-border-sm" aria-hidden="true"></span>
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
        <nav className="d-flex justify-content-center mt-3">
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

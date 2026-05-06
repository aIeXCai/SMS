"use client";

import { Stats } from "./types";

interface Props {
  selectedCount: number;
  allSelected: boolean;
  batchStatus: string;
  stats: Stats | null;
  canStudentWrite: boolean;
  error: string | null;
  selectAllRef: React.RefObject<HTMLInputElement | null>;
  onSelectAll: () => void;
  onBatchStatusChange: (status: string) => void;
  onBatchUpdateStatus: () => void;
  onBatchDelete: () => void;
  onBatchPromote: () => void;
  onBatchGraduate: () => void;
}

export default function StudentBatchBar({
  selectedCount,
  allSelected,
  batchStatus,
  stats,
  canStudentWrite,
  error,
  selectAllRef,
  onSelectAll,
  onBatchStatusChange,
  onBatchUpdateStatus,
  onBatchDelete,
  onBatchPromote,
  onBatchGraduate,
}: Props) {
  if (!canStudentWrite) {
    return (
      <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded mb-4" role="alert">
        当前角色仅可查看学生信息，写操作入口已隐藏。
      </div>
    );
  }

  return (
    <div className="mb-3">
      <div className="w-full">
        <div className="bg-white rounded-lg shadow">
          <div className="px-4 py-2 border-b border-gray-200 flex justify-between items-center">
            <h5 className="mb-0 text-sm">
              <i className="fas fa-cogs mr-2"></i>批量操作
            </h5>
            <span className={`text-xs px-2 py-0.5 rounded ${selectedCount > 0 ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-600"} ml-2`}>
              已选择 {selectedCount} 个学生
            </span>
          </div>
          <div className="px-4 py-2">
            <div className="flex items-center gap-3">
              <div className="shrink-0">
                <div className="flex items-center gap-2">
                  <input
                    className="rounded border-gray-300"
                    type="checkbox"
                    id="selectAll"
                    checked={allSelected}
                    onChange={onSelectAll}
                    ref={selectAllRef}
                  />
                  <label className="text-sm text-gray-700 whitespace-nowrap" htmlFor="selectAll">
                    全选
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-1">
                <label className="text-sm text-gray-700 whitespace-nowrap">批量修改状态为</label>
                <select
                  className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
                  value={batchStatus}
                  onChange={(e) => onBatchStatusChange(e.target.value)}
                >
                  <option value="">请选择</option>
                  {stats?.status_choices.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div className="shrink-0">
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="bg-yellow-500 text-white text-xs px-2.5 py-1.5 rounded hover:bg-yellow-600 transition-colors whitespace-nowrap"
                    onClick={onBatchUpdateStatus}
                  >
                    <i className="fas fa-edit mr-1"></i>应用状态修改
                  </button>
                  <button
                    type="button"
                    className="bg-red-600 text-white text-xs px-2.5 py-1.5 rounded hover:bg-red-700 transition-colors whitespace-nowrap"
                    onClick={onBatchDelete}
                  >
                    <i className="fas fa-trash mr-1"></i>批量删除
                  </button>
                  <button
                    type="button"
                    className="bg-blue-500 text-white text-xs px-2.5 py-1.5 rounded hover:bg-blue-600 transition-colors whitespace-nowrap"
                    onClick={onBatchPromote}
                  >
                    <i className="fas fa-level-up-alt mr-1"></i>批量升年级
                  </button>
                  <button
                    type="button"
                    className="bg-green-600 text-white text-xs px-2.5 py-1.5 rounded hover:bg-green-700 transition-colors whitespace-nowrap"
                    onClick={onBatchGraduate}
                  >
                    <i className="fas fa-graduation-cap mr-1"></i>批量毕业
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Global error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded mt-3" role="alert">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

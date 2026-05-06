"use client";

interface ScoreBatchBarProps {
  selectedCount: number;
  totalCount: number;
  canScoreWrite: boolean;
  onDeleteSelected: () => void;
  onDeleteFiltered: () => void;
}

export default function ScoreBatchBar({
  selectedCount,
  totalCount,
  canScoreWrite,
  onDeleteSelected,
  onDeleteFiltered,
}: ScoreBatchBarProps) {
  if (!canScoreWrite) return null;

  return (
    <div
      className="bg-white rounded-lg shadow overflow-hidden mb-6"
      style={{
        borderRadius: "15px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
      }}
    >
      <div
        className="px-6 py-4 border-b border-gray-200"
        style={{
          background: "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)",
          borderRadius: "15px 15px 0 0",
        }}
      >
        <h5 className="mb-0">
          <i className="fas fa-tasks mr-2"></i>批量操作
        </h5>
      </div>
      <div className="p-4">
        <div className="flex flex-wrap items-center">
          <div className="w-full md:w-1/2">
            <div className="flex items-center">
              <i className="fas fa-check-square mr-2 text-green-600"></i>
              <span className="font-bold">
                已选择: {selectedCount} / {totalCount} 条记录
              </span>
            </div>
          </div>
          <div className="w-full md:w-1/2 text-right">
            <button
              type="button"
              className="border border-red-300 text-red-600 px-4 py-2 rounded hover:bg-red-50 transition-colors mr-2"
              onClick={onDeleteFiltered}
            >
              <i className="fas fa-filter"></i> 删除筛选结果
            </button>
            <button
              type="button"
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
              onClick={onDeleteSelected}
            >
              <i className="fas fa-trash"></i> 删除选中项
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

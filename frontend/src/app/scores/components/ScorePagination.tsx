"use client";

interface ScorePaginationProps {
  currentPage: number;
  numPages: number;
  pageSize: number;
  totalCount: number;
  startIndex: number;
  endIndex: number;
  pageSizeOptions: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export default function ScorePagination({
  currentPage,
  numPages,
  pageSize,
  totalCount,
  startIndex,
  endIndex,
  pageSizeOptions,
  onPageChange,
  onPageSizeChange,
}: ScorePaginationProps) {
  if (numPages <= 0) return null;

  // Compute visible page range: up to 5 pages centered on current
  const pages: number[] = [];
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(numPages, currentPage + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <nav aria-label="成绩列表分页">
      <div className="flex justify-center gap-1 mt-4">
        <button
          className="px-3 py-1.5 border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          aria-label="首页"
        >
          &laquo;&laquo;
        </button>
        <button
          className="px-3 py-1.5 border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          aria-label="上一页"
        >
          &laquo;
        </button>
        {pages.map((num) => (
          <button
            key={num}
            className={`px-3 py-1.5 border rounded ${
              currentPage === num
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
            onClick={() => onPageChange(num)}
          >
            {num}
          </button>
        ))}
        <button
          className="px-3 py-1.5 border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => onPageChange(Math.min(numPages, currentPage + 1))}
          disabled={currentPage >= numPages}
          aria-label="下一页"
        >
          &raquo;
        </button>
        <button
          className="px-3 py-1.5 border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => onPageChange(numPages)}
          disabled={currentPage >= numPages}
          aria-label="末页"
        >
          &raquo;&raquo;
        </button>
      </div>

      <div className="flex justify-between items-center mt-2 mb-4">
        <small className="text-gray-500">
          显示第 {startIndex} - {endIndex} 条记录，共 {totalCount} 条
        </small>
        <div className="flex items-center">
          <small className="text-gray-500 mr-2">每页显示：</small>
          <select
            className="border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500"
            style={{ width: "auto" }}
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
              onPageChange(1);
            }}
          >
            {(pageSizeOptions || [10, 20, 50, 100]).map((n) => (
              <option key={n} value={n}>
                {n} 条
              </option>
            ))}
          </select>
        </div>
      </div>
    </nav>
  );
}

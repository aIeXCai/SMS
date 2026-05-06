"use client";

interface Props {
  currentPage: number;
  numPages: number;
  onPageChange: (page: number) => void;
}

export default function QueryPagination({ currentPage, numPages, onPageChange }: Props) {
  if (numPages <= 1) return null;

  return (
    <nav aria-label="成绩查询结果分页">
      <div className="flex justify-center gap-1 mt-4 mb-2">
        <button className="px-3 py-1.5 border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={currentPage === 1} onClick={() => onPageChange(1)}>
          <i className="fas fa-angle-double-left"></i> 首页
        </button>
        <button className="px-3 py-1.5 border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={currentPage === 1} onClick={() => onPageChange(Math.max(1, currentPage - 1))}>
          <i className="fas fa-angle-left"></i> 上一页
        </button>
        <span className="px-3 py-1.5 border border-blue-600 rounded bg-blue-600 text-white">
          第 {currentPage} 页，共 {numPages} 页
        </span>
        <button className="px-3 py-1.5 border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={currentPage >= numPages} onClick={() => onPageChange(Math.min(numPages, currentPage + 1))}>
          下一页 <i className="fas fa-angle-right"></i>
        </button>
        <button className="px-3 py-1.5 border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={currentPage >= numPages} onClick={() => onPageChange(numPages)}>
          末页 <i className="fas fa-angle-double-right"></i>
        </button>
      </div>
    </nav>
  );
}

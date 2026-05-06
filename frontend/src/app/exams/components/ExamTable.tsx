"use client";

import Link from "next/link";

type Option = { value: string; label: string };
type ExamOptions = { academic_years: Option[]; grade_levels: Option[] };

type Exam = {
  id: number;
  name: string;
  academic_year: string;
  grade_level: string;
  date: string;
  description: string;
};

interface Props {
  exams: Exam[];
  options: ExamOptions | null;
  totalCount: number;
  currentPage: number;
  pageSize: number;
  isLoading: boolean;
  canExamWrite: boolean;
  selectedIds: Set<number>;
  onSelectAll: () => void;
  onSelectOne: (id: number) => void;
  onBatchDelete: () => void;
  onSetCurrentPage: (page: number) => void;
  onDeleteRequest: (data: { id: number; name: string }) => void;
}

export default function ExamTable({
  exams,
  options,
  totalCount,
  currentPage,
  pageSize,
  isLoading,
  canExamWrite,
  selectedIds,
  onSelectAll,
  onSelectOne,
  onBatchDelete,
  onSetCurrentPage,
  onDeleteRequest,
}: Props) {
  const selectedCount = selectedIds.size;

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="bg-white px-4 py-3 border-b flex justify-between items-center">
        <h5 className="mb-0 font-bold text-gray-900">
          <i className="fas fa-list mr-2 text-blue-600"></i>考试列表
        </h5>
        {selectedCount > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-blue-600 font-medium">{selectedCount} 个考试已选择</span>
            <button
              type="button"
              className="bg-red-600 text-white text-xs px-3 py-1.5 rounded hover:bg-red-700 transition-colors"
              onClick={onBatchDelete}
            >
              <i className="fas fa-trash mr-1"></i>全部删除
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="text-center p-5 text-gray-500">
          <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" role="status">
            <span className="sr-only">加载中...</span>
          </div>
        </div>
      ) : exams.length > 0 ? (
        <div className="app-table-wrapper">
          <div className="app-table-scroll">
            <table className="app-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                      checked={selectedCount === exams.length}
                      onChange={onSelectAll}
                    />
                  </th>
                  <th><i className="fas fa-calendar-alt mr-1"></i>学年</th>
                  <th><i className="fas fa-tag mr-1"></i>考试名称</th>
                  <th><i className="fas fa-users mr-1"></i>适用年级</th>
                  <th><i className="fas fa-clock mr-1"></i>考试日期</th>
                  <th><i className="fas fa-info-circle mr-1"></i>考试描述</th>
                  <th><i className="fas fa-cogs mr-1"></i>操作</th>
                </tr>
              </thead>
              <tbody>
                {exams.map(exam => (
                  <tr key={exam.id}>
                    <td>
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
                        checked={selectedIds.has(exam.id)}
                        onChange={() => onSelectOne(exam.id)}
                      />
                    </td>
                    <td>
                      <span className="inline-block rounded-full px-3 py-2 text-xs" style={{ background: '#c8eee8', color: '#01876c', border: '1px solid #8cd4c4', fontSize: '0.9rem' }}>{exam.academic_year}</span>
                    </td>
                    <td>
                      <span className="font-bold" style={{ color: '#1e2a25' }}>{exam.name}</span>
                    </td>
                    <td>
                      <span className="inline-block rounded-full px-3 py-2 text-xs" style={{ background: '#d4e8fc', color: '#0369a1', border: '1px solid #a0c4e8', fontSize: '0.9rem' }}>
                        {options?.grade_levels.find(g => g.value === exam.grade_level)?.label || exam.grade_level}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: '#1e2a25' }}>
                        <i className="fas fa-calendar mr-1" style={{ color: '#5a6b63' }}></i>
                        {exam.date ? exam.date.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$1年$2月$3日') : ''}
                      </span>
                    </td>
                    <td>
                      <span style={{ maxWidth: '200px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: '0 auto', color: '#1e2a25', fontSize: '0.85rem' }}>
                        {exam.description || "暂无描述"}
                      </span>
                    </td>
                    <td>
                      {canExamWrite ? (
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <Link href={`/exams/${exam.id}/edit`} className="text-sm px-2 py-1 rounded" style={{ background: '#b8ddd5', color: '#015a4a', border: '1px solid #8cd4c4' }} title="编辑考试">
                            <i className="fas fa-edit"></i>
                          </Link>
                          <button
                            type="button"
                            className="text-sm px-2 py-1 rounded"
                            style={{ background: '#fecaca', color: '#b91c1c', border: '1px solid #fca5a5' }}
                            title="删除考试"
                            onClick={() => onDeleteRequest({ id: exam.id, name: exam.name })}
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-500">只读</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '14px 16px', borderTop: '1px solid #e2e8e5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafcfb', borderRadius: '0 0 15px 15px' }}>
            <span style={{ color: '#8fa398', fontSize: '0.82rem' }}>共 {totalCount} 条记录</span>
            <div>
              <button className="text-sm px-2 py-1 rounded bg-white text-gray-600 border border-gray-200 mr-2 disabled:opacity-50" disabled={currentPage === 1} onClick={() => onSetCurrentPage(currentPage - 1)}>上一页</button>
              <span style={{ color: '#5a6b63', fontSize: '0.82rem', marginRight: '8px' }}>第 {currentPage} 页</span>
              <button className="text-sm px-2 py-1 rounded bg-white text-gray-600 border border-gray-200 disabled:opacity-50" disabled={currentPage * pageSize >= totalCount} onClick={() => onSetCurrentPage(currentPage + 1)}>下一页</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-5 text-gray-500">
          <i className="fas fa-clipboard-list mb-3 opacity-25" style={{ fontSize: '4rem' }}></i>
          <h5 className="font-bold mb-2">暂无考试记录</h5>
          <p className="text-sm mb-4">还没有创建任何考试，点击上方按钮开始创建第一个考试吧！</p>
          {canExamWrite && (
            <Link href="/exams/create" className="bg-blue-600 text-white px-4 py-2 rounded-full shadow-sm hover:bg-blue-700 transition-colors">
              <i className="fas fa-plus mr-2"></i>创建第一个考试
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

interface Props {
  examName: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function DeleteExamModal({ examName, onCancel, onConfirm }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        <div className="flex items-center justify-between bg-red-600 text-white px-6 py-4" style={{ borderRadius: '15px 15px 0 0' }}>
          <h5 className="font-bold mb-0">
            <i className="fas fa-exclamation-triangle mr-2"></i>确认删除考试
          </h5>
          <button type="button" aria-label="关闭" className="bg-transparent border-none text-white opacity-70 hover:opacity-100 text-xl cursor-pointer" onClick={onCancel}>&times;</button>
        </div>
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded flex mb-0">
            <i className="fas fa-exclamation-triangle text-2xl mr-3 mt-1"></i>
            <div>
              <h6 className="font-bold mb-2">危险操作警告</h6>
              <p className="mb-2">确定要删除考试 <strong>&quot;{examName}&quot;</strong> 吗？</p>
              <small className="opacity-75">此操作将同时删除该考试的所有成绩记录，且不可撤销！</small>
            </div>
          </div>
        </div>
        <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3" style={{ borderRadius: '0 0 15px 15px' }}>
          <button type="button" className="bg-white border border-gray-300 px-4 py-2 rounded shadow-sm hover:bg-gray-50 transition-colors" onClick={onCancel}>取消</button>
          <button type="button" className="bg-red-600 text-white px-4 py-2 rounded shadow-sm hover:bg-red-700 transition-colors" onClick={onConfirm}>
            <i className="fas fa-trash mr-2"></i>确认删除
          </button>
        </div>
      </div>
    </div>
  );
}

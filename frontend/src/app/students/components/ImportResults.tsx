"use client";

interface FailedRow {
  row: number;
  error: string;
}

interface ImportResults {
  success: boolean;
  imported_count: number;
  failed_count: number;
  success_messages: string[];
  error_messages: string[];
  warning_messages: string[];
  failed_rows: FailedRow[];
  message?: string;
}

interface Props {
  importResults: ImportResults;
  onComplete: () => void;
}

export default function ImportResults({ importResults, onComplete }: Props) {
  const isSuccess = importResults.success;
  const alertClass = isSuccess
    ? "bg-green-50 border border-green-200 text-green-800 p-4 rounded-lg shadow-sm mb-4"
    : "bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg shadow-sm mb-4";

  return (
    <div className="animation-fade-in">
      <div className={alertClass}>
        <h4 className={`font-bold mb-3 flex items-center ${isSuccess ? 'text-green-600' : 'text-red-600'}`}>
          <i className={`fas ${isSuccess ? 'fa-check-circle' : 'fa-times-circle'} mr-2`}></i>
          {isSuccess ? '导入完成！' : '导入失败！'}
        </h4>
        <div className="p-3 bg-white/50 rounded" style={{ fontSize: '1.05rem' }}>
          <div className="flex items-center mb-2">
            <i className="fas fa-check text-green-600 mr-2"></i>
            <span>成功导入 <strong className="text-lg text-green-600">{importResults.imported_count}</strong> 条学生记录</span>
          </div>
          {importResults.failed_count > 0 && (
            <div className="flex items-center">
              <i className="fas fa-times text-red-600 mr-2"></i>
              <span>失败记录 <strong className="text-lg text-red-600">{importResults.failed_count}</strong> 条</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap">
        {importResults.failed_rows && importResults.failed_rows.length > 0 && (
          <div className="w-full mb-4">
            <div className="bg-white rounded-lg shadow-sm border border-red-300 overflow-hidden">
              <div className="bg-red-600 text-white px-4 py-2">
                <h6 className="mb-0 font-bold"><i className="fas fa-times mr-2"></i>失败详情</h6>
              </div>
              <div className="p-0" style={{ maxHeight: "250px", overflowY: "auto" }}>
                <table className="w-full border-collapse [&_tr:hover]:bg-gray-50 text-sm mb-0">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-center border-b border-gray-200 py-2" style={{ width: '80px' }}>Excel行号</th>
                      <th className="border-b border-gray-200 py-2">失败原因</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importResults.failed_rows.map((fr, idx) => (
                      <tr key={idx}>
                        <td className="text-center font-bold text-gray-500 border-r border-gray-200 py-2 align-middle">{fr.row}</td>
                        <td className="text-red-600 text-sm py-2 align-middle" style={{ whiteSpace: 'pre-wrap' }}>{fr.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {importResults.warning_messages && importResults.warning_messages.length > 0 && (
          <div className="w-full">
            <div className="bg-white rounded-lg shadow-sm border border-yellow-300 overflow-hidden">
              <div className="bg-yellow-500 text-gray-900 px-4 py-2">
                <h6 className="mb-0 font-bold"><i className="fas fa-exclamation-triangle mr-2"></i>警告信息 (已处理但需留意)</h6>
              </div>
              <div className="p-3 bg-gray-50" style={{ maxHeight: "200px", overflowY: "auto" }}>
                {importResults.warning_messages.map((wm, idx) => (
                  <div key={idx} className="text-gray-900 text-sm mb-2 pb-2 border-b border-yellow-200 flex">
                    <i className="fas fa-circle text-yellow-500 mt-1 mr-2" style={{fontSize: '6px'}}></i>
                    <span>{wm}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="text-center mt-4 pt-3 border-t">
        <button
          type="button"
          className="bg-blue-600 text-white px-5 py-3 rounded-full shadow hover:bg-blue-700 transition-all text-lg"
          onClick={onComplete}
        >
          完成并刷新数据
        </button>
      </div>
    </div>
  );
}

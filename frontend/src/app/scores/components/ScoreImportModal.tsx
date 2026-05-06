"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { ScoreOptions, ImportResult } from "../types";

interface ScoreImportModalProps {
  visible: boolean;
  options: ScoreOptions | null;
  onClose: () => void;
  onImportSuccess: () => void;
  onShowResult: (type: "success" | "error", title: string, subtitle: string, message: string) => void;
}

export default function ScoreImportModal({
  visible, options, onClose, onImportSuccess, onShowResult,
}: ScoreImportModalProps) {
  const [importExam, setImportExam] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  if (!visible) return null;

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    window.URL.revokeObjectURL(url);
  };

  const downloadTemplate = async () => {
    try {
      const res = await api.downloadBlob('/scores/download-template/');
      if (!res.ok) { onShowResult("error", "下载失败", "模板下载失败", "模板下载失败"); return; }
      downloadBlob(await res.blob(), "score_import_template.xlsx");
      onShowResult("success", "下载成功", "模板已下载", "模板文件已成功下载。请按模板填写后再导入。");
    } catch (e) { console.error(e); onShowResult("error", "下载失败", "模板下载失败", "模板下载失败"); }
  };

  const validateImport = (): string | null => {
    if (!importExam) return "请选择考试";
    if (!importFile) return "请选择Excel文件";
    const ext = importFile.name.split(".").pop()?.toLowerCase();
    if (!ext || !["xlsx", "xls"].includes(ext)) return "请选择有效的Excel文件（.xlsx或.xls）";
    return null;
  };

  const handleBatchImport = async () => {
    const error = validateImport();
    if (error) { onShowResult("error", "导入提示", "缺少必要信息", error); return; }
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("exam", importExam);
      formData.append("excel_file", importFile!);
      const data = await api.upload<{ success: boolean; message: string; imported_count: number; failed_count: number; execution_time?: number; error_details?: Array<{ row: number; student_id: string; student_name: string; errors: string[] }> }>('/scores/batch-import/', formData);
      setImportResult({
        success: !!data.success, message: data.message || "导入完成",
        imported_count: data.imported_count || 0, failed_count: data.failed_count || 0,
        execution_time: data.execution_time, error_details: data.error_details || [],
      });
      if (data.success) onImportSuccess();
      setImportExam(""); setImportFile(null);
    } catch (e) { console.error(e); setImportResult({ success: false, message: "网络错误，请稍后重试", imported_count: 0, failed_count: 0 }); }
    finally { setUploading(false); }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.currentTarget !== e.target) return;
    if (importResult) setImportResult(null);
    onClose();
  };

  const resetAndClose = () => {
    setImportResult(null);
    onClose();
  };

  // Import result display
  if (importResult) {
    const isSuccess = importResult.success;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} onClick={handleOverlayClick}>
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 overflow-hidden">
          <div className={`flex items-center justify-between px-6 py-4 border-b ${isSuccess ? "bg-green-600" : "bg-red-600"}`}>
            <h5 className="font-bold text-white text-lg">
              <i className={`fas ${isSuccess ? "fa-check-circle" : "fa-exclamation-triangle"} mr-2`}></i>导入结果
            </h5>
            <button type="button" className="text-white opacity-70 hover:opacity-100 bg-transparent border-none text-xl cursor-pointer" onClick={resetAndClose}>&times;</button>
          </div>
          <div className="p-6">
            {isSuccess ? (
              <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded">
                <h5 className="font-bold"><i className="fas fa-check-circle"></i> 导入成功！</h5>
                <p>成功导入 <strong>{importResult.imported_count}</strong> 个学生{importResult.failed_count > 0 && <>，失败 <strong>{importResult.failed_count}</strong> 个</>}</p>
                {importResult.execution_time !== undefined && <p><i className="fas fa-clock"></i> 执行时间: <strong>{importResult.execution_time}秒</strong></p>}
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded">
                <h5 className="font-bold"><i className="fas fa-exclamation-circle"></i> 导入失败！</h5>
                <p>{importResult.message}</p>
              </div>
            )}
            {!!importResult.error_details?.length && (
              <div className="overflow-x-auto mt-4" style={{ maxHeight: "280px", overflowY: "auto" }}>
                <table className="w-full border-collapse [&_tr:nth-child(even)]:bg-gray-50 text-sm">
                  <thead className="bg-gray-800 text-white"><tr><th>行号</th><th>学号</th><th>学生姓名</th><th>失败原因</th></tr></thead>
                  <tbody>
                    {importResult.error_details.map((error) => (
                      <tr key={`${error.row}_${error.student_id}`}>
                        <td>{error.row}</td><td>{error.student_id || "-"}</td><td>{error.student_name || "-"}</td>
                        <td><ul className="mb-0 list-none p-0">{error.errors.map((msg, idx) => <li key={idx}>{msg}</li>)}</ul></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
            <button type="button" className={`px-4 py-2 rounded text-white ${isSuccess ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"} transition-colors`}
              onClick={resetAndClose}>
              <i className={`fas ${isSuccess ? "fa-check" : "fa-redo"} mr-2`}></i>关闭
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Import form
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} onClick={handleOverlayClick}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ background: 'linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%)' }}>
          <h5 className="font-bold text-gray-900 text-lg">
            <i className="fas fa-upload mr-2 text-green-600"></i>批量导入成绩 (Excel)
          </h5>
          <button type="button" className="text-gray-600 opacity-50 hover:opacity-80 bg-transparent border-none text-xl cursor-pointer" onClick={onClose}>&times;</button>
        </div>

        <div className="p-6">
          {/* Row: select exam + select file */}
          <div className="flex gap-4 mb-4">
            <div style={{ flex: 1 }}>
              <label className="block text-sm font-medium text-gray-700 mb-1">选择考试 <span className="text-red-600">*</span></label>
              <select className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" value={importExam} onChange={(e) => setImportExam(e.target.value)}>
                <option value="">--- 请选择考试 ---</option>
                {options?.exams.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label className="block text-sm font-medium text-gray-700 mb-1">选择Excel文件 <span className="text-red-600">*</span></label>
              <input type="file" className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" accept=".xlsx,.xls"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded">
            <i className="fas fa-info-circle"></i><strong> 使用说明：</strong>
            <ul className="mb-0 mt-2 list-none p-0 space-y-1">
              <li>请确保Excel文件格式正确，第一行为标题行</li>
              <li>必须包含&ldquo;学号&rdquo;和&ldquo;学生姓名&rdquo;列</li>
              <li>科目列名必须与系统中的科目名称完全一致</li>
              <li><button type="button" className="bg-transparent border-none p-0 text-blue-600 underline cursor-pointer" onClick={downloadTemplate}>
                <i className="fas fa-download"></i> 下载模板文件</button></li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
          <button type="button" className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors" onClick={onClose}>取消</button>
          <button type="button" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={uploading} onClick={handleBatchImport}>
            {uploading ? <><i className="fas fa-spinner fa-spin"></i> 上传中...</> : <><i className="fas fa-upload"></i> 开始上传</>}
          </button>
        </div>
      </div>
    </div>
  );
}

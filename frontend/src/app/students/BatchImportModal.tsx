import React, { useState, useRef } from "react";
import { api } from "@/lib/api";
import ImportInstructions from "./components/ImportInstructions";
import ImportResults from "./components/ImportResults";

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

interface BatchImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BatchImportModal({ isOpen, onClose, onSuccess }: BatchImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importResults, setImportResults] = useState<ImportResults | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await api.downloadBlob('/students/download-template/');
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "student_import_template.xlsx";
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        alert("下载模板失败");
      }
    } catch (err) {
      console.error(err);
      alert("下载模板出错");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setErrorMsg("请先选择一个包含学生信息的 Excel 文件");
      return;
    }
    setIsSubmitting(true);
    setErrorMsg("");
    setImportResults(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const data = await api.upload<ImportResults>('/students/batch-import/', formData);
      if (data.success) {
        setImportResults(data);
      } else {
        setErrorMsg(data.message || "上传或处理失败，请检查文件格式。");
      }
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg("网络异常或服务器错误");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetStateAndClose = () => {
    setFile(null);
    setImportResults(null);
    setErrorMsg("");
    setIsSubmitting(false);
    onClose();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center" style={{ backgroundColor: "rgba(0,0,0,0.6)" }} tabIndex={-1} role="dialog">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 mt-[5vh] overflow-hidden" style={{ borderLeft: '4px solid #28a745' }}>
        {/* kept because: gradient background */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ background: 'linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%)' }}>
          <h5 className="font-bold text-gray-900 mb-0">
            <i className="fas fa-file-import mr-2 text-green-600"></i>
            批量导入学生
          </h5>
          <button type="button" className="bg-transparent border-none text-xl leading-none opacity-50 hover:opacity-80 cursor-pointer" onClick={resetStateAndClose} aria-label="Close">&times;</button>
        </div>

        <div className="p-8">
          {!importResults && (
            <>
              <ImportInstructions onDownloadTemplate={handleDownloadTemplate} />

              {errorMsg && (
                <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg flex items-center mb-4 shadow-sm">
                  <i className="fas fa-exclamation-triangle mr-3 text-2xl"></i>
                  <div>{errorMsg}</div>
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div
                  className={`file-upload-area p-5 mb-4 text-center ${file ? 'has-file' : ''}`}
                  style={{
                    border: '2px dashed #28a745',
                    borderRadius: '10px',
                    backgroundColor: file ? '#e9ecef' : '#f8f9fa',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer'
                  }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    className="hidden"
                    accept=".xlsx, .xls"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                  />
                  {!file ? (
                    <>
                      <i className="fas fa-cloud-upload-alt fa-3x text-green-600 mb-3 opacity-75"></i>
                      <h5 className="mb-2 text-gray-900">点击或拖拽选择文件</h5>
                      <p className="text-gray-500 text-sm mb-0">支持 .xlsx 或 .xls 格式</p>
                    </>
                  ) : (
                    <div className="text-green-600 scale-in">
                      <i className="fas fa-file-excel fa-3x mb-3"></i>
                      <h5 className="text-gray-900 mb-1 font-bold">{file.name}</h5>
                      <p className="text-gray-500 text-sm mb-0">{formatFileSize(file.size)}</p>
                    </div>
                  )}
                </div>

                <div className="text-center mt-4">
                  <button
                    type="submit"
                    className="rounded-full shadow px-5 text-lg py-3 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)', border: 'none', minWidth: '200px' }}
                    disabled={isSubmitting || !file}
                  >
                    {isSubmitting ? (
                      <>
                        <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full inline-block mr-2 align-middle" role="status" aria-hidden="true"></span>
                        处理中...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-upload mr-2"></i>开始导入
                      </>
                    )}
                  </button>
                  <button type="button" className="bg-white border border-gray-300 px-5 py-3 rounded-full shadow-sm text-lg ml-3 hover:bg-gray-50 transition-colors" onClick={resetStateAndClose}>
                    取消
                  </button>
                </div>
              </form>
            </>
          )}

          {importResults && (
            <ImportResults
              importResults={importResults}
              onComplete={() => { onSuccess(); resetStateAndClose(); }}
            />
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .file-upload-area:hover { border-color: #20c997 !important; background-color: #e9ecef !important; }
        .file-upload-area.has-file { border-color: #28a745 !important; }
        .transition-all { transition: all 0.3s ease; }
        .transition-all:hover { transform: translateY(-2px); box-shadow: 0 .5rem 1rem rgba(0,0,0,.15)!important; }
        .animation-fade-in { animation: fadeIn 0.4s ease-out; }
        .scale-in { animation: scaleIn 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
      `}} />
    </div>
  );
}

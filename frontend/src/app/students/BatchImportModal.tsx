import React, { useState, useRef } from "react";

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
  backendBaseUrl: string;
  authHeader: HeadersInit | undefined;
}

export default function BatchImportModal({ isOpen, onClose, onSuccess, backendBaseUrl, authHeader }: BatchImportModalProps) {
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
      const res = await fetch(`${backendBaseUrl}/api/students/download-template/`, {
        method: "GET",
        headers: { ...authHeader }
      });
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
      const res = await fetch(`${backendBaseUrl}/api/students/batch-import/`, {
        method: "POST",
        headers: {
          ...authHeader,
        },
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setImportResults(data);
      } else {
        setErrorMsg(data.message || "上传或处理失败，请检查文件格式。");
      }
    } catch (err: any) {
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
    <div className="modal d-block" style={{ backgroundColor: "rgba(0,0,0,0.6)", position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1050 }} tabIndex={-1} role="dialog">
      <div className="modal-dialog modal-lg modal-dialog-centered" role="document" style={{ marginTop: '5vh' }}>
        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '15px', overflow: 'hidden', borderLeft: '4px solid #28a745' }}>
          <div className="modal-header border-bottom" style={{ background: 'linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%)', padding: '1.5rem' }}>
            <h5 className="modal-title fw-bold text-dark mb-0">
              <i className="fas fa-file-import me-2 text-success"></i>
              批量导入学生
            </h5>
            <button type="button" className="btn-close" onClick={resetStateAndClose} aria-label="Close"></button>
          </div>
          
          <div className="modal-body" style={{ padding: '2rem' }}>
            {!importResults && (
              <>
                <div className="alert border mb-4" style={{ background: 'linear-gradient(135deg, #d1ecf1 0%, #bee5eb 100%)', borderColor: '#bee5eb', borderRadius: '10px', padding: '1.5rem' }}>
                   <div className="d-flex align-items-start">
                     <i className="fas fa-info-circle me-3" style={{ fontSize: '2rem', color: '#0c5460' }}></i>
                     <div>
                      <h6 className="alert-heading fw-bold mb-2 text-dark">导入说明</h6>
                      <ul className="mb-0 ps-3 lh-lg text-dark small" style={{ opacity: 0.9 }}>
                        <li>请先下载系统提供的标准 <strong>Excel 模板文件</strong>。</li>
                        <li><strong>学号</strong> 和 <strong>姓名</strong> 为必填项。</li>
                        <li>若系统已存在相同学号，将执行<strong>更新操作</strong>。</li>
                        <li>日期格式确保为 <strong>YYYY-MM-DD</strong>。</li>
                      </ul>
                     </div>
                   </div>
                </div>

                <div className="mb-4 text-center" style={{ background: 'linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%)', border: '1px solid #ffeaa7', borderRadius: '10px', padding: '1.5rem' }}>
                  <button 
                    type="button" 
                    onClick={handleDownloadTemplate}
                    className="btn btn-warning fw-bold text-dark shadow-sm px-4 rounded-pill transition-all"
                  >
                    <i className="fas fa-download me-2"></i>下载导入模板
                  </button>
                </div>

                {errorMsg && (
                  <div className="alert alert-danger border-0 rounded-3 d-flex align-items-center mb-4 shadow-sm">
                    <i className="fas fa-exclamation-triangle me-3 fs-4"></i>
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
                      className="d-none" 
                      accept=".xlsx, .xls"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                    />
                    
                    {!file ? (
                      <>
                        <i className="fas fa-cloud-upload-alt fa-3x text-success mb-3 opacity-75"></i>
                        <h5 className="mb-2 text-dark">点击或拖拽选择文件</h5>
                        <p className="text-muted small mb-0">支持 .xlsx 或 .xls 格式</p>
                      </>
                    ) : (
                      <div className="text-success scale-in">
                        <i className="fas fa-file-excel fa-3x mb-3"></i>
                        <h5 className="text-dark mb-1 fw-bold">{file.name}</h5>
                        <p className="text-muted small mb-0">{formatFileSize(file.size)}</p>
                      </div>
                    )}
                  </div>

                  <div className="text-center mt-4">
                    <button 
                      type="submit" 
                      className="btn btn-success btn-lg rounded-pill shadow px-5"
                      style={{ background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)', border: 'none', minWidth: '200px' }}
                      disabled={isSubmitting || !file}
                    >
                      {isSubmitting ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                          处理中...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-upload me-2"></i>开始导入
                        </>
                      )}
                    </button>
                    <button type="button" className="btn btn-light btn-lg rounded-pill shadow-sm px-5 ms-3 border" onClick={resetStateAndClose}>
                      取消
                    </button>
                  </div>
                </form>
              </>
            )}

            {/* 导入结果展示 */}
            {importResults && (
              <div className="animation-fade-in">
                <div className={`alert ${importResults.success ? 'alert-success' : 'alert-danger'} border-0 shadow-sm rounded-3 mb-4`}>
                  <h4 className={`alert-heading mb-3 ${importResults.success ? 'text-success' : 'text-danger'} fw-bold d-flex align-items-center`}>
                    <i className={`fas ${importResults.success ? 'fa-check-circle' : 'fa-times-circle'} me-2`}></i>
                    {importResults.success ? '导入完成！' : '导入失败！'}
                  </h4>
                  <div className="p-3 bg-white bg-opacity-50 rounded" style={{ fontSize: '1.05rem' }}>
                    <div className="d-flex align-items-center mb-2">
                      <i className="fas fa-check text-success me-2"></i>
                      <span>成功导入 <strong className="fs-5 text-success">{importResults.imported_count}</strong> 条学生记录</span>
                    </div>
                    {importResults.failed_count > 0 && (
                      <div className="d-flex align-items-center">
                        <i className="fas fa-times text-danger me-2"></i>
                        <span>失败记录 <strong className="fs-5 text-danger">{importResults.failed_count}</strong> 条</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="row">
                  {importResults.failed_rows && importResults.failed_rows.length > 0 && (
                    <div className="col-12 mb-4">
                      <div className="card border-danger shadow-sm">
                        <div className="card-header bg-danger text-white py-2">
                          <h6 className="mb-0 fw-bold"><i className="fas fa-times me-2"></i>失败详情</h6>
                        </div>
                        <div className="card-body p-0" style={{ maxHeight: "250px", overflowY: "auto" }}>
                          <table className="table table-sm table-hover mb-0">
                            <thead className="table-light sticky-top">
                              <tr>
                                <th className="text-center border-bottom bg-light" style={{ width: '80px' }}>Excel行号</th>
                                <th className="border-bottom bg-light">失败原因</th>
                              </tr>
                            </thead>
                            <tbody>
                              {importResults.failed_rows.map((fr, idx) => (
                                <tr key={idx}>
                                  <td className="text-center fw-bold text-muted border-end align-middle">{fr.row}</td>
                                  <td className="text-danger small align-middle" style={{ whiteSpace: 'pre-wrap' }}>{fr.error}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {importResults.warning_messages && importResults.warning_messages.length > 0 && (
                    <div className="col-12">
                      <div className="card border-warning shadow-sm">
                        <div className="card-header bg-warning text-dark py-2">
                          <h6 className="mb-0 fw-bold"><i className="fas fa-exclamation-triangle me-2"></i>警告信息 (已处理但需留意)</h6>
                        </div>
                        <div className="card-body p-3 bg-light" style={{ maxHeight: "200px", overflowY: "auto" }}>
                          {importResults.warning_messages.map((wm, idx) => (
                            <div key={idx} className="text-dark small mb-2 lh-base border-bottom pb-2 border-warning border-opacity-25 d-flex">
                              <i className="fas fa-circle text-warning mt-1 me-2" style={{fontSize: '6px'}}></i>
                              <span>{wm}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="text-center mt-4 pt-3 border-top">
                  <button 
                    type="button" 
                    className="btn btn-primary btn-lg px-5 rounded-pill shadow transition-all" 
                    onClick={() => { onSuccess(); resetStateAndClose(); }}
                  >
                    完成并刷新数据
                  </button>
                </div>
              </div>
            )}
          </div>
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

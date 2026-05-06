"use client";

import type { ResultModalState } from "../types";

interface ScoreConfirmModalProps {
  mode: "delete" | "result";
  visible: boolean;
  selectedCount?: number;
  onConfirmDelete?: () => void;
  onCancelDelete?: () => void;
  result?: ResultModalState;
  onCloseResult?: () => void;
}

export default function ScoreConfirmModal({
  mode, visible, selectedCount = 0, onConfirmDelete, onCancelDelete, result, onCloseResult,
}: ScoreConfirmModalProps) {
  if (!visible) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.currentTarget !== e.target) return;
    if (mode === "delete" && onCancelDelete) onCancelDelete();
    if (mode === "result" && onCloseResult) onCloseResult();
  };

  if (mode === "delete") {
    return (
      <div className="custom-modal show" onClick={handleOverlayClick}>
        <div className="modal-content">
          <div className="modal-header error">
            <h5 className="modal-title"><i className="fas fa-exclamation-triangle mr-2"></i>确认批量删除</h5>
            <button type="button" className="close" onClick={onCancelDelete}><i className="fas fa-times"></i></button>
          </div>
          <div className="modal-body">
            <div className="icon error"><i className="fas fa-trash"></i></div>
            <h6>危险操作警告</h6>
            <p>您即将删除选中的 {selectedCount} 条成绩记录。<br />此操作不可逆，请谨慎操作！</p>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-modal btn-primary" onClick={onCancelDelete}><i className="fas fa-times mr-2"></i>取消</button>
            <button type="button" className="btn-modal btn-danger" onClick={onConfirmDelete}><i className="fas fa-trash mr-2"></i>确认删除</button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "result" && result) {
    const isSuccess = result.type === "success";
    return (
      <div className="custom-modal show" onClick={handleOverlayClick}>
        <div className="modal-content">
          <div className={`modal-header ${result.type}`}>
            <h5 className="modal-title">
              <i className={`fas ${isSuccess ? "fa-check" : "fa-exclamation-triangle"} mr-2`}></i>{result.title}
            </h5>
            <button type="button" className="close" onClick={onCloseResult}><i className="fas fa-times"></i></button>
          </div>
          <div className="modal-body">
            <div className={`icon ${result.type}`}>
              <i className={`fas ${isSuccess ? "fa-check" : "fa-exclamation-triangle"}`}></i>
            </div>
            <h6>{result.subtitle}</h6>
            <p style={{ whiteSpace: "pre-line" }}>{result.message}</p>
          </div>
          <div className="modal-footer">
            <button type="button" className={`btn-modal ${isSuccess ? "btn-success" : "btn-primary"}`} onClick={onCloseResult}>
              <i className={`fas ${isSuccess ? "fa-check" : "fa-redo"} mr-2`}></i>{isSuccess ? "确定" : "重试"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

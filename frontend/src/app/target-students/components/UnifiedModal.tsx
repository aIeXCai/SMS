"use client";

type UnifiedModalVariant = "success" | "error" | "warning" | "info";

type UnifiedModalProps = {
  open: boolean;
  variant?: UnifiedModalVariant;
  title: string;
  subtitle?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

const variantIconMap: Record<UnifiedModalVariant, string> = {
  success: "fa-check-circle",
  error: "fa-exclamation-triangle",
  warning: "fa-exclamation-circle",
  info: "fa-circle-info",
};

export default function UnifiedModal({
  open,
  variant = "info",
  title,
  subtitle,
  message,
  confirmText = "确定",
  cancelText = "取消",
  showCancel = false,
  onConfirm,
  onClose,
}: UnifiedModalProps) {
  if (!open) return null;

  const iconClass = variantIconMap[variant];

  return (
    <>
      <div className="ts-modal show" onClick={(e) => e.currentTarget === e.target && onClose()}>
        <div className="ts-modal-content">
          <div className={`ts-modal-header ${variant}`}>
            <h5 className="ts-modal-title">
              <i className={`fas ${iconClass} me-2`}></i>
              {title}
            </h5>
            <button type="button" className="ts-modal-close" onClick={onClose} aria-label="关闭">
              <i className="fas fa-times"></i>
            </button>
          </div>
          <div className="ts-modal-body">
            {subtitle ? <h6>{subtitle}</h6> : null}
            {message ? <p style={{ whiteSpace: "pre-line" }}>{message}</p> : null}
          </div>
          <div className="ts-modal-footer">
            {showCancel ? (
              <button type="button" className="ts-btn-modal ts-btn-cancel" onClick={onClose}>
                <i className="fas fa-times me-2"></i>
                {cancelText}
              </button>
            ) : null}
            <button
              type="button"
              className={`ts-btn-modal ${variant === "success" ? "ts-btn-success" : variant === "error" ? "ts-btn-danger" : "ts-btn-primary"}`}
              onClick={onConfirm}
            >
              <i className={`fas ${showCancel ? "fa-check" : "fa-circle-check"} me-2`}></i>
              {confirmText}
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .ts-modal {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.45);
          z-index: 2000;
          animation: tsFadeIn 0.2s ease;
        }

        .ts-modal-content {
          width: min(560px, calc(100vw - 2rem));
          background: #fff;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 12px 36px rgba(0, 0, 0, 0.25);
          animation: tsSlideIn 0.25s ease;
        }

        .ts-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.25rem;
          color: #fff;
          background: linear-gradient(135deg, #17a2b8, #138496);
        }

        .ts-modal-header.success {
          background: linear-gradient(135deg, #28a745, #20c997);
        }

        .ts-modal-header.error {
          background: linear-gradient(135deg, #dc3545, #c82333);
        }

        .ts-modal-header.warning {
          background: linear-gradient(135deg, #fd7e14, #e8590c);
        }

        .ts-modal-header.info {
          background: linear-gradient(135deg, #007bff, #0056b3);
        }

        .ts-modal-title {
          margin: 0;
          font-size: 1.05rem;
          font-weight: 700;
        }

        .ts-modal-close {
          border: none;
          background: transparent;
          color: #fff;
          cursor: pointer;
          font-size: 1rem;
          opacity: 0.9;
        }

        .ts-modal-close:hover {
          opacity: 1;
        }

        .ts-modal-body {
          padding: 1.25rem;
          color: #495057;
          line-height: 1.6;
        }

        .ts-modal-body h6 {
          font-size: 1rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
        }

        .ts-modal-body p {
          margin-bottom: 0;
          color: #6c757d;
        }

        .ts-modal-footer {
          display: flex;
          justify-content: center;
          gap: 0.75rem;
          padding: 0.9rem 1.25rem 1.25rem;
          background: #f8f9fa;
        }

        .ts-btn-modal {
          border: none;
          border-radius: 999px;
          padding: 0.6rem 1.25rem;
          font-weight: 600;
          color: #fff;
          cursor: pointer;
        }

        .ts-btn-primary {
          background: linear-gradient(135deg, #007bff, #0056b3);
        }

        .ts-btn-success {
          background: linear-gradient(135deg, #28a745, #20c997);
        }

        .ts-btn-danger {
          background: linear-gradient(135deg, #dc3545, #c82333);
        }

        .ts-btn-cancel {
          background: linear-gradient(135deg, #6c757d, #5a6268);
        }

        @keyframes tsFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes tsSlideIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}

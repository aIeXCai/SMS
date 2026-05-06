import type { ResultModalState, DuplicateInfo } from "../types";

type Props = {
  modal: ResultModalState;
  duplicateInfo: DuplicateInfo | null;
  onClose: () => void;
};

export default function ResultModal({ modal, duplicateInfo, onClose }: Props) {
  if (!modal.show) return null;

  return (
    <>
      <div
        className="custom-modal show"
        onClick={(e) => e.currentTarget === e.target && onClose()}
      >
        <div className="modal-content">
          <div className={`modal-header ${modal.type}`}>
            <h5>
              <i
                className={`fas ${
                  modal.type === "success" ? "fa-check" : "fa-exclamation-triangle"
                } mr-2`}
              ></i>
              {modal.title}
            </h5>
            <button type="button" className="close" onClick={onClose}>
              <i className="fas fa-times"></i>
            </button>
          </div>
          <div className="modal-body">
            <div className={`icon ${modal.type}`}>
              <i
                className={`fas ${
                  modal.type === "success" ? "fa-check" : "fa-exclamation-triangle"
                }`}
              ></i>
            </div>
            <h6>{modal.subtitle}</h6>
            <p>{modal.message}</p>

            {modal.type === "error" && duplicateInfo && (
              <div className="mt-3 text-left">
                <div className="text-sm mb-2">检测到重复录入科目：</div>
                <div className="flex flex-wrap gap-2 mb-2">
                  {duplicateInfo.duplicate_subjects.map((subject) => (
                    <span
                      key={subject}
                      className="bg-red-100 text-red-600 border border-red-200 text-xs px-2 py-0.5 rounded"
                    >
                      {subject}
                    </span>
                  ))}
                </div>
                <div className="text-sm mb-2">建议：请改为编辑已存在成绩，而不是重复新增。</div>
                <a
                  href={`/scores/batch-edit?student=${duplicateInfo.student_id}&exam=${duplicateInfo.exam_id}`}
                  className="border border-red-300 text-red-600 text-sm px-2 py-1 rounded hover:bg-red-50 transition-colors"
                >
                  <i className="fas fa-edit mr-1"></i>去编辑该考试成绩
                </a>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className={`btn-modal ${modal.type === "success" ? "btn-success" : "btn-primary"}`}
              onClick={onClose}
            >
              <i
                className={`fas ${
                  modal.type === "success" ? "fa-check" : "fa-redo"
                } mr-2`}
              ></i>
              {modal.type === "success" ? "确定" : "重试"}
            </button>
          </div>
        </div>
      </div>
      <style jsx>{`
        .custom-modal {
          display: none;
          position: fixed;
          z-index: 1050;
          left: 0;
          top: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(5px);
        }
        .custom-modal.show {
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn 0.3s ease;
        }
        .modal-content {
          background: white;
          border-radius: 15px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
          max-width: 500px;
          width: 90%;
          overflow: hidden;
          animation: slideInDown 0.3s ease;
        }
        .modal-header {
          color: white;
          padding: 1.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .modal-header.success {
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
        }
        .modal-header.error {
          background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
        }
        .modal-header h5 {
          margin: 0;
          font-weight: 600;
          display: flex;
          align-items: center;
        }
        .modal-header .close {
          background: none;
          border: none;
          color: white;
          font-size: 1.5rem;
          cursor: pointer;
          opacity: 0.8;
        }
        .modal-body {
          padding: 2rem;
          text-align: center;
        }
        .modal-body .icon {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 1.5rem;
          margin: 0 auto 1rem;
        }
        .modal-body .icon.success {
          background: linear-gradient(135deg, #28a745, #20c997);
        }
        .modal-body .icon.error {
          background: linear-gradient(135deg, #dc3545, #c82333);
        }
        .modal-body h6 {
          color: #495057;
          margin-bottom: 1rem;
          font-weight: 600;
        }
        .modal-body p {
          color: #6c757d;
          margin-bottom: 0;
          line-height: 1.6;
        }
        .modal-footer {
          background: #f8f9fa;
          padding: 1rem 2rem;
          display: flex;
          justify-content: center;
          gap: 1rem;
        }
        .btn-modal {
          padding: 0.6rem 1.5rem;
          border: none;
          border-radius: 20px;
          font-weight: 600;
          cursor: pointer;
        }
        .btn-modal.btn-primary {
          background: linear-gradient(135deg, #007bff, #0056b3);
          color: white;
        }
        .btn-modal.btn-success {
          background: linear-gradient(135deg, #28a745, #20c997);
          color: white;
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes slideInDown {
          from {
            opacity: 0;
            transform: translateY(-30px);
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

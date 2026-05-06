import Link from "next/link";
import type { EditDetail } from "../types";

interface Props {
  detail: EditDetail;
  scores: Record<string, string>;
  saving: boolean;
  onScoreChange: (subjectCode: string, value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function ScoreForm({ detail, scores, saving, onScoreChange, onSubmit }: Props) {
  return (
    <div className="score-form-card animate-in">
      <h5 className="score-form-header">
        <i className="fas fa-pencil-alt mr-2"></i>成绩录入
      </h5>

      <form onSubmit={onSubmit} id="scoreForm">
        <div className="score-grid">
          {detail.subjects.filter((s) => detail.existing_scores?.hasOwnProperty(s.value)).map((subject) => (
            <div className="score-item" key={subject.value}>
              <label className="score-label" htmlFor={`score_${subject.value}`}>
                <div className="subject-icon"><i className="fas fa-book-open"></i></div>
                {subject.label}
              </label>
              <input
                type="number"
                className="score-input"
                id={`score_${subject.value}`}
                name={`score_${subject.value}`}
                value={scores[subject.value] || ""}
                step="0.5"
                min="0"
                max={detail.subject_max_scores?.[subject.value] ?? 100}
                onChange={(e) => onScoreChange(subject.value, e.target.value)}
                data-subject-name={subject.label}
                placeholder={`0 - ${detail.subject_max_scores?.[subject.value] ?? 100}`}
              />
            </div>
          ))}
        </div>

        <div className="action-buttons">
          <button type="submit" className="btn-save" disabled={saving}>
            <i className="fas fa-save mr-2"></i>{saving ? "保存中..." : "保存所有成绩"}
          </button>
          <Link href="/scores" className="btn-cancel">
            <i className="fas fa-times mr-2"></i>取消
          </Link>
        </div>
      </form>
      <style jsx global>{`
        .score-form-card {
          background: white;
          border: none;
          border-radius: 15px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          overflow: hidden;
        }
        .score-form-header {
          background: linear-gradient(135deg, #6f42c1 0%, #e83e8c 100%);
          color: white;
          padding: 1rem 1.5rem;
          margin: 0;
        }
        .score-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.5rem;
          padding: 2rem;
        }
        .score-item {
          background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
          border: 2px solid #e9ecef;
          border-radius: 12px;
          padding: 1.5rem;
          transition: all 0.3s ease;
        }
        .score-label {
          font-weight: 600;
          color: #495057;
          margin-bottom: 0.8rem;
          display: flex;
          align-items: center;
          font-size: 1rem;
        }
        .subject-icon {
          width: 24px;
          height: 24px;
          background: linear-gradient(135deg, #17a2b8, #138496);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          margin-right: 0.5rem;
          font-size: 0.7rem;
        }
        .score-input {
          width: 100%;
          padding: 0.8rem 1rem;
          border: 2px solid #e9ecef;
          border-radius: 8px;
          font-size: 1.1rem;
          text-align: center;
          font-weight: 500;
          background: white;
        }
        .action-buttons {
          background: #f8f9fa;
          padding: 1.5rem 2rem;
          border-top: 1px solid #e9ecef;
          display: flex;
          gap: 1rem;
          justify-content: center;
        }
        .btn-save {
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          border: none;
          color: white;
          padding: 0.8rem 2rem;
          border-radius: 25px;
          font-weight: 600;
        }
        .btn-cancel {
          background: linear-gradient(135deg, #6c757d 0%, #5a6268 100%);
          border: none;
          color: white;
          padding: 0.8rem 2rem;
          border-radius: 25px;
          font-weight: 600;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
        }
      `}</style>
    </div>
  );
}

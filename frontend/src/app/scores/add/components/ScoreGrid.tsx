import type { Option } from "../types";

type Props = {
  subjects: Option[];
  scores: Record<string, string>;
  onUpdateScore: (subject: string, value: string) => void;
};

export default function ScoreGrid({ subjects, scores, onUpdateScore }: Props) {
  return (
    <>
      <div className="mb-4">
        <h6 className="mb-3">
          <i className="fas fa-chart-line mr-2"></i>各科成绩录入
          <small className="text-gray-500">(支持小数)</small>
        </h6>
        <div className="score-grid">
          {subjects.map((subject) => (
            <div className="score-item" key={subject.value}>
              <label>
                <i className="fas fa-book mr-1"></i>{subject.label}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="150"
                placeholder="请输入分数"
                value={scores[subject.value] || ""}
                onChange={(e) => onUpdateScore(subject.value, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>
      <style jsx>{`
        .score-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1rem;
          margin-top: 1.5rem;
        }
        .score-item {
          background: #f8f9fa;
          border: 2px solid #e9ecef;
          border-radius: 10px;
          padding: 1rem;
          transition: all 0.3s ease;
        }
        .score-item:hover {
          border-color: #007bff;
          box-shadow: 0 2px 8px rgba(0, 123, 255, 0.15);
        }
        .score-item label {
          font-weight: 600;
          color: #495057;
          margin-bottom: 0.5rem;
          display: block;
        }
        .score-item input {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid #ced4da;
          border-radius: 8px;
          text-align: center;
          font-size: 1.1rem;
          font-weight: 500;
        }
      `}</style>
    </>
  );
}

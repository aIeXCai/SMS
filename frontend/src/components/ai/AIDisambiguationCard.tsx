"use client";

export interface CandidateExam {
  exam_id: number;
  name: string;
  date: string;
  academic_year: string;
}

interface AIDisambiguationCardProps {
  candidates: CandidateExam[];
  onSelect: (examId: number) => void;
}

export function AIDisambiguationCard({
  candidates,
  onSelect,
}: AIDisambiguationCardProps) {
  if (!candidates || candidates.length === 0) return null;

  return (
    <div className="mt-2 pt-2 border-t border-gray-200">
      <p className="text-xs text-gray-500 mb-2">
        找到了多次相关考试，请选择您要查询的考试：
      </p>
      <div className="space-y-1.5">
        {candidates.map((c) => (
          <div
            key={`candidate-${c.exam_id}`}
            className="flex items-center justify-between px-3 py-2
                       border border-gray-200 bg-white rounded-lg shadow-sm
                       hover:border-green-300 transition-colors"
          >
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-medium text-gray-800 truncate">
                {c.name}
              </span>
              <span className="text-[11px] text-gray-400">
                {c.date ?? ""}
                {c.academic_year ? ` · ${c.academic_year}` : ""}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onSelect(c.exam_id)}
              className="flex-shrink-0 ml-3 px-2.5 py-1 text-xs font-medium
                         text-green-700 bg-green-50 border border-green-200
                         rounded-md hover:bg-green-100 hover:border-green-300
                         transition-colors"
            >
              选择
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

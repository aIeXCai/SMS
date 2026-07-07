"use client";

import type { AIClarificationOption, AIClarificationReply } from "./types";

interface AIClarificationCardProps {
  message: string;
  questionId: string;
  options?: AIClarificationOption[];
  details?: {
    common_subjects?: string[];
    only_exam_a?: string[];
    only_exam_b?: string[];
  };
  disabled?: boolean;
  onSelect: (reply: AIClarificationReply) => void;
  onCancel?: () => void;
}

function DetailRow({ label, values }: { label: string; values?: string[] }) {
  if (!values || values.length === 0) return null;
  return (
    <div className="text-xs text-gray-600">
      <span className="font-medium text-gray-700">{label}：</span>
      {values.join("、")}
    </div>
  );
}

export function AIClarificationCard({
  message,
  questionId,
  options = [],
  details,
  disabled = false,
  onSelect,
  onCancel,
}: AIClarificationCardProps) {
  return (
    <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3">
      <div className="text-sm font-medium text-gray-800">{message}</div>
      {details && (
        <div className="mt-2 space-y-1 rounded-md bg-gray-50 p-2">
          <DetailRow label="共同科目" values={details.common_subjects} />
          <DetailRow label="仅第一场有" values={details.only_exam_a} />
          <DetailRow label="仅第二场有" values={details.only_exam_b} />
        </div>
      )}
      {options.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {options.map((option) => (
            <button
              key={`${questionId}-${option.value}`}
              type="button"
              disabled={disabled}
              onClick={() =>
                onSelect({
                  question_id: questionId,
                  value: option.value,
                  label: option.label,
                  payload: option.payload,
                })
              }
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-left text-xs text-gray-700
                         transition-colors hover:border-[#01876c] hover:bg-[#e8f7f4] hover:text-[#01876c]
                         disabled:cursor-not-allowed disabled:opacity-50"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
      {onCancel && (
        <button
          type="button"
          disabled={disabled}
          onClick={onCancel}
          className="mt-2 text-xs text-gray-500 transition-colors hover:text-gray-700 disabled:opacity-50"
        >
          取消当前追问
        </button>
      )}
    </div>
  );
}

import type { DuplicateInfo } from "../types";

type Props = {
  errorMessage: string | null;
  duplicateInfo: DuplicateInfo | null;
};

export default function ErrorBanner({ errorMessage, duplicateInfo }: Props) {
  if (!errorMessage) return null;

  return (
    <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded">
      <div className="font-semibold mb-1">保存失败：{errorMessage}</div>
      {duplicateInfo && (
        <>
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
        </>
      )}
    </div>
  );
}

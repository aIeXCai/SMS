"use client";

type Option = { value: string; label: string };
type SubjectRow = { subject_code: string; max_score: number | "" };

interface Props {
  academicYear: string;
  name: string;
  date: string;
  gradeLevelLabel: string;
  description: string;
  subjects: SubjectRow[];
  allSubjects: Option[];
  loadingSubjects: boolean;
  submitting: boolean;
  onSubjectChange: (idx: number, field: "subject_code" | "max_score", value: string) => void;
  onAddSubject: () => void;
  onRemoveSubject: (idx: number) => void;
  onSubmit: () => void;
  onPrevStep: () => void;
  onCancel: () => void;
  submitLabel?: string;
}

export default function ExamSubjectsForm({
  academicYear,
  name,
  date,
  gradeLevelLabel,
  description,
  subjects,
  allSubjects,
  loadingSubjects,
  submitting,
  onSubjectChange,
  onAddSubject,
  onRemoveSubject,
  onSubmit,
  onPrevStep,
  onCancel,
  submitLabel = "创建考试",
}: Props) {
  const validCount = subjects.filter(s => s.subject_code).length;

  return (
    <div>
      {/* Summary card */}
      <div className="bg-white rounded-2xl shadow-sm mb-4 overflow-hidden" style={{ borderRadius: 15 }}>
        <div className="p-4">
          <h6 className="font-bold text-gray-900 mb-3">
            <i className="fas fa-clipboard-check mr-2 text-green-600"></i>考试信息确认
          </h6>
          <div className="flex flex-wrap gap-2 text-sm">
            <div className="w-1/2 md:w-1/4">
              <span className="text-gray-500 text-xs">学年</span>
              <div className="font-bold">{academicYear}</div>
            </div>
            <div className="w-1/2 md:w-1/4">
              <span className="text-gray-500 text-xs">考试名称</span>
              <div className="font-bold">{name}</div>
            </div>
            <div className="w-1/2 md:w-1/4">
              <span className="text-gray-500 text-xs">考试日期</span>
              <div className="font-bold">{date}</div>
            </div>
            <div className="w-1/2 md:w-1/4">
              <span className="text-gray-500 text-xs">适用年级</span>
              <div className="font-bold">{gradeLevelLabel}</div>
            </div>
            {description && (
              <div className="w-full mt-1">
                <span className="text-gray-500 text-xs">描述：</span>
                <span className="text-sm text-gray-600">{description}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Subjects configuration */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ borderRadius: 15 }}>
        <div className="p-4">
          <div className="flex justify-between items-center mb-3">
            <h5 className="font-bold text-gray-900 mb-0">
              <i className="fas fa-book mr-2 text-blue-600"></i>科目配置
            </h5>
            <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded">{validCount} 个科目</span>
          </div>

          <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded py-2 mb-4">
            <i className="fas fa-lightbulb mr-2"></i>
            系统已根据 <strong>{gradeLevelLabel}</strong> 自动配置常考科目和标准满分，您可以根据实际情况调整或删除科目。
          </div>

          {loadingSubjects ? (
            <div className="text-center py-3">
              <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full inline-block mr-2 align-middle"></div>
              正在加载默认科目...
            </div>
          ) : (
            <>
              <div className="overflow-x-auto mb-3">
                <table className="w-full border-collapse border border-gray-200 align-middle mb-0" style={{ minWidth: 400 }}>
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-center border border-gray-200 px-3 py-2" style={{ width: "50%" }}>科目</th>
                      <th className="text-center border border-gray-200 px-3 py-2" style={{ width: "35%" }}>满分</th>
                      <th className="text-center border border-gray-200 px-3 py-2" style={{ width: "15%" }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjects.map((row, idx) => (
                      <tr key={idx}>
                        <td className="border border-gray-200 px-2 py-1">
                          <select
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500"
                            value={row.subject_code}
                            onChange={(e) => onSubjectChange(idx, "subject_code", e.target.value)}
                          >
                            <option value="">-- 选择科目 --</option>
                            {allSubjects.map((s) => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="border border-gray-200 px-2 py-1">
                          <input
                            type="number"
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            min={1}
                            value={row.max_score}
                            onChange={(e) => onSubjectChange(idx, "max_score", e.target.value)}
                            placeholder="满分"
                          />
                        </td>
                        <td className="text-center border border-gray-200 px-2 py-1">
                          <button
                            type="button"
                            className="border border-red-300 text-red-600 text-sm px-2 py-1 rounded hover:bg-red-50 transition-colors"
                            onClick={() => onRemoveSubject(idx)}
                            title="删除此科目"
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                    {subjects.length === 0 && (
                      <tr>
                        <td colSpan={3} className="text-center text-gray-500 py-3 border border-gray-200">
                          暂无科目，点击下方按钮添加
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                className="border border-green-600 text-green-600 text-sm px-2 py-1 rounded hover:bg-green-50 transition-colors mb-4"
                onClick={onAddSubject}
              >
                <i className="fas fa-plus mr-2"></i>添加科目
              </button>
            </>
          )}

          <div className="flex justify-between">
            <div>
              <button className="border border-gray-300 px-4 py-2 rounded hover:bg-gray-50 transition-colors mr-2" onClick={onPrevStep}>
                <i className="fas fa-arrow-left mr-2"></i>上一步
              </button>
              <button type="button" className="border border-gray-300 px-4 py-2 rounded hover:bg-gray-50 transition-colors" onClick={onCancel}>
                取消
              </button>
            </div>
            <button
              className="bg-green-600 text-white px-5 py-2 rounded hover:bg-green-700 transition-colors disabled:opacity-50"
              onClick={onSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full inline-block mr-2 align-middle"></span>
                  提交中...
                </>
              ) : (
                <>
                  <i className="fas fa-check mr-2"></i>{submitLabel}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import type { Option, ExamScopeType, RuleForm } from "../types";
import { EXAM_SCOPE_OPTIONS, QUANTIFIER_OPTIONS, ABSENT_POLICY_OPTIONS } from "../types";

export type DropdownKeys = "grade" | "examScope" | "exam" | "quantifier" | "absentPolicy";

interface Props {
  form: RuleForm;
  gradeOptions: Option[];
  examOptions: Option[];
  selectedExamIds: string[];
  allExamsSelected: boolean;
  selectedExamText: string;
  drop: Record<DropdownKeys, boolean>;
  isLoading: boolean;
  onToggleDrop: (key: DropdownKeys) => void;
  onGradeChange: (value: string) => void;
  onExamScopeTypeChange: (value: ExamScopeType) => void;
  onThresholdChange: (value: string) => void;
  onKChange: (value: string) => void;
  onQuantifierChange: (value: "all" | "at_least") => void;
  onAbsentPolicyChange: (value: "strict_fail" | "ignore_absent") => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onToggleExamSelection: (examId: string) => void;
  onToggleAllExams: () => void;
  onQuery: () => void;
  onReset: () => void;
}

export default function ResultFilterBar({
  form,
  gradeOptions,
  examOptions,
  selectedExamIds,
  allExamsSelected,
  selectedExamText,
  drop,
  isLoading,
  onToggleDrop,
  onGradeChange,
  onExamScopeTypeChange,
  onThresholdChange,
  onKChange,
  onQuantifierChange,
  onAbsentPolicyChange,
  onDateFromChange,
  onDateToChange,
  onToggleExamSelection,
  onToggleAllExams,
  onQuery,
  onReset,
}: Props) {
  return (
    <div className="bg-white rounded-lg shadow filter-card mb-3">
      <div className="px-4 py-3 border-b border-gray-200">
        <h5 className="mb-0">
          <i className="fas fa-sliders-h mr-2"></i>筛选条件
        </h5>
      </div>
      <div className="p-4">
        <div className="flex flex-wrap gap-3">
          {/* Grade */}
          <div className="w-full md:w-1/4">
            <label className="block text-sm font-medium text-gray-700 mb-1">年级</label>
            <div className="custom-dropdown">
              <button
                type="button"
                className={`custom-dropdown-toggle ${drop.grade ? "active" : ""}`}
                onClick={() => onToggleDrop("grade")}
              >
                <span>
                  {gradeOptions.find((g) => g.value === form.grade_level)?.label || "--- 请选择年级 ---"}
                </span>
                <i className="fas fa-chevron-down custom-dropdown-arrow"></i>
              </button>
              <div className={`custom-dropdown-menu ${drop.grade ? "show" : ""}`}>
                {gradeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className="custom-dropdown-item"
                    onClick={() => {
                      onGradeChange(opt.value);
                      onToggleDrop("grade");
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Exam Scope */}
          <div className="w-full md:w-1/4">
            <label className="block text-sm font-medium text-gray-700 mb-1">考试范围</label>
            <div className="custom-dropdown">
              <button
                type="button"
                className={`custom-dropdown-toggle ${drop.examScope ? "active" : ""}`}
                onClick={() => onToggleDrop("examScope")}
              >
                <span>
                  {EXAM_SCOPE_OPTIONS.find((o) => o.value === form.exam_scope.type)?.label || "请选择"}
                </span>
                <i className="fas fa-chevron-down custom-dropdown-arrow"></i>
              </button>
              <div className={`custom-dropdown-menu ${drop.examScope ? "show" : ""}`}>
                {EXAM_SCOPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className="custom-dropdown-item"
                    onClick={() => {
                      onExamScopeTypeChange(opt.value as ExamScopeType);
                      onToggleDrop("examScope");
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Threshold */}
          <div className="w-full md:w-1/6">
            <label className="block text-sm font-medium text-gray-700 mb-1">前N名</label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={form.threshold}
              onChange={(e) => onThresholdChange(e.target.value)}
              placeholder="如：50"
            />
          </div>

          {/* Quantifier */}
          <div className="w-full md:w-1/6">
            <label className="block text-sm font-medium text-gray-700 mb-1">满足方式</label>
            <div className="custom-dropdown">
              <button
                type="button"
                className={`custom-dropdown-toggle ${drop.quantifier ? "active" : ""}`}
                onClick={() => onToggleDrop("quantifier")}
              >
                <span>
                  {QUANTIFIER_OPTIONS.find((o) => o.value === form.quantifier)?.label || "请选择"}
                </span>
                <i className="fas fa-chevron-down custom-dropdown-arrow"></i>
              </button>
              <div className={`custom-dropdown-menu ${drop.quantifier ? "show" : ""}`}>
                {QUANTIFIER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className="custom-dropdown-item"
                    onClick={() => {
                      onQuantifierChange(opt.value as "all" | "at_least");
                      onToggleDrop("quantifier");
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* K value */}
          <div className="w-full md:w-1/6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              K值{" "}
              <span className="text-gray-500 text-sm">
                ({form.quantifier === "at_least" ? "必填" : "选填"})
              </span>
            </label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={form.k}
              onChange={(e) => onKChange(e.target.value)}
              placeholder={form.quantifier === "at_least" ? "如：3" : "量词为至少K次时填写"}
              disabled={form.quantifier !== "at_least"}
            />
          </div>
        </div>

        {/* Exam selector (when scope is selected_exam_ids) */}
        {form.exam_scope.type === "selected_exam_ids" && (
          <div className="mt-2" style={{ overflow: "visible" }}>
            <label className="block text-sm font-medium text-gray-700 mb-1">选择考试</label>
            <div className="custom-dropdown" style={{ width: "min(420px, 100%)", minWidth: "280px" }}>
              <button
                type="button"
                className={`custom-dropdown-toggle ${drop.exam ? "active" : ""}`}
                onClick={() => onToggleDrop("exam")}
              >
                <span
                  className="d-inline-block"
                  style={{ maxWidth: "calc(100% - 1.5rem)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {selectedExamText}
                </span>
                <i className="fas fa-chevron-down custom-dropdown-arrow"></i>
              </button>
              <div className={`custom-dropdown-menu ${drop.exam ? "show" : ""}`} style={{ width: "100%", minWidth: "100%" }}>
                <div className="custom-dropdown-header">
                  <label className="form-check mb-0">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={allExamsSelected}
                      onChange={onToggleAllExams}
                    />
                    <span className="form-check-label fw-medium">全选/取消全选</span>
                  </label>
                </div>
                <div className="custom-dropdown-items">
                  {examOptions.length === 0 && (
                    <div className="text-muted px-2 py-2">
                      {form.grade_level ? "该年级暂无考试" : "请先选择年级"}
                    </div>
                  )}
                  {examOptions.map((exam) => (
                    <label key={exam.value} className="form-check custom-dropdown-item">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={selectedExamIds.includes(exam.value)}
                        onChange={() => onToggleExamSelection(exam.value)}
                      />
                      <span className="form-check-label">{exam.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Date range (when scope is date_range) */}
        {form.exam_scope.type === "date_range" && (
          <div className="flex flex-wrap gap-3 mt-2">
            <div className="w-full md:w-1/4">
              <label className="block text-sm font-medium text-gray-700 mb-1">开始日期</label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={form.exam_scope.date_from || ""}
                onChange={(e) => onDateFromChange(e.target.value)}
              />
            </div>
            <div className="w-full md:w-1/4">
              <label className="block text-sm font-medium text-gray-700 mb-1">结束日期</label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={form.exam_scope.date_to || ""}
                onChange={(e) => onDateToChange(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Absent policy */}
        <div className="flex flex-wrap gap-3 mt-2">
          <div className="w-full md:w-1/4">
            <label className="block text-sm font-medium text-gray-700 mb-1">缺考判定</label>
            <div className="custom-dropdown">
              <button
                type="button"
                className={`custom-dropdown-toggle ${drop.absentPolicy ? "active" : ""}`}
                onClick={() => onToggleDrop("absentPolicy")}
              >
                <span>
                  {ABSENT_POLICY_OPTIONS.find((o) => o.value === form.absent_policy)?.label || "请选择"}
                </span>
                <i className="fas fa-chevron-down custom-dropdown-arrow"></i>
              </button>
              <div className={`custom-dropdown-menu ${drop.absentPolicy ? "show" : ""}`}>
                {ABSENT_POLICY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className="custom-dropdown-item"
                    onClick={() => {
                      onAbsentPolicyChange(opt.value as "strict_fail" | "ignore_absent");
                      onToggleDrop("absentPolicy");
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Query / Reset buttons */}
          <div className="flex-1 flex items-end gap-2">
            <button
              type="button"
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
              onClick={onQuery}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full inline-block mr-2"></span>
                  查询中...
                </>
              ) : (
                <>
                  <i className="fas fa-search mr-1"></i>查询
                </>
              )}
            </button>
            <button
              type="button"
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors"
              onClick={onReset}
            >
              <i className="fas fa-undo mr-1"></i>重置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

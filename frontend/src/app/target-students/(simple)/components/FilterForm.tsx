"use client";

import type { Option, RuleForm } from "../types";
import { EXAM_SCOPE_OPTIONS, QUANTIFIER_OPTIONS, ABSENT_POLICY_OPTIONS } from "../types";

interface OpenState {
  grade: boolean;
  examScope: boolean;
  exam: boolean;
  quantifier: boolean;
  absentPolicy: boolean;
}

interface Props {
  form: RuleForm;
  gradeOptions: Option[];
  examOptions: Option[];
  selectedExamIds: string[];
  allExamsSelected: boolean;
  selectedExamText: string;
  open: OpenState;
  onToggle: (key: keyof OpenState) => () => void;
  onGradeChange: (value: string) => void;
  onExamScopeChange: (value: string) => void;
  onThresholdChange: (value: string) => void;
  onKChange: (value: string) => void;
  onQuantifierChange: (value: "all" | "at_least") => void;
  onAbsentPolicyChange: (value: "strict_fail" | "ignore_absent") => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onToggleExam: (examId: string) => void;
  onToggleAllExams: () => void;
  onQuery: () => void;
  onReset: () => void;
}

export default function FilterForm({
  form,
  gradeOptions,
  examOptions,
  selectedExamIds,
  allExamsSelected,
  selectedExamText,
  open,
  onToggle,
  onGradeChange,
  onExamScopeChange,
  onThresholdChange,
  onKChange,
  onQuantifierChange,
  onAbsentPolicyChange,
  onDateFromChange,
  onDateToChange,
  onToggleExam,
  onToggleAllExams,
  onQuery,
  onReset,
}: Props) {
  return (
    <div className="card filter-card mb-3">
      <div className="px-4 py-3 border-b border-gray-200">
        <h5 className="mb-0">
          <i className="fas fa-sliders-h mr-2"></i>规则配置
        </h5>
      </div>
      <div className="p-4">
        <div className="flex flex-wrap gap-3">
          {/* 年级 */}
          <div className="flex-1 min-w-0">
            <label className="block text-sm font-medium text-gray-700 mb-1">年级</label>
            <div className="custom-dropdown">
              <button
                type="button"
                className={`custom-dropdown-toggle ${open.grade ? "active" : ""}`}
                onClick={onToggle("grade")}
              >
                <span>
                  {gradeOptions.find((g) => g.value === form.grade_level)?.label ||
                    "--- 请选择年级 ---"}
                </span>
                <i className="fas fa-chevron-down custom-dropdown-arrow"></i>
              </button>
              <div className={`custom-dropdown-menu ${open.grade ? "show" : ""}`}>
                {gradeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className="custom-dropdown-item"
                    onClick={() => {
                      onGradeChange(opt.value);
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 考试范围 */}
          <div className="flex-1 min-w-0">
            <label className="block text-sm font-medium text-gray-700 mb-1">考试范围</label>
            <div className="custom-dropdown">
              <button
                type="button"
                className={`custom-dropdown-toggle ${open.examScope ? "active" : ""}`}
                onClick={onToggle("examScope")}
              >
                <span>
                  {EXAM_SCOPE_OPTIONS.find((o) => o.value === form.exam_scope.type)?.label ||
                    "请选择"}
                </span>
                <i className="fas fa-chevron-down custom-dropdown-arrow"></i>
              </button>
              <div className={`custom-dropdown-menu ${open.examScope ? "show" : ""}`}>
                {EXAM_SCOPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className="custom-dropdown-item"
                    onClick={() => {
                      onExamScopeChange(opt.value);
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 前N名 */}
          <div className="flex-1 min-w-0">
            <label className="block text-sm font-medium text-gray-700 mb-1">前N名</label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={form.threshold}
              onChange={(e) => onThresholdChange(e.target.value)}
              placeholder="如：50"
            />
          </div>

          {/* 满足方式 */}
          <div className="flex-1 min-w-0">
            <label className="block text-sm font-medium text-gray-700 mb-1">满足方式</label>
            <div className="custom-dropdown">
              <button
                type="button"
                className={`custom-dropdown-toggle ${open.quantifier ? "active" : ""}`}
                onClick={onToggle("quantifier")}
              >
                <span>
                  {QUANTIFIER_OPTIONS.find((o) => o.value === form.quantifier)?.label ||
                    "请选择"}
                </span>
                <i className="fas fa-chevron-down custom-dropdown-arrow"></i>
              </button>
              <div className={`custom-dropdown-menu ${open.quantifier ? "show" : ""}`}>
                {QUANTIFIER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className="custom-dropdown-item"
                    onClick={() => {
                      onQuantifierChange(opt.value as "all" | "at_least");
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* K值 */}
          <div className="flex-1 min-w-0">
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
              placeholder={
                form.quantifier === "at_least" ? "如：3" : "量词为至少K次时填写"
              }
              disabled={form.quantifier !== "at_least"}
            />
          </div>
        </div>

        {/* 指定考试多选 */}
        {form.exam_scope.type === "selected_exam_ids" && (
          <div className="mt-2 exam-selector-wrap">
            <label className="block text-sm font-medium text-gray-700 mb-1">选择考试</label>
            <div className="custom-dropdown exam-selector-dropdown">
              <button
                type="button"
                className={`custom-dropdown-toggle ${open.exam ? "active" : ""}`}
                onClick={onToggle("exam")}
              >
                <span className="truncate inline-block exam-selector-text">
                  {selectedExamText}
                </span>
                <i className="fas fa-chevron-down custom-dropdown-arrow"></i>
              </button>
              <div
                className={`custom-dropdown-menu exam-selector-menu ${open.exam ? "show" : ""}`}
              >
                <div className="custom-dropdown-header">
                  <label className="form-check mb-0">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                      checked={allExamsSelected}
                      onChange={onToggleAllExams}
                    />
                    <span className="font-medium">全选/取消全选</span>
                  </label>
                </div>
                <div className="custom-dropdown-items">
                  {examOptions.length === 0 && (
                    <div className="text-gray-500 px-2 py-2">
                      {form.grade_level ? "该年级暂无考试" : "请先选择年级"}
                    </div>
                  )}
                  {examOptions.map((exam) => (
                    <label key={exam.value} className="form-check custom-dropdown-item">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
                        checked={selectedExamIds.includes(exam.value)}
                        onChange={() => onToggleExam(exam.value)}
                      />
                      <span className="form-check-label">{exam.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 日期范围 */}
        {form.exam_scope.type === "date_range" && (
          <div className="flex flex-wrap gap-3 mt-2">
            <div className="flex-1 min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">开始日期</label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={form.exam_scope.date_from || ""}
                onChange={(e) => onDateFromChange(e.target.value)}
              />
            </div>
            <div className="flex-1 min-w-0">
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

        {/* 缺考判定 + 查询/重置按钮 */}
        <div className="flex flex-wrap gap-3 mt-2 items-end">
          <div className="flex-1 min-w-0">
            <label className="block text-sm font-medium text-gray-700 mb-1">缺考判定</label>
            <div className="custom-dropdown">
              <button
                type="button"
                className={`custom-dropdown-toggle ${open.absentPolicy ? "active" : ""}`}
                onClick={onToggle("absentPolicy")}
              >
                <span>
                  {ABSENT_POLICY_OPTIONS.find((o) => o.value === form.absent_policy)
                    ?.label || "请选择"}
                </span>
                <i className="fas fa-chevron-down custom-dropdown-arrow"></i>
              </button>
              <div
                className={`custom-dropdown-menu ${open.absentPolicy ? "show" : ""}`}
              >
                {ABSENT_POLICY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className="custom-dropdown-item"
                    onClick={() => {
                      onAbsentPolicyChange(
                        opt.value as "strict_fail" | "ignore_absent"
                      );
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-1 min-w-0 gap-2 justify-end">
            <button
              type="button"
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition-colors"
              onClick={onQuery}
            >
              <i className="fas fa-search mr-1"></i>查询
            </button>
            <button
              type="button"
              className="bg-gray-500 text-white px-6 py-2 rounded hover:bg-gray-600 transition-colors"
              onClick={onReset}
            >
              <i className="fas fa-undo mr-1"></i>重置
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .filter-card .card-body {
          overflow: visible !important;
        }
        .filter-card .card-body > .row {
          overflow: visible !important;
          flex-wrap: wrap;
        }
        .filter-card .card-body > .row > [class*="col-"] {
          overflow: visible !important;
        }
        .filter-card .form-control,
        .filter-card .custom-dropdown-toggle {
          height: 38px;
          padding: 0.375rem 0.75rem;
          font-size: 14px;
        }
        .custom-dropdown {
          position: relative;
          width: 100%;
          color: #495057;
        }
        .exam-selector-wrap {
          overflow: visible;
        }
        .exam-selector-dropdown {
          width: min(420px, 100%);
          min-width: 280px;
        }
        .exam-selector-text {
          max-width: calc(100% - 1.5rem);
        }
        .exam-selector-menu {
          width: 100%;
          min-width: 100%;
        }
        .custom-dropdown-toggle {
          width: 100%;
          border: 1px solid #ced4da;
          border-radius: 0.375rem;
          background-color: #fff;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: all 0.2s ease;
          text-align: left;
          font-size: 14px;
        }
        .custom-dropdown-toggle:hover,
        .custom-dropdown-toggle.active {
          border-color: #007bff;
          box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
        }
        .custom-dropdown-arrow {
          transition: transform 0.2s ease;
          color: #6c757d;
          margin-left: auto;
        }
        .custom-dropdown-toggle.active .custom-dropdown-arrow {
          transform: rotate(180deg);
        }
        .custom-dropdown-menu {
          position: absolute;
          top: calc(100% + 2px);
          left: 0;
          width: 100%;
          background: white;
          border: 1px solid #ced4da;
          border-radius: 0.375rem;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          z-index: 1050;
          max-height: 250px;
          overflow-y: auto;
          display: none;
          box-sizing: border-box;
        }
        .custom-dropdown-menu.show {
          display: block;
        }
        .custom-dropdown-header {
          padding: 0.5rem 0.75rem;
          border-bottom: 1px solid #e9ecef;
          background-color: #f8f9fa;
          border-radius: 0.375rem 0.375rem 0 0;
        }
        .custom-dropdown-items {
          padding: 0.25rem 0;
        }
        .custom-dropdown-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          width: 100%;
          padding: 0.375rem 0.75rem;
          cursor: pointer;
          transition: background-color 0.15s ease;
          font-size: 14px;
          border: none;
          background: transparent;
          text-align: left;
        }
        .custom-dropdown-item:hover {
          background-color: #f8f9fa;
        }
        .custom-dropdown-item input[type="checkbox"] {
          width: 16px;
          height: 16px;
          margin-right: 0.5rem;
        }
        .custom-dropdown-header .form-check,
        .custom-dropdown-item.form-check {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0;
          padding-left: 0.75rem;
        }
        .custom-dropdown-header .form-check-input,
        .custom-dropdown-item.form-check .form-check-input {
          float: none;
          margin: 0;
          position: static;
          flex-shrink: 0;
        }
        .custom-dropdown-header .form-check-label,
        .custom-dropdown-item.form-check .form-check-label {
          margin: 0;
        }
        @media (max-width: 576px) {
          .exam-selector-dropdown {
            width: 100%;
            min-width: 0;
          }
        }
      `}</style>
    </div>
  );
}

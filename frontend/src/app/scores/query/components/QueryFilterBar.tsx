"use client";

import type { Filters, ScoreOptions } from "../types";

interface Props {
  filters: Filters;
  options: ScoreOptions | null;
  academicYearDropdownOpen: boolean;
  gradeDropdownOpen: boolean;
  examDropdownOpen: boolean;
  classDropdownOpen: boolean;
  sortByDropdownOpen: boolean;
  subjectMenuOpen: boolean;
  selectedSubjectText: string;
  allSubjectsSelected: boolean;
  onToggleAcademicYear: () => void;
  onToggleGrade: () => void;
  onToggleExam: () => void;
  onToggleClass: () => void;
  onToggleSortBy: () => void;
  onToggleSubjectMenu: () => void;
  onAcademicYearChange: (value: string) => void;
  onGradeChange: (value: string) => void;
  onExamChange: (value: string) => void;
  onClassChange: (value: string) => void;
  onSortByChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onToggleSubject: (value: string) => void;
  onToggleAllSubjects: () => void;
  onQuery: () => void;
  onReset: () => void;
}

export default function QueryFilterBar({
  filters, options,
  academicYearDropdownOpen, gradeDropdownOpen, examDropdownOpen,
  classDropdownOpen, sortByDropdownOpen, subjectMenuOpen,
  selectedSubjectText, allSubjectsSelected,
  onToggleAcademicYear, onToggleGrade, onToggleExam,
  onToggleClass, onToggleSortBy, onToggleSubjectMenu,
  onAcademicYearChange, onGradeChange, onExamChange,
  onClassChange, onSortByChange,
  onDateFromChange, onDateToChange, onNameChange,
  onToggleSubject, onToggleAllSubjects,
  onQuery, onReset,
}: Props) {
  return (
    <div className="bg-white rounded-lg shadow mb-4">
      <div className="px-4 py-3 border-b border-gray-200">
        <h5 className="mb-0"><i className="fas fa-filter mr-2"></i>快速筛选与操作</h5>
      </div>
      <div className="p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-0">
            <label className="block text-sm font-bold text-[#5a6b63] mb-1">学年</label>
            <div className="app-custom-dropdown">
              <button type="button" className={`app-custom-dropdown-toggle ${academicYearDropdownOpen ? "active" : ""}`} onClick={onToggleAcademicYear}>
                <span>{filters.academic_year_filter ? options?.academic_years.find(o => o.value === filters.academic_year_filter)?.label || filters.academic_year_filter : "--- 所有学年 ---"}</span>
                <i className="fas fa-chevron-down app-custom-dropdown-arrow"></i>
              </button>
              <div className={`app-custom-dropdown-menu ${academicYearDropdownOpen ? "show" : ""}`}>
                <button type="button" className="app-custom-dropdown-item" onClick={() => onAcademicYearChange("")}>--- 所有学年 ---</button>
                {options?.academic_years.map((x) => (
                  <button key={x.value} type="button" className="app-custom-dropdown-item" onClick={() => onAcademicYearChange(x.value)}>{x.label}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <label className="block text-sm font-bold text-[#5a6b63] mb-1">年级</label>
            <div className="app-custom-dropdown">
              <button type="button" className={`app-custom-dropdown-toggle ${gradeDropdownOpen ? "active" : ""}`} onClick={onToggleGrade}>
                <span>{filters.grade_filter ? options?.grade_levels.find(o => o.value === filters.grade_filter)?.label || filters.grade_filter : "--- 所有年级 ---"}</span>
                <i className="fas fa-chevron-down app-custom-dropdown-arrow"></i>
              </button>
              <div className={`app-custom-dropdown-menu ${gradeDropdownOpen ? "show" : ""}`}>
                <button type="button" className="app-custom-dropdown-item" onClick={() => onGradeChange("")}>--- 所有年级 ---</button>
                {options?.grade_levels.map((x) => (
                  <button key={x.value} type="button" className="app-custom-dropdown-item" onClick={() => onGradeChange(x.value)}>{x.label}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <label className="block text-sm font-bold text-[#5a6b63] mb-1">开始日期</label>
            <input type="date" className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" value={filters.date_from_filter} onChange={(e) => onDateFromChange(e.target.value)} />
          </div>
          <div className="flex-1 min-w-0">
            <label className="block text-sm font-bold text-[#5a6b63] mb-1">结束日期</label>
            <input type="date" className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" value={filters.date_to_filter} onChange={(e) => onDateToChange(e.target.value)} />
          </div>
          <div className="flex-1 min-w-0">
            <label className="block text-sm font-bold text-[#5a6b63] mb-1">考试</label>
            <div className="app-custom-dropdown">
              <button type="button" className={`app-custom-dropdown-toggle ${examDropdownOpen ? "active" : ""}`} onClick={onToggleExam}>
                <span>{filters.exam_filter ? options?.exams.find(o => o.value === filters.exam_filter)?.label || filters.exam_filter : "--- 所有考试 ---"}</span>
                <i className="fas fa-chevron-down app-custom-dropdown-arrow"></i>
              </button>
              <div className={`app-custom-dropdown-menu ${examDropdownOpen ? "show" : ""}`}>
                <button type="button" className="app-custom-dropdown-item" onClick={() => onExamChange("")}>--- 所有考试 ---</button>
                {options?.exams.map((x) => (
                  <button key={x.value} type="button" className="app-custom-dropdown-item" onClick={() => onExamChange(x.value)}>{x.label}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <label className="block text-sm font-bold text-[#5a6b63] mb-1">排序方式</label>
            <div className="app-custom-dropdown">
              <button type="button" className={`app-custom-dropdown-toggle ${sortByDropdownOpen ? "active" : ""}`} onClick={onToggleSortBy}>
                <span>{filters.sort_by ? options?.sort_by_options.find(o => o.value === filters.sort_by)?.label || filters.sort_by : "--- 默认排序 ---"}</span>
                <i className="fas fa-chevron-down app-custom-dropdown-arrow"></i>
              </button>
              <div className={`app-custom-dropdown-menu ${sortByDropdownOpen ? "show" : ""}`}>
                <button type="button" className="app-custom-dropdown-item" onClick={() => onSortByChange("")}>--- 默认排序 ---</button>
                {(options?.sort_by_options || []).filter(x => x.value).map((x) => (
                  <button key={x.value} type="button" className="app-custom-dropdown-item" onClick={() => onSortByChange(x.value)}>{x.label}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mt-2 items-end">
          <div className="flex-1 min-w-0">
            <label className="block text-sm font-bold text-[#5a6b63] mb-1">班级</label>
            <div className="app-custom-dropdown">
              <button type="button" className={`app-custom-dropdown-toggle ${classDropdownOpen ? "active" : ""}`} onClick={onToggleClass}>
                <span>{filters.class_filter ? options?.class_name_choices.find(o => o.value === filters.class_filter)?.label || filters.class_filter : "--- 所有班级 ---"}</span>
                <i className="fas fa-chevron-down app-custom-dropdown-arrow"></i>
              </button>
              <div className={`app-custom-dropdown-menu ${classDropdownOpen ? "show" : ""}`}>
                <button type="button" className="app-custom-dropdown-item" onClick={() => onClassChange("")}>--- 所有班级 ---</button>
                {options?.class_name_choices.map((x) => (
                  <button key={x.value} type="button" className="app-custom-dropdown-item" onClick={() => onClassChange(x.value)}>{x.label}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <label className="block text-sm font-bold text-[#5a6b63] mb-1">姓名</label>
            <input className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" value={filters.student_name_filter} onChange={(e) => onNameChange(e.target.value)} placeholder="支持模糊搜索" />
          </div>
          <div className="w-full md:w-1/3">
            <label className="block text-sm font-bold text-[#5a6b63] mb-1">科目</label>
            <div className={`app-custom-dropdown ${subjectMenuOpen ? "show" : ""}`}>
              <button type="button" className={`app-custom-dropdown-toggle ${subjectMenuOpen ? "active" : ""}`} onClick={onToggleSubjectMenu}>
                <span>{selectedSubjectText}</span>
                <i className="fas fa-chevron-down app-custom-dropdown-arrow"></i>
              </button>
              <div className={`app-custom-dropdown-menu ${subjectMenuOpen ? "show" : ""} py-2 px-3`}>
                <div style={{ padding: '0.25rem 0.125rem', borderBottom: '1px solid #f1f3f4', marginBottom: '0.5rem' }}>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="checkbox" className="rounded border-gray-300" checked={allSubjectsSelected} onChange={onToggleAllSubjects} />
                    <span>全选/取消全选</span>
                  </label>
                </div>
                {(options?.subjects || []).map((subject) => (
                  <label key={subject.value} className="flex items-center gap-2 cursor-pointer py-0.5 px-0.5 text-sm">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                      checked={filters.subject_filters.includes(subject.value)}
                      onChange={() => onToggleSubject(subject.value)}
                    />
                    <span>{subject.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="w-full md:w-1/12 flex items-end">
            <button type="button" className="app-btn-primary w-full" onClick={onQuery}><i className="fas fa-search mr-1"></i>查询</button>
          </div>
          <div className="flex-1 min-w-0 flex items-end">
            <button type="button" className="app-btn-outline w-full" onClick={onReset}><i className="fas fa-undo mr-1"></i>重置条件</button>
          </div>
        </div>
      </div>
    </div>
  );
}

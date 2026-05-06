"use client";

import type { Option, ScoreOptions, Filters } from "../types";

interface ScoreFilterBarProps {
  filters: Filters; options: ScoreOptions | null; gradeClasses: Option[];
  collapsed: boolean; onToggleCollapse: () => void;
  gradeDropdownOpen: boolean; examDropdownOpen: boolean; classDropdownOpen: boolean;
  onGradeDropdownToggle: () => void; onExamDropdownToggle: () => void; onClassDropdownToggle: () => void;
  onGradeSelect: (value: string) => void; onExamSelect: (value: string) => void;
  onClassSelect: (value: string) => void; onFilter: () => void; onReset: () => void;
}

function Dropdown(props: {
  label: string; value: string; options: Option[]; isOpen: boolean;
  disabled?: boolean; placeholder?: string; colClass?: string;
  onToggle: () => void; onSelect: (v: string) => void;
}) {
  const { label, value, options, isOpen, disabled, placeholder, colClass, onToggle, onSelect } = props;
  const selectedLabel = value ? options.find((o) => o.value === value)?.label || value : placeholder || `全部${label}`;
  const actualDisabled = disabled && !value;
  const displayText = actualDisabled ? `请先选择年级` : selectedLabel;
  return (
    <div className={colClass || "w-full md:w-1/6"}>
      <label className="block text-sm font-bold text-gray-600 mb-1" style={{ color: "#5a6b63" }}>{label}</label>
      <div className="app-custom-dropdown">
        <button type="button" className={`app-custom-dropdown-toggle${isOpen ? " active" : ""}`}
          onClick={(e) => { e.stopPropagation(); onToggle(); }} disabled={!!actualDisabled}>
          <span>{displayText}</span>
          <i className="fas fa-chevron-down app-custom-dropdown-arrow"></i>
        </button>
        <div className={`app-custom-dropdown-menu${isOpen ? " show" : ""}`}>
          <button type="button" className="app-custom-dropdown-item"
            onClick={(e) => { e.stopPropagation(); onSelect(""); }}>全部{label}</button>
          {options.map((x) => (
            <button key={x.value} type="button" className="app-custom-dropdown-item"
              onClick={(e) => { e.stopPropagation(); onSelect(x.value); }}>{x.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ScoreFilterBar({
  filters, options, gradeClasses, collapsed, onToggleCollapse,
  gradeDropdownOpen, examDropdownOpen, classDropdownOpen,
  onGradeDropdownToggle, onExamDropdownToggle, onClassDropdownToggle,
  onGradeSelect, onExamSelect, onClassSelect, onFilter, onReset,
}: ScoreFilterBarProps) {
  return (
    <div className="bg-white rounded-lg shadow mb-3">
      <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center"
        style={{ cursor: "pointer" }} onClick={onToggleCollapse}>
        <h5 className="mb-0"><i className="fas fa-filter mr-2"></i>高级筛选</h5>
        <button type="button" className="text-sm text-gray-500 hover:text-gray-700 bg-transparent border-none cursor-pointer p-0">
          <i className={`fas fa-chevron-${collapsed ? "down" : "up"}`} style={{ transition: "transform 0.2s" }}></i>
        </button>
      </div>
      {!collapsed && (
        <div className="p-4">
          <div className="flex items-end gap-3">
            <Dropdown label="年级" value={filters.grade_filter} options={options?.grade_levels || []}
              isOpen={gradeDropdownOpen} onToggle={onGradeDropdownToggle} onSelect={onGradeSelect}
              colClass="flex-1 min-w-0" />
            <Dropdown label="考试" value={filters.exam_filter} options={options?.exams || []}
              isOpen={examDropdownOpen} disabled={!filters.grade_filter}
              colClass="flex-1 min-w-0"
              onToggle={onExamDropdownToggle} onSelect={onExamSelect} />
            <Dropdown label="班级" value={filters.class_filter} options={gradeClasses}
              isOpen={classDropdownOpen} disabled={!filters.grade_filter}
              colClass="flex-1 min-w-0"
              onToggle={onClassDropdownToggle} onSelect={onClassSelect} />
            <div className="flex gap-2 shrink-0">
              <button type="button" className="app-btn-primary" onClick={onFilter}>
                <i className="fas fa-search"></i> 筛选</button>
              <button type="button" className="app-btn-outline" onClick={onReset}>
                <i className="fas fa-undo"></i> 重置筛选</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

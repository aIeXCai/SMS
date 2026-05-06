"use client";

import { Stats } from "./types";

interface Props {
  search: string;
  filterStatus: string;
  filterGrade: string;
  filterClass: string;
  filterGradeDropdownOpen: boolean;
  filterClassDropdownOpen: boolean;
  filterStatusDropdownOpen: boolean;
  stats: Stats | null;
  onSearchChange: (value: string) => void;
  onFilterStatusChange: (value: string) => void;
  onFilterGradeChange: (value: string) => void;
  onFilterClassChange: (value: string) => void;
  onFilterGradeDropdownToggle: () => void;
  onFilterClassDropdownToggle: () => void;
  onFilterStatusDropdownToggle: () => void;
  onReset: () => void;
}

export default function StudentFilterBar({
  search,
  filterStatus,
  filterGrade,
  filterClass,
  filterGradeDropdownOpen,
  filterClassDropdownOpen,
  filterStatusDropdownOpen,
  stats,
  onSearchChange,
  onFilterStatusChange,
  onFilterGradeChange,
  onFilterClassChange,
  onFilterGradeDropdownToggle,
  onFilterClassDropdownToggle,
  onFilterStatusDropdownToggle,
  onReset,
}: Props) {
  return (
    <div className="flex flex-wrap mb-3">
      <div className="w-full">
        <div className="bg-white rounded-lg shadow">
          <div className="px-4 py-3 border-b border-gray-200">
            <h5 className="mb-0">
              <i className="fas fa-filter mr-2"></i>筛选条件
            </h5>
          </div>
          <div className="p-4">
            <div className="flex gap-3">
              <div className="flex-1 min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-1">搜索学号/姓名</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={search}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="输入关键字后自动更新"
                />
              </div>
              <div className="flex-1 min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-1">入学年份</label>
                <div className="custom-dropdown">
                  <button type="button" className={`custom-dropdown-toggle ${filterGradeDropdownOpen ? "active" : ""}`} onClick={onFilterGradeDropdownToggle}>
                    <span>{filterGrade || "全部"}</span>
                    <i className="fas fa-chevron-down custom-dropdown-arrow"></i>
                  </button>
                  <div className={`custom-dropdown-menu ${filterGradeDropdownOpen ? "show" : ""}`}>
                    <button type="button" className="custom-dropdown-item" onClick={() => { onFilterGradeChange(""); onFilterGradeDropdownToggle(); }}>
                      全部
                    </button>
                    {stats?.cohort_choices.map((cohort) => (
                      <button key={cohort} type="button" className="custom-dropdown-item" onClick={() => { onFilterGradeChange(cohort); onFilterGradeDropdownToggle(); }}>
                        {cohort}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-1">班级</label>
                <div className="custom-dropdown">
                  <button type="button" className={`custom-dropdown-toggle ${filterClassDropdownOpen ? "active" : ""}`} onClick={onFilterClassDropdownToggle}>
                    <span>{filterClass || "全部"}</span>
                    <i className="fas fa-chevron-down custom-dropdown-arrow"></i>
                  </button>
                  <div className={`custom-dropdown-menu ${filterClassDropdownOpen ? "show" : ""}`}>
                    <button type="button" className="custom-dropdown-item" onClick={() => { onFilterClassChange(""); onFilterClassDropdownToggle(); }}>
                      全部
                    </button>
                    {stats?.class_name_choices.map((cls) => (
                      <button key={cls} type="button" className="custom-dropdown-item" onClick={() => { onFilterClassChange(cls); onFilterClassDropdownToggle(); }}>
                        {cls}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
                <div className="custom-dropdown">
                  <button type="button" className={`custom-dropdown-toggle ${filterStatusDropdownOpen ? "active" : ""}`} onClick={onFilterStatusDropdownToggle}>
                    <span>{filterStatus || "全部"}</span>
                    <i className="fas fa-chevron-down custom-dropdown-arrow"></i>
                  </button>
                  <div className={`custom-dropdown-menu ${filterStatusDropdownOpen ? "show" : ""}`}>
                    <button type="button" className="custom-dropdown-item" onClick={() => { onFilterStatusChange(""); onFilterStatusDropdownToggle(); }}>
                      全部
                    </button>
                    {stats?.status_choices.map((st) => (
                      <button key={st} type="button" className="custom-dropdown-item" onClick={() => { onFilterStatusChange(st); onFilterStatusDropdownToggle(); }}>
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex-1 min-w-0 flex items-end">
                <button
                  className="border border-gray-300 px-4 py-2 rounded hover:bg-gray-50 transition-colors w-full"
                  onClick={onReset}
                >
                  <i className="fas fa-refresh mr-2"></i>重置过滤条件
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

type Option = {
  value: string;
  label: string;
};

type ExamOptions = {
  academic_years: Option[];
  grade_levels: Option[];
};

interface Props {
  academicYear: string;
  gradeLevel: string;
  academicYearDropdownOpen: boolean;
  gradeLevelDropdownOpen: boolean;
  options: ExamOptions | null;
  onAcademicYearChange: (value: string) => void;
  onGradeLevelChange: (value: string) => void;
  onAcademicYearDropdownToggle: () => void;
  onGradeLevelDropdownToggle: () => void;
  onFilter: () => void;
  onReset: () => void;
}

export default function ExamFilterBar({
  academicYear,
  gradeLevel,
  academicYearDropdownOpen,
  gradeLevelDropdownOpen,
  options,
  onAcademicYearChange,
  onGradeLevelChange,
  onAcademicYearDropdownToggle,
  onGradeLevelDropdownToggle,
  onFilter,
  onReset,
}: Props) {
  return (
    <div className="bg-white rounded-lg shadow mb-3">
      <div className="px-4 py-3 border-b border-gray-200">
        <h5 className="mb-0">
          <i className="fas fa-filter mr-2"></i>筛选条件
        </h5>
      </div>
      <div className="p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="w-full md:w-1/4">
            <label className="block text-sm font-bold text-gray-600 mb-1" style={{ color: '#5a6b63' }}>学年</label>
            <div className="app-custom-dropdown">
              <button
                type="button"
                className={`app-custom-dropdown-toggle ${academicYearDropdownOpen ? "active" : ""}`}
                onClick={onAcademicYearDropdownToggle}
              >
                <span>{academicYear ? options?.academic_years.find(o => o.value === academicYear)?.label || academicYear : "全部学年"}</span>
                <i className="fas fa-chevron-down app-custom-dropdown-arrow"></i>
              </button>
              <div className={`app-custom-dropdown-menu ${academicYearDropdownOpen ? "show" : ""}`}>
                <button type="button" className="app-custom-dropdown-item" onClick={() => { onAcademicYearChange(""); onAcademicYearDropdownToggle(); }}>
                  全部学年
                </button>
                {options?.academic_years.map(oy => (
                  <button key={oy.value} type="button" className="app-custom-dropdown-item" onClick={() => { onAcademicYearChange(oy.value); onAcademicYearDropdownToggle(); }}>
                    {oy.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="w-full md:w-1/4">
            <label className="block text-sm font-bold text-gray-600 mb-1" style={{ color: '#5a6b63' }}>年级</label>
            <div className="app-custom-dropdown">
              <button
                type="button"
                className={`app-custom-dropdown-toggle ${gradeLevelDropdownOpen ? "active" : ""}`}
                onClick={onGradeLevelDropdownToggle}
              >
                <span>{gradeLevel ? options?.grade_levels.find(o => o.value === gradeLevel)?.label || gradeLevel : "全部年级"}</span>
                <i className="fas fa-chevron-down app-custom-dropdown-arrow"></i>
              </button>
              <div className={`app-custom-dropdown-menu ${gradeLevelDropdownOpen ? "show" : ""}`}>
                <button type="button" className="app-custom-dropdown-item" onClick={() => { onGradeLevelChange(""); onGradeLevelDropdownToggle(); }}>
                  全部年级
                </button>
                {options?.grade_levels.map(og => (
                  <button key={og.value} type="button" className="app-custom-dropdown-item" onClick={() => { onGradeLevelChange(og.value); onGradeLevelDropdownToggle(); }}>
                    {og.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="w-full md:w-1/4 flex items-end gap-2">
            <button type="button" className="app-btn-primary" onClick={onFilter}>
              <i className="fas fa-search mr-1"></i>筛选
            </button>
            <button type="button" className="app-btn-outline" onClick={onReset}>
              <i className="fas fa-undo mr-1"></i>重置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

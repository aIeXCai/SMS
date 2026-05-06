"use client";

interface ScoreSearchBarProps {
  studentIdFilter: string;
  studentNameFilter: string;
  onStudentIdChange: (value: string) => void;
  onStudentNameChange: (value: string) => void;
  onSearch: () => void;
}

export default function ScoreSearchBar({
  studentIdFilter,
  studentNameFilter,
  onStudentIdChange,
  onStudentNameChange,
  onSearch,
}: ScoreSearchBarProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onSearch();
    }
  };

  return (
    <div className="flex items-center gap-3 mb-3 p-3 bg-white rounded-lg shadow-sm">
      <div className="flex items-center gap-2">
        <i className="fas fa-search text-gray-400"></i>
        <span className="text-sm text-gray-500 font-semibold whitespace-nowrap">快速搜索</span>
      </div>
      <input
        type="text"
        className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        style={{ maxWidth: "160px" }}
        placeholder="学号"
        value={studentIdFilter}
        onChange={(e) => onStudentIdChange(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <input
        type="text"
        className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        style={{ maxWidth: "160px" }}
        placeholder="学生姓名"
        value={studentNameFilter}
        onChange={(e) => onStudentNameChange(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button type="button" className="app-btn-primary" onClick={onSearch}>
        <i className="fas fa-search"></i> 搜索
      </button>
    </div>
  );
}

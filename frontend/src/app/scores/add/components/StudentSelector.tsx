import type { StudentItem } from "../types";

type Props = {
  studentQuery: string;
  searchLoading: boolean;
  searchResults: StudentItem[];
  onQueryChange: (value: string) => void;
  onSelect: (student: StudentItem) => void;
};

export default function StudentSelector({
  studentQuery,
  searchLoading,
  searchResults,
  onQueryChange,
  onSelect,
}: Props) {
  return (
    <>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        <i className="fas fa-user mr-1"></i>选择学生 <span className="text-red-600">*</span>
      </label>
      <div className="student-search-container">
        <input
          className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="输入学生姓名、学号或班级进行搜索..."
          value={studentQuery}
          onChange={(e) => onQueryChange(e.target.value)}
        />
        {(searchLoading || searchResults.length > 0) && (
          <div className="student-search-dropdown">
            {searchLoading ? (
              <div className="student-search-loading">搜索中...</div>
            ) : (
              searchResults.map((item) => (
                <div
                  key={item.id}
                  className="student-search-item"
                  onClick={() => onSelect(item)}
                >
                  <strong>{item.name}</strong> ({item.student_id})
                  <div className="text-sm text-gray-500">
                    {item.grade_level_display}
                    {item.class_name}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
      <style jsx>{`
        .student-search-container {
          position: relative;
          z-index: 1200;
        }
        .student-search-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: white;
          border: 1px solid #ced4da;
          border-top: none;
          border-radius: 0 0 8px 8px;
          max-height: 200px;
          overflow-y: auto;
          z-index: 2000;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        .student-search-item {
          padding: 0.75rem;
          cursor: pointer;
          border-bottom: 1px solid #f8f9fa;
        }
        .student-search-item:hover {
          background-color: #f8f9fa;
        }
        .student-search-loading {
          padding: 0.75rem;
          text-align: center;
          color: #6c757d;
          font-style: italic;
        }
      `}</style>
    </>
  );
}

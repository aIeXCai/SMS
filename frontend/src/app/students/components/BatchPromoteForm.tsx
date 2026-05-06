"use client";

interface Props {
  studentCount: number;
  gradeLevelChoices: string[];
  targetGradeLevel: string;
  currentGradeLevel: string;
  autoCreateClasses: boolean;
  isSubmitting: boolean;
  onChange: (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export default function BatchPromoteForm({
  studentCount,
  gradeLevelChoices,
  targetGradeLevel,
  currentGradeLevel,
  autoCreateClasses,
  isSubmitting,
  onChange,
  onSubmit,
  onCancel,
}: Props) {
  return (
    <div className="promote-card mb-5">
      {/* kept because: gradient header */}
      <div className="card-header">
        <h5 className="mb-0 text-blue-600">
          <i className="fas fa-graduation-cap mr-2"></i>批量升年级操作
        </h5>
      </div>
      <div className="card-body">
        {/* Selected students preview */}
        <div className="selected-students-preview text-center">
          <div className="flex flex-wrap items-center">
            <div className="w-full md:w-1/3">
              <div className="student-count">{studentCount}</div>
              <small className="text-gray-500">选中学生</small>
            </div>
            <div className="w-full md:w-2/3">
              <h6 className="mb-2">
                <i className="fas fa-users text-blue-600 mr-2"></i>已选择学生
              </h6>
              <p className="mb-0 text-gray-500">
                您已选择了 <span className="font-bold text-blue-600">{studentCount}</span> 名学生进行升年级操作
              </p>
            </div>
          </div>
        </div>

        {/* Instructions */}
        {/* kept because: gradient background */}
        <div className="info-box">
          <div className="info-icon">
            <i className="fas fa-lightbulb"></i>
          </div>
          <h6 className="text-green-600 font-bold mb-2">操作说明</h6>
          <p className="mb-0 text-gray-500">
            升年级操作将自动为学生分配到对应年级的班级。如果目标班级不存在，系统将自动创建新班级。
          </p>
        </div>

        {/* Warning */}
        {/* kept because: gradient background */}
        <div className="warning-box">
          <div className="warning-icon text-center">
            <i className="fas fa-exclamation-triangle"></i>
          </div>
          <h6 className="text-yellow-600 font-bold mb-2">
            <i className="fas fa-exclamation-triangle mr-2"></i>重要提示
          </h6>
          <ul className="mb-0 text-gray-500 list-none p-0 text-left">
            <li><i className="fas fa-check text-yellow-600 mr-2"></i>升年级操作将修改学生所属班级信息</li>
            <li><i className="fas fa-check text-yellow-600 mr-2"></i>如果目标班级不存在，系统可能会自动创建</li>
            <li><i className="fas fa-check text-yellow-600 mr-2"></i>此操作执行后不可撤销，请谨慎操作</li>
          </ul>
        </div>

        {/* Promote form */}
        <form onSubmit={onSubmit}>
          <div className="form-group-custom">
            <label htmlFor="target_grade_level" className="form-label">
              <i className="fas fa-graduation-cap mr-2 text-blue-600"></i>目标年级
            </label>
            <select
              className="form-select"
              name="target_grade_level"
              id="target_grade_level"
              value={targetGradeLevel}
              onChange={onChange}
              required
            >
              <option value="">请选择目标年级</option>
              {gradeLevelChoices.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <div className="form-text">
              <i className="fas fa-info-circle mr-1"></i>学生将要升入的年级
            </div>
          </div>

          <div className="form-group-custom">
            <label htmlFor="current_grade_level" className="form-label">
              <i className="fas fa-filter mr-2 text-gray-500"></i>限定当前年级 (可选)
            </label>
            <select
              className="form-select"
              name="current_grade_level"
              id="current_grade_level"
              value={currentGradeLevel}
              onChange={onChange}
            >
              <option value="">不限定（全部选中学生均执行）</option>
              {gradeLevelChoices.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <div className="form-text">
              <i className="fas fa-info-circle mr-1"></i>如果设置，只有属于此年级的选中学生才会被升级
            </div>
          </div>

          {/* Auto-create classes toggle */}
          <div className="form-group-custom mt-4">
            <div className="form-switch flex items-center">
              <div className="mr-3">
                <input
                  type="checkbox"
                  className="form-check-input ml-0"
                  name="auto_create_classes"
                  id="auto_create_classes"
                  checked={autoCreateClasses}
                  onChange={onChange}
                />
              </div>
              <div>
                <label className="font-medium mb-0 text-sm text-gray-700" htmlFor="auto_create_classes">
                  <i className="fas fa-plus-circle mr-2 text-green-600"></i>自动创建缺失的目标班级
                </label>
                <div className="form-text mt-1">
                  <i className="fas fa-info-circle mr-1"></i>例如：某生原为&ldquo;一年级1班&rdquo;，如勾选此项，在目标年级找不到&ldquo;1班&rdquo;时会自动创建&ldquo;{targetGradeLevel || '目标年级'}1班&rdquo;
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center mt-5">
            <div className="btn-group-custom flex">
              <button type="button" className="btn-outline-secondary btn-custom mr-3" onClick={onCancel}>
                <i className="fas fa-times mr-2"></i>取消
              </button>
              <button type="submit" className="btn-info-custom btn-custom" disabled={isSubmitting || studentCount === 0}>
                <i className="fas fa-save mr-2"></i>
                {isSubmitting ? "处理中..." : "确认升年级"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

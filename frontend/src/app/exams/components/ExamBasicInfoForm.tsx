"use client";

type Option = { value: string; label: string };
type ExamOptions = { academic_years: Option[]; grade_levels: Option[] };

interface Props {
  academicYear: string;
  name: string;
  date: string;
  gradeLevel: string;
  description: string;
  options: ExamOptions | null;
  errors: Record<string, string>;
  onAcademicYearChange: (v: string) => void;
  onNameChange: (v: string) => void;
  onDateChange: (v: string) => void;
  onGradeLevelChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onNextStep: () => void;
  onCancel: () => void;
  // For edit mode: show current exam info banner
  editBanner?: string;
}

export default function ExamBasicInfoForm({
  academicYear,
  name,
  date,
  gradeLevel,
  description,
  options,
  errors,
  onAcademicYearChange,
  onNameChange,
  onDateChange,
  onGradeLevelChange,
  onDescriptionChange,
  onNextStep,
  onCancel,
  editBanner,
}: Props) {
  return (
    <div className="bg-white rounded-2xl shadow-sm" style={{ borderRadius: 15 }}>
      <div className="p-4">
        {editBanner && (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded py-2 mb-4">
            <i className="fas fa-info-circle mr-2"></i>
            <span dangerouslySetInnerHTML={{ __html: editBanner }} />
          </div>
        )}

        <h5 className="font-bold mb-4 text-gray-900">
          <i className="fas fa-info-circle mr-2 text-blue-600"></i>考试基本信息
        </h5>

        <div className="mb-3">
          <label className="block text-sm font-bold text-gray-700 mb-1">学年 <span className="text-red-600">*</span></label>
          <select
            className={`w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 ${errors.academicYear ? "border-red-500" : ""}`}
            value={academicYear}
            onChange={(e) => onAcademicYearChange(e.target.value)}
          >
            <option value="">-- 请选择学年 --</option>
            {options?.academic_years.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {errors.academicYear && <div className="text-red-600 text-sm mt-1">{errors.academicYear}</div>}
        </div>

        <div className="mb-3">
          <label className="block text-sm font-bold text-gray-700 mb-1">考试名称 <span className="text-red-600">*</span></label>
          <input
            type="text"
            className={`w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.name ? "border-red-500" : ""}`}
            placeholder="例：期中考试、期末考试、月考"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
          />
          {errors.name && <div className="text-red-600 text-sm mt-1">{errors.name}</div>}
        </div>

        <div className="mb-3">
          <label className="block text-sm font-bold text-gray-700 mb-1">考试日期 <span className="text-red-600">*</span></label>
          <input
            type="date"
            className={`w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.date ? "border-red-500" : ""}`}
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
          />
          {errors.date && <div className="text-red-600 text-sm mt-1">{errors.date}</div>}
        </div>

        <div className="mb-3">
          <label className="block text-sm font-bold text-gray-700 mb-1">适用年级 <span className="text-red-600">*</span></label>
          <select
            className={`w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 ${errors.gradeLevel ? "border-red-500" : ""}`}
            value={gradeLevel}
            onChange={(e) => onGradeLevelChange(e.target.value)}
          >
            <option value="">-- 请选择年级 --</option>
            {options?.grade_levels.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {errors.gradeLevel && <div className="text-red-600 text-sm mt-1">{errors.gradeLevel}</div>}
          <div className="text-gray-500 text-sm mt-1">选择年级后，系统将在下一步自动推荐该年级的常考科目和标准满分</div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-bold text-gray-700 mb-1">考试描述（可选）</label>
          <textarea
            className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            rows={3}
            placeholder="可选：填写考试的相关说明或注意事项"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
          />
        </div>

        <div className="flex justify-between">
          <button type="button" className="border border-gray-300 px-4 py-2 rounded hover:bg-gray-50 transition-colors" onClick={onCancel}>
            取消
          </button>
          <button className="bg-blue-600 text-white px-5 py-2 rounded hover:bg-blue-700 transition-colors" onClick={onNextStep}>
            下一步：配置科目 <i className="fas fa-arrow-right ml-2"></i>
          </button>
        </div>
      </div>
    </div>
  );
}

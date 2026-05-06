export default function InstructionsPanel() {
  return (
    <div className="flex flex-wrap mb-4">
      <div className="w-full">
        <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded tips-alert">
          <div className="flex items-center">
            <i className="fas fa-info-circle fa-2x mr-3 text-green-600"></i>
            <div>
              <h6 className="alert-heading mb-1 text-green-600">
                <i className="fas fa-lightbulb mr-1"></i>操作指南
              </h6>
              <p className="mb-0 text-sm text-green-600">
                <strong>1. 选择年级</strong> →{" "}
                <strong>2. 设置考试范围</strong> →{" "}
                <strong>3. 输入前N名阈值</strong> →{" "}
                <strong>4. 选择满足方式</strong> →{" "}
                <strong>5. 点击查询</strong>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

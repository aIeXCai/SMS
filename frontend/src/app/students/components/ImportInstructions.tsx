"use client";

interface Props {
  onDownloadTemplate: () => void;
}

export default function ImportInstructions({ onDownloadTemplate }: Props) {
  return (
    <>
      {/* kept because: gradient background */}
      <div className="border mb-4" style={{ background: 'linear-gradient(135deg, #d1ecf1 0%, #bee5eb 100%)', borderColor: '#bee5eb', borderRadius: '10px', padding: '1.5rem' }}>
        <div className="flex items-start">
          <i className="fas fa-info-circle mr-3" style={{ fontSize: '2rem', color: '#0c5460' }}></i>
          <div>
            <h6 className="font-bold mb-2 text-gray-900">导入说明</h6>
            <ul className="mb-0 pl-3 text-gray-900 text-sm" style={{ opacity: 0.9, lineHeight: '1.8' }}>
              <li>请先下载系统提供的标准 <strong>Excel 模板文件</strong>。</li>
              <li><strong>学号</strong> 和 <strong>姓名</strong> 为必填项。</li>
              <li>若系统已存在相同学号，将执行<strong>更新操作</strong>。</li>
              <li>日期格式确保为 <strong>YYYY-MM-DD</strong>。</li>
            </ul>
          </div>
        </div>
      </div>

      {/* kept because: gradient background */}
      <div className="mb-4 text-center" style={{ background: 'linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%)', border: '1px solid #ffeaa7', borderRadius: '10px', padding: '1.5rem' }}>
        <button
          type="button"
          onClick={onDownloadTemplate}
          className="bg-yellow-500 text-gray-900 font-bold shadow-sm px-4 py-2 rounded-full hover:bg-yellow-600 transition-all"
        >
          <i className="fas fa-download mr-2"></i>下载导入模板
        </button>
      </div>
    </>
  );
}

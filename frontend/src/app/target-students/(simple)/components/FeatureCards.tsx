export default function FeatureCards() {
  return (
    <div className="flex flex-wrap gap-4">
      {/* 左侧：功能特点 */}
      <div className="flex-1 min-w-0">
        <div className="intro-card h-100">
          <div className="intro-card-header">
            <div className="intro-icon-wrapper">
              <i className="fas fa-star"></i>
            </div>
            <h5 className="mb-0">功能特点</h5>
          </div>
          <div className="intro-card-body">
            <div className="feature-item">
              <div className="feature-icon">
                <i className="fas fa-chart-line"></i>
              </div>
              <div className="feature-content">
                <h6>稳定优生识别</h6>
                <p>筛选多次考试中持续保持前列的学生</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">
                <i className="fas fa-crown"></i>
              </div>
              <div className="feature-content">
                <h6>拔尖生定位</h6>
                <p>快速找出年级排名前列的目标学生</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">
                <i className="fas fa-sliders-h"></i>
              </div>
              <div className="feature-content">
                <h6>灵活条件配置</h6>
                <p>支持指定考试范围、K次命中、缺考处理等多种规则</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 右侧：指标说明 */}
      <div className="flex-1 min-w-0">
        <div className="intro-card h-100">
          <div className="intro-card-header">
            <div className="intro-icon-wrapper">
              <i className="fas fa-info-circle"></i>
            </div>
            <h5 className="mb-0">指标说明</h5>
          </div>
          <div className="intro-card-body">
            <div className="indicator-item">
              <div className="indicator-tag">总分年级排名</div>
              <p>该学生在某次考试中的总分在年级所有学生中的排名</p>
            </div>
            <div className="indicator-item">
              <div className="indicator-tag">前N名</div>
              <p>排名数值 ≤ N 的学生（如前50名，即排名1-50名）</p>
            </div>
            <div className="indicator-item">
              <div className="indicator-tag warning">缺考判定</div>
              <p>
                <strong>缺考视为不达标：</strong>缺考直接判定为不满足条件
                <br />
                <strong>忽略缺考：</strong>缺考不计入统计，仅统计有成绩的学生
              </p>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .intro-card {
          background: #fff;
          border: none;
          border-radius: 16px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          overflow: hidden;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .intro-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
        }
        .intro-card-header {
          background: linear-gradient(135deg, #2e7d32 0%, #43a047 100%);
          color: white;
          padding: 1.25rem 1.5rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .intro-card-header h5 {
          font-weight: 600;
          margin: 0;
        }
        .intro-icon-wrapper {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .intro-icon-wrapper i {
          font-size: 1.25rem;
        }
        .intro-card-body {
          padding: 1.5rem;
        }
        .feature-item {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          margin-bottom: 1.25rem;
        }
        .feature-item:last-child {
          margin-bottom: 0;
        }
        .feature-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .feature-icon i {
          color: #2e7d32;
          font-size: 1.1rem;
        }
        .feature-content h6 {
          font-size: 0.95rem;
          font-weight: 600;
          color: #2c3e50;
          margin-bottom: 0.25rem;
        }
        .feature-content p {
          font-size: 0.85rem;
          color: #6c757d;
          margin: 0;
          line-height: 1.5;
        }
        .indicator-item {
          margin-bottom: 1rem;
        }
        .indicator-item:last-child {
          margin-bottom: 0;
        }
        .indicator-tag {
          display: inline-block;
          background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
          color: #1565c0;
          font-size: 0.8rem;
          font-weight: 600;
          padding: 0.25rem 0.75rem;
          border-radius: 6px;
          margin-bottom: 0.5rem;
        }
        .indicator-tag.warning {
          background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
          color: #e65100;
        }
        .indicator-item p {
          font-size: 0.85rem;
          color: #495057;
          margin: 0;
          line-height: 1.6;
        }
      `}</style>
    </div>
  );
}

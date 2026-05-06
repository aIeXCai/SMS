import type { EditDetail } from "../types";

interface Props {
  detail: EditDetail;
}

export default function StudentInfoCard({ detail }: Props) {
  return (
    <div className="student-info-card animate-in">
      <h5 className="student-info-header">
        <i className="fas fa-user-graduate mr-2"></i>学生信息
      </h5>
      <div className="student-info-body">
        <div className="flex flex-wrap">
          <div className="w-full md:w-1/2">
            <div className="info-item">
              <div className="info-icon"><i className="fas fa-user"></i></div>
              <div><strong>学生姓名：</strong>{detail.student.name}</div>
            </div>
            <div className="info-item">
              <div className="info-icon"><i className="fas fa-id-card"></i></div>
              <div><strong>学号：</strong>{detail.student.student_id}</div>
            </div>
          </div>
          <div className="w-full md:w-1/2">
            <div className="info-item">
              <div className="info-icon"><i className="fas fa-graduation-cap"></i></div>
              <div>
                <strong>年级班级：</strong>
                {detail.student.grade_level_display || "未设置"} {detail.student.class_name || "未分班"}
              </div>
            </div>
            <div className="info-item">
              <div className="info-icon"><i className="fas fa-clipboard-list"></i></div>
              <div><strong>考试：</strong>{detail.exam.name} ({detail.exam.academic_year})</div>
            </div>
          </div>
        </div>
        <div className="info-item mt-2">
          <div className="info-icon"><i className="fas fa-calendar-alt"></i></div>
          <div><strong>考试日期：</strong>{detail.exam.date?.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$1年$2月$3日")}</div>
        </div>
      </div>
      <style jsx global>{`
        .student-info-card {
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          border: none;
          border-radius: 15px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          margin-bottom: 2rem;
          overflow: hidden;
        }
        .student-info-header {
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          color: white;
          padding: 1rem 1.5rem;
          margin: 0;
        }
        .student-info-body {
          padding: 1.5rem;
        }
        .info-item {
          display: flex;
          align-items: center;
          margin-bottom: 0.8rem;
          padding: 0.5rem;
          background: rgba(255, 255, 255, 0.7);
          border-radius: 8px;
        }
        .info-icon {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #007bff, #0056b3);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          margin-right: 1rem;
          font-size: 0.9rem;
        }
      `}</style>
    </div>
  );
}

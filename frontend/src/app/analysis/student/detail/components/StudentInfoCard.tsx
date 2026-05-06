"use client";

import type { AnalysisData } from "./types";

type Props = { data: AnalysisData };

export default function StudentInfoCard({ data }: Props) {
  const info = data.student_info;
  return (
    <div className="analysis-info-card alert-modern">
      <div className="flex items-center">
        <i className="fas fa-info-circle fa-2x mr-3 text-green-600"></i>
        <div>
          <h6 className="alert-heading mb-1 text-green-600"><i className="fas fa-user mr-1"></i>学生信息</h6>
          <p className="mb-0 text-green-600">
            <strong>学号：</strong>{info.student_id} |
            <strong>年级：</strong>{info.grade_level} |
            <strong>班级：</strong>{info.class_name || "未分班"} |
            <strong>考试次数：</strong><span>{data.exams.length}</span>次
          </p>
        </div>
      </div>
    </div>
  );
}

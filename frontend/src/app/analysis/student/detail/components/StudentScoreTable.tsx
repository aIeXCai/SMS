"use client";

import type { AnalysisData } from "./types";
import { getExamDisplayText } from "./types";

type Props = { data: AnalysisData };

export default function StudentScoreTable({ data }: Props) {
  return (
    <div className="flex flex-wrap mb-6">
      <div className="w-full">
        <div className="chart-card">
          <div className="card-header"><h5><i className="fas fa-table mr-2"></i>学生详细成绩数据</h5></div>
          <div className="card-body">
            <div className="table-container-wrapper">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse score-table" id="studentScoreTable">
                  <thead>
                    <tr>
                      <th>考试名称</th><th>总分</th><th>班排</th><th>级排</th><th>各科详情</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.exams.map((exam) => (
                      <tr key={exam.id}>
                        <td>{getExamDisplayText(exam)}</td>
                        <td><span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">{exam.total_score || 0}</span></td>
                        <td><span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">{exam.class_total_rank || "-"}</span></td>
                        <td><span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">{exam.grade_total_rank || "-"}</span></td>
                        <td>
                          <div className="flex flex-nowrap gap-1 subject-detail-scroll">
                            {(exam.scores || []).map((score, idx) => {
                              const gRank = score.grade_rank ? `级排:${score.grade_rank}` : "";
                              const cRank = score.class_rank ? `班排:${score.class_rank}` : "";
                              const rank = gRank && cRank ? `(${gRank},${cRank})` : gRank ? `(${gRank})` : cRank ? `(${cRank})` : "";
                              return <small key={`${exam.id}-${idx}`} className="bg-gray-50 text-gray-900 text-xs px-2 py-0.5 rounded mr-1">{score.subject_name}:{score.score_value || 0}{rank}</small>;
                            })}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

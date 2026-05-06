"use client";

import type { AnalysisData } from "./types";

type Props = {
  data: AnalysisData;
};

export default function GradeStatsCards({ data }: Props) {
  return (
    <div className="flex flex-wrap mb-4">
      <div className="w-full md:w-1/4">
        <div className="stats-card text-center">
          <div className="stats-number">{data.total_students}</div>
          <div className="stats-label">总参考学生数</div>
        </div>
      </div>
      <div className="w-full md:w-1/4">
        <div className="stats-card text-center">
          <div className="stats-number">{data.total_classes}</div>
          <div className="stats-label">参考班级数</div>
        </div>
      </div>
      <div className="w-full md:w-1/4">
        <div className="stats-card text-center">
          <div className="stats-number">{Number(data.grade_avg_score || 0).toFixed(1)}</div>
          <div className="stats-label">年级平均总分</div>
        </div>
      </div>
      <div className="w-full md:w-1/4">
        <div className="stats-card text-center">
          <div className="stats-number">{Number(data.total_max_score || 0).toFixed(0)}</div>
          <div className="stats-label">本场考试满分</div>
        </div>
      </div>
    </div>
  );
}

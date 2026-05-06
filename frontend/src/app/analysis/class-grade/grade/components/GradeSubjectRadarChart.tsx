"use client";

import { useEffect, useRef } from "react";
import Chart, {
  GREEN_PRIMARY,
  GREEN_PRIMARY_ALPHA,
  DATALABELS_HIDDEN,
  RESPONSIVE_CHART,
  RADAR_R_SCALE,
} from "@/lib/chart";

type Props = {
  subjectNames: string[];
  subjectAverages: number[];
  subjectMaxScores: number[];
  gradeLevel: string;
};

export default function GradeSubjectRadarChart({ subjectNames, subjectAverages, subjectMaxScores, gradeLevel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current || subjectNames.length === 0) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

    const fallbackMax = gradeLevel.startsWith("初") ? 120 : 150;
    const normalizedData = subjectMaxScores.length > 0 && subjectMaxScores.length === subjectAverages.length
      ? subjectAverages.map((score, i) => {
          const max = Number(subjectMaxScores[i] || 0);
          return max > 0 ? Number(score || 0) / max : 0;
        })
      : subjectAverages.map((score) => Number(score || 0) / fallbackMax);

    chartRef.current = new Chart(canvasRef.current, {
      type: "radar",
      data: {
        labels: subjectNames,
        datasets: [{
          label: "年级标准化平均分",
          data: normalizedData,
          backgroundColor: GREEN_PRIMARY_ALPHA,
          borderColor: GREEN_PRIMARY,
          borderWidth: 3,
          pointBackgroundColor: GREEN_PRIMARY,
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointRadius: 6,
          pointHoverBackgroundColor: "#fff",
          pointHoverBorderColor: GREEN_PRIMARY,
          pointHoverRadius: 8,
        }],
      },
      options: {
        ...RESPONSIVE_CHART,
        scales: { ...RADAR_R_SCALE },
        plugins: {
          legend: { display: false },
          datalabels: DATALABELS_HIDDEN,
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const i = ctx.dataIndex;
                const raw = Number(subjectAverages[i] || 0).toFixed(1);
                const maxForSubject = subjectMaxScores[i];
                const maxText = maxForSubject ? `/${maxForSubject}` : "";
                const pct = (Number(ctx.parsed.r) * 100).toFixed(1);
                return `实际分数: ${raw}${maxText}分 | 标准化分数: ${pct}%`;
              },
            },
          },
        },
      },
    });

    return () => { chartRef.current?.destroy(); chartRef.current = null; };
  }, [subjectNames, subjectAverages, subjectMaxScores, gradeLevel]);

  return (
    <div className="chart-card">
      <div className="card-header"><h5><i className="fas fa-chart-line"></i> 各科目年级平均分标准化雷达图</h5></div>
      <div className="card-body"><div className="chart-container"><canvas ref={canvasRef}></canvas></div></div>
    </div>
  );
}

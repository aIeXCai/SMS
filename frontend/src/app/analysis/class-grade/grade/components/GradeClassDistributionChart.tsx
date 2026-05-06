"use client";

import { useEffect, useRef } from "react";
import Chart, {
  GRADE_DISTRIBUTION_COLORS,
  GRADE_DISTRIBUTION_BORDERS,
  GRADE_RANGE_LABELS,
  DATALABELS_CENTER,
  SCALE_X_COMMON,
  SCALE_Y_INTEGER,
  RESPONSIVE_CHART,
} from "@/lib/chart";

type Props = {
  classNames: string[];
  classGradeDistribution: Record<string, number[]>;
};

export default function GradeClassDistributionChart({ classNames, classGradeDistribution }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current || classNames.length === 0) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

    chartRef.current = new Chart(canvasRef.current, {
      type: "bar",
      data: {
        labels: classNames,
        datasets: GRADE_RANGE_LABELS.map((label, i) => ({
          label,
          data: classNames.map((cn) => Number(classGradeDistribution?.[cn]?.[i] || 0)),
          backgroundColor: GRADE_DISTRIBUTION_COLORS[i],
          borderColor: GRADE_DISTRIBUTION_BORDERS[i],
          borderWidth: 1,
          borderRadius: 4,
        })),
      },
      options: {
        ...RESPONSIVE_CHART,
        scales: {
          x: { stacked: true, ...SCALE_X_COMMON },
          y: { ...SCALE_Y_INTEGER, stacked: true, title: { display: true, text: "学生人数", color: "#6c757d", font: { size: 14, weight: 500 } } },
        },
        plugins: {
          legend: { position: "top" as const, reverse: true, labels: { padding: 15, usePointStyle: true, font: { size: 12 } } },
          datalabels: { ...DATALABELS_CENTER, formatter: (v) => { const c = Number(v); return c > 0 ? `${c}` : ""; } },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}人`,
            },
          },
        },
      },
    });

    return () => { chartRef.current?.destroy(); chartRef.current = null; };
  }, [classNames, classGradeDistribution]);

  return (
    <div className="chart-card">
      <div className="card-header"><h5><i className="fas fa-chart-bar"></i> 各班级等级分布</h5></div>
      <div className="card-body"><div className="chart-container"><canvas ref={canvasRef}></canvas></div></div>
    </div>
  );
}

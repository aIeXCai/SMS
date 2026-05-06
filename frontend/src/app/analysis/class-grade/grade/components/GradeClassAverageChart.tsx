"use client";

import { useEffect, useRef } from "react";
import Chart, {
  GRADIENT_BAR_COLORS,
  DATALABELS_ABOVE,
  SCALE_X_COMMON,
  SCALE_Y_COMMON,
  RESPONSIVE_CHART,
} from "@/lib/chart";

type Props = {
  classNames: string[];
  classAverages: number[];
  totalMaxScore: number;
};

export default function GradeClassAverageChart({ classNames, classAverages, totalMaxScore }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current || classNames.length === 0) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

    const barColors = classNames.map((_, i) => GRADIENT_BAR_COLORS[i % GRADIENT_BAR_COLORS.length]);
    const barBorders = barColors.map((c) => c.replace("0.8", "1"));

    chartRef.current = new Chart(canvasRef.current, {
      type: "bar",
      data: {
        labels: classNames,
        datasets: [{
          label: "班级平均分",
          data: classAverages,
          backgroundColor: barColors,
          borderColor: barBorders,
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false,
        }],
      },
      options: {
        ...RESPONSIVE_CHART,
        plugins: {
          legend: { display: false },
          datalabels: { ...DATALABELS_ABOVE, formatter: (v) => Number(v).toFixed(1) },
          tooltip: {
            callbacks: {
              label: (ctx) => `平均分: ${Number(ctx.parsed.y).toFixed(1)}分`,
            },
          },
        },
        scales: {
          x: { ...SCALE_X_COMMON },
          y: { ...SCALE_Y_COMMON, max: Math.max(totalMaxScore || 0, 1) },
        },
      },
    });

    return () => { chartRef.current?.destroy(); chartRef.current = null; };
  }, [classNames, classAverages, totalMaxScore]);

  return (
    <div className="chart-card">
      <div className="card-header"><h5><i className="fas fa-chart-bar"></i> 各班级平均分对比</h5></div>
      <div className="card-body"><div className="chart-container"><canvas ref={canvasRef}></canvas></div></div>
    </div>
  );
}

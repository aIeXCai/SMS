"use client";

import { useEffect, useRef, useMemo } from "react";
import Chart, {
  GREEN_PRIMARY,
  GREEN_PRIMARY_ALPHA,
  DATALABELS_HIDDEN,
  SCALE_X_COMMON,
  RESPONSIVE_CHART,
} from "@/lib/chart";

type Props = {
  subjectNames: string[];
  difficultyCoefficients: number[];
};

export default function GradeDifficultyChart({ subjectNames, difficultyCoefficients }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  const yRange = useMemo(() => {
    const values = difficultyCoefficients.map(Number).filter((v) => Number.isFinite(v));
    if (values.length === 0) return { min: 0, max: 1 };
    const obsMin = Math.min(...values);
    const obsMax = Math.max(...values);
    const range = Math.max(obsMax - obsMin, 0.05);
    const pad = range * 0.2;
    let min = Math.max(0, +(obsMin - pad).toFixed(2));
    let max = Math.min(1, +(obsMax + pad).toFixed(2));
    if (max - min < 0.1) {
      const center = (max + min) / 2;
      min = Math.max(0, +(center - 0.05).toFixed(2));
      max = Math.min(1, +(center + 0.05).toFixed(2));
    }
    return { min, max };
  }, [difficultyCoefficients]);

  useEffect(() => {
    if (!canvasRef.current || subjectNames.length === 0) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

    chartRef.current = new Chart(canvasRef.current, {
      type: "line",
      data: {
        labels: subjectNames,
        datasets: [{
          label: "难度系数",
          data: difficultyCoefficients,
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
          tension: 0.3,
          fill: true,
        }],
      },
      options: {
        ...RESPONSIVE_CHART,
        plugins: {
          legend: { display: false },
          datalabels: DATALABELS_HIDDEN,
          tooltip: {
            callbacks: {
              label: (ctx) => `难度系数: ${Number(ctx.parsed.y).toFixed(3)}`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: false,
            min: yRange.min,
            max: yRange.max,
            grid: { color: "rgba(0,0,0,0.1)" },
            ticks: { color: "#6c757d", font: { size: 14 }, callback: (v) => Number(v).toFixed(2) },
          },
          x: { ...SCALE_X_COMMON },
        },
      },
    });

    return () => { chartRef.current?.destroy(); chartRef.current = null; };
  }, [subjectNames, difficultyCoefficients, yRange]);

  return (
    <div className="chart-card">
      <div className="card-header"><h5><i className="fas fa-chart-line"></i> 各科目难度系数</h5></div>
      <div className="card-body"><div className="chart-container"><canvas ref={canvasRef}></canvas></div></div>
    </div>
  );
}

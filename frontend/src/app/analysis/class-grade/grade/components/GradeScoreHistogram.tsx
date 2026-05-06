"use client";

import { useEffect, useRef, useMemo } from "react";
import Chart, {
  GREEN_PRIMARY,
  GREEN_PRIMARY_ALPHA,
  DATALABELS_ABOVE,
  SCALE_X_COMMON,
  SCALE_Y_INTEGER,
  RESPONSIVE_CHART,
} from "@/lib/chart";

type Props = {
  totalScores: number[];
};

export default function GradeScoreHistogram({ totalScores }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  const bins = useMemo(() => {
    if (totalScores.length === 0) return { labels: [] as string[], counts: [] as number[] };
    const min = Math.min(...totalScores);
    const max = Math.max(...totalScores);
    const range = Math.max(max - min, 1);
    let binCount = Math.min(12, Math.max(6, Math.ceil(Math.sqrt(totalScores.length))));
    if (range < binCount) binCount = Math.max(3, Math.ceil(range));
    const binWidth = Math.max(Math.ceil(range / binCount), 1);

    const labels: string[] = [];
    const counts: number[] = [];
    for (let i = 0; i < binCount; i++) {
      const binStart = min + i * binWidth;
      const binEnd = i === binCount - 1 ? max : binStart + binWidth - 1;
      labels.push(`${Math.floor(binStart)}-${Math.floor(binEnd)}`);
      const count = totalScores.filter((s) => i === binCount - 1 ? s >= binStart && s <= binEnd : s >= binStart && s < binStart + binWidth).length;
      counts.push(count);
    }
    return { labels, counts };
  }, [totalScores]);

  useEffect(() => {
    if (!canvasRef.current || bins.labels.length === 0) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

    chartRef.current = new Chart(canvasRef.current, {
      type: "bar",
      data: {
        labels: bins.labels,
        datasets: [{
          label: "学生人数",
          data: bins.counts,
          backgroundColor: GREEN_PRIMARY_ALPHA,
          borderColor: GREEN_PRIMARY,
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false,
        }],
      },
      options: {
        ...RESPONSIVE_CHART,
        plugins: {
          legend: { display: false },
          datalabels: { ...DATALABELS_ABOVE, formatter: (v) => `${Math.round(Number(v))}` },
          tooltip: {
            callbacks: {
              title: (ctx) => `分数区间: ${ctx[0].label}分`,
              label: (ctx) => {
                const pct = ((Number(ctx.parsed.y) / totalScores.length) * 100).toFixed(1);
                return `学生人数: ${ctx.parsed.y}人 (${pct}%)`;
              },
            },
          },
        },
        scales: {
          x: { ...SCALE_X_COMMON, ticks: { color: "#6c757d", font: { size: 14 }, maxRotation: 45 } },
          y: { ...SCALE_Y_INTEGER, title: { display: true, text: "学生人数", color: "#6c757d", font: { size: 14, weight: 500 } } },
        },
      },
    });

    return () => { chartRef.current?.destroy(); chartRef.current = null; };
  }, [bins, totalScores.length]);

  return (
    <div className="chart-card">
      <div className="card-header"><h5><i className="fas fa-chart-area"></i> 年级总分分布直方图</h5></div>
      <div className="card-body"><div className="chart-container-large"><canvas ref={canvasRef}></canvas></div></div>
    </div>
  );
}

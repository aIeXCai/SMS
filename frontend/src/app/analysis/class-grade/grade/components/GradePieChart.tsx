"use client";

import { useEffect, useRef } from "react";
import Chart, {
  GRADE_DOUGHNUT_COLORS,
  DATALABELS_HIDDEN,
  LEGEND_BOTTOM,
  RESPONSIVE_CHART,
} from "@/lib/chart";

type Props = {
  scoreRanges: string[];
  scoreDistribution: number[];
};

export default function GradePieChart({ scoreRanges, scoreDistribution }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !scoreRanges.length || !scoreDistribution.length) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

    chartRef.current = new Chart(canvasRef.current, {
      type: "doughnut",
      data: {
        labels: scoreRanges,
        datasets: [{
          data: scoreDistribution,
          backgroundColor: GRADE_DOUGHNUT_COLORS,
          borderColor: "#fff",
          borderWidth: 3,
          hoverBorderWidth: 5,
          hoverOffset: 10,
        }],
      },
      options: {
        ...RESPONSIVE_CHART,
        cutout: "60%",
        plugins: {
          legend: { ...LEGEND_BOTTOM },
          datalabels: DATALABELS_HIDDEN,
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const total = (ctx.dataset.data as number[]).reduce((s, v) => s + Number(v), 0);
                const pct = total > 0 ? ((Number(ctx.parsed) / total) * 100).toFixed(1) : "0.0";
                return `${ctx.label}: ${ctx.parsed}人 (${pct}%)`;
              },
            },
          },
        },
      },
    });

    return () => { chartRef.current?.destroy(); chartRef.current = null; };
  }, [scoreRanges, scoreDistribution]);

  return (
    <div className="chart-card">
      <div className="card-header"><h5><i className="fas fa-chart-pie"></i> 年级整体各等级分布饼图</h5></div>
      <div className="card-body"><div className="chart-container-large"><canvas ref={canvasRef}></canvas></div></div>
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";
import type { TooltipItem } from "chart.js";
import Chart, {
  CLASS_COMPARISON_COLORS, DATALABELS_HIDDEN,
  SCALE_X_COMMON, RESPONSIVE_CHART, LEGEND_TOP,
} from "@/lib/chart";

type ChartDataPayload = {
  subjects: string[]; classes: string[];
  class_subject_averages: Record<string, number[]>;
  score_distributions: Record<string, number[]>;
};

export function useMultiComparisonChart(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  chartData: ChartDataPayload | undefined,
  chartMaxScore: number,
) {
  const chartRef = useRef<Chart | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    chartRef.current?.destroy();
    chartRef.current = null;
    if (!canvasRef.current || !chartData) return;

    chartRef.current = new Chart(canvasRef.current, {
      type: "bar",
      data: {
        labels: chartData.subjects,
        datasets: chartData.classes.map((cn, i) => ({
          label: cn, data: chartData.class_subject_averages?.[cn] || [],
          backgroundColor: CLASS_COMPARISON_COLORS[i % CLASS_COMPARISON_COLORS.length],
          borderColor: CLASS_COMPARISON_COLORS[i % CLASS_COMPARISON_COLORS.length],
          borderWidth: 2, borderRadius: 4,
        })),
      },
      options: {
        ...RESPONSIVE_CHART,
        plugins: {
          legend: { ...LEGEND_TOP },
          datalabels: DATALABELS_HIDDEN,
          tooltip: { mode: "index" as const, intersect: false, callbacks: { label: (ctx: TooltipItem<"bar">) => `${ctx.dataset.label}: ${Number(ctx.parsed.y).toFixed(1)}分` } },
        },
        scales: {
          x: { ...SCALE_X_COMMON, ticks: { color: "#6c757d", font: { size: 15, weight: 600 } } },
          y: { beginAtZero: true, max: chartMaxScore, grid: { color: "rgba(0,0,0,0.1)" }, title: { display: true, text: "平均分", color: "#6c757d", font: { size: 16, weight: 700 } }, ticks: { color: "#6c757d", font: { size: 15, weight: 600 } } },
        },
      },
    });
    return () => { chartRef.current?.destroy(); chartRef.current = null; };
  }, [chartData, chartMaxScore]);
}

export function useMultiTrendChart(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  chartData: ChartDataPayload | undefined,
  chartMaxScore: number,
) {
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    chartRef.current?.destroy();
    chartRef.current = null;
    if (!canvasRef.current || !chartData) return;

    chartRef.current = new Chart(canvasRef.current, {
      type: "line",
      data: {
        labels: chartData.subjects,
        datasets: chartData.classes.map((cn, i) => ({
          label: cn, data: chartData.class_subject_averages?.[cn] || [],
          borderColor: CLASS_COMPARISON_COLORS[i % CLASS_COMPARISON_COLORS.length],
          backgroundColor: `${CLASS_COMPARISON_COLORS[i % CLASS_COMPARISON_COLORS.length]}20`,
          borderWidth: 3, pointRadius: 6, pointHoverRadius: 8, tension: 0.3, fill: false,
        })),
      },
      options: {
        ...RESPONSIVE_CHART,
        plugins: { legend: { ...LEGEND_TOP }, datalabels: DATALABELS_HIDDEN },
        scales: {
          x: { ...SCALE_X_COMMON, ticks: { color: "#6c757d", font: { size: 15, weight: 600 } } },
          y: { beginAtZero: true, max: chartMaxScore, grid: { color: "rgba(0,0,0,0.1)" }, title: { display: true, text: "平均分", color: "#6c757d", font: { size: 16, weight: 700 } }, ticks: { color: "#6c757d", font: { size: 15, weight: 600 } } },
        },
      },
    });
    return () => { chartRef.current?.destroy(); chartRef.current = null; };
  }, [chartData, chartMaxScore]);
}

export function useMultiDistributionChart(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  chartData: ChartDataPayload | undefined,
) {
  const chartRef = useRef<Chart | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    chartRef.current?.destroy();
    chartRef.current = null;
    if (!canvasRef.current || !chartData) return;

    chartRef.current = new Chart(canvasRef.current, {
      type: "bar",
      data: {
        labels: ["特优(95%+)", "优秀(85%-95%)", "良好(70%-85%)", "及格(60%-70%)", "不及格(<60%)"],
        datasets: chartData.classes.map((cn, i) => ({
          label: cn, data: chartData.score_distributions?.[cn] || [0, 0, 0, 0, 0],
          backgroundColor: CLASS_COMPARISON_COLORS[i % CLASS_COMPARISON_COLORS.length],
          borderColor: CLASS_COMPARISON_COLORS[i % CLASS_COMPARISON_COLORS.length],
          borderWidth: 1, borderRadius: 4,
        })),
      },
      options: {
        ...RESPONSIVE_CHART,
        plugins: { legend: { ...LEGEND_TOP }, datalabels: DATALABELS_HIDDEN },
        scales: {
          x: { ...SCALE_X_COMMON, ticks: { color: "#6c757d", font: { size: 15, weight: 600 } } },
          y: { beginAtZero: true, grid: { color: "rgba(0,0,0,0.1)" }, title: { display: true, text: "学生人数", color: "#6c757d", font: { size: 16, weight: 700 } }, ticks: { color: "#6c757d", font: { size: 15, weight: 600 }, callback: (v: string | number) => Number.isInteger(Number(v)) ? `${v}` : "" } },
        },
      },
    });
    return () => { chartRef.current?.destroy(); chartRef.current = null; };
  }, [chartData]);
}

"use client";

import { useEffect, useRef } from "react";
import type { TooltipItem } from "chart.js";
import Chart, {
  GREEN_PRIMARY, GREEN_PRIMARY_LIGHT, GREEN_PRIMARY_ALPHA,
  GRADE_DISTRIBUTION_COLORS, GRADE_DISTRIBUTION_BORDERS, GRADE_RANGE_LABELS,
  DATALABELS_CENTER, DATALABELS_HIDDEN, LEGEND_BOTTOM,
  SCALE_X_COMMON, SCALE_Y_COMMON, RADAR_R_SCALE,
  RESPONSIVE_CHART, SLOW_ANIMATION, TOOLTIP_STYLE,
} from "@/lib/chart";

type SubjectStat = {
  code: string; name: string; avg_score: number;
  actual_max_score: number; actual_min_score: number; count: number; exam_max_score: number;
};

type ChartDataPayload = {
  subject_avg_scores?: { labels: string[]; data: number[] };
  subject_max_scores?: number[];
  score_distribution?: Record<string, Record<string, number>>;
  grade_distribution?: Record<string, number>;
  total_max_score?: number;
};

function useChart(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const chartRef = useRef<Chart | null>(null);
  const destroy = () => { chartRef.current?.destroy(); chartRef.current = null; };
  return { chartRef, destroy };
}

export function useRadarChart(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  subjectStats: SubjectStat[] | undefined,
  comparisonMaxScore: number,
) {
  const { chartRef, destroy } = useChart(canvasRef);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    destroy();
    if (!canvasRef.current || !subjectStats?.length) return;
    const labels = subjectStats.map((s) => s.name);
    const scores = subjectStats.map((s) => s.avg_score);
    const maxScores = subjectStats.map((s) => s.exam_max_score || comparisonMaxScore);
    const normalized = scores.map((s, i) => maxScores[i] > 0 ? s / maxScores[i] : 0);

    chartRef.current = new Chart(canvasRef.current, {
      type: "radar",
      data: {
        labels,
        datasets: [{
          label: "标准化平均分", data: normalized, backgroundColor: GREEN_PRIMARY_LIGHT,
          borderColor: GREEN_PRIMARY, borderWidth: 3, pointBackgroundColor: GREEN_PRIMARY,
          pointBorderColor: "#fff", pointBorderWidth: 2, pointRadius: 6,
          pointHoverBackgroundColor: "#fff", pointHoverBorderColor: GREEN_PRIMARY, pointHoverRadius: 8, tension: 0.2,
        }],
      },
      options: {
        ...RESPONSIVE_CHART, ...SLOW_ANIMATION,
        scales: { ...RADAR_R_SCALE, r: { ...RADAR_R_SCALE.r, pointLabels: { color: "#495057", font: { size: 15, weight: 500 as const } }, ticks: { ...RADAR_R_SCALE.r.ticks, font: { size: 15 } } } },
        plugins: {
          legend: { display: false }, datalabels: DATALABELS_HIDDEN,
          tooltip: {
            ...TOOLTIP_STYLE,
            callbacks: {
              label: (ctx: TooltipItem<"radar">) => {
                const i = ctx.dataIndex;
                const orig = scores[i] || 0; const maxFor = maxScores[i] || 0;
                const pct = ((ctx.parsed.r || 0) * 100).toFixed(1);
                return [`实际分数: ${orig.toFixed(1)}${maxFor > 0 ? `/${maxFor}` : ""}分`, `标准化分数: ${pct}%`];
              },
            },
          },
        },
      },
    });
    return destroy;
  }, [subjectStats, comparisonMaxScore]);
}

export function useDistributionChart(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  subjectStats: SubjectStat[] | undefined,
  chartData: ChartDataPayload | undefined,
) {
  const { chartRef, destroy } = useChart(canvasRef);
  const dist = chartData?.score_distribution || {};
  const gradeOrder = ["特优(95%+)", "优秀(85%-95%)", "良好(70%-85%)", "及格(60%-70%)", "不及格(<60%)"];

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    destroy();
    if (!canvasRef.current || !subjectStats?.length) return;
    const codes = subjectStats.map((s) => s.code);
    const labels = subjectStats.map((s) => s.name);

    const datasets = GRADE_RANGE_LABELS.map((range, i) => ({
      label: range,
      data: codes.map((code) => Number(dist?.[code]?.[range] || 0)),
      backgroundColor: GRADE_DISTRIBUTION_COLORS[i], borderColor: GRADE_DISTRIBUTION_BORDERS[i],
      borderWidth: 2, borderSkipped: false as const,
    }));

    chartRef.current = new Chart(canvasRef.current, {
      type: "bar", data: { labels, datasets },
      options: {
        ...RESPONSIVE_CHART, ...SLOW_ANIMATION,
        interaction: { mode: "index" as const, intersect: false },
        scales: {
          x: { stacked: true, ...SCALE_X_COMMON, ticks: { color: "#6c757d", font: { size: 15, weight: 500 } } },
          y: { stacked: true, beginAtZero: true, grid: { color: "rgba(0,0,0,0.1)" }, ticks: { color: "#6c757d", font: { size: 15 }, stepSize: 1, callback: (v: string | number) => Number.isInteger(Number(v)) ? `${v}` : "" } },
        },
        plugins: {
          legend: { position: "top" as const, labels: { padding: 15, usePointStyle: true, font: { size: 12, weight: 500 as const }, sort: (a: { text: string }, b: { text: string }) => gradeOrder.indexOf(a.text) - gradeOrder.indexOf(b.text) } },
          datalabels: DATALABELS_HIDDEN,
          tooltip: {
            ...TOOLTIP_STYLE, mode: "index" as const, intersect: false,
            callbacks: {
              title: (ctx: TooltipItem<"bar">[]) => `${ctx[0]?.label || ""} - 成绩分布`,
              label: (ctx: TooltipItem<"bar">) => `${ctx.dataset.label}: ${ctx.parsed.y}人`,
              footer: (items: TooltipItem<"bar">[]) => {
                const t = items.reduce((s, i) => s + Number(i.parsed.y || 0), 0);
                return `总计: ${t}人`;
              },
            },
          },
        },
      },
    });
    return destroy;
  }, [subjectStats, dist]);
}

export function usePieChart(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  chartData: ChartDataPayload | undefined,
) {
  const { chartRef, destroy } = useChart(canvasRef);
  const gd = chartData?.grade_distribution || {};

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    destroy();
    if (!canvasRef.current) return;
    const order = ["特优(95%+)", "优秀(85%-95%)", "良好(70%-85%)", "及格(60%-70%)", "不及格(<60%)"];
    const pieLabels = order.filter((l) => l in gd);
    const pieData = pieLabels.map((l) => Number(gd[l] || 0));
    const gradeColors: Record<string, string> = { "不及格(<60%)": "#6B7280", "及格(60%-70%)": "#EF4444", "良好(70%-85%)": "#F59E0B", "优秀(85%-95%)": "#3B82F6", "特优(95%+)": "#10B981" };

    chartRef.current = new Chart(canvasRef.current, {
      type: "doughnut",
      data: {
        labels: pieLabels,
        datasets: [{ data: pieData, backgroundColor: pieLabels.map((l) => gradeColors[l] || "#6c757d"), borderColor: "#fff", borderWidth: 3, hoverBorderWidth: 5, hoverOffset: 10 }],
      },
      options: {
        ...RESPONSIVE_CHART, cutout: "60%",
        animation: { animateRotate: true, duration: 2000, easing: "easeInOutQuart" as const },
        plugins: {
          legend: { ...LEGEND_BOTTOM, labels: { ...LEGEND_BOTTOM.labels, font: { size: 15, weight: 500 as const } } },
          datalabels: DATALABELS_HIDDEN,
          tooltip: {
            ...TOOLTIP_STYLE,
            callbacks: {
              label: (ctx: TooltipItem<"doughnut">) => {
                const total = (ctx.dataset.data as number[]).reduce((s, v) => s + Number(v), 0);
                const pct = total > 0 ? ((Number(ctx.parsed) / total) * 100).toFixed(1) : "0.0";
                return `${ctx.label}: ${ctx.parsed}人 (${pct}%)`;
              },
            },
          },
        },
      },
    });
    return destroy;
  }, [gd]);
}

export function useComparisonChart(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  subjectStats: SubjectStat[] | undefined,
  comparisonMaxScore: number,
) {
  const { chartRef, destroy } = useChart(canvasRef);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    destroy();
    if (!canvasRef.current || !subjectStats?.length) return;
    const labels = subjectStats.map((s) => s.name);
    const values = subjectStats.map((s) => Number(s.avg_score || 0));

    chartRef.current = new Chart(canvasRef.current, {
      type: "bar",
      data: { labels, datasets: [{ label: "平均分", data: values, backgroundColor: GREEN_PRIMARY_ALPHA, borderColor: GREEN_PRIMARY, borderWidth: 2, borderRadius: 8, borderSkipped: false }] },
      options: {
        ...RESPONSIVE_CHART, ...SLOW_ANIMATION,
        scales: {
          x: { ...SCALE_X_COMMON, ticks: { color: "#6c757d", font: { size: 15, weight: 500 } } },
          y: { ...SCALE_Y_COMMON, max: comparisonMaxScore, ticks: { color: "#6c757d", font: { size: 18 }, stepSize: 20 } },
        },
        plugins: {
          legend: { display: false },
          datalabels: { ...DATALABELS_CENTER, font: { size: 13, weight: 700 as const }, formatter: (v: number | string) => Number(v || 0).toFixed(1) },
          tooltip: { ...TOOLTIP_STYLE, borderColor: "rgb(0, 0, 0)", callbacks: { label: (ctx: TooltipItem<"bar">) => `平均分: ${Number(ctx.parsed.y).toFixed(1)}分` } },
        },
      },
    });
    return destroy;
  }, [subjectStats, comparisonMaxScore]);
}

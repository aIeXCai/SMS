import Chart from "chart.js/auto";
import ChartDataLabels from "chartjs-plugin-datalabels";

declare global {
  interface Window {
    __smsChartDataLabelsRegistered?: boolean;
  }
}

if (typeof window !== "undefined" && !window.__smsChartDataLabelsRegistered) {
  Chart.register(ChartDataLabels);
  window.__smsChartDataLabelsRegistered = true;
}

// ============================================================================
// Shared color palettes
// ============================================================================

/** Primary green used across all analysis pages */
export const GREEN_PRIMARY = "rgb(1, 135, 108)";
export const GREEN_PRIMARY_ALPHA = "rgba(1, 135, 108, 0.8)";
export const GREEN_PRIMARY_LIGHT = "rgba(1, 135, 108, 0.2)";

/** Gradient bar chart colors for multi-class / multi-item bar charts */
export const GRADIENT_BAR_COLORS = [
  "rgba(1,135,108,0.8)", "rgba(59,130,246,0.8)", "rgba(245,158,11,0.8)",
  "rgba(239,68,68,0.8)", "rgba(16,185,129,0.8)", "rgba(139,92,246,0.8)",
  "rgba(236,72,153,0.8)", "rgba(34,197,94,0.8)", "rgba(249,115,22,0.8)",
];

/** Colors for multi-class comparison across analysis pages */
export const CLASS_COMPARISON_COLORS = [
  "#01876c", "#874d5c", "#035c7a", "#874d35", "#386b5e", "#6a5600",
  "#025e4b", "#2b4079", "#4b874d", "#57577b", "#873300", "#02a583",
];

/** Grade distribution colors (from worst to best) */
export const GRADE_DISTRIBUTION_COLORS = [
  "rgba(107,114,128,0.8)",  // fail - gray
  "rgba(239,68,68,0.8)",     // pass - red
  "rgba(245,158,11,0.8)",    // good - orange
  "rgba(59,130,246,0.8)",    // excellent - blue
  "rgba(16,185,129,0.8)",    // top - green
];

/** Grade distribution border colors */
export const GRADE_DISTRIBUTION_BORDERS = [
  "#6B7280", "#EF4444", "#F59E0B", "#3B82F6", "#10B981",
];

/** Doughnut chart colors for grade distribution (pie) */
export const GRADE_DOUGHNUT_COLORS = ["#10B981", "#3B82F6", "#F59E0B", "#EF4444", "#6B7280"];

/** Grade distribution labels (order matters — used for display) */
export const GRADE_RANGE_LABELS = [
  "不及格(<60%)", "及格(60%-70%)", "良好(70%-85%)", "优秀(85%-95%)", "特优(95%+)",
];

/** Grade distribution labels for legend (reversed for stacked bar display) */
export const GRADE_RANGE_LABELS_STACKED = [
  "特优(95%+)", "优秀(85%-95%)", "良好(70%-85%)", "及格(60%-70%)", "不及格(<60%)",
];

/** Subject bar chart colors (greens gradient) */
export const SUBJECT_BAR_COLORS = [
  { bg: "rgba(1, 123, 108, 0.8)", border: "rgb(1, 123, 108)" },
  { bg: "rgba(26, 148, 133, 0.8)", border: "rgb(26, 148, 133)" },
  { bg: "rgba(51, 173, 158, 0.8)", border: "rgb(51, 173, 158)" },
  { bg: "rgba(76, 198, 183, 0.8)", border: "rgb(76, 198, 183)" },
  { bg: "rgba(101, 223, 208, 0.8)", border: "rgb(101, 223, 208)" },
];

/** Trend line colors for student analysis */
export const TREND_LINE_COLORS = [
  "rgb(1, 123, 108)", "rgb(40, 167, 69)", "rgb(0, 123, 255)", "rgb(255, 193, 7)",
  "rgb(220, 53, 69)", "rgb(108, 117, 125)", "rgb(255, 107, 53)", "rgb(111, 66, 193)",
];

// ============================================================================
// Common Chart.js option fragments
// ============================================================================

/** Standard responsive + maintainAspectRatio */
export const RESPONSIVE_CHART = {
  responsive: true,
  maintainAspectRatio: false,
} as const;

/** Slow animation preset (2s) */
export const SLOW_ANIMATION = {
  animation: { duration: 2000, easing: "easeInOutQuart" as const },
} as const;

// --- Scale presets ---

/** Common x-axis scale: no grid, gray ticks */
export const SCALE_X_COMMON = {
  grid: { display: false },
  ticks: { color: "#6c757d", font: { size: 14 } },
} as const;

/** Common y-axis scale: beginAtZero, light grid */
export const SCALE_Y_COMMON = {
  beginAtZero: true,
  grid: { color: "rgba(0,0,0,0.1)" },
  ticks: { color: "#6c757d", font: { size: 12 } },
} as const;

/** Y-axis with integer-only tick callback */
export const SCALE_Y_INTEGER = {
  beginAtZero: true,
  grid: { color: "rgba(0,0,0,0.1)" },
  ticks: {
    color: "#6c757d",
    font: { size: 14 },
    callback: (value: string | number) => (Number.isInteger(Number(value)) ? `${value}` : ""),
  },
} as const;

/** Radar r-scale: normalized 0-1 with percentage ticks */
export const RADAR_R_SCALE = {
  r: {
    beginAtZero: true,
    max: 1,
    ticks: {
      stepSize: 0.2,
      color: "#6c757d",
      font: { size: 12 },
      callback: (value: string | number) => `${(Number(value) * 100).toFixed(0)}%`,
    },
    grid: { color: "rgba(0,0,0,0.1)" },
    angleLines: { color: "rgba(0,0,0,0.1)" },
    pointLabels: { color: "#495057", font: { size: 16, weight: 500 as const } },
  },
} as const;

// --- Datalabels plugin presets ---

/** datalabels: show above bar, dark text */
export const DATALABELS_ABOVE = {
  display: true,
  anchor: "end" as const,
  align: "top" as const,
  offset: 4,
  color: "#374151",
  font: { size: 12, weight: 600 as const },
} as const;

/** datalabels: centered inside bar, white text */
export const DATALABELS_CENTER = {
  display: true,
  anchor: "center" as const,
  align: "center" as const,
  color: "#ffffff",
  font: { size: 11, weight: 700 as const },
} as const;

/** datalabels: hidden */
export const DATALABELS_HIDDEN = { display: false } as const;

// --- Legend presets ---

/** Bottom legend with pointStyle circles */
export const LEGEND_BOTTOM = {
  position: "bottom" as const,
  labels: { padding: 20, usePointStyle: true, font: { size: 14, weight: 500 as const } },
} as const;

/** Top legend with pointStyle circles (compact) */
export const LEGEND_TOP_COMPACT = {
  position: "top" as const,
  labels: { padding: 15, usePointStyle: true, font: { size: 12 } },
} as const;

/** Top legend with pointStyle circles (large) */
export const LEGEND_TOP = {
  position: "top" as const,
  labels: { padding: 15, usePointStyle: true, font: { size: 15 } },
} as const;

// --- Tooltip presets ---

/** Standard tooltip style */
export const TOOLTIP_STYLE = {
  backgroundColor: "rgba(0,0,0,0.8)",
  titleColor: "#fff",
  bodyColor: "#fff",
  borderColor: GREEN_PRIMARY,
  borderWidth: 1,
  cornerRadius: 8,
} as const;

export default Chart;

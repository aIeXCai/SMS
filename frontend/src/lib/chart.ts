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

export default Chart;

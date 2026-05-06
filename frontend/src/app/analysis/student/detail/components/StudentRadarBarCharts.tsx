"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { TooltipItem } from "chart.js";
import Chart, {
  SUBJECT_BAR_COLORS,
  DATALABELS_HIDDEN,
  RESPONSIVE_CHART,
} from "@/lib/chart";
import type { AnalysisData } from "./types";
import { getExamDisplayText } from "./types";

type Props = { data: AnalysisData };

export default function StudentRadarBarCharts({ data }: Props) {
  const [radarExamOpen, setRadarExamOpen] = useState(false);
  const [barExamOpen, setBarExamOpen] = useState(false);
  const [radarExamId, setRadarExamId] = useState(() => data.exams[0] ? String(data.exams[0].id) : "");
  const [barExamId, setBarExamId] = useState(() => data.exams[0] ? String(data.exams[0].id) : "");

  const radarCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const barCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const radarChartRef = useRef<Chart | null>(null);
  const barChartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".filter-dropdown")) {
        setRadarExamOpen(false); setBarExamOpen(false);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const radarExam = data.exams.find((ex) => String(ex.id) === radarExamId) || data.exams[0];
  const barExam = data.exams.find((ex) => String(ex.id) === barExamId) || data.exams[0];

  const drawRadar = useCallback(() => {
    if (!radarCanvasRef.current || !radarExam) return;
    radarChartRef.current?.destroy();
    radarChartRef.current = new Chart(radarCanvasRef.current, {
      type: "radar",
      data: {
        labels: radarExam.scores.map((s) => s.subject_name),
        datasets: [{
          label: "",
          data: radarExam.scores.map((s) => Math.round(Math.max(0, Math.min(100, (s.score_value / (s.full_score || 100)) * 100)))),
          borderColor: "rgb(40, 167, 69)",
          backgroundColor: "rgba(40, 167, 69, 0.2)",
          pointBackgroundColor: "rgb(40, 167, 69)",
        }],
      },
      options: {
        ...RESPONSIVE_CHART,
        scales: { r: { beginAtZero: true, min: 0, max: 100, ticks: { stepSize: 20, callback: (v) => `${Number(v)}%` } } },
        plugins: {
          legend: { display: false }, datalabels: DATALABELS_HIDDEN,
          tooltip: {
            callbacks: {
              label: (ctx: TooltipItem<"radar">) => `得分率: ${ctx.raw}%`,
              afterLabel: (ctx: TooltipItem<"radar">) => {
                const s = radarExam.scores?.[ctx.dataIndex];
                return s ? `实际得分: ${s.score_value || 0}/${s.full_score || 100}` : "";
              },
            },
          },
        },
      },
    });
  }, [radarExam]);

  const drawBar = useCallback(() => {
    if (!barCanvasRef.current || !barExam) return;
    barChartRef.current?.destroy();
    barChartRef.current = new Chart(barCanvasRef.current, {
      type: "bar",
      data: {
        labels: barExam.scores.map((s) => s.subject_name),
        datasets: [{
          label: "",
          data: barExam.scores.map((s) => s.score_value || 0),
          backgroundColor: barExam.scores.map((_, i) => SUBJECT_BAR_COLORS[i % SUBJECT_BAR_COLORS.length].bg),
          borderColor: barExam.scores.map((_, i) => SUBJECT_BAR_COLORS[i % SUBJECT_BAR_COLORS.length].border),
          borderWidth: 1, borderRadius: 8, borderSkipped: false,
        }],
      },
      options: {
        ...RESPONSIVE_CHART,
        plugins: {
          legend: { display: false },
          datalabels: {
            display: true, anchor: "center", align: "center",
            color: "#ffffff", font: { size: 14, weight: "bold" },
            formatter: (v: number) => v,
          },
          tooltip: { callbacks: { label: (ctx: TooltipItem<"bar">) => `得分: ${ctx.raw}分` } },
        },
        scales: { y: { beginAtZero: true, title: { display: true, text: "得分" } } },
      },
    });
  }, [barExam]);

  useEffect(() => { drawRadar(); return () => radarChartRef.current?.destroy(); }, [drawRadar]);
  useEffect(() => { drawBar(); return () => barChartRef.current?.destroy(); }, [drawBar]);

  return (
    <div className="flex flex-wrap mb-6">
      {/* --- Radar chart --- */}
      <div className="w-full lg:w-1/3">
        <div className="chart-card">
          <div className="card-header"><h5><i className="fas fa-chart-area mr-2"></i>学科能力雷达图</h5></div>
          <div className="card-body">
            <div className="chart-filters">
              <div className="filter-group">
                <label><i className="fas fa-calendar-alt mr-2 text-blue-600"></i>考试</label>
                <div className="filter-dropdown">
                  <button type="button" className={`filter-dropdown-toggle ${radarExamOpen ? "active" : ""}`}
                    onClick={() => { setRadarExamOpen((v) => !v); setBarExamOpen(false); }}>
                    <span>{radarExam ? getExamDisplayText(radarExam) : "请选择考试"}</span>
                    <i className="fas fa-chevron-down filter-dropdown-arrow"></i>
                  </button>
                  <div className={`filter-dropdown-menu ${radarExamOpen ? "show" : ""}`}>
                    {data.exams.map((ex) => (
                      <div key={ex.id} className={`filter-dropdown-item ${String(ex.id) === radarExamId ? "selected" : ""}`}
                        onClick={() => { setRadarExamId(String(ex.id)); setRadarExamOpen(false); }}>
                        {getExamDisplayText(ex)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="chart-container"><canvas ref={radarCanvasRef} id="radarChart"></canvas></div>
          </div>
        </div>
      </div>

      {/* --- Bar chart --- */}
      <div className="w-full lg:w-2/3">
        <div className="chart-card">
          <div className="card-header"><h5><i className="fas fa-chart-bar mr-2"></i>成绩对比分析</h5></div>
          <div className="card-body">
            <div className="chart-filters">
              <div className="filter-group">
                <label><i className="fas fa-calendar-alt mr-2 text-blue-600"></i>考试</label>
                <div className="filter-dropdown">
                  <button type="button" className={`filter-dropdown-toggle ${barExamOpen ? "active" : ""}`}
                    onClick={() => { setBarExamOpen((v) => !v); setRadarExamOpen(false); }}>
                    <span>{barExam ? getExamDisplayText(barExam) : "请选择考试"}</span>
                    <i className="fas fa-chevron-down filter-dropdown-arrow"></i>
                  </button>
                  <div className={`filter-dropdown-menu ${barExamOpen ? "show" : ""}`}>
                    {data.exams.map((ex) => (
                      <div key={ex.id} className={`filter-dropdown-item ${String(ex.id) === barExamId ? "selected" : ""}`}
                        onClick={() => { setBarExamId(String(ex.id)); setBarExamOpen(false); }}>
                        {getExamDisplayText(ex)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="chart-container"><canvas ref={barCanvasRef} id="barChart"></canvas></div>
          </div>
        </div>
      </div>
    </div>
  );
}

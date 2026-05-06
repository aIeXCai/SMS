"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import type { TooltipItem } from "chart.js";
import Chart, { TREND_LINE_COLORS, RESPONSIVE_CHART } from "@/lib/chart";
import type { AnalysisData } from "./types";
import { getExamDisplayText } from "./types";

type Props = { data: AnalysisData };

export default function StudentTrendChart({ data }: Props) {
  // Filter state
  const [examOpen, setExamOpen] = useState(false);
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [rankTypeOpen, setRankTypeOpen] = useState(false);
  const [selectedExams, setSelectedExams] = useState<string[]>(() => ["all"]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(() => ["total"]);
  const [rankType, setRankType] = useState<"class" | "grade">("grade");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (!el.closest(".filter-dropdown")) {
        setExamOpen(false); setSubjectOpen(false); setRankTypeOpen(false);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  // Filtered data
  const trendExams = useMemo(() => {
    if (selectedExams.includes("all")) return data.exams;
    return data.exams.filter((ex) => selectedExams.includes(String(ex.id)));
  }, [data.exams, selectedExams]);

  const trendSubjects = useMemo(() => {
    if (selectedSubjects.includes("all")) return ["total", ...(data.subjects || [])];
    return selectedSubjects;
  }, [data.subjects, selectedSubjects]);

  const examText = selectedExams.includes("all")
    ? "所有考试" : selectedExams.length === 0 ? "请选择考试" : `已选择 ${selectedExams.length} 个考试`;

  const subjectText = selectedSubjects.includes("all")
    ? "所有科目" : selectedSubjects.length === 0 ? "请选择科目" : `已选择 ${selectedSubjects.length} 个科目`;

  const toggleAllExams = useCallback((checked: boolean) => setSelectedExams(checked ? ["all"] : []), []);
  const toggleExam = useCallback((id: string, checked: boolean) => {
    setSelectedExams((prev) => {
      let next = prev.includes("all") ? [] : [...prev];
      if (checked) { if (!next.includes(id)) next.push(id); }
      else next = next.filter((i) => i !== id);
      return next;
    });
  }, []);

  const toggleAllSubjects = useCallback((checked: boolean) => setSelectedSubjects(checked ? ["all"] : []), []);
  const toggleSubject = useCallback((code: string, checked: boolean) => {
    setSelectedSubjects((prev) => {
      let next = prev.includes("all") ? [] : [...prev];
      if (checked) { if (!next.includes(code)) next.push(code); }
      else next = next.filter((c) => c !== code);
      return next;
    });
  }, []);

  // Draw chart
  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current?.destroy();
    chartRef.current = null;
    if (trendExams.length === 0 || trendSubjects.length === 0) return;

    const labelRankText = rankType === "class" ? "班级排名" : "年级排名";
    const datasets = trendSubjects.map((subject, i) => {
      const color = TREND_LINE_COLORS[i % TREND_LINE_COLORS.length];
      const trendItem = data.trend_data?.[subject];
      const values = trendExams.map((exam) => {
        if (!trendItem) return null;
        const idx = trendItem.exam_ids.indexOf(exam.id);
        if (idx < 0) return null;
        const val = rankType === "class" ? trendItem.class_ranks[idx] : trendItem.grade_ranks[idx];
        return val && val > 0 ? val : null;
      });

      return {
        label: subject === "total" ? `总分${labelRankText}` : `${subject}${labelRankText}`,
        data: values,
        borderColor: color,
        backgroundColor: color.replace("rgb", "rgba").replace(")", ", 0.1)"),
        fill: false, tension: 0.3, pointRadius: 4, pointHoverRadius: 7,
        pointBorderWidth: 2, pointBackgroundColor: "#ffffff",
        pointBorderColor: color, borderWidth: 2.5,
      };
    });

    chartRef.current = new Chart(canvasRef.current, {
      type: "line",
      data: { labels: trendExams.map(getExamDisplayText), datasets },
      options: {
        ...RESPONSIVE_CHART,
        scales: {
          y: {
            reverse: true, min: 1,
            title: { display: true, text: "排名" },
            ticks: { callback: (v: string | number) => { const n = Number(v); return Number.isInteger(n) && n >= 1 ? `${n}` : ""; } },
          },
          x: { type: "category", offset: true },
        },
        plugins: {
          legend: { display: true, position: "top" },
          datalabels: {
            display: true, align: "top", anchor: "end", offset: 4,
            font: { size: 15, weight: "bold" },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            color: (ctx: any) => ctx.dataset.borderColor,
            formatter: (v: number | null) => (v ? v : ""),
          },
          tooltip: { callbacks: { label: (ctx: TooltipItem<"line">) => `${ctx.dataset.label}: ${ctx.raw ? `第${ctx.raw}名` : "无数据"}` } },
        },
      },
    });

    return () => { chartRef.current?.destroy(); chartRef.current = null; };
  }, [data, trendExams, trendSubjects, rankType]);

  return (
    <div className="flex flex-wrap mb-6">
      <div className="w-full">
        <div className="chart-card">
          <div className="card-header"><h5><i className="fas fa-chart-line mr-2"></i>排名趋势分析</h5></div>
          <div className="card-body">
            <div className="chart-filters">
              <div className="flex flex-wrap gap-3">
                {/* --- Exam multiselect --- */}
                <div className="flex-1 min-w-0">
                  <div className="filter-group">
                    <label><i className="fas fa-calendar-alt mr-2 text-blue-600"></i>考试</label>
                    <div className="filter-dropdown">
                      <button type="button" className={`filter-dropdown-toggle ${examOpen ? "active" : ""}`}
                        onClick={() => { setExamOpen((v) => !v); setSubjectOpen(false); setRankTypeOpen(false); }}>
                        <span>{examText}</span><i className="fas fa-chevron-down filter-dropdown-arrow"></i>
                      </button>
                      <div className={`filter-dropdown-menu ${examOpen ? "show" : ""}`}>
                        <div className="filter-dropdown-header"><small className="text-gray-500">多选考试 (<span>{selectedExams.includes("all") ? data.exams.length : selectedExams.length}</span> 个已选择)</small></div>
                        <label className="filter-dropdown-item"><input type="checkbox" className="rounded border-gray-300" checked={selectedExams.includes("all")} onChange={(e) => toggleAllExams(e.target.checked)} />所有考试</label>
                        {data.exams.map((ex) => (
                          <label key={ex.id} className="filter-dropdown-item">
                            <input type="checkbox" className="rounded border-gray-300" checked={!selectedExams.includes("all") && selectedExams.includes(String(ex.id))} onChange={(e) => toggleExam(String(ex.id), e.target.checked)} />{getExamDisplayText(ex)}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* --- Subject multiselect --- */}
                <div className="flex-1 min-w-0">
                  <div className="filter-group">
                    <label><i className="fas fa-book mr-2 text-green-600"></i>科目</label>
                    <div className="filter-dropdown">
                      <button type="button" className={`filter-dropdown-toggle ${subjectOpen ? "active" : ""}`}
                        onClick={() => { setSubjectOpen((v) => !v); setExamOpen(false); setRankTypeOpen(false); }}>
                        <span>{subjectText}</span><i className="fas fa-chevron-down filter-dropdown-arrow"></i>
                      </button>
                      <div className={`filter-dropdown-menu ${subjectOpen ? "show" : ""}`}>
                        <div className="filter-dropdown-header"><small className="text-gray-500">多选科目 (<span>{selectedSubjects.includes("all") ? data.subjects.length + 1 : selectedSubjects.length}</span> 个已选择)</small></div>
                        <label className="filter-dropdown-item"><input type="checkbox" className="rounded border-gray-300" checked={selectedSubjects.includes("all")} onChange={(e) => toggleAllSubjects(e.target.checked)} />所有科目</label>
                        <label className="filter-dropdown-item"><input type="checkbox" className="rounded border-gray-300" checked={!selectedSubjects.includes("all") && selectedSubjects.includes("total")} onChange={(e) => toggleSubject("total", e.target.checked)} />总分</label>
                        {data.subjects.map((s) => (
                          <label key={s} className="filter-dropdown-item"><input type="checkbox" className="rounded border-gray-300" checked={!selectedSubjects.includes("all") && selectedSubjects.includes(s)} onChange={(e) => toggleSubject(s, e.target.checked)} />{s}</label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* --- Rank type select --- */}
                <div className="flex-1 min-w-0">
                  <div className="filter-group">
                    <label><i className="fas fa-trophy mr-2 text-yellow-600"></i>排名类型</label>
                    <div className="filter-dropdown">
                      <button type="button" className={`filter-dropdown-toggle ${rankTypeOpen ? "active" : ""}`}
                        onClick={() => { setRankTypeOpen((v) => !v); setExamOpen(false); setSubjectOpen(false); }}>
                        <span>{rankType === "class" ? "班级排名" : "年级排名"}</span><i className="fas fa-chevron-down filter-dropdown-arrow"></i>
                      </button>
                      <div className={`filter-dropdown-menu ${rankTypeOpen ? "show" : ""}`}>
                        <div className={`filter-dropdown-item ${rankType === "class" ? "selected" : ""}`} onClick={() => { setRankType("class"); setRankTypeOpen(false); }}>班级排名</div>
                        <div className={`filter-dropdown-item ${rankType === "grade" ? "selected" : ""}`} onClick={() => { setRankType("grade"); setRankTypeOpen(false); }}>年级排名</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="chart-container-large"><canvas ref={canvasRef} id="trendChart"></canvas></div>
          </div>
        </div>
      </div>
    </div>
  );
}

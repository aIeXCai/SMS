"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Chart from "chart.js/auto";
import ChartDataLabels from "chartjs-plugin-datalabels";

type SubjectScore = {
  subject_name: string;
  score_value: number;
  full_score: number;
  grade_rank: number | null;
  class_rank: number | null;
};

type ExamData = {
  id: number;
  name: string;
  academic_year: string;
  exam_date: string | null;
  grade_level: string;
  scores: SubjectScore[];
  total_score: number;
  average_score: number;
  grade_total_rank: number | null;
  class_total_rank: number | null;
};

type TrendItem = {
  class_ranks: Array<number | null>;
  grade_ranks: Array<number | null>;
  scores: Array<number | null>;
  exam_names: string[];
  exam_ids: number[];
};

type AnalysisData = {
  student_info: {
    id: number;
    student_id: string;
    name: string;
    grade_level: string;
    class_name: string;
  };
  exams: ExamData[];
  subjects: string[];
  trend_data: Record<string, TrendItem>;
  summary: {
    total_exams: number;
    subjects_count: number;
  };
};

const backendBaseUrl = typeof window !== "undefined" ? `http://${window.location.hostname}:8000` : "http://localhost:8000";

export default function StudentAnalysisDetailPage() {
  return (
    <Suspense fallback={<div className="p-4">加载中...</div>}>
      <StudentAnalysisDetailContent />
    </Suspense>
  );
}

function StudentAnalysisDetailContent() {
  const { token, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const studentId = searchParams.get("student_id") || "";

  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasNoData, setHasNoData] = useState(false);

  const [trendExamOpen, setTrendExamOpen] = useState(false);
  const [trendSubjectOpen, setTrendSubjectOpen] = useState(false);
  const [trendRankTypeOpen, setTrendRankTypeOpen] = useState(false);
  const [radarExamOpen, setRadarExamOpen] = useState(false);
  const [barExamOpen, setBarExamOpen] = useState(false);

  const [selectedTrendExams, setSelectedTrendExams] = useState<string[]>([]);
  const [selectedTrendSubjects, setSelectedTrendSubjects] = useState<string[]>([]);
  const [selectedRankType, setSelectedRankType] = useState<"class" | "grade">("grade");
  const [selectedRadarExamId, setSelectedRadarExamId] = useState<string>("");
  const [selectedBarExamId, setSelectedBarExamId] = useState<string>("");
  const [chartPluginReady, setChartPluginReady] = useState(false);

  const trendCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const radarCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const barCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const trendChartRef = useRef<any>(null);
  const radarChartRef = useRef<any>(null);
  const barChartRef = useRef<any>(null);

  const effectiveToken = useMemo(() => {
    if (token) return token;
    if (typeof window !== "undefined") return localStorage.getItem("accessToken");
    return null;
  }, [token]);

  const authHeader = useMemo(() => {
    if (!effectiveToken) return undefined;
    return { Authorization: `Bearer ${effectiveToken}` };
  }, [effectiveToken]);

  const colors = [
    "rgb(1, 123, 108)",
    "rgb(40, 167, 69)",
    "rgb(0, 123, 255)",
    "rgb(255, 193, 7)",
    "rgb(220, 53, 69)",
    "rgb(108, 117, 125)",
    "rgb(255, 107, 53)",
    "rgb(111, 66, 193)",
  ];

  useEffect(() => {
    if (!loading && !effectiveToken) router.push("/login");
  }, [loading, effectiveToken, router]);

  useEffect(() => {
    if (!effectiveToken || !studentId) return;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${backendBaseUrl}/api/scores/student-analysis-data/?student_id=${encodeURIComponent(studentId)}`, {
          headers: { ...authHeader },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();
        if (!result.success || !result.data) {
          setHasNoData(true);
          setAnalysisData(null);
          return;
        }

        const data: AnalysisData = result.data;
        setAnalysisData(data);
        setHasNoData((data.exams || []).length === 0);

        const firstExamId = data.exams?.[0] ? String(data.exams[0].id) : "";
        setSelectedRadarExamId(firstExamId);
        setSelectedBarExamId(firstExamId);
        setSelectedTrendExams(data.exams?.length ? ["all"] : []);
        setSelectedTrendSubjects(["total"]);
        setSelectedRankType("grade");
      } catch (error) {
        console.error("加载个人分析数据失败", error);
        setHasNoData(true);
        setAnalysisData(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [effectiveToken, studentId, authHeader]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".filter-dropdown")) {
        setTrendExamOpen(false);
        setTrendSubjectOpen(false);
        setTrendRankTypeOpen(false);
        setRadarExamOpen(false);
        setBarExamOpen(false);
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    try {
      Chart.register(ChartDataLabels);
      setChartPluginReady(true);
    } catch {
      setChartPluginReady(true);
    }
  }, []);

  const ensureChartReady = () => {
    return chartPluginReady;
  };

  const getSchoolYearText = (exam: ExamData) => {
    if (exam.academic_year) return exam.academic_year;
    if (exam.exam_date) {
      const year = Number(exam.exam_date.substring(0, 4));
      const month = Number(exam.exam_date.substring(5, 7));
      return month >= 9 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
    }
    return "2024-2025";
  };

  const getExamDisplayText = (exam: ExamData) => `${getSchoolYearText(exam)}${exam.name}（${exam.grade_level || "高一"}）`;

  const trendExams = useMemo(() => {
    if (!analysisData?.exams) return [];
    if (selectedTrendExams.includes("all")) return analysisData.exams;
    return analysisData.exams.filter((exam) => selectedTrendExams.includes(String(exam.id)));
  }, [analysisData, selectedTrendExams]);

  const trendSubjects = useMemo(() => {
    if (!analysisData) return [] as string[];
    if (selectedTrendSubjects.includes("all")) return ["total", ...(analysisData.subjects || [])];
    return selectedTrendSubjects;
  }, [analysisData, selectedTrendSubjects]);

  const drawTrendChart = () => {
    if (!ensureChartReady() || !trendCanvasRef.current || !analysisData) return;

    if (trendChartRef.current) {
      trendChartRef.current.destroy();
      trendChartRef.current = null;
    }

    if (trendExams.length === 0 || trendSubjects.length === 0) return;

    const datasets = trendSubjects.map((subject, index) => {
      const color = colors[index % colors.length];
      const trendItem = analysisData.trend_data?.[subject];
      const labelRankText = selectedRankType === "class" ? "班级排名" : "年级排名";

      const data = trendExams.map((exam) => {
        if (!trendItem) return null;
        const examIndex = trendItem.exam_ids.indexOf(exam.id);
        if (examIndex < 0) return null;
        const value = selectedRankType === "class" ? trendItem.class_ranks[examIndex] : trendItem.grade_ranks[examIndex];
        return value && value > 0 ? value : null;
      });

      return {
        label: subject === "total" ? `总分${labelRankText}` : `${subject}${labelRankText}`,
        data,
        borderColor: color,
        backgroundColor: color.replace("rgb", "rgba").replace(")", ", 0.1)"),
        fill: false,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 7,
        pointBorderWidth: 2,
        pointBackgroundColor: "#ffffff",
        pointBorderColor: color,
        borderWidth: 2.5,
      };
    });

    trendChartRef.current = new Chart(trendCanvasRef.current, {
      type: "line",
      data: {
        labels: trendExams.map(getExamDisplayText),
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            reverse: true,
            min: 1,
            title: { display: true, text: "排名" },
            ticks: {
              callback: (value: string | number) => {
                const numeric = Number(value);
                return Number.isInteger(numeric) && numeric >= 1 ? `${numeric}` : "";
              },
            },
          },
          x: { type: "category", offset: true },
        },
        plugins: {
          legend: { display: true, position: "top" },
          datalabels: {
            display: true,
            align: "top",
            anchor: "end",
            offset: 4,
            font: { size: 15, weight: "bold" },
            color: (context: any) => context.dataset.borderColor,
            formatter: (value: number | null) => (value ? value : ""),
          },
          tooltip: {
            callbacks: {
              label: (ctx: any) => `${ctx.dataset.label}: ${ctx.raw ? `第${ctx.raw}名` : "无数据"}`,
            },
          },
        },
      },
    });
  };

  const drawRadarChart = () => {
    if (!ensureChartReady() || !radarCanvasRef.current || !analysisData) return;

    if (radarChartRef.current) {
      radarChartRef.current.destroy();
      radarChartRef.current = null;
    }

    const exam = analysisData.exams.find((item) => String(item.id) === selectedRadarExamId) || analysisData.exams[0];
    if (!exam) return;

    radarChartRef.current = new Chart(radarCanvasRef.current, {
      type: "radar",
      data: {
        labels: exam.scores.map((s) => s.subject_name),
        datasets: [
          {
            label: "",
            data: exam.scores.map((s) => {
              const full = s.full_score || 100;
              return Math.round(Math.max(0, Math.min(100, (s.score_value / full) * 100)));
            }),
            borderColor: "rgb(40, 167, 69)",
            backgroundColor: "rgba(40, 167, 69, 0.2)",
            pointBackgroundColor: "rgb(40, 167, 69)",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            beginAtZero: true,
            min: 0,
            max: 100,
            ticks: { stepSize: 20, callback: (v: string | number) => `${Number(v)}%` },
          },
        },
        plugins: {
          legend: { display: false },
          datalabels: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx: any) => `得分率: ${ctx.raw}%`,
              afterLabel: (ctx: any) => {
                const idx = ctx.dataIndex;
                const currentScore = exam.scores?.[idx];
                if (!currentScore) return "";
                return `实际得分: ${currentScore.score_value || 0}/${currentScore.full_score || 100}`;
              },
            },
          },
        },
      },
    });
  };

  const drawBarChart = () => {
    if (!ensureChartReady() || !barCanvasRef.current || !analysisData) return;

    if (barChartRef.current) {
      barChartRef.current.destroy();
      barChartRef.current = null;
    }

    const exam = analysisData.exams.find((item) => String(item.id) === selectedBarExamId) || analysisData.exams[0];
    if (!exam) return;

    const subjectColors = [
      { bg: "rgba(1, 123, 108, 0.8)", border: "rgb(1, 123, 108)" },
      { bg: "rgba(26, 148, 133, 0.8)", border: "rgb(26, 148, 133)" },
      { bg: "rgba(51, 173, 158, 0.8)", border: "rgb(51, 173, 158)" },
      { bg: "rgba(76, 198, 183, 0.8)", border: "rgb(76, 198, 183)" },
      { bg: "rgba(101, 223, 208, 0.8)", border: "rgb(101, 223, 208)" },
    ];

    barChartRef.current = new Chart(barCanvasRef.current, {
      type: "bar",
      data: {
        labels: exam.scores.map((s) => s.subject_name),
        datasets: [
          {
            label: "",
            data: exam.scores.map((s, index) => s.score_value || 0),
            backgroundColor: exam.scores.map((_, index) => subjectColors[index % subjectColors.length].bg),
            borderColor: exam.scores.map((_, index) => subjectColors[index % subjectColors.length].border),
            borderWidth: 1,
            borderRadius: 8,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          datalabels: {
            display: true,
            anchor: "center",
            align: "center",
            color: "#ffffff",
            font: { size: 14, weight: "bold" },
            formatter: (value: number) => value,
          },
          tooltip: {
            callbacks: {
              label: (ctx: any) => `得分: ${ctx.raw}分`,
            },
          },
        },
        scales: { y: { beginAtZero: true, title: { display: true, text: "得分" } } },
      },
    });
  };

  useEffect(() => {
    if (!analysisData) return;
    drawTrendChart();
  }, [analysisData, selectedTrendExams, selectedTrendSubjects, selectedRankType, chartPluginReady]);

  useEffect(() => {
    if (!analysisData) return;
    drawRadarChart();
  }, [analysisData, selectedRadarExamId, chartPluginReady]);

  useEffect(() => {
    if (!analysisData) return;
    drawBarChart();
  }, [analysisData, selectedBarExamId, chartPluginReady]);

  useEffect(() => {
    return () => {
      trendChartRef.current?.destroy();
      radarChartRef.current?.destroy();
      barChartRef.current?.destroy();
    };
  }, []);

  const trendExamText = selectedTrendExams.includes("all")
    ? "所有考试"
    : selectedTrendExams.length === 0
      ? "请选择考试"
      : `已选择 ${selectedTrendExams.length} 个考试`;

  const trendSubjectText = selectedTrendSubjects.includes("all")
    ? "所有科目"
    : selectedTrendSubjects.length === 0
      ? "请选择科目"
      : `已选择 ${selectedTrendSubjects.length} 个科目`;

  const toggleAllTrendExams = (checked: boolean) => {
    if (!analysisData) return;
    setSelectedTrendExams(checked ? ["all"] : []);
  };

  const toggleTrendExam = (examId: string, checked: boolean) => {
    setSelectedTrendExams((prev) => {
      let next = prev.includes("all") ? [] : [...prev];
      if (checked) {
        if (!next.includes(examId)) next.push(examId);
      } else {
        next = next.filter((id) => id !== examId);
      }
      return next;
    });
  };

  const toggleAllTrendSubjects = (checked: boolean) => {
    setSelectedTrendSubjects(checked ? ["all"] : []);
  };

  const toggleTrendSubject = (subjectCode: string, checked: boolean) => {
    setSelectedTrendSubjects((prev) => {
      let next = prev.includes("all") ? [] : [...prev];
      if (checked) {
        if (!next.includes(subjectCode)) next.push(subjectCode);
      } else {
        next = next.filter((code) => code !== subjectCode);
      }
      return next;
    });
  };

  if (loading) return <div className="p-4">加载中...</div>;

  return (
    <>
      <div className="container-fluid fade-in">
        <div className="page-header">
          <div className="container-fluid">
            <div className="row align-items-center">
              <div className="col">
                <h1><i className="fas fa-user-graduate me-3"></i>{analysisData?.student_info.name || "学生"} - 个人成绩分析</h1>
                <nav aria-label="breadcrumb">
                  <ol className="breadcrumb">
                    <li className="breadcrumb-item"><Link href="/analysis/class-grade">成绩分析</Link></li>
                    <li className="breadcrumb-item"><Link href="/analysis/student">个人分析</Link></li>
                    <li className="breadcrumb-item active" aria-current="page">{analysisData?.student_info.name || "-"}</li>
                  </ol>
                </nav>
              </div>
              <div className="col-auto">
                <Link href="/analysis/student" className="btn btn-return"><i className="fas fa-arrow-left me-2"></i>返回选择</Link>
              </div>
            </div>
          </div>
        </div>

        {analysisData && (
          <div className="analysis-info-card alert alert-modern">
            <div className="d-flex align-items-center">
              <i className="fas fa-info-circle fa-2x me-3 text-success"></i>
              <div>
                <h6 className="alert-heading mb-1 text-success"><i className="fas fa-user me-1"></i>学生信息</h6>
                <p className="mb-0 text-success">
                  <strong>学号：</strong>{analysisData.student_info.student_id} |
                  <strong>年级：</strong>{analysisData.student_info.grade_level} |
                  <strong>班级：</strong>{analysisData.student_info.class_name || "未分班"} |
                  <strong>考试次数：</strong><span>{analysisData.exams.length}</span>次
                </p>
              </div>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="text-center py-5" style={{ display: "block" }}>
            <div className="loading-spinner mx-auto mb-3"></div>
            <h5>正在加载分析数据...</h5>
            <p className="text-muted">请稍候，正在为您准备详细的成绩分析报告</p>
          </div>
        )}

        {!isLoading && hasNoData && (
          <div className="no-data-message">
            <i className="fas fa-chart-line"></i>
            <p>暂无分析数据，请确保该学生有考试成绩记录。</p>
            <Link href="/analysis/student" className="btn btn-primary"><i className="fas fa-arrow-left me-2"></i>返回学生选择</Link>
          </div>
        )}

        {!isLoading && !hasNoData && analysisData && (
          <div id="analysisResults">
            <div className="row">
              <div className="col-12">
                <div className="chart-card">
                  <div className="card-header"><h5><i className="fas fa-chart-line me-2"></i>排名趋势分析</h5></div>
                  <div className="card-body">
                    <div className="chart-filters">
                      <div className="row g-3">
                        <div className="col-md-4">
                          <div className="filter-group">
                            <label><i className="fas fa-calendar-alt me-2 text-primary"></i>考试</label>
                            <div className="filter-dropdown">
                              <button type="button" className={`filter-dropdown-toggle ${trendExamOpen ? "active" : ""}`} onClick={() => { setTrendExamOpen((v)=>!v); setTrendSubjectOpen(false); setTrendRankTypeOpen(false); setRadarExamOpen(false); setBarExamOpen(false); }}>
                                <span>{trendExamText}</span><i className="fas fa-chevron-down filter-dropdown-arrow"></i>
                              </button>
                              <div className={`filter-dropdown-menu ${trendExamOpen ? "show" : ""}`}>
                                <div className="filter-dropdown-header"><small className="text-muted">多选考试 (<span>{selectedTrendExams.includes("all") ? analysisData.exams.length : selectedTrendExams.length}</span> 个已选择)</small></div>
                                <label className="filter-dropdown-item"><input type="checkbox" className="form-check-input" checked={selectedTrendExams.includes("all")} onChange={(e)=>toggleAllTrendExams(e.target.checked)} />所有考试</label>
                                {analysisData.exams.map((exam) => (
                                  <label key={exam.id} className="filter-dropdown-item">
                                    <input type="checkbox" className="form-check-input" checked={!selectedTrendExams.includes("all") && selectedTrendExams.includes(String(exam.id))} onChange={(e)=>toggleTrendExam(String(exam.id), e.target.checked)} />
                                    {getExamDisplayText(exam)}
                                  </label>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="col-md-4">
                          <div className="filter-group">
                            <label><i className="fas fa-book me-2 text-success"></i>科目</label>
                            <div className="filter-dropdown">
                              <button type="button" className={`filter-dropdown-toggle ${trendSubjectOpen ? "active" : ""}`} onClick={() => { setTrendSubjectOpen((v)=>!v); setTrendExamOpen(false); setTrendRankTypeOpen(false); setRadarExamOpen(false); setBarExamOpen(false); }}>
                                <span>{trendSubjectText}</span><i className="fas fa-chevron-down filter-dropdown-arrow"></i>
                              </button>
                              <div className={`filter-dropdown-menu ${trendSubjectOpen ? "show" : ""}`}>
                                <div className="filter-dropdown-header"><small className="text-muted">多选科目 (<span>{selectedTrendSubjects.includes("all") ? analysisData.subjects.length + 1 : selectedTrendSubjects.length}</span> 个已选择)</small></div>
                                <label className="filter-dropdown-item"><input type="checkbox" className="form-check-input" checked={selectedTrendSubjects.includes("all")} onChange={(e)=>toggleAllTrendSubjects(e.target.checked)} />所有科目</label>
                                <label className="filter-dropdown-item"><input type="checkbox" className="form-check-input" checked={!selectedTrendSubjects.includes("all") && selectedTrendSubjects.includes("total")} onChange={(e)=>toggleTrendSubject("total", e.target.checked)} />总分</label>
                                {analysisData.subjects.map((subject) => (
                                  <label key={subject} className="filter-dropdown-item"><input type="checkbox" className="form-check-input" checked={!selectedTrendSubjects.includes("all") && selectedTrendSubjects.includes(subject)} onChange={(e)=>toggleTrendSubject(subject, e.target.checked)} />{subject}</label>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="col-md-4">
                          <div className="filter-group">
                            <label><i className="fas fa-trophy me-2 text-warning"></i>排名类型</label>
                            <div className="filter-dropdown">
                              <button type="button" className={`filter-dropdown-toggle ${trendRankTypeOpen ? "active" : ""}`} onClick={() => { setTrendRankTypeOpen((v)=>!v); setTrendExamOpen(false); setTrendSubjectOpen(false); setRadarExamOpen(false); setBarExamOpen(false); }}>
                                <span>{selectedRankType === "class" ? "班级排名" : "年级排名"}</span><i className="fas fa-chevron-down filter-dropdown-arrow"></i>
                              </button>
                              <div className={`filter-dropdown-menu ${trendRankTypeOpen ? "show" : ""}`}>
                                <div className={`filter-dropdown-item ${selectedRankType === "class" ? "selected" : ""}`} onClick={() => { setSelectedRankType("class"); setTrendRankTypeOpen(false); }}>班级排名</div>
                                <div className={`filter-dropdown-item ${selectedRankType === "grade" ? "selected" : ""}`} onClick={() => { setSelectedRankType("grade"); setTrendRankTypeOpen(false); }}>年级排名</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="chart-container-large"><canvas ref={trendCanvasRef} id="trendChart"></canvas></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="row">
              <div className="col-lg-4">
                <div className="chart-card">
                  <div className="card-header"><h5><i className="fas fa-chart-area me-2"></i>学科能力雷达图</h5></div>
                  <div className="card-body">
                    <div className="chart-filters">
                      <div className="filter-group">
                        <label><i className="fas fa-calendar-alt me-2 text-primary"></i>考试</label>
                        <div className="filter-dropdown">
                          <button type="button" className={`filter-dropdown-toggle ${radarExamOpen ? "active" : ""}`} onClick={() => { setRadarExamOpen((v)=>!v); setTrendExamOpen(false); setTrendSubjectOpen(false); setTrendRankTypeOpen(false); setBarExamOpen(false); }}>
                            <span>{analysisData.exams.find((e)=>String(e.id)===selectedRadarExamId) ? getExamDisplayText(analysisData.exams.find((e)=>String(e.id)===selectedRadarExamId) as ExamData) : "请选择考试"}</span><i className="fas fa-chevron-down filter-dropdown-arrow"></i>
                          </button>
                          <div className={`filter-dropdown-menu ${radarExamOpen ? "show" : ""}`}>
                            {analysisData.exams.map((exam) => (
                              <div key={exam.id} className={`filter-dropdown-item ${String(exam.id) === selectedRadarExamId ? "selected" : ""}`} onClick={() => { setSelectedRadarExamId(String(exam.id)); setRadarExamOpen(false); }}>
                                {getExamDisplayText(exam)}
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

              <div className="col-lg-8">
                <div className="chart-card">
                  <div className="card-header"><h5><i className="fas fa-chart-bar me-2"></i>成绩对比分析</h5></div>
                  <div className="card-body">
                    <div className="chart-filters">
                      <div className="filter-group">
                        <label><i className="fas fa-calendar-alt me-2 text-primary"></i>考试</label>
                        <div className="filter-dropdown">
                          <button type="button" className={`filter-dropdown-toggle ${barExamOpen ? "active" : ""}`} onClick={() => { setBarExamOpen((v)=>!v); setTrendExamOpen(false); setTrendSubjectOpen(false); setTrendRankTypeOpen(false); setRadarExamOpen(false); }}>
                            <span>{analysisData.exams.find((e)=>String(e.id)===selectedBarExamId) ? getExamDisplayText(analysisData.exams.find((e)=>String(e.id)===selectedBarExamId) as ExamData) : "请选择考试"}</span><i className="fas fa-chevron-down filter-dropdown-arrow"></i>
                          </button>
                          <div className={`filter-dropdown-menu ${barExamOpen ? "show" : ""}`}>
                            {analysisData.exams.map((exam) => (
                              <div key={exam.id} className={`filter-dropdown-item ${String(exam.id) === selectedBarExamId ? "selected" : ""}`} onClick={() => { setSelectedBarExamId(String(exam.id)); setBarExamOpen(false); }}>
                                {getExamDisplayText(exam)}
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

            <div className="row">
              <div className="col-12">
                <div className="chart-card">
                  <div className="card-header"><h5><i className="fas fa-table me-2"></i>学生详细成绩数据</h5></div>
                  <div className="card-body">
                    <div className="table-container-wrapper">
                      <div className="table-responsive">
                        <table className="table score-table" id="studentScoreTable">
                          <thead>
                            <tr>
                              <th>考试名称</th>
                              <th>总分</th>
                              <th>班排</th>
                              <th>级排</th>
                              <th>各科详情</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analysisData.exams.map((exam) => (
                              <tr key={exam.id}>
                                <td>{getExamDisplayText(exam)}</td>
                                <td><span className="badge bg-primary">{exam.total_score || 0}</span></td>
                                <td><span className="badge bg-success">{exam.class_total_rank || "-"}</span></td>
                                <td><span className="badge bg-info">{exam.grade_total_rank || "-"}</span></td>
                                <td>
                                  <div className="d-flex flex-nowrap gap-1 subject-detail-scroll">
                                    {(exam.scores || []).map((score, idx) => {
                                      const gradeRankText = score.grade_rank ? `级排:${score.grade_rank}` : "";
                                      const classRankText = score.class_rank ? `班排:${score.class_rank}` : "";
                                      const rank = gradeRankText && classRankText ? `(${gradeRankText},${classRankText})` : gradeRankText ? `(${gradeRankText})` : classRankText ? `(${classRankText})` : "";
                                      return <small key={`${exam.id}-${idx}`} className="badge bg-light text-dark me-1">{score.subject_name}:{score.score_value || 0}{rank}</small>;
                                    })}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        .page-header {
          background: linear-gradient(135deg, rgb(1,135,108) 0%, rgb(1,105,85) 100%);
          color: white;
          padding: 2rem 0;
          margin-bottom: 2rem;
          border-radius: 15px;
        }
        .page-header .breadcrumb-item,
        .page-header .breadcrumb-item a,
        .page-header .breadcrumb-item.active,
        .page-header .breadcrumb-item + .breadcrumb-item::before {
          color: #ffffff;
        }
        .btn-return {
          background: gray;
          border: none;
          border-radius: 25px;
          padding: 0.75rem 2rem;
          color: white;
          font-weight: 500;
          transition: all 0.3s ease;
          box-shadow: 0 8px 25px rgba(1, 135, 108, 0.2);
        }
        .btn-return:hover {
          transform: translateY(-2px);
          color: white;
          box-shadow: 0 12px 35px rgba(1, 135, 108, 0.3);
        }
        .analysis-info-card {
          background: linear-gradient(135deg, rgba(1,135,108,0.1) 0%, rgba(1,135,108,0.15) 100%);
          border: none;
          border-radius: 12px;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
          margin-bottom: 1.5rem;
          padding: 1rem 1.5rem;
        }
        .analysis-info-card .alert-heading {
          font-weight: 700;
        }
        .alert-modern {
          border: none;
          border-radius: 10px;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
          margin-bottom: 2rem;
        }
        .chart-card {
          border: none;
          border-radius: 15px;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
          margin-bottom: 1.5rem;
          overflow: hidden;
          transition: all 0.3s ease;
          background: linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%);
          height: 100%;
        }
        .chart-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 35px rgba(0, 0, 0, 0.15);
        }
        .chart-card .card-body {
          padding: 1rem;
        }
        .chart-card .card-header {
          background: linear-gradient(135deg, rgba(1,135,108,0.1) 0%, rgba(1,135,108,0.15) 100%);
          border: none;
          padding: 1rem 1.5rem;
          border-bottom: 1px solid rgba(1, 135, 108, 0.2);
        }
        .chart-card .card-header h5,
        .chart-card .card-header i {
          color: rgb(1, 135, 108);
        }
        .chart-card .card-header h5 {
          font-weight: 700;
        }
        #analysisResults > .row {
          margin-bottom: 2rem;
        }
        #analysisResults > .row:last-child {
          margin-bottom: 0;
        }
        .chart-container { position: relative; height: 350px; margin-bottom: 10px; padding: 10px; }
        .chart-container-large { position: relative; height: 450px; margin-bottom: 10px; padding: 10px; }
        .chart-filters { padding: 1rem; background-color: #f8f9fa; border-radius: 0.5rem; margin-bottom: 1rem; border: 1px solid #dee2e6; }
        .filter-group { margin-bottom: 1rem; }
        .filter-group:last-child { margin-bottom: 0; }
        .filter-group label { font-weight: 600; margin-bottom: 0.5rem; display: block; color: #495057; }
        .filter-dropdown { position: relative; width: 100%; color: #495057; }
        .filter-dropdown-toggle { width: 100%; padding: 0.75rem 1rem; border: 1px solid #ced4da; border-radius: 0.5rem; background-color: #fff; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: all 0.3s ease; font-size: 0.875rem; }
        .filter-dropdown-toggle:hover, .filter-dropdown-toggle.active { border-color: #007bff; box-shadow: 0 0 0 0.2rem rgba(0,123,255,.25); }
        .filter-dropdown-arrow { transition: transform .3s ease; color: #6c757d; }
        .filter-dropdown-toggle.active .filter-dropdown-arrow { transform: rotate(180deg); color: #007bff; }
        .filter-dropdown-menu { position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid #ced4da; border-radius: .5rem; box-shadow: 0 .5rem 1rem rgba(0,0,0,.15); z-index: 1000; max-height: 200px; overflow-y: auto; display: none; margin-top: .25rem; }
        .filter-dropdown-menu.show { display: block; }
        .filter-dropdown-header { padding: .75rem 1rem; border-bottom: 1px solid #e9ecef; background-color: #f8f9fa; font-weight: 500; }
        .filter-dropdown-item { padding: .75rem 1rem; cursor: pointer; transition: background-color .15s ease-in-out; border-bottom: 1px solid #f8f9fa; font-size: .875rem; display:flex; align-items:center; gap:.5rem; }
        .filter-dropdown-item:hover { background-color: #f8f9fa; }
        .filter-dropdown-item.selected { background-color: #007bff; color: white; }
        .score-table td:nth-child(5) { min-width: 400px; max-width: 600px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .score-table td:nth-child(5) .subject-detail-scroll {
          white-space: nowrap;
          overflow-x: auto;
          overflow-y: hidden;
          scrollbar-width: thin;
          scrollbar-color: #dee2e6 transparent;
          padding-bottom: 2px;
        }
        .score-table td:nth-child(5) .subject-detail-scroll::-webkit-scrollbar {
          height: 4px;
        }
        .score-table td:nth-child(5) .subject-detail-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .score-table td:nth-child(5) .subject-detail-scroll::-webkit-scrollbar-thumb {
          background-color: #dee2e6;
          border-radius: 2px;
        }
        .table-container-wrapper { position: relative; overflow: hidden; border: 1px solid #dee2e6; border-radius: 10px; background: white; }
        .score-table { margin:0; border-collapse: separate; border-spacing: 0; font-size: 14px; }
        .score-table th,.score-table td { padding: .75rem; text-align: center; white-space: nowrap; border-bottom: 1px solid #dee2e6; }
        .score-table thead th { background: #017b6c; color:white; font-weight:600; }
        .score-table tbody tr:hover { background-color: #f5f5f5 !important; }
        .no-data-message { text-align:center; padding:3rem; color:#6c757d; font-size:1.1rem; }
        .no-data-message i { font-size:3rem; margin-bottom:1rem; opacity:.5; }
        .loading-spinner { width: 3rem; height: 3rem; border: .3rem solid #f3f3f3; border-top: .3rem solid #007bff; border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg);} 100% { transform: rotate(360deg);} }
      `}</style>
    </>
  );
}

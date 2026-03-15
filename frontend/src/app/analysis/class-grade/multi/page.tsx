"use client";

import Link from "next/link";
import Chart from "chart.js/auto";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

type SubjectItem = { code: string; name: string };

type ClassStatistic = {
  class_name: string;
  student_count: number;
  avg_total: number;
  max_total: number;
  min_total: number;
  subject_averages: number[];
};

type ChartDataPayload = {
  subjects: string[];
  classes: string[];
  class_subject_averages: Record<string, number[]>;
  score_distributions: Record<string, number[]>;
};

type AnalysisData = {
  selected_exam: {
    id: number;
    name: string;
    academic_year: string;
    grade_level: string;
    grade_level_display: string;
  };
  selected_grade: string;
  academic_year: string;
  selected_classes: string[];
  class_statistics: ClassStatistic[];
  subjects: SubjectItem[];
  total_students: number;
  subject_count: number;
  highest_avg: number;
  chart_data: ChartDataPayload;
};

const backendBaseUrl = typeof window !== "undefined" ? `http://${window.location.hostname}:8000` : "http://localhost:8000";

type SortState = {
  column: number;
  direction: "asc" | "desc";
};

export default function ClassAnalysisMultiPage() {
  return (
    <Suspense fallback={<div className="p-4">加载中...</div>}>
      <ClassAnalysisMultiContent />
    </Suspense>
  );
}

function ClassAnalysisMultiContent() {
  const { token, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const querySignature = searchParams.toString();
  const parsedQuery = useMemo(() => {
    const academicYear = searchParams.get("academic_year") || "";
    const examId = searchParams.get("exam") || "";
    const gradeLevel = searchParams.get("grade_level") || "";
    const className = searchParams.get("class_name") || "";
    const selectedClasses = searchParams.getAll("selected_classes");
    return { academicYear, examId, gradeLevel, className, selectedClasses };
  }, [querySignature, searchParams]);

  const { academicYear, examId, gradeLevel, className, selectedClasses } = parsedQuery;

  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasNoData, setHasNoData] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [sortState, setSortState] = useState<SortState>({ column: -1, direction: "asc" });

  const comparisonCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const trendCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const distributionCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const comparisonChartRef = useRef<Chart | null>(null);
  const trendChartRef = useRef<Chart | null>(null);
  const distributionChartRef = useRef<Chart | null>(null);

  const effectiveToken = useMemo(() => {
    if (token) return token;
    if (typeof window !== "undefined") return localStorage.getItem("accessToken");
    return null;
  }, [token]);

  const authHeader = useMemo(() => {
    if (!effectiveToken) return undefined;
    return { Authorization: `Bearer ${effectiveToken}` };
  }, [effectiveToken]);

  useEffect(() => {
    if (!loading && !effectiveToken) router.push("/login");
  }, [loading, effectiveToken, router]);

  const chartMaxScore = useMemo(() => {
    const fallback = (analysisData?.selected_grade || "").startsWith("初") ? 120 : 150;
    const classSubjectAverages = analysisData?.chart_data?.class_subject_averages;
    if (!classSubjectAverages) return fallback;

    const allValues = Object.values(classSubjectAverages).flat();
    const finiteValues = allValues.filter((value): value is number => Number.isFinite(value));
    if (finiteValues.length === 0) return fallback;

    const observedMax = Math.max(...finiteValues);
    if (observedMax <= 0) return fallback;

    return Math.max(fallback, Math.ceil((observedMax + 5) / 10) * 10);
  }, [analysisData]);

  const sortedClassStatistics = useMemo(() => {
    const rows = [...(analysisData?.class_statistics || [])];
    const { column, direction } = sortState;
    if (column < 2) return rows;

    rows.sort((a, b) => {
      const getValue = (row: ClassStatistic) => {
        if (column === 2) return Number(row.avg_total || 0);
        if (column === 3) return Number(row.max_total || 0);
        if (column === 4) return Number(row.min_total || 0);
        const subjectIndex = column - 5;
        return Number(row.subject_averages?.[subjectIndex] || 0);
      };

      const aValue = getValue(a);
      const bValue = getValue(b);
      return direction === "asc" ? aValue - bValue : bValue - aValue;
    });

    return rows;
  }, [analysisData, sortState]);

  useEffect(() => {
    if (!effectiveToken) return;
    if (!examId || (selectedClasses.length === 0 && !className)) {
      setErrorText("缺少必要参数：请先从成绩分析入口选择多个班级。");
      setHasNoData(true);
      setIsLoading(false);
      return;
    }

    const loadData = async () => {
      setIsLoading(true);
      setHasNoData(false);
      setErrorText("");
      try {
        const params = new URLSearchParams();
        params.set("exam", examId);
        if (academicYear) params.set("academic_year", academicYear);
        if (gradeLevel) params.set("grade_level", gradeLevel);

        if (selectedClasses.length > 0) {
          selectedClasses.forEach((value) => params.append("selected_classes", value));
        } else if (className) {
          params.set("class_name", className);
        }

        const response = await fetch(`${backendBaseUrl}/api/scores/class-analysis-multi/?${params.toString()}`, {
          headers: { ...authHeader },
        });

        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.success || !result?.data) {
          throw new Error(result?.error || `HTTP ${response.status}`);
        }

        const data: AnalysisData = result.data;
        setAnalysisData(data);
        if (!data.class_statistics?.length) {
          setHasNoData(true);
        }
      } catch (error) {
        console.error("加载多班级分析失败", error);
        setErrorText(error instanceof Error ? error.message : "加载失败，请稍后重试");
        setHasNoData(true);
        setAnalysisData(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [effectiveToken, querySignature, authHeader]);

  const destroyCharts = () => {
    comparisonChartRef.current?.destroy();
    trendChartRef.current?.destroy();
    distributionChartRef.current?.destroy();
    comparisonChartRef.current = null;
    trendChartRef.current = null;
    distributionChartRef.current = null;
  };

  const classColors = [
    "#01876c",
    "#874d5c",
    "#035c7a",
    "#874d35",
    "#386b5e",
    "#6a5600",
    "#025e4b",
    "#2b4079",
    "#4b874d",
    "#57577b",
    "#873300",
    "#02a583",
  ];

  const drawComparisonChart = () => {
    if (!analysisData || !comparisonCanvasRef.current) return;
    const chartData = analysisData.chart_data;

    comparisonChartRef.current = new Chart(comparisonCanvasRef.current, {
      type: "bar",
      data: {
        labels: chartData.subjects,
        datasets: chartData.classes.map((classNameText, index) => ({
          label: classNameText,
          data: chartData.class_subject_averages?.[classNameText] || [],
          backgroundColor: classColors[index % classColors.length],
          borderColor: classColors[index % classColors.length],
          borderWidth: 2,
          borderRadius: 4,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top",
            labels: { padding: 20, usePointStyle: true, font: { size: 15 } },
          },
          datalabels: { display: false },
          tooltip: {
            mode: "index",
            intersect: false,
            callbacks: {
              label: (context) => `${context.dataset.label}: ${Number(context.parsed.y).toFixed(1)}分`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: "#6c757d", font: { size: 15, weight: 600 } },
          },
          y: {
            beginAtZero: true,
            max: chartMaxScore,
            grid: { color: "rgba(0,0,0,0.1)" },
            title: { display: true, text: "平均分", color: "#6c757d", font: { size: 16, weight: 700 } },
            ticks: { color: "#6c757d", font: { size: 15, weight: 600 } },
          },
        },
      },
    });
  };

  const drawTrendChart = () => {
    if (!analysisData || !trendCanvasRef.current) return;
    const chartData = analysisData.chart_data;

    trendChartRef.current = new Chart(trendCanvasRef.current, {
      type: "line",
      data: {
        labels: chartData.subjects,
        datasets: chartData.classes.map((classNameText, index) => ({
          label: classNameText,
          data: chartData.class_subject_averages?.[classNameText] || [],
          borderColor: classColors[index % classColors.length],
          backgroundColor: `${classColors[index % classColors.length]}20`,
          borderWidth: 3,
          pointRadius: 6,
          pointHoverRadius: 8,
          tension: 0.3,
          fill: false,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top",
            labels: { padding: 15, usePointStyle: true, font: { size: 15 } },
          },
          datalabels: { display: false },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: "#6c757d", font: { size: 15, weight: 600 } },
          },
          y: {
            beginAtZero: true,
            max: chartMaxScore,
            grid: { color: "rgba(0,0,0,0.1)" },
            title: { display: true, text: "平均分", color: "#6c757d", font: { size: 16, weight: 700 } },
            ticks: { color: "#6c757d", font: { size: 15, weight: 600 } },
          },
        },
      },
    });
  };

  const drawDistributionChart = () => {
    if (!analysisData || !distributionCanvasRef.current) return;
    const chartData = analysisData.chart_data;

    distributionChartRef.current = new Chart(distributionCanvasRef.current, {
      type: "bar",
      data: {
        labels: ["特优(95%+)", "优秀(85%-95%)", "良好(70%-85%)", "及格(60%-70%)", "不及格(<60%)"],
        datasets: chartData.classes.map((classNameText, index) => ({
          label: classNameText,
          data: chartData.score_distributions?.[classNameText] || [0, 0, 0, 0, 0],
          backgroundColor: classColors[index % classColors.length],
          borderColor: classColors[index % classColors.length],
          borderWidth: 1,
          borderRadius: 4,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top",
            labels: { padding: 15, usePointStyle: true, font: { size: 15 } },
          },
          datalabels: { display: false },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: "#6c757d", font: { size: 15, weight: 600 } },
          },
          y: {
            beginAtZero: true,
            grid: { color: "rgba(0,0,0,0.1)" },
            title: { display: true, text: "学生人数", color: "#6c757d", font: { size: 16, weight: 700 } },
            ticks: {
              color: "#6c757d",
              font: { size: 15, weight: 600 },
              callback: (value: string | number) => (Number.isInteger(Number(value)) ? `${value}` : ""),
            },
          },
        },
      },
    });
  };

  useEffect(() => {
    if (!analysisData) return;
    destroyCharts();
    drawComparisonChart();
    drawTrendChart();
    drawDistributionChart();
  }, [analysisData]);

  useEffect(() => {
    return () => destroyCharts();
  }, []);

  const onSort = (column: number) => {
    setSortState((prev) => {
      if (prev.column === column) {
        return { column, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { column, direction: "asc" };
    });
  };

  const sortClassName = (column: number) => {
    if (sortState.column !== column) return "";
    return sortState.direction === "asc" ? "sort-asc" : "sort-desc";
  };

  const getSortIconClass = (column: number) => {
    if (sortState.column !== column) return "fas fa-sort sort-icon";
    return sortState.direction === "asc" ? "fas fa-sort-up sort-icon" : "fas fa-sort-down sort-icon";
  };

  if (loading) return <div className="p-4">加载中...</div>;

  return (
    <>
      <div className="container-fluid fade-in">
        <div className="page-header">
          <div className="container-fluid">
            <div className="row align-items-center">
              <div className="col">
                <h1><i className="fas fa-chart-line me-3"></i>多班级对比分析</h1>
                <nav aria-label="breadcrumb">
                  <ol className="breadcrumb">
                    <li className="breadcrumb-item"><Link href="/analysis/class-grade">成绩分析</Link></li>
                    <li className="breadcrumb-item active" aria-current="page">多班级对比</li>
                  </ol>
                </nav>
              </div>
              <div className="col-auto text-end">
                <Link href="/analysis/class-grade" className="btn btn-return"><i className="fas fa-arrow-left me-2"></i>返回选择</Link>
              </div>
            </div>
          </div>
        </div>

        {analysisData && (
          <div className="analysis-info-card alert alert-modern">
            <div className="d-flex align-items-center">
              <i className="fas fa-info-circle fa-2x me-3 text-success"></i>
              <div>
                <h6 className="alert-heading mb-1 text-success"><i className="fas fa-filter me-1"></i>当前分析条件</h6>
                <p className="mb-0 text-success">
                  <strong>学年：</strong>{analysisData.academic_year || "-"} |
                  <strong>考试：</strong>{analysisData.selected_exam.name} |
                  <strong>年级：</strong>{analysisData.selected_grade}
                </p>
                <p className="mb-0 text-success mt-1">
                  <strong>已选择班级：</strong>
                  {analysisData.selected_classes.length > 0 ? analysisData.selected_classes.join("、") : <span className="text-muted">无</span>}
                </p>
              </div>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="text-center py-5">
            <div className="loading-spinner mx-auto mb-3"></div>
            <h5>正在加载多班级分析数据...</h5>
            <p className="text-muted">请稍候，正在生成多班级对比图表</p>
          </div>
        )}

        {!isLoading && hasNoData && (
          <div className="no-data-message">
            <i className="fas fa-chart-line"></i>
            <p>{errorText || "暂无多班级分析数据，请检查筛选条件。"}</p>
            <Link href="/analysis/class-grade" className="btn btn-primary"><i className="fas fa-arrow-left me-2"></i>返回分析入口</Link>
          </div>
        )}

        {!isLoading && !hasNoData && analysisData && (
          <>
            <div className="row mb-4">
              <div className="col-md-3"><div className="stats-card text-center"><div className="stats-number">{analysisData.selected_classes.length}</div><div className="stats-label">对比班级数</div></div></div>
              <div className="col-md-3"><div className="stats-card text-center"><div className="stats-number">{analysisData.total_students}</div><div className="stats-label">总参考学生数</div></div></div>
              <div className="col-md-3"><div className="stats-card text-center"><div className="stats-number">{analysisData.subject_count}</div><div className="stats-label">考试科目数</div></div></div>
              <div className="col-md-3"><div className="stats-card text-center"><div className="stats-number">{Number(analysisData.highest_avg || 0).toFixed(1)}</div><div className="stats-label">最高班级平均分</div></div></div>
            </div>

            <div className="row">
              <div className="col-12">
                <div className="chart-card">
                  <div className="card-header"><h5><i className="fas fa-chart-bar"></i> 各科目班级平均分对比</h5></div>
                  <div className="card-body"><div className="chart-container-large"><canvas ref={comparisonCanvasRef}></canvas></div></div>
                </div>
              </div>
            </div>

            <div className="row">
              <div className="col-md-6">
                <div className="chart-card">
                  <div className="card-header"><h5><i className="fas fa-chart-line"></i> 班级表现趋势图</h5></div>
                  <div className="card-body"><div className="chart-container"><canvas ref={trendCanvasRef}></canvas></div></div>
                </div>
              </div>
              <div className="col-md-6">
                <div className="chart-card">
                  <div className="card-header"><h5><i className="fas fa-chart-area"></i> 班级等级分布对比</h5></div>
                  <div className="card-body"><div className="chart-container"><canvas ref={distributionCanvasRef}></canvas></div></div>
                </div>
              </div>
            </div>

            <div className="row">
              <div className="col-12">
                <div className="chart-card">
                  <div className="card-header"><h5><i className="fas fa-table"></i> 班级详细数据对比</h5></div>
                  <div className="card-body">
                    <div className="table-responsive">
                      <table className="table table-modern table-striped table-hover" id="classComparisonTable">
                        <thead>
                          <tr>
                            <th>班级</th>
                            <th>参考人数</th>
                            <th className={`sortable ${sortClassName(2)}`} onClick={() => onSort(2)}>总分 <i className={getSortIconClass(2)}></i></th>
                            <th className={`sortable ${sortClassName(3)}`} onClick={() => onSort(3)}>最高分 <i className={getSortIconClass(3)}></i></th>
                            <th className={`sortable ${sortClassName(4)}`} onClick={() => onSort(4)}>最低分 <i className={getSortIconClass(4)}></i></th>
                            {analysisData.subjects.map((subject, index) => (
                              <th key={subject.code} className={`sortable ${sortClassName(index + 5)}`} onClick={() => onSort(index + 5)}>
                                {subject.name} <i className={getSortIconClass(index + 5)}></i>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody id="classTableBody">
                          {sortedClassStatistics.map((classData, rowIndex) => (
                            <tr key={`${classData.class_name}-${rowIndex}`}>
                              <td><strong>{classData.class_name}</strong></td>
                              <td>{classData.student_count}</td>
                              <td data-value={classData.avg_total}>{Number(classData.avg_total || 0).toFixed(1)}</td>
                              <td data-value={classData.max_total}>{Number(classData.max_total || 0).toFixed(1)}</td>
                              <td data-value={classData.min_total}>{Number(classData.min_total || 0).toFixed(1)}</td>
                              {classData.subject_averages.map((subjectAvg, idx) => (
                                <td key={`${classData.class_name}-${idx}`} data-value={subjectAvg}>{Number(subjectAvg || 0).toFixed(1)}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
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
        .page-header .breadcrumb-item + .breadcrumb-item::before { color: #ffffff; }

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
        .btn-return:hover { transform: translateY(-2px); color: white; box-shadow: 0 12px 35px rgba(1, 135, 108, 0.3); }

        .analysis-info-card {
          background: linear-gradient(135deg, rgba(1,135,108,0.1) 0%, rgba(1,135,108,0.15) 100%);
          border: none;
          border-radius: 12px;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
          margin-bottom: 1.5rem;
          padding: 1rem 1.5rem;
        }
        .analysis-info-card .alert-heading { font-weight: 700; }

        .stats-card {
          background: linear-gradient(135deg, rgb(1,135,108) 0%, rgb(1,105,85) 100%);
          color: white;
          border-radius: 15px;
          padding: 20px;
          margin-bottom: 15px;
          box-shadow: 0 8px 25px rgba(1,135,108,0.2);
          transition: all 0.3s ease;
          border: none;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .stats-card:hover { transform: translateY(-5px); box-shadow: 0 12px 35px rgba(1,135,108,0.3); }
        .stats-number { font-size: 2.8rem; font-weight: bold; margin-bottom: 0.5rem; color: white; }
        .stats-label { font-size: 1rem; opacity: 0.9; font-weight: 500; color: white; }

        .chart-card {
          border: none;
          border-radius: 15px;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
          margin-bottom: 1.5rem;
          overflow: hidden;
          transition: all 0.3s ease;
          background: linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%);
        }
        .chart-card:hover { transform: translateY(-3px); box-shadow: 0 12px 35px rgba(0, 0, 0, 0.15); }
        .chart-card .card-header {
          background: linear-gradient(135deg, rgba(1,135,108,0.1) 0%, rgba(1,135,108,0.15) 100%);
          border: none;
          padding: 1rem 1.5rem;
          border-bottom: 1px solid rgba(1, 135, 108, 0.2);
        }
        .chart-card .card-header h5, .chart-card .card-header i { color: rgb(1, 135, 108); font-weight: 700; }

        .chart-container { position: relative; height: 500px; margin-bottom: 20px; padding: 5px; width: 100%; }
        .chart-container-large { position: relative; height: 600px; margin-bottom: 20px; padding: 5px; width: 100%; }
        .chart-card .card-body { padding: 0.5rem; }

        .sortable { cursor: pointer; user-select: none; position: relative; transition: background-color 0.2s ease; }
        .sort-icon {
          margin-left: 8px;
          color: #0dd338ff;
          font-size: 12px;
        }

        .table-modern thead th { background: #017b6c; color: white; font-weight: 600; white-space: nowrap; }
        .table-modern th,
        .table-modern td,
        #classComparisonTable th,
        #classComparisonTable td {
          text-align: center;
          vertical-align: middle;
        }

        .alert-modern { border: none; border-radius: 10px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1); margin-bottom: 2rem; }
        .no-data-message { text-align:center; padding:3rem; color:#6c757d; font-size:1.1rem; }
        .no-data-message i { font-size:3rem; margin-bottom:1rem; opacity:.5; }
        .loading-spinner { width: 3rem; height: 3rem; border: .3rem solid #f3f3f3; border-top: .3rem solid #007bff; border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg);} 100% { transform: rotate(360deg);} }
      `}</style>
    </>
  );
}

"use client";

import Link from "next/link";
import Chart from "@/lib/chart";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

type SubjectItem = {
  code: string;
  name: string;
  max_score: number;
};

type ClassStatistic = {
  class_name: string;
  student_count: number;
  avg_total: number;
  max_total: number;
  min_total: number;
  excellent_rate: number;
  good_rate: number;
  pass_rate: number;
  subject_averages: number[];
};

type ChartDataPayload = {
  class_names: string[];
  class_averages: number[];
  subject_names: string[];
  subject_averages: number[];
  subject_max_scores: number[];
  score_ranges: string[];
  score_distribution: number[];
  class_grade_distribution: Record<string, number[]>;
  difficulty_coefficients: number[];
  total_max_score: number;
  total_scores: number[];
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
  total_students: number;
  total_classes: number;
  grade_avg_score: number;
  excellent_rate: number;
  class_statistics: ClassStatistic[];
  subjects: SubjectItem[];
  total_max_score: number;
  chart_data: ChartDataPayload;
};

type SortState = {
  column: number;
  direction: "asc" | "desc";
};

const backendBaseUrl = typeof window !== "undefined" ? `http://${window.location.hostname}:8000` : "http://localhost:8000";

export default function ClassAnalysisGradePage() {
  return (
    <Suspense fallback={<div className="p-4">加载中...</div>}>
      <ClassAnalysisGradeContent />
    </Suspense>
  );
}

function ClassAnalysisGradeContent() {
  const { token, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const querySignature = searchParams.toString();
  const parsedQuery = useMemo(() => {
    const academicYear = searchParams.get("academic_year") || "";
    const examId = searchParams.get("exam") || "";
    const gradeLevel = searchParams.get("grade_level") || "";
    return { academicYear, examId, gradeLevel };
  }, [querySignature, searchParams]);

  const { academicYear, examId, gradeLevel } = parsedQuery;

  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasNoData, setHasNoData] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [sortState, setSortState] = useState<SortState>({ column: -1, direction: "asc" });

  const classAverageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const subjectRadarCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const gradeHistogramCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const gradePieCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const classDistributionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const difficultyCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const classAverageChartRef = useRef<Chart | null>(null);
  const subjectRadarChartRef = useRef<Chart | null>(null);
  const gradeHistogramChartRef = useRef<Chart | null>(null);
  const gradePieChartRef = useRef<Chart | null>(null);
  const classDistributionChartRef = useRef<Chart | null>(null);
  const difficultyChartRef = useRef<Chart | null>(null);

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

  const sortedClassStatistics = useMemo(() => {
    const rows = [...(analysisData?.class_statistics || [])];
    const { column, direction } = sortState;
    if (column < 2) return rows;

    rows.sort((a, b) => {
      const getValue = (row: ClassStatistic) => {
        if (column === 2) return Number(row.avg_total || 0);
        if (column === 3) return Number(row.max_total || 0);
        if (column === 4) return Number(row.min_total || 0);
        if (column === 5) return Number(row.excellent_rate || 0);
        if (column === 6) return Number(row.good_rate || 0);
        if (column === 7) return Number(row.pass_rate || 0);
        const subjectIndex = column - 8;
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
    if (!examId || !gradeLevel) {
      setErrorText("缺少必要参数：请先从成绩分析入口选择年级分析。");
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
        params.set("grade_level", gradeLevel);
        if (academicYear) params.set("academic_year", academicYear);
        params.set("class_name", "all");

        const response = await fetch(`${backendBaseUrl}/api/scores/class-analysis-grade/?${params.toString()}`, {
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
        console.error("加载年级分析失败", error);
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
    classAverageChartRef.current?.destroy();
    subjectRadarChartRef.current?.destroy();
    gradeHistogramChartRef.current?.destroy();
    gradePieChartRef.current?.destroy();
    classDistributionChartRef.current?.destroy();
    difficultyChartRef.current?.destroy();

    classAverageChartRef.current = null;
    subjectRadarChartRef.current = null;
    gradeHistogramChartRef.current = null;
    gradePieChartRef.current = null;
    classDistributionChartRef.current = null;
    difficultyChartRef.current = null;
  };

  const drawClassAverageChart = () => {
    if (!analysisData || !classAverageCanvasRef.current) return;
    const chartData = analysisData.chart_data;
    const gradientColors = [
      "rgba(1,135,108,0.8)", "rgba(59,130,246,0.8)", "rgba(245,158,11,0.8)",
      "rgba(239,68,68,0.8)", "rgba(16,185,129,0.8)", "rgba(139,92,246,0.8)",
      "rgba(236,72,153,0.8)", "rgba(34,197,94,0.8)", "rgba(249,115,22,0.8)",
    ];
    const classNames = chartData.class_names || [];
    const barColors = classNames.map((_, index) => gradientColors[index % gradientColors.length]);
    const barBorderColors = barColors.map((color) => color.replace("0.8", "1"));

    classAverageChartRef.current = new Chart(classAverageCanvasRef.current, {
      type: "bar",
      data: {
        labels: classNames,
        datasets: [
          {
            label: "班级平均分",
            data: chartData.class_averages || [],
            backgroundColor: barColors,
            borderColor: barBorderColors,
            borderWidth: 2,
            borderRadius: 6,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => `平均分: ${Number(context.parsed.y).toFixed(1)}分`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            max: Math.max(analysisData.total_max_score || 0, 1),
            grid: { color: "rgba(0,0,0,0.1)" },
            ticks: { color: "#6c757d", font: { size: 12 } },
          },
          x: {
            grid: { display: false },
            ticks: { color: "#6c757d", font: { size: 14 } },
          },
        },
      },
    });
  };

  const drawSubjectRadarChart = () => {
    if (!analysisData || !subjectRadarCanvasRef.current) return;
    const chartData = analysisData.chart_data;
    const primaryColor = "rgb(1,135,108)";
    const primaryColorAlpha = "rgba(1,135,108,0.8)";
    const fallbackMax = analysisData.selected_grade.startsWith("初") ? 120 : 150;

    const subjectScores = chartData.subject_averages || [];
    const subjectMaxScores = chartData.subject_max_scores || [];

    const normalizedData =
      subjectMaxScores.length > 0 && subjectMaxScores.length === subjectScores.length
        ? subjectScores.map((score, index) => {
            const maxScoreForSubject = Number(subjectMaxScores[index] || 0);
            return maxScoreForSubject > 0 ? Number(score || 0) / maxScoreForSubject : 0;
          })
        : subjectScores.map((score) => Number(score || 0) / fallbackMax);

    subjectRadarChartRef.current = new Chart(subjectRadarCanvasRef.current, {
      type: "radar",
      data: {
        labels: chartData.subject_names || [],
        datasets: [
          {
            label: "年级标准化平均分",
            data: normalizedData,
            backgroundColor: primaryColorAlpha,
            borderColor: primaryColor,
            borderWidth: 3,
            pointBackgroundColor: primaryColor,
            pointBorderColor: "#fff",
            pointBorderWidth: 2,
            pointRadius: 6,
            pointHoverBackgroundColor: "#fff",
            pointHoverBorderColor: primaryColor,
            pointHoverRadius: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            beginAtZero: true,
            max: 1,
            ticks: {
              color: "#6c757d",
              font: { size: 12 },
              stepSize: 0.2,
              callback: (value) => `${(Number(value) * 100).toFixed(0)}%`,
            },
            grid: { color: "rgba(0,0,0,0.1)" },
            angleLines: { color: "rgba(0,0,0,0.1)" },
            pointLabels: { color: "#495057", font: { size: 16, weight: 500 } },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => {
                const index = context.dataIndex;
                const rawScore = Number(subjectScores[index] || 0).toFixed(1);
                const maxScoreForSubject = subjectMaxScores[index];
                const maxText = maxScoreForSubject ? `/${maxScoreForSubject}` : "";
                const percentage = (Number(context.parsed.r) * 100).toFixed(1);
                return `实际分数: ${rawScore}${maxText}分 | 标准化分数: ${percentage}%`;
              },
            },
          },
        },
      },
    });
  };

  const drawGradeHistogramChart = () => {
    if (!analysisData || !gradeHistogramCanvasRef.current) return;
    const chartData = analysisData.chart_data;
    const totalScores = chartData.total_scores || [];
    if (totalScores.length === 0) return;

    const primaryColor = "rgb(1,135,108)";
    const primaryColorAlpha = "rgba(1,135,108,0.8)";

    const minScore = Math.min(...totalScores);
    const maxScore = Math.max(...totalScores);
    const scoreRange = Math.max(maxScore - minScore, 1);

    let binCount = Math.min(12, Math.max(6, Math.ceil(Math.sqrt(totalScores.length))));
    if (scoreRange < binCount) {
      binCount = Math.max(3, Math.ceil(scoreRange));
    }
    const binWidth = Math.max(Math.ceil(scoreRange / binCount), 1);

    const bins: string[] = [];
    const binCounts: number[] = [];

    for (let index = 0; index < binCount; index += 1) {
      const binStart = minScore + index * binWidth;
      const binEnd = index === binCount - 1 ? maxScore : binStart + binWidth - 1;
      bins.push(`${Math.floor(binStart)}-${Math.floor(binEnd)}`);

      const count = totalScores.filter((score) => {
        if (index === binCount - 1) return score >= binStart && score <= binEnd;
        return score >= binStart && score < binStart + binWidth;
      }).length;
      binCounts.push(count);
    }

    gradeHistogramChartRef.current = new Chart(gradeHistogramCanvasRef.current, {
      type: "bar",
      data: {
        labels: bins,
        datasets: [
          {
            label: "学生人数",
            data: binCounts,
            backgroundColor: primaryColorAlpha,
            borderColor: primaryColor,
            borderWidth: 2,
            borderRadius: 6,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (context) => `分数区间: ${context[0].label}分`,
              label: (context) => {
                const percentage = ((Number(context.parsed.y) / totalScores.length) * 100).toFixed(1);
                return `学生人数: ${context.parsed.y}人 (${percentage}%)`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: "#6c757d", font: { size: 14 }, maxRotation: 45 },
          },
          y: {
            beginAtZero: true,
            title: { display: true, text: "学生人数", color: "#6c757d", font: { size: 14, weight: 500 } },
            grid: { color: "rgba(0,0,0,0.1)" },
            ticks: {
              color: "#6c757d",
              font: { size: 14 },
              callback: (value) => (Number.isInteger(Number(value)) ? `${value}` : ""),
            },
          },
        },
      },
    });
  };

  const drawGradePieChart = () => {
    if (!analysisData || !gradePieCanvasRef.current) return;
    const chartData = analysisData.chart_data;

    const pieLabels = chartData.score_ranges || [];
    const pieData = chartData.score_distribution || [];
    if (!pieLabels.length || !pieData.length) return;

    const gradeColors = ["#10B981", "#3B82F6", "#F59E0B", "#EF4444", "#6B7280"];

    gradePieChartRef.current = new Chart(gradePieCanvasRef.current, {
      type: "doughnut",
      data: {
        labels: pieLabels,
        datasets: [
          {
            data: pieData,
            backgroundColor: gradeColors,
            borderColor: "#fff",
            borderWidth: 3,
            hoverBorderWidth: 5,
            hoverOffset: 10,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { padding: 20, usePointStyle: true, font: { size: 14, weight: 500 } },
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const total = context.dataset.data.reduce((sum, value) => Number(sum) + Number(value), 0);
                const percentage = total > 0 ? ((Number(context.parsed) / total) * 100).toFixed(1) : "0.0";
                return `${context.label}: ${context.parsed}人 (${percentage}%)`;
              },
            },
          },
        },
        cutout: "60%",
      },
    });
  };

  const drawClassDistributionChart = () => {
    if (!analysisData || !classDistributionCanvasRef.current) return;
    const chartData = analysisData.chart_data;
    const classNames = chartData.class_names || [];
    if (classNames.length === 0) return;

    const gradeLabels = ["不及格(<60%)", "及格(60%-70%)", "良好(70%-85%)", "优秀(85%-95%)", "特优(95%+)"];
    const stackedBarColors = [
      "rgba(107,114,128,0.8)",
      "rgba(239,68,68,0.8)",
      "rgba(245,158,11,0.8)",
      "rgba(59,130,246,0.8)",
      "rgba(16,185,129,0.8)",
    ];

    classDistributionChartRef.current = new Chart(classDistributionCanvasRef.current, {
      type: "bar",
      data: {
        labels: classNames,
        datasets: gradeLabels.map((label, index) => ({
          label,
          data: classNames.map((className) => Number(chartData.class_grade_distribution?.[className]?.[index] || 0)),
          backgroundColor: stackedBarColors[index],
          borderColor: stackedBarColors[index].replace("0.8", "1"),
          borderWidth: 1,
          borderRadius: 4,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: { color: "#6c757d", font: { size: 14 } },
          },
          y: {
            stacked: true,
            beginAtZero: true,
            title: { display: true, text: "学生人数", color: "#6c757d", font: { size: 14, weight: 500 } },
            grid: { color: "rgba(0,0,0,0.1)" },
            ticks: {
              color: "#6c757d",
              font: { size: 14 },
              callback: (value) => (Number.isInteger(Number(value)) ? `${value}` : ""),
            },
          },
        },
        plugins: {
          legend: {
            position: "top",
            reverse: true,
            labels: { padding: 15, usePointStyle: true, font: { size: 12 } },
          },
          tooltip: {
            callbacks: {
              label: (context) => `${context.dataset.label}: ${context.parsed.y}人`,
            },
          },
        },
      },
    });
  };

  const drawDifficultyChart = () => {
    if (!analysisData || !difficultyCanvasRef.current) return;
    const chartData = analysisData.chart_data;
    const primaryColor = "rgb(1,135,108)";
    const primaryColorAlpha = "rgba(1,135,108,0.8)";
    const difficultyValues = (chartData.difficulty_coefficients || []).map((value) => Number(value)).filter((value) => Number.isFinite(value));

    let yAxisMin = 0;
    let yAxisMax = 1;
    if (difficultyValues.length > 0) {
      const observedMin = Math.min(...difficultyValues);
      const observedMax = Math.max(...difficultyValues);
      const observedRange = Math.max(observedMax - observedMin, 0.05);
      const padding = observedRange * 0.2;

      yAxisMin = Math.max(0, Number((observedMin - padding).toFixed(2)));
      yAxisMax = Math.min(1, Number((observedMax + padding).toFixed(2)));

      if (yAxisMax - yAxisMin < 0.1) {
        const center = (yAxisMax + yAxisMin) / 2;
        yAxisMin = Math.max(0, Number((center - 0.05).toFixed(2)));
        yAxisMax = Math.min(1, Number((center + 0.05).toFixed(2)));
      }
    }

    difficultyChartRef.current = new Chart(difficultyCanvasRef.current, {
      type: "line",
      data: {
        labels: chartData.subject_names || [],
        datasets: [
          {
            label: "难度系数",
            data: chartData.difficulty_coefficients || [],
            backgroundColor: primaryColorAlpha,
            borderColor: primaryColor,
            borderWidth: 3,
            pointBackgroundColor: primaryColor,
            pointBorderColor: "#fff",
            pointBorderWidth: 2,
            pointRadius: 6,
            pointHoverBackgroundColor: "#fff",
            pointHoverBorderColor: primaryColor,
            pointHoverRadius: 8,
            tension: 0.3,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => `难度系数: ${Number(context.parsed.y).toFixed(3)}`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: false,
            min: yAxisMin,
            max: yAxisMax,
            grid: { color: "rgba(0,0,0,0.1)" },
            ticks: {
              color: "#6c757d",
              font: { size: 14 },
              callback: (value) => Number(value).toFixed(2),
            },
          },
          x: {
            grid: { display: false },
            ticks: { color: "#6c757d", font: { size: 14 } },
          },
        },
      },
    });
  };

  useEffect(() => {
    if (!analysisData) return;
    destroyCharts();
    drawClassAverageChart();
    drawSubjectRadarChart();
    drawGradeHistogramChart();
    drawGradePieChart();
    drawClassDistributionChart();
    drawDifficultyChart();
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
                <h1><i className="fas fa-graduation-cap me-3"></i>年级成绩分析</h1>
                <nav aria-label="breadcrumb">
                  <ol className="breadcrumb">
                    <li className="breadcrumb-item"><Link href="/analysis/class-grade">成绩分析</Link></li>
                    <li className="breadcrumb-item active" aria-current="page">年级分析</li>
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
              </div>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="text-center py-5">
            <div className="loading-spinner mx-auto mb-3"></div>
            <h5>正在加载年级分析数据...</h5>
            <p className="text-muted">请稍候，正在生成年级分析图表</p>
          </div>
        )}

        {!isLoading && hasNoData && (
          <div className="no-data-message">
            <i className="fas fa-chart-line"></i>
            <p>{errorText || "暂无年级分析数据，请检查筛选条件。"}</p>
            <Link href="/analysis/class-grade" className="btn btn-primary"><i className="fas fa-arrow-left me-2"></i>返回分析入口</Link>
          </div>
        )}

        {!isLoading && !hasNoData && analysisData && (
          <>
            <div className="row mb-4">
              <div className="col-md-3"><div className="stats-card text-center"><div className="stats-number">{analysisData.total_students}</div><div className="stats-label">总参考学生数</div></div></div>
              <div className="col-md-3"><div className="stats-card text-center"><div className="stats-number">{analysisData.total_classes}</div><div className="stats-label">参考班级数</div></div></div>
              <div className="col-md-3"><div className="stats-card text-center"><div className="stats-number">{Number(analysisData.grade_avg_score || 0).toFixed(1)}</div><div className="stats-label">年级平均总分</div></div></div>
              <div className="col-md-3"><div className="stats-card text-center"><div className="stats-number">{Number(analysisData.total_max_score || 0).toFixed(0)}</div><div className="stats-label">本场考试满分</div></div></div>
            </div>

            <div className="row">
              <div className="col-md-6">
                <div className="chart-card">
                  <div className="card-header"><h5><i className="fas fa-chart-bar"></i> 各班级平均分对比</h5></div>
                  <div className="card-body"><div className="chart-container"><canvas ref={classAverageCanvasRef}></canvas></div></div>
                </div>
              </div>
              <div className="col-md-6">
                <div className="chart-card">
                  <div className="card-header"><h5><i className="fas fa-chart-line"></i> 各科目年级平均分标准化雷达图</h5></div>
                  <div className="card-body"><div className="chart-container"><canvas ref={subjectRadarCanvasRef}></canvas></div></div>
                </div>
              </div>
            </div>

            <div className="row">
              <div className="col-md-6">
                <div className="chart-card">
                  <div className="card-header"><h5><i className="fas fa-chart-area"></i> 年级总分分布直方图</h5></div>
                  <div className="card-body"><div className="chart-container-large"><canvas ref={gradeHistogramCanvasRef}></canvas></div></div>
                </div>
              </div>
              <div className="col-md-6">
                <div className="chart-card">
                  <div className="card-header"><h5><i className="fas fa-chart-pie"></i> 年级整体各等级分布饼图</h5></div>
                  <div className="card-body"><div className="chart-container-large"><canvas ref={gradePieCanvasRef}></canvas></div></div>
                </div>
              </div>
            </div>

            <div className="row">
              <div className="col-md-6">
                <div className="chart-card">
                  <div className="card-header"><h5><i className="fas fa-chart-bar"></i> 各班级等级分布</h5></div>
                  <div className="card-body"><div className="chart-container"><canvas ref={classDistributionCanvasRef}></canvas></div></div>
                </div>
              </div>
              <div className="col-md-6">
                <div className="chart-card">
                  <div className="card-header"><h5><i className="fas fa-chart-line"></i> 各科目难度系数</h5></div>
                  <div className="card-body"><div className="chart-container"><canvas ref={difficultyCanvasRef}></canvas></div></div>
                </div>
              </div>
            </div>

            <div className="row">
              <div className="col-12">
                <div className="chart-card">
                  <div className="card-header"><h5><i className="fas fa-table"></i> 年级详细数据统计</h5></div>
                  <div className="card-body">
                    <div className="table-responsive">
                      <table className="table table-modern table-striped table-hover" id="gradeComparisonTable">
                        <thead>
                          <tr>
                            <th>班级</th>
                            <th>人数</th>
                            <th className={`sortable ${sortClassName(2)}`} onClick={() => onSort(2)}>平均分 <i className={getSortIconClass(2)}></i></th>
                            <th className={`sortable ${sortClassName(3)}`} onClick={() => onSort(3)}>最高分 <i className={getSortIconClass(3)}></i></th>
                            <th className={`sortable ${sortClassName(4)}`} onClick={() => onSort(4)}>最低分 <i className={getSortIconClass(4)}></i></th>
                            <th className={`sortable ${sortClassName(5)}`} onClick={() => onSort(5)}>优秀率 <i className={getSortIconClass(5)}></i></th>
                            <th className={`sortable ${sortClassName(6)}`} onClick={() => onSort(6)}>良好率 <i className={getSortIconClass(6)}></i></th>
                            <th className={`sortable ${sortClassName(7)}`} onClick={() => onSort(7)}>及格率 <i className={getSortIconClass(7)}></i></th>
                            {analysisData.subjects.map((subject, index) => (
                              <th key={subject.code} className={`sortable ${sortClassName(index + 8)}`} onClick={() => onSort(index + 8)}>
                                {subject.name} <i className={getSortIconClass(index + 8)}></i>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody id="gradeTableBody">
                          {sortedClassStatistics.map((classData, rowIndex) => (
                            <tr key={`${classData.class_name}-${rowIndex}`}>
                              <td><strong>{classData.class_name}</strong></td>
                              <td>{classData.student_count}</td>
                              <td data-value={classData.avg_total}>{Number(classData.avg_total || 0).toFixed(1)}</td>
                              <td data-value={classData.max_total}>{Number(classData.max_total || 0).toFixed(1)}</td>
                              <td data-value={classData.min_total}>{Number(classData.min_total || 0).toFixed(1)}</td>
                              <td data-value={classData.excellent_rate}>{Number(classData.excellent_rate || 0).toFixed(1)}%</td>
                              <td data-value={classData.good_rate}>{Number(classData.good_rate || 0).toFixed(1)}%</td>
                              <td data-value={classData.pass_rate}>{Number(classData.pass_rate || 0).toFixed(1)}%</td>
                              {classData.subject_averages.map((subjectAvg, index) => (
                                <td key={`${classData.class_name}-${index}`} data-value={subjectAvg}>{Number(subjectAvg || 0).toFixed(1)}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-2 px-3 pb-0 mb-0">
                      <small className="text-muted">
                        <strong>注：</strong>
                        <p>优秀率=(特优人数+优秀人数)/总人数；良好率=(特优人数+优秀人数+良好人数)/总人数；及格率=(特优人数+优秀人数+良好人数+及格人数)/总人数</p>
                      </small>
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

        .chart-container { position: relative; height: 360px; margin-bottom: 10px; padding: 10px; width: 100%; }
        .chart-container-large { position: relative; height: 460px; margin-bottom: 10px; padding: 10px; width: 100%; }
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
        #gradeComparisonTable th,
        #gradeComparisonTable td {
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

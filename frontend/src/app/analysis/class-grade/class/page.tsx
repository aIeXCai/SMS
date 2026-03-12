"use client";

import Link from "next/link";
import Chart from "chart.js/auto";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

type SubjectStat = {
  code: string;
  name: string;
  avg_score: number;
  actual_max_score: number;
  actual_min_score: number;
  count: number;
  exam_max_score: number;
};

type StudentRanking = {
  student_id: number;
  student_name: string;
  total_score: number;
  subject_count: number;
  rank: number;
  grade_rank: number | null;
};

type ChartDataPayload = {
  subject_avg_scores?: {
    labels: string[];
    data: number[];
  };
  subject_max_scores?: number[];
  score_distribution?: Record<string, Record<string, number>>;
  grade_distribution?: Record<string, number>;
  total_max_score?: number;
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
  target_class: {
    id: number;
    grade_level: string;
    class_name: string;
  };
  total_students: number;
  class_avg_total: number;
  class_max_total: number;
  class_min_total: number;
  subject_stats: SubjectStat[];
  student_rankings: StudentRanking[];
  chart_data: ChartDataPayload;
};

const backendBaseUrl = typeof window !== "undefined" ? `http://${window.location.hostname}:8000` : "http://localhost:8000";

export default function ClassAnalysisSinglePage() {
  return (
    <Suspense fallback={<div className="p-4">加载中...</div>}>
      <ClassAnalysisSingleContent />
    </Suspense>
  );
}

function ClassAnalysisSingleContent() {
  const { token, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const querySignature = searchParams.toString();

  const parsedQuery = useMemo(() => {
    const academicYear = searchParams.get("academic_year") || "";
    const examId = searchParams.get("exam") || "";
    const gradeLevel = searchParams.get("grade_level") || "";
    const selectedClasses = searchParams.getAll("selected_classes");
    const className = searchParams.get("class_name") || "";
    return {
      academicYear,
      examId,
      gradeLevel,
      selectedClasses,
      className,
    };
  }, [querySignature, searchParams]);

  const { academicYear, examId, gradeLevel, selectedClasses, className } = parsedQuery;

  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasNoData, setHasNoData] = useState(false);
  const [errorText, setErrorText] = useState("");

  const radarCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const comparisonCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pieCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const distributionCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const radarChartRef = useRef<Chart | null>(null);
  const comparisonChartRef = useRef<Chart | null>(null);
  const pieChartRef = useRef<Chart | null>(null);
  const distributionChartRef = useRef<Chart | null>(null);
  const hasRegisteredDataLabelsRef = useRef(false);

  const effectiveToken = useMemo(() => {
    if (token) return token;
    if (typeof window !== "undefined") return localStorage.getItem("accessToken");
    return null;
  }, [token]);

  const authHeader = useMemo(() => {
    if (!effectiveToken) return undefined;
    return { Authorization: `Bearer ${effectiveToken}` };
  }, [effectiveToken]);

  const comparisonMaxScore = useMemo(() => {
    const maxExamScore = Math.max(
      ...((analysisData?.subject_stats || []).map((item) => Number(item.exam_max_score) || 0)),
      0
    );
    if (maxExamScore <= 0) return 150;
    return Math.ceil(maxExamScore / 10) * 10;
  }, [analysisData]);

  useEffect(() => {
    if (!hasRegisteredDataLabelsRef.current) {
      Chart.register(ChartDataLabels);
      hasRegisteredDataLabelsRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!loading && !effectiveToken) router.push("/login");
  }, [loading, effectiveToken, router]);

  useEffect(() => {
    if (!effectiveToken) return;
    if (!examId || (!className && selectedClasses.length === 0)) {
      setErrorText("缺少必要参数：请先从成绩分析入口选择考试和单个班级。");
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

        const response = await fetch(`${backendBaseUrl}/api/scores/class-analysis-single/?${params.toString()}`, {
          headers: { ...authHeader },
        });

        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.success || !result?.data) {
          throw new Error(result?.error || `HTTP ${response.status}`);
        }

        const data: AnalysisData = result.data;
        if (!data.subject_stats?.length && !data.student_rankings?.length) {
          setHasNoData(true);
          setAnalysisData(null);
          return;
        }

        setAnalysisData(data);
      } catch (error) {
        console.error("加载单班级分析失败", error);
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
    radarChartRef.current?.destroy();
    comparisonChartRef.current?.destroy();
    pieChartRef.current?.destroy();
    distributionChartRef.current?.destroy();
    radarChartRef.current = null;
    comparisonChartRef.current = null;
    pieChartRef.current = null;
    distributionChartRef.current = null;
  };

  const drawRadarChart = () => {
    if (!analysisData || !radarCanvasRef.current) return;
    const subjectLabels = analysisData.subject_stats.map((item) => item.name);
    const subjectScores = analysisData.subject_stats.map((item) => item.avg_score);
    const subjectMaxScores = analysisData.subject_stats.map((item) => item.exam_max_score || comparisonMaxScore);

    if (!subjectLabels.length) return;

    const normalizedData = subjectScores.map((score, index) => {
      const maxScoreForSubject = subjectMaxScores[index] || comparisonMaxScore;
      return maxScoreForSubject > 0 ? score / maxScoreForSubject : 0;
    });

    radarChartRef.current = new Chart(radarCanvasRef.current, {
      type: "radar",
      data: {
        labels: subjectLabels,
        datasets: [
          {
            label: "标准化平均分",
            data: normalizedData,
            backgroundColor: "rgba(1, 135, 108, 0.2)",
            borderColor: "rgb(1,135,108)",
            borderWidth: 3,
            pointBackgroundColor: "rgb(1,135,108)",
            pointBorderColor: "#fff",
            pointBorderWidth: 2,
            pointRadius: 6,
            pointHoverBackgroundColor: "#fff",
            pointHoverBorderColor: "rgb(1,135,108)",
            pointHoverRadius: 8,
            tension: 0.2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 2000,
          easing: "easeInOutQuart",
        },
        scales: {
          r: {
            beginAtZero: true,
            max: 1,
            ticks: {
              stepSize: 0.2,
              color: "#6c757d",
              font: { size: 15 },
              callback: (value: string | number) => `${(Number(value) * 100).toFixed(0)}%`,
            },
            grid: { color: "rgba(0,0,0,0.1)" },
            angleLines: { color: "rgba(0,0,0,0.1)" },
            pointLabels: {
              color: "#495057",
              font: { size: 15, weight: 500 },
            },
          },
        },
        plugins: {
          legend: { display: false },
          datalabels: { display: false },
          tooltip: {
            backgroundColor: "rgba(0,0,0,0.8)",
            titleColor: "#fff",
            bodyColor: "#fff",
            borderColor: "rgb(1,135,108)",
            borderWidth: 1,
            cornerRadius: 8,
            displayColors: false,
            callbacks: {
              label: (context) => {
                const index = context.dataIndex;
                const originalScore = subjectScores[index] || 0;
                const maxScoreForSubject = subjectMaxScores[index] || 0;
                const percentage = ((context.parsed.r || 0) * 100).toFixed(1);
                const maxScoreText = maxScoreForSubject > 0 ? `/${maxScoreForSubject}` : "";
                return [`实际分数: ${originalScore.toFixed(1)}${maxScoreText}分`, `标准化分数: ${percentage}%`];
              },
            },
          },
        },
      },
    });
  };

  const drawDistributionChart = () => {
    if (!analysisData || !distributionCanvasRef.current) return;

    const subjectCodes = analysisData.subject_stats.map((item) => item.code);
    const subjectLabels = analysisData.subject_stats.map((item) => item.name);
    const distributionBySubject = analysisData.chart_data?.score_distribution || {};

    const gradeRangesOrder = ["特优(95%+)", "优秀(85%-95%)", "良好(70%-85%)", "及格(60%-70%)", "不及格(<60%)"];
    const gradeRangesStack = ["不及格(<60%)", "及格(60%-70%)", "良好(70%-85%)", "优秀(85%-95%)", "特优(95%+)"];

    const distributionColors = [
      { bg: "rgba(107, 114, 128, 0.8)", border: "#6B7280" },
      { bg: "rgba(239, 68, 68, 0.8)", border: "#EF4444" },
      { bg: "rgba(245, 158, 11, 0.8)", border: "#F59E0B" },
      { bg: "rgba(59, 130, 246, 0.8)", border: "#3B82F6" },
      { bg: "rgba(16, 185, 129, 0.8)", border: "#10B981" },
    ];

    const datasets = gradeRangesStack.map((range, index) => ({
      label: range,
      data: subjectCodes.map((code) => distributionBySubject?.[code]?.[range] || 0),
      backgroundColor: distributionColors[index].bg,
      borderColor: distributionColors[index].border,
      borderWidth: 2,
      borderSkipped: false as const,
    }));

    distributionChartRef.current = new Chart(distributionCanvasRef.current, {
      type: "bar",
      data: {
        labels: subjectLabels,
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 2000, easing: "easeInOutQuart" },
        interaction: { mode: "index", intersect: false },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: { color: "#6c757d", font: { size: 15, weight: 500 } },
          },
          y: {
            stacked: true,
            beginAtZero: true,
            grid: { color: "rgba(0,0,0,0.1)" },
            ticks: {
              color: "#6c757d",
              font: { size: 15 },
              stepSize: 1,
              callback: (value: string | number) => (Number.isInteger(Number(value)) ? `${value}` : ""),
            },
          },
        },
        plugins: {
          legend: {
            position: "top",
            labels: {
              padding: 15,
              usePointStyle: true,
              font: { size: 12, weight: 500 },
              sort: (a, b) => gradeRangesOrder.indexOf(a.text) - gradeRangesOrder.indexOf(b.text),
            },
          },
          datalabels: { display: false },
          tooltip: {
            backgroundColor: "rgba(0,0,0,0.8)",
            titleColor: "#fff",
            bodyColor: "#fff",
            borderColor: "rgb(1,135,108)",
            borderWidth: 1,
            cornerRadius: 8,
            mode: "index",
            intersect: false,
            callbacks: {
              title: (context) => `${context[0]?.label || ""} - 成绩分布`,
              label: (context) => `${context.dataset.label}: ${context.parsed.y}人`,
              footer: (tooltipItems) => {
                const total = tooltipItems.reduce((sum, item) => sum + Number(item.parsed.y || 0), 0);
                return `总计: ${total}人`;
              },
            },
          },
        },
      },
    });
  };

  const drawPieChart = () => {
    if (!analysisData || !pieCanvasRef.current) return;

    const order = ["特优(95%+)", "优秀(85%-95%)", "良好(70%-85%)", "及格(60%-70%)", "不及格(<60%)"];
    const gradeDistribution = analysisData.chart_data?.grade_distribution || {};
    const pieLabels = order.filter((label) => label in gradeDistribution);
    const pieData = pieLabels.map((label) => Number(gradeDistribution[label] || 0));

    const gradeColors: Record<string, string> = {
      "不及格(<60%)": "#6B7280",
      "及格(60%-70%)": "#EF4444",
      "良好(70%-85%)": "#F59E0B",
      "优秀(85%-95%)": "#3B82F6",
      "特优(95%+)": "#10B981",
    };

    pieChartRef.current = new Chart(pieCanvasRef.current, {
      type: "doughnut",
      data: {
        labels: pieLabels,
        datasets: [
          {
            data: pieData,
            backgroundColor: pieLabels.map((label) => gradeColors[label] || "#6c757d"),
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
        animation: { animateRotate: true, duration: 2000, easing: "easeInOutQuart" },
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              padding: 20,
              usePointStyle: true,
              font: { size: 15, weight: 500 },
            },
          },
          datalabels: { display: false },
          tooltip: {
            backgroundColor: "rgba(0,0,0,0.8)",
            titleColor: "#fff",
            bodyColor: "#fff",
            borderColor: "rgb(1,135,108)",
            borderWidth: 1,
            cornerRadius: 8,
            callbacks: {
              label: (context) => {
                const total = context.dataset.data.reduce((sum, value) => sum + Number(value), 0);
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

  const drawComparisonChart = () => {
    if (!analysisData || !comparisonCanvasRef.current) return;

    const labels = analysisData.subject_stats.map((item) => item.name);
    const values = analysisData.subject_stats.map((item) => Number(item.avg_score || 0));

    comparisonChartRef.current = new Chart(comparisonCanvasRef.current, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "平均分",
            data: values,
            backgroundColor: "rgba(1, 135, 108, 0.8)",
            borderColor: "rgb(1,135,108)",
            borderWidth: 2,
            borderRadius: 8,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 2000, easing: "easeInOutQuart" },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: "#6c757d", font: { size: 15, weight: 500 } },
          },
          y: {
            beginAtZero: true,
            max: comparisonMaxScore,
            grid: { color: "rgba(0,0,0,0.1)" },
            ticks: {
              color: "#6c757d",
              font: { size: 18 },
              stepSize: 20,
            },
          },
        },
        plugins: {
          legend: { display: false },
          datalabels: {
            display: true,
            color: "#ffffff",
            font: { size: 13, weight: 700 },
            anchor: "center",
            align: "center",
            formatter: (value: number | string) => Number(value || 0).toFixed(1),
          },
          tooltip: {
            backgroundColor: "rgba(0,0,0,0.8)",
            titleColor: "#fff",
            bodyColor: "#fff",
            borderColor: "rgb(0, 0, 0)",
            borderWidth: 1,
            cornerRadius: 8,
            displayColors: false,
            callbacks: {
              label: (context) => `平均分: ${Number(context.parsed.y).toFixed(1)}分`,
            },
          },
        },
      },
    });
  };

  useEffect(() => {
    if (!analysisData) return;
    destroyCharts();
    drawRadarChart();
    drawComparisonChart();
    drawPieChart();
    drawDistributionChart();
  }, [analysisData]);

  useEffect(() => {
    return () => destroyCharts();
  }, []);

  if (loading) return <div className="p-4">加载中...</div>;

  return (
    <>
      <div className="container-fluid fade-in">
        <div className="page-header">
          <div className="container-fluid">
            <div className="row align-items-center">
              <div className="col">
                <h1><i className="fas fa-chart-line me-3"></i>班级成绩分析</h1>
                <nav aria-label="breadcrumb">
                  <ol className="breadcrumb">
                    <li className="breadcrumb-item"><Link href="/analysis/class-grade">成绩分析</Link></li>
                    <li className="breadcrumb-item active" aria-current="page">班级分析</li>
                  </ol>
                </nav>
              </div>
              <div className="col-auto">
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
                  <strong>年级：</strong>{analysisData.selected_grade} |
                  <strong>班级：</strong>{analysisData.target_class.grade_level}{analysisData.target_class.class_name}
                </p>
              </div>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="text-center py-5">
            <div className="loading-spinner mx-auto mb-3"></div>
            <h5>正在加载班级分析数据...</h5>
            <p className="text-muted">请稍候，正在生成单班级详细分析报告</p>
          </div>
        )}

        {!isLoading && hasNoData && (
          <div className="no-data-message">
            <i className="fas fa-chart-line"></i>
            <p>{errorText || "暂无单班级分析数据，请检查筛选条件。"}</p>
            <Link href="/analysis/class-grade" className="btn btn-primary"><i className="fas fa-arrow-left me-2"></i>返回分析入口</Link>
          </div>
        )}

        {!isLoading && !hasNoData && analysisData && (
          <>
            <div className="row mb-4">
              <div className="col-md-3"><div className="stats-card text-center"><div className="stats-number">{analysisData.total_students}</div><div className="stats-label">参考学生数</div></div></div>
              <div className="col-md-3"><div className="stats-card text-center"><div className="stats-number">{analysisData.class_avg_total}</div><div className="stats-label">班级平均总分</div></div></div>
              <div className="col-md-3"><div className="stats-card text-center"><div className="stats-number">{analysisData.class_max_total}</div><div className="stats-label">最高分</div></div></div>
              <div className="col-md-3"><div className="stats-card text-center"><div className="stats-number">{analysisData.class_min_total}</div><div className="stats-label">最低分</div></div></div>
            </div>

            <div className="row">
              <div className="col-md-4">
                <div className="chart-card mb-2"><div className="card-header"><h5><i className="fas fa-chart-line"></i> 各科目平均分标准化雷达图</h5></div><div className="card-body"><div className="chart-container" style={{ height: 350 }}><canvas ref={radarCanvasRef}></canvas></div></div></div>
                <div className="chart-card mb-2"><div className="card-header"><h5><i className="fas fa-chart-area"></i> 科目平均分对比图</h5></div><div className="card-body"><div className="chart-container" style={{ height: 350 }}><canvas ref={comparisonCanvasRef}></canvas></div></div></div>
                <div className="chart-card mb-2"><div className="card-header"><h5><i className="fas fa-chart-pie"></i> 总分等级分布饼图</h5></div><div className="card-body"><div className="chart-container" style={{ height: 350 }}><canvas ref={pieCanvasRef}></canvas></div></div></div>
                <div className="chart-card mb-2"><div className="card-header"><h5><i className="fas fa-chart-bar"></i> 各科目等级分布柱状图</h5></div><div className="card-body"><div className="chart-container" style={{ height: 350 }}><canvas ref={distributionCanvasRef}></canvas></div></div></div>
              </div>

              <div className="col-md-4">
                <div className="chart-card" style={{ height: "fit-content" }}>
                  <div className="card-header"><h5><i className="fas fa-chart-line"></i> 各科目统计</h5></div>
                  <div className="card-body">
                    {analysisData.subject_stats.map((stats) => (
                      <div key={stats.code} className="subject-card">
                        <div className="card-body">
                          <h6 className="card-title">{stats.name}</h6>
                          <div className="row">
                            <div className="col-6"><small className="text-muted">平均分</small><br /><strong>{stats.avg_score}</strong></div>
                            <div className="col-6"><small className="text-muted">最高分</small><br /><strong>{stats.actual_max_score}</strong></div>
                            <div className="col-6"><small className="text-muted">最低分</small><br /><strong>{stats.actual_min_score}</strong></div>
                            <div className="col-6"><small className="text-muted">参考人数</small><br /><strong>{stats.count}</strong></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="col-md-4">
                <div className="chart-card">
                  <div className="card-header"><h5><i className="fas fa-trophy"></i> 学生总分排名</h5></div>
                  <div className="card-body">
                    <div className="ranking-table">
                      <table className="table table-modern">
                        <thead>
                          <tr><th>排名</th><th>姓名</th><th>总分</th><th>年级排名</th></tr>
                        </thead>
                        <tbody>
                          {analysisData.student_rankings.map((student) => (
                            <tr key={student.student_id}>
                              <td>
                                {student.rank === 1 ? <span className="badge ranking-badge ranking-first">{student.rank}</span> : student.rank === 2 ? <span className="badge ranking-badge ranking-second">{student.rank}</span> : student.rank === 3 ? <span className="badge ranking-badge ranking-third">{student.rank}</span> : student.rank}
                              </td>
                              <td>{student.student_name}</td>
                              <td><strong>{student.total_score}</strong></td>
                              <td>{student.grade_rank ? student.grade_rank : <span className="text-muted">-</span>}</td>
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
        .alert-modern { border: none; border-radius: 10px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1); margin-bottom: 2rem; }

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
        .chart-card .card-body { padding: 1rem; }
        .chart-card .card-header {
          background: linear-gradient(135deg, rgba(1,135,108,0.1) 0%, rgba(1,135,108,0.15) 100%);
          border: none;
          padding: 1rem 1.5rem;
          border-bottom: 1px solid rgba(1, 135, 108, 0.2);
        }
        .chart-card .card-header h5,
        .chart-card .card-header i { color: rgb(1, 135, 108); font-weight: 700; }

        .chart-container { position: relative; height: 340px; margin-bottom: 5px; padding: 10px; }

        .subject-card {
          border: none;
          border-radius: 10px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
          border-left: 4px solid rgb(1, 135, 108);
          transition: all 0.3s ease;
          margin-bottom: 15px;
        }
        .subject-card:hover { transform: translateX(5px); box-shadow: 0 8px 18px rgba(0,0,0,0.12); }
        .subject-card .card-title { font-size: 1.2rem; font-weight: 600; color: black; margin-bottom: 1rem; }
        .subject-card .card-body .row { margin-bottom: 0; }

        .ranking-table { border-radius: 10px; max-height: 1350px; overflow-y: auto; }
        .ranking-table::-webkit-scrollbar { width: 6px; }
        .ranking-table::-webkit-scrollbar-track { background: rgba(1, 135, 108, 0.1); border-radius: 3px; }
        .ranking-table::-webkit-scrollbar-thumb { background: rgba(1, 135, 108, 0.5); border-radius: 3px; }
        .ranking-table::-webkit-scrollbar-thumb:hover { background: rgb(1, 135, 108); }

        .ranking-badge {
          display: inline-block;
          padding: 0.375rem 0.75rem;
          font-size: 0.875rem;
          font-weight: 600;
          border-radius: 50%;
          color: white;
          text-align: center;
          min-width: 2rem;
          height: 1.5rem;
          line-height: 1.2;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        .ranking-first { background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%) !important; color: #8B4513 !important; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3); }
        .ranking-second { background: linear-gradient(135deg, #C0C0C0 0%, #A9A9A9 100%) !important; color: #2F4F4F !important; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3); }
        .ranking-third { background: linear-gradient(135deg, #CD7F32 0%, #B8860B 100%) !important; color: white !important; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3); }

        .table-modern thead th { background: #017b6c; color: white; font-weight: 600; white-space: nowrap; }
        .table-modern td { vertical-align: middle; }

        .no-data-message { text-align:center; padding:3rem; color:#6c757d; font-size:1.1rem; }
        .no-data-message i { font-size:3rem; margin-bottom:1rem; opacity:.5; }
        .loading-spinner { width: 3rem; height: 3rem; border: .3rem solid #f3f3f3; border-top: .3rem solid #007bff; border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg);} 100% { transform: rotate(360deg);} }
      `}</style>
    </>
  );
}

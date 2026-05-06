"use client";

import Link from "next/link";
import "@/app/analysis/analysis-shared.css";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { GREEN_PRIMARY } from "@/lib/chart";
import { useRadarChart, useDistributionChart, usePieChart, useComparisonChart } from "./hooks";

type SubjectStat = {
  code: string; name: string; avg_score: number;
  actual_max_score: number; actual_min_score: number; count: number; exam_max_score: number;
};
type StudentRanking = { student_id: number; student_name: string; total_score: number; subject_count: number; rank: number; grade_rank: number | null };
type ChartDataPayload = {
  subject_avg_scores?: { labels: string[]; data: number[] }; subject_max_scores?: number[];
  score_distribution?: Record<string, Record<string, number>>; grade_distribution?: Record<string, number>; total_max_score?: number;
};
type AnalysisData = {
  selected_exam: { id: number; name: string; academic_year: string; grade_level: string; grade_level_display: string };
  selected_grade: string; academic_year: string; target_class: { id: number; grade_level: string; class_name: string };
  total_students: number; class_avg_total: number; class_max_total: number; class_min_total: number;
  subject_stats: SubjectStat[]; student_rankings: StudentRanking[]; chart_data: ChartDataPayload;
};

export default function ClassAnalysisClassPage() {
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

  const { academicYear, examId, gradeLevel, selectedClasses, className } = useMemo(() => ({
    academicYear: searchParams.get("academic_year") || "", examId: searchParams.get("exam") || "",
    gradeLevel: searchParams.get("grade_level") || "", selectedClasses: searchParams.getAll("selected_classes"),
    className: searchParams.get("class_name") || "",
  }), [querySignature, searchParams]);

  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasNoData, setHasNoData] = useState(false);
  const [errorText, setErrorText] = useState("");

  const radarCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const comparisonCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pieCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const distributionCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const comparisonMaxScore = useMemo(() => {
    const maxExamScore = Math.max(...((analysisData?.subject_stats || []).map((s) => Number(s.exam_max_score) || 0)), 0);
    return maxExamScore <= 0 ? 150 : Math.ceil(maxExamScore / 10) * 10;
  }, [analysisData]);

  useEffect(() => { if (!loading && !token) router.push("/login"); }, [loading, token, router]);

  useEffect(() => {
    if (!token) return;
    if (!examId || (!className && selectedClasses.length === 0)) {
      setErrorText("缺少必要参数：请先从成绩分析入口选择考试和单个班级。");
      setHasNoData(true); setIsLoading(false); return;
    }
    (async () => {
      setIsLoading(true); setHasNoData(false); setErrorText("");
      try {
        const params: Record<string, string | number | string[]> = { exam: examId };
        if (academicYear) params.academic_year = academicYear;
        if (gradeLevel) params.grade_level = gradeLevel;
        if (selectedClasses.length > 0) {
          params.selected_classes = selectedClasses;
        } else if (className) {
          params.class_name = className;
        }
        const result = await api.get<{ success?: boolean; data?: AnalysisData; error?: string }>('/scores/class-analysis-single/', params);
        if (!result?.success || !result?.data) throw new Error(result?.error || 'Request failed');
        const data: AnalysisData = result.data;
        if (!data.subject_stats?.length && !data.student_rankings?.length) { setHasNoData(true); setAnalysisData(null); return; }
        setAnalysisData(data);
      } catch (error) {
        console.error("加载单班级分析失败", error);
        setErrorText(error instanceof Error ? error.message : "加载失败");
        setHasNoData(true); setAnalysisData(null);
      } finally { setIsLoading(false); }
    })();
  }, [token, querySignature]);

  // Chart hooks
  useRadarChart(radarCanvasRef, analysisData?.subject_stats, comparisonMaxScore);
  useComparisonChart(comparisonCanvasRef, analysisData?.subject_stats, comparisonMaxScore);
  usePieChart(pieCanvasRef, analysisData?.chart_data);
  useDistributionChart(distributionCanvasRef, analysisData?.subject_stats, analysisData?.chart_data);

  if (loading) return <div className="p-4">加载中...</div>;

  return (
    <>
      <div className="w-full px-4 mx-auto max-w-[1400px] fade-in">
        <div className="analysis-page-header">
          <div className="w-full px-4 mx-auto max-w-[1400px]">
            <div className="flex flex-wrap items-center">
              <div className="flex-1">
                <h1><i className="fas fa-chart-line mr-3"></i>班级成绩分析</h1>
                <nav aria-label="breadcrumb">
                  <ol className="breadcrumb">
                    <li className="breadcrumb-item"><Link href="/analysis/class-grade">成绩分析</Link></li>
                    <li className="breadcrumb-item active" aria-current="page">班级分析</li>
                  </ol>
                </nav>
              </div>
              <div className="shrink-0">
                <Link href="/analysis/class-grade" className="btn-return"><i className="fas fa-arrow-left mr-2"></i>返回选择</Link>
              </div>
            </div>
          </div>
        </div>

        {analysisData && (
          <div className="analysis-info-card alert-modern">
            <div className="flex items-center">
              <i className="fas fa-info-circle fa-2x mr-3 text-green-600"></i>
              <div><h6 className="alert-heading mb-1 text-green-600"><i className="fas fa-filter mr-1"></i>当前分析条件</h6>
                <p className="mb-0 text-green-600">
                  <strong>学年：</strong>{analysisData.academic_year || "-"} |
                  <strong>考试：</strong>{analysisData.selected_exam.name} |
                  <strong>年级：</strong>{analysisData.selected_grade} |
                  <strong>班级：</strong>{analysisData.target_class.grade_level}{analysisData.target_class.class_name}
                </p>
              </div>
            </div>
          </div>
        )}

        {isLoading && <div className="text-center py-5"><div className="loading-spinner mx-auto mb-3"></div><h5>正在加载班级分析数据...</h5><p className="text-gray-500">请稍候，正在生成单班级详细分析报告</p></div>}

        {!isLoading && hasNoData && (
          <div className="no-data-message"><i className="fas fa-chart-line"></i><p>{errorText || "暂无单班级分析数据，请检查筛选条件。"}</p>
            <Link href="/analysis/class-grade" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"><i className="fas fa-arrow-left mr-2"></i>返回分析入口</Link></div>
        )}

        {!isLoading && !hasNoData && analysisData && (
          <>
            <div className="flex flex-wrap mb-4">
              <div className="w-full md:w-1/4"><div className="stats-card text-center"><div className="stats-number">{analysisData.total_students}</div><div className="stats-label">参考学生数</div></div></div>
              <div className="w-full md:w-1/4"><div className="stats-card text-center"><div className="stats-number">{analysisData.class_avg_total}</div><div className="stats-label">班级平均总分</div></div></div>
              <div className="w-full md:w-1/4"><div className="stats-card text-center"><div className="stats-number">{analysisData.class_max_total}</div><div className="stats-label">最高分</div></div></div>
              <div className="w-full md:w-1/4"><div className="stats-card text-center"><div className="stats-number">{analysisData.class_min_total}</div><div className="stats-label">最低分</div></div></div>
            </div>

            <div className="flex flex-wrap">
              <div className="w-full md:w-1/3">
                <div className="chart-card mb-2"><div className="card-header"><h5><i className="fas fa-chart-line"></i> 各科目平均分标准化雷达图</h5></div><div className="card-body"><div className="chart-container" style={{ height: 350 }}><canvas ref={radarCanvasRef}></canvas></div></div></div>
                <div className="chart-card mb-2"><div className="card-header"><h5><i className="fas fa-chart-area"></i> 科目平均分对比图</h5></div><div className="card-body"><div className="chart-container" style={{ height: 350 }}><canvas ref={comparisonCanvasRef}></canvas></div></div></div>
                <div className="chart-card mb-2"><div className="card-header"><h5><i className="fas fa-chart-pie"></i> 总分等级分布饼图</h5></div><div className="card-body"><div className="chart-container" style={{ height: 350 }}><canvas ref={pieCanvasRef}></canvas></div></div></div>
                <div className="chart-card mb-2"><div className="card-header"><h5><i className="fas fa-chart-bar"></i> 各科目等级分布柱状图</h5></div><div className="card-body"><div className="chart-container" style={{ height: 350 }}><canvas ref={distributionCanvasRef}></canvas></div></div></div>
              </div>

              <div className="w-full md:w-1/3">
                <div className="chart-card" style={{ height: "fit-content" }}>
                  <div className="card-header"><h5><i className="fas fa-chart-line"></i> 各科目统计</h5></div>
                  <div className="card-body">
                    {analysisData.subject_stats.map((stats) => (
                      <div key={stats.code} className="subject-card"><div className="card-body">
                        <h6 className="card-title">{stats.name}</h6>
                        <div className="flex flex-wrap">
                          <div className="w-1/2"><small className="text-gray-500">平均分</small><br /><strong>{stats.avg_score}</strong></div>
                          <div className="w-1/2"><small className="text-gray-500">最高分</small><br /><strong>{stats.actual_max_score}</strong></div>
                          <div className="w-1/2"><small className="text-gray-500">最低分</small><br /><strong>{stats.actual_min_score}</strong></div>
                          <div className="w-1/2"><small className="text-gray-500">参考人数</small><br /><strong>{stats.count}</strong></div>
                        </div>
                      </div></div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="w-full md:w-1/3">
                <div className="chart-card">
                  <div className="card-header"><h5><i className="fas fa-trophy"></i> 学生总分排名</h5></div>
                  <div className="card-body"><div className="ranking-table">
                    <table className="w-full border-collapse table-modern text-center">
                      <thead><tr><th className="px-3 py-2">排名</th><th className="px-3 py-2">姓名</th><th className="px-3 py-2">总分</th><th className="px-3 py-2">年级排名</th></tr></thead>
                      <tbody>
                        {analysisData.student_rankings.map((s) => (
                          <tr key={s.student_id} className="border-b border-gray-100">
                            <td className="px-3 py-2">{s.rank === 1 ? <span className="badge ranking-badge ranking-first">{s.rank}</span> : s.rank === 2 ? <span className="badge ranking-badge ranking-second">{s.rank}</span> : s.rank === 3 ? <span className="badge ranking-badge ranking-third">{s.rank}</span> : s.rank}</td>
                            <td className="px-3 py-2">{s.student_name}</td><td className="px-3 py-2"><strong>{s.total_score}</strong></td>
                            <td className="px-3 py-2">{s.grade_rank ? s.grade_rank : <span className="text-gray-500">-</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div></div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <style jsx global>{`
        .subject-card { border: none; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-left: 4px solid ${GREEN_PRIMARY}; transition: all 0.3s ease; margin-bottom: 15px; }
        .subject-card:hover { transform: translateX(5px); box-shadow: 0 8px 18px rgba(0,0,0,0.12); }
        .subject-card .card-title { font-size: 1.2rem; font-weight: 600; color: black; margin-bottom: 1rem; }
        .ranking-table { border-radius: 10px; max-height: 1350px; overflow-y: auto; }
        .ranking-table::-webkit-scrollbar { width: 6px; }
        .ranking-table::-webkit-scrollbar-track { background: rgba(1, 135, 108, 0.1); border-radius: 3px; }
        .ranking-table::-webkit-scrollbar-thumb { background: rgba(1, 135, 108, 0.5); border-radius: 3px; }
        .ranking-table::-webkit-scrollbar-thumb:hover { background: ${GREEN_PRIMARY}; }
        .ranking-badge { display: inline-block; padding: 0.375rem 0.75rem; font-size: 0.875rem; font-weight: 600; border-radius: 50%; color: white; text-align: center; min-width: 2rem; height: 1.5rem; line-height: 1.2; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2); }
        .ranking-first { background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%) !important; color: #8B4513 !important; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3); }
        .ranking-second { background: linear-gradient(135deg, #C0C0C0 0%, #A9A9A9 100%) !important; color: #2F4F4F !important; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3); }
        .ranking-third { background: linear-gradient(135deg, #CD7F32 0%, #B8860B 100%) !important; color: white !important; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3); }
      `}</style>
    </>
  );
}

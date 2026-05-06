"use client";

import Link from "next/link";
import "@/app/analysis/analysis-shared.css";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { useMultiComparisonChart, useMultiTrendChart, useMultiDistributionChart } from "./hooks";

type SubjectItem = { code: string; name: string };
type ClassStatistic = { class_name: string; student_count: number; avg_total: number; max_total: number; min_total: number; subject_averages: number[] };
type ChartDataPayload = { subjects: string[]; classes: string[]; class_subject_averages: Record<string, number[]>; score_distributions: Record<string, number[]> };
type AnalysisData = {
  selected_exam: { id: number; name: string; academic_year: string; grade_level: string; grade_level_display: string };
  selected_grade: string; academic_year: string; selected_classes: string[];
  class_statistics: ClassStatistic[]; subjects: SubjectItem[]; total_students: number; subject_count: number; highest_avg: number;
  chart_data: ChartDataPayload;
};
type SortState = { column: number; direction: "asc" | "desc" };

export default function ClassAnalysisMultiPage() {
  return <Suspense fallback={<div className="p-4">加载中...</div>}><ClassAnalysisMultiContent /></Suspense>;
}

function ClassAnalysisMultiContent() {
  const { token, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const querySignature = searchParams.toString();

  const { academicYear, examId, gradeLevel, className, selectedClasses } = useMemo(() => ({
    academicYear: searchParams.get("academic_year") || "", examId: searchParams.get("exam") || "",
    gradeLevel: searchParams.get("grade_level") || "", className: searchParams.get("class_name") || "",
    selectedClasses: searchParams.getAll("selected_classes"),
  }), [querySignature, searchParams]);

  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasNoData, setHasNoData] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [sortState, setSortState] = useState<SortState>({ column: -1, direction: "asc" });

  const comparisonCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const trendCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const distributionCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => { if (!loading && !token) router.push("/login"); }, [loading, token, router]);

  const chartMaxScore = useMemo(() => {
    const fb = (analysisData?.selected_grade || "").startsWith("初") ? 120 : 150;
    const avgs = analysisData?.chart_data?.class_subject_averages;
    if (!avgs) return fb;
    const all = Object.values(avgs).flat().filter((v): v is number => Number.isFinite(v));
    if (all.length === 0) return fb;
    const max = Math.max(...all);
    return max <= 0 ? fb : Math.max(fb, Math.ceil((max + 5) / 10) * 10);
  }, [analysisData]);

  const sortedClassStatistics = useMemo(() => {
    const rows = [...(analysisData?.class_statistics || [])];
    const { column, direction } = sortState;
    if (column < 2) return rows;
    rows.sort((a, b) => {
      const getVal = (row: ClassStatistic) => {
        if (column === 2) return Number(row.avg_total || 0);
        if (column === 3) return Number(row.max_total || 0);
        if (column === 4) return Number(row.min_total || 0);
        return Number(row.subject_averages?.[column - 5] || 0);
      };
      return direction === "asc" ? getVal(a) - getVal(b) : getVal(b) - getVal(a);
    });
    return rows;
  }, [analysisData, sortState]);

  useEffect(() => {
    if (!token) return;
    if (!examId || (selectedClasses.length === 0 && !className)) {
      setErrorText("缺少必要参数：请先从成绩分析入口选择多个班级。");
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
        const result = await api.get<{ success?: boolean; data?: AnalysisData; error?: string }>('/scores/class-analysis-multi/', params);
        if (!result?.success || !result?.data) throw new Error(result?.error || 'Request failed');
        const data: AnalysisData = result.data;
        setAnalysisData(data);
        if (!data.class_statistics?.length) setHasNoData(true);
      } catch (error) {
        console.error("加载多班级分析失败", error);
        setErrorText(error instanceof Error ? error.message : "加载失败");
        setHasNoData(true); setAnalysisData(null);
      } finally { setIsLoading(false); }
    })();
  }, [token, querySignature]);

  // Chart hooks
  useMultiComparisonChart(comparisonCanvasRef, analysisData?.chart_data, chartMaxScore);
  useMultiTrendChart(trendCanvasRef, analysisData?.chart_data, chartMaxScore);
  useMultiDistributionChart(distributionCanvasRef, analysisData?.chart_data);

  const onSort = (c: number) => setSortState((p) => p.column === c ? { column: c, direction: p.direction === "asc" ? "desc" : "asc" } : { column: c, direction: "asc" });
  const sc = (col: number) => sortState.column === col ? (sortState.direction === "asc" ? "sort-asc" : "sort-desc") : "";
  const si = (col: number) => sortState.column === col ? (sortState.direction === "asc" ? "fas fa-sort-up sort-icon" : "fas fa-sort-down sort-icon") : "fas fa-sort sort-icon";

  if (loading) return <div className="p-4">加载中...</div>;

  return (
    <>
      <div className="w-full px-4 mx-auto max-w-[1400px] fade-in">
        <div className="analysis-page-header">
          <div className="w-full px-4 mx-auto max-w-[1400px]"><div className="flex flex-wrap items-center">
            <div className="flex-1"><h1><i className="fas fa-chart-line mr-3"></i>多班级对比分析</h1>
              <nav aria-label="breadcrumb"><ol className="breadcrumb">
                <li className="breadcrumb-item"><Link href="/analysis/class-grade">成绩分析</Link></li>
                <li className="breadcrumb-item active" aria-current="page">多班级对比</li>
              </ol></nav></div>
            <div className="flex-shrink-0 text-right"><Link href="/analysis/class-grade" className="btn-return"><i className="fas fa-arrow-left mr-2"></i>返回选择</Link></div>
          </div></div>
        </div>

        {analysisData && (<div className="analysis-info-card alert-modern"><div className="flex items-center">
          <i className="fas fa-info-circle fa-2x mr-3 text-green-600"></i><div>
            <h6 className="alert-heading mb-1 text-green-600"><i className="fas fa-filter mr-1"></i>当前分析条件</h6>
            <p className="mb-0 text-green-600"><strong>学年：</strong>{analysisData.academic_year || "-"} | <strong>考试：</strong>{analysisData.selected_exam.name} | <strong>年级：</strong>{analysisData.selected_grade}</p>
            <p className="mb-0 text-green-600 mt-1"><strong>已选择班级：</strong>{analysisData.selected_classes.length > 0 ? analysisData.selected_classes.join("、") : <span className="text-gray-500">无</span>}</p>
          </div></div></div>)}

        {isLoading && <div className="text-center py-5"><div className="loading-spinner mx-auto mb-3"></div><h5>正在加载多班级分析数据...</h5><p className="text-gray-500">请稍候，正在生成多班级对比图表</p></div>}

        {!isLoading && hasNoData && (<div className="no-data-message"><i className="fas fa-chart-line"></i><p>{errorText || "暂无多班级分析数据，请检查筛选条件。"}</p>
          <Link href="/analysis/class-grade" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"><i className="fas fa-arrow-left mr-2"></i>返回分析入口</Link></div>)}

        {!isLoading && !hasNoData && analysisData && (<>
          <div className="flex flex-wrap mb-4">
            <div className="w-full md:w-1/4"><div className="stats-card text-center"><div className="stats-number">{analysisData.selected_classes.length}</div><div className="stats-label">对比班级数</div></div></div>
            <div className="w-full md:w-1/4"><div className="stats-card text-center"><div className="stats-number">{analysisData.total_students}</div><div className="stats-label">总参考学生数</div></div></div>
            <div className="w-full md:w-1/4"><div className="stats-card text-center"><div className="stats-number">{analysisData.subject_count}</div><div className="stats-label">考试科目数</div></div></div>
            <div className="w-full md:w-1/4"><div className="stats-card text-center"><div className="stats-number">{Number(analysisData.highest_avg || 0).toFixed(1)}</div><div className="stats-label">最高班级平均分</div></div></div>
          </div>

          <div className="flex flex-wrap"><div className="w-full"><div className="chart-card"><div className="card-header"><h5><i className="fas fa-chart-bar"></i> 各科目班级平均分对比</h5></div>
            <div className="card-body"><div className="chart-container-large"><canvas ref={comparisonCanvasRef}></canvas></div></div></div></div></div>

          <div className="flex flex-wrap">
            <div className="w-full md:w-1/2"><div className="chart-card"><div className="card-header"><h5><i className="fas fa-chart-line"></i> 班级表现趋势图</h5></div>
              <div className="card-body"><div className="chart-container"><canvas ref={trendCanvasRef}></canvas></div></div></div></div>
            <div className="w-full md:w-1/2"><div className="chart-card"><div className="card-header"><h5><i className="fas fa-chart-area"></i> 班级等级分布对比</h5></div>
              <div className="card-body"><div className="chart-container"><canvas ref={distributionCanvasRef}></canvas></div></div></div></div>
          </div>

          <div className="flex flex-wrap"><div className="w-full"><div className="chart-card"><div className="card-header"><h5><i className="fas fa-table"></i> 班级详细数据对比</h5></div>
            <div className="card-body"><div className="overflow-x-auto">
              <table className="w-full border-collapse table-modern text-center [&_tbody_tr]:bg-white [&_tbody_tr:nth-child(even)]:bg-gray-100 [&_tbody_tr:hover]:bg-green-100" id="classComparisonTable">
                <thead><tr>
                  <th className="px-4 py-2.5 text-sm min-w-[80px]">班级</th><th className="px-4 py-2.5 text-sm w-[60px]">参考人数</th>
                  <th className={`sortable px-4 py-2.5 text-sm ${sc(2)}`} onClick={() => onSort(2)}>总分 <i className={si(2)}></i></th>
                  <th className={`sortable px-4 py-2.5 text-sm ${sc(3)}`} onClick={() => onSort(3)}>最高分 <i className={si(3)}></i></th>
                  <th className={`sortable px-4 py-2.5 text-sm ${sc(4)}`} onClick={() => onSort(4)}>最低分 <i className={si(4)}></i></th>
                  {analysisData.subjects.map((s, i) => (
                    <th key={s.code} className={`sortable px-4 py-2.5 text-sm ${sc(i + 5)}`} onClick={() => onSort(i + 5)}>{s.name} <i className={si(i + 5)}></i></th>
                  ))}
                </tr></thead>
                <tbody id="classTableBody">
                  {sortedClassStatistics.map((row, ri) => (<tr key={`${row.class_name}-${ri}`} className="border-b border-gray-100">
                    <td className="px-4 py-2 min-w-[80px]"><strong>{row.class_name}</strong></td><td className="px-4 py-2 w-[60px]">{row.student_count}</td>
                    <td className="px-4 py-2" data-value={row.avg_total}>{Number(row.avg_total || 0).toFixed(1)}</td>
                    <td className="px-4 py-2" data-value={row.max_total}>{Number(row.max_total || 0).toFixed(1)}</td>
                    <td className="px-4 py-2" data-value={row.min_total}>{Number(row.min_total || 0).toFixed(1)}</td>
                    {row.subject_averages.map((avg, ii) => <td className="px-4 py-2" key={`${row.class_name}-${ii}`} data-value={avg}>{Number(avg || 0).toFixed(1)}</td>)}
                  </tr>))}
                </tbody>
              </table>
            </div></div></div></div></div>
        </>)}
      </div>

      <style jsx global>{`
        #classComparisonTable th, #classComparisonTable td, .table-modern th, .table-modern td { text-align: center; vertical-align: middle; }
        .chart-container { height: 500px; width: 100%; margin-bottom: 20px; padding: 5px; }
        .chart-container-large { height: 600px; width: 100%; margin-bottom: 20px; padding: 5px; }
      `}</style>
    </>
  );
}

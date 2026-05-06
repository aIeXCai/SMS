"use client";

import Link from "next/link";
import "@/app/analysis/analysis-shared.css";
import { Suspense, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

import GradeStatsCards from "./components/GradeStatsCards";
import GradeClassAverageChart from "./components/GradeClassAverageChart";
import GradeSubjectRadarChart from "./components/GradeSubjectRadarChart";
import GradeScoreHistogram from "./components/GradeScoreHistogram";
import GradePieChart from "./components/GradePieChart";
import GradeClassDistributionChart from "./components/GradeClassDistributionChart";
import GradeDifficultyChart from "./components/GradeDifficultyChart";
import GradeDataTable from "./components/GradeDataTable";
import { useGradeAnalysisData, useSortedClassStats } from "./hooks";

export default function ClassAnalysisGradePage() {
  return (
    <Suspense fallback={<div className="p-4">加载中...</div>}>
      <ClassAnalysisGradeContent />
    </Suspense>
  );
}

function ClassAnalysisGradeContent() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const parsed = useMemo(() => ({
    academicYear: searchParams.get("academic_year") || "",
    examId: searchParams.get("exam") || "",
    gradeLevel: searchParams.get("grade_level") || "",
  }), [searchParams.toString(), searchParams]);

  const { academicYear, examId, gradeLevel } = parsed;

  useEffect(() => {
    if (!loading && !token) router.push("/login");
    if (!loading && token && user?.role === "subject_teacher") router.push("/analysis/class-grade");
  }, [loading, token, router, user]);

  const { analysisData, isLoading, hasNoData, errorText } =
    useGradeAnalysisData(token, examId, gradeLevel, academicYear);

  const { sortedClassStatistics, sortState, onSort } = useSortedClassStats(analysisData);

  if (loading) return <div className="p-4">加载中...</div>;

  return (
    <>
      <div className="w-full px-4 mx-auto max-w-[1400px] fade-in">
        <div className="analysis-page-header">
          <div className="w-full px-4 mx-auto max-w-[1400px]">
            <div className="flex flex-wrap items-center">
              <div className="flex-1">
                <h1><i className="fas fa-graduation-cap mr-3"></i>年级成绩分析</h1>
                <nav aria-label="breadcrumb">
                  <ol className="breadcrumb">
                    <li className="breadcrumb-item"><Link href="/analysis/class-grade">成绩分析</Link></li>
                    <li className="breadcrumb-item active" aria-current="page">年级分析</li>
                  </ol>
                </nav>
              </div>
              <div className="flex-shrink-0 text-right">
                <Link href="/analysis/class-grade" className="btn-return"><i className="fas fa-arrow-left mr-2"></i>返回选择</Link>
              </div>
            </div>
          </div>
        </div>

        {analysisData && (
          <div className="analysis-info-card alert-modern">
            <div className="flex items-center">
              <i className="fas fa-info-circle fa-2x mr-3 text-green-600"></i>
              <div>
                <h6 className="alert-heading mb-1 text-green-600"><i className="fas fa-filter mr-1"></i>当前分析条件</h6>
                <p className="mb-0 text-green-600">
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
            <p className="text-gray-500">请稍候，正在生成年级分析图表</p>
          </div>
        )}

        {!isLoading && hasNoData && (
          <div className="no-data-message">
            <i className="fas fa-chart-line"></i>
            <p>{errorText || "暂无年级分析数据，请检查筛选条件。"}</p>
            <Link href="/analysis/class-grade" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"><i className="fas fa-arrow-left mr-2"></i>返回分析入口</Link>
          </div>
        )}

        {!isLoading && !hasNoData && analysisData && (
          <>
            <GradeStatsCards data={analysisData} />

            <div className="flex flex-wrap">
              <div className="w-full md:w-1/2">
                <GradeClassAverageChart
                  classNames={analysisData.chart_data.class_names}
                  classAverages={analysisData.chart_data.class_averages}
                  totalMaxScore={analysisData.total_max_score}
                />
              </div>
              <div className="w-full md:w-1/2">
                <GradeSubjectRadarChart
                  subjectNames={analysisData.chart_data.subject_names}
                  subjectAverages={analysisData.chart_data.subject_averages}
                  subjectMaxScores={analysisData.chart_data.subject_max_scores}
                  gradeLevel={analysisData.selected_grade}
                />
              </div>
            </div>

            <div className="flex flex-wrap">
              <div className="w-full md:w-1/2">
                <GradeScoreHistogram totalScores={analysisData.chart_data.total_scores} />
              </div>
              <div className="w-full md:w-1/2">
                <GradePieChart
                  scoreRanges={analysisData.chart_data.score_ranges}
                  scoreDistribution={analysisData.chart_data.score_distribution}
                />
              </div>
            </div>

            <div className="flex flex-wrap">
              <div className="w-full md:w-1/2">
                <GradeClassDistributionChart
                  classNames={analysisData.chart_data.class_names}
                  classGradeDistribution={analysisData.chart_data.class_grade_distribution}
                />
              </div>
              <div className="w-full md:w-1/2">
                <GradeDifficultyChart
                  subjectNames={analysisData.chart_data.subject_names}
                  difficultyCoefficients={analysisData.chart_data.difficulty_coefficients}
                />
              </div>
            </div>

            <GradeDataTable
              classStatistics={sortedClassStatistics}
              subjects={analysisData.subjects}
              sortState={sortState}
              onSort={onSort}
            />
          </>
        )}
      </div>

      <style jsx global>{`
        .chart-container { height: 360px; width: 100%; }
        .chart-container-large { height: 460px; width: 100%; }
        #gradeComparisonTable th,
        #gradeComparisonTable td,
        .table-modern th,
        .table-modern td { text-align: center; vertical-align: middle; }
      `}</style>
    </>
  );
}

"use client";

import Link from "next/link";
import "@/app/analysis/analysis-shared.css";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

import StudentInfoCard from "./components/StudentInfoCard";
import StudentTrendChart from "./components/StudentTrendChart";
import StudentRadarBarCharts from "./components/StudentRadarBarCharts";
import StudentScoreTable from "./components/StudentScoreTable";
import ExportButton from "./components/ExportButton";
import { useStudentAnalysisData, useStudentAuth } from "./hooks";

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

  const { effectiveToken } = useStudentAuth(token, loading);
  const { analysisData, isLoading, hasNoData } =
    useStudentAnalysisData(effectiveToken, studentId);

  useEffect(() => {
    if (!loading && !effectiveToken) router.push("/login");
  }, [loading, effectiveToken, router]);

  if (loading) return <div className="p-4">加载中...</div>;

  return (
    <>
      <div className="w-full px-4 mx-auto max-w-[1400px] fade-in">
        <div className="analysis-page-header">
          <div className="w-full px-4 mx-auto max-w-[1400px]">
            <div className="flex flex-wrap items-center">
              <div className="flex-1">
                <h1><i className="fas fa-user-graduate mr-3"></i>{analysisData?.student_info.name || "学生"} - 个人成绩分析</h1>
                <nav aria-label="breadcrumb">
                  <ol className="breadcrumb">
                    <li className="breadcrumb-item"><Link href="/analysis/class-grade">成绩分析</Link></li>
                    <li className="breadcrumb-item"><Link href="/analysis/student">个人分析</Link></li>
                    <li className="breadcrumb-item active" aria-current="page">{analysisData?.student_info.name || "-"}</li>
                  </ol>
                </nav>
              </div>
              <div className="flex-shrink-0">
                <div className="flex gap-2">
                  <ExportButton
                    studentId={studentId}
                    disabled={isLoading || hasNoData || !studentId}
                    studentInfo={analysisData?.student_info}
                  />
                  <Link href="/analysis/student" className="btn-return">
                    <i className="fas fa-arrow-left mr-2"></i>返回选择
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {analysisData && <StudentInfoCard data={analysisData} />}

        {isLoading && (
          <div className="text-center py-5">
            <div className="loading-spinner mx-auto mb-3"></div>
            <h5>正在加载分析数据...</h5>
            <p className="text-gray-500">请稍候，正在为您准备详细的成绩分析报告</p>
          </div>
        )}

        {!isLoading && hasNoData && (
          <div className="no-data-message">
            <i className="fas fa-chart-line"></i>
            <p>暂无分析数据，请确保该学生有考试成绩记录。</p>
            <Link href="/analysis/student" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"><i className="fas fa-arrow-left mr-2"></i>返回学生选择</Link>
          </div>
        )}

        {!isLoading && !hasNoData && analysisData && (
          <div id="analysisResults">
            <StudentTrendChart data={analysisData} />
            <StudentRadarBarCharts data={analysisData} />
            <StudentScoreTable data={analysisData} />
          </div>
        )}
      </div>

      <style jsx global>{`
        .btn-export {
          background: #00897b; border: none; border-radius: 25px;
          padding: 0.75rem 1.5rem; color: white; font-weight: 600;
          transition: all 0.3s ease; box-shadow: 0 8px 25px rgba(0, 137, 123, 0.25);
        }
        .btn-export:hover:not(:disabled) {
          transform: translateY(-2px); color: white; box-shadow: 0 12px 35px rgba(0, 137, 123, 0.35);
        }
        .btn-export:disabled { opacity: 0.7; cursor: not-allowed; }
        .chart-card { height: 100%; margin-bottom: 1.5rem; }
        .chart-container { height: 350px; margin-bottom: 10px; padding: 10px; }
        .chart-container-large { height: 450px; margin-bottom: 10px; padding: 10px; }
        #analysisResults > .row { margin-bottom: 2rem; }
        #analysisResults > .row:last-child { margin-bottom: 0; }
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
          white-space: nowrap; overflow-x: auto; overflow-y: hidden;
          scrollbar-width: thin; scrollbar-color: #dee2e6 transparent; padding-bottom: 2px;
        }
        .score-table td:nth-child(5) .subject-detail-scroll::-webkit-scrollbar { height: 4px; }
        .score-table td:nth-child(5) .subject-detail-scroll::-webkit-scrollbar-track { background: transparent; }
        .score-table td:nth-child(5) .subject-detail-scroll::-webkit-scrollbar-thumb { background-color: #dee2e6; border-radius: 2px; }
        .table-container-wrapper { position: relative; overflow: hidden; border: 1px solid #dee2e6; border-radius: 10px; background: white; }
        .score-table { margin:0; border-collapse: separate; border-spacing: 0; font-size: 14px; }
        .score-table th,.score-table td { padding: .75rem; text-align: center; white-space: nowrap; border-bottom: 1px solid #dee2e6; }
        .score-table thead th { background: #017b6c; color:white; font-weight:600; }
        .score-table tbody tr:hover { background-color: #f5f5f5 !important; }
      `}</style>
    </>
  );
}

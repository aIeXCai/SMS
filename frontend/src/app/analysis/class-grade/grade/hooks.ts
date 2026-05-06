"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { AnalysisData, ClassStatistic, SortState } from "./components/types";

/** Fetch grade analysis data + manage loading/error states */
export function useGradeAnalysisData(
  effectiveToken: string | null,
  examId: string,
  gradeLevel: string,
  academicYear: string,
) {
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasNoData, setHasNoData] = useState(false);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    if (!effectiveToken) return;
    if (!examId || !gradeLevel) {
      setErrorText("缺少必要参数：请先从成绩分析入口选择年级分析。");
      setHasNoData(true);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setHasNoData(false);
      setErrorText("");
      try {
        const result = await api.get<{ success?: boolean; data?: AnalysisData; error?: string }>(
          '/scores/class-analysis-grade/',
          { exam: examId, grade_level: gradeLevel, class_name: "all", ...(academicYear ? { academic_year: academicYear } : {}) }
        );
        if (!result?.success || !result?.data) {
          throw new Error(result?.error || "加载失败");
        }

        if (cancelled) return;
        const data: AnalysisData = result.data;
        setAnalysisData(data);
        if (!data.class_statistics?.length) setHasNoData(true);
      } catch (error) {
        if (cancelled) return;
        console.error("加载年级分析失败", error);
        setErrorText(error instanceof Error ? error.message : "加载失败，请稍后重试");
        setHasNoData(true);
        setAnalysisData(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [effectiveToken, examId, gradeLevel, academicYear]);

  return { analysisData, isLoading, hasNoData, errorText };
}

/** Sorted class statistics with sort state management */
export function useSortedClassStats(analysisData: AnalysisData | null) {
  const [sortState, setSortState] = useState<SortState>({ column: -1, direction: "asc" });

  const sortedData = useMemo(() => {
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
      const aVal = getValue(a);
      const bVal = getValue(b);
      return direction === "asc" ? aVal - bVal : bVal - aVal;
    });
    return rows;
  }, [analysisData, sortState]);

  const onSort = (column: number) => {
    setSortState((prev) => {
      if (prev.column === column) return { column, direction: prev.direction === "asc" ? "desc" : "asc" };
      return { column, direction: "asc" };
    });
  };

  return { sortedClassStatistics: sortedData, sortState, onSort };
}

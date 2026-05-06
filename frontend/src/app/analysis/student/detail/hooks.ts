"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { AnalysisData } from "./components/types";

/** Fetch student analysis data */
export function useStudentAnalysisData(
  effectiveToken: string | null,
  studentId: string,
) {
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasNoData, setHasNoData] = useState(false);

  useEffect(() => {
    if (!effectiveToken || !studentId) return;

    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const result = await api.get<{ success?: boolean; data?: AnalysisData }>(
          '/scores/student-analysis-data/',
          { student_id: studentId }
        );
        if (!result.success || !result.data) {
          if (!cancelled) { setHasNoData(true); setAnalysisData(null); }
          return;
        }
        const data: AnalysisData = result.data;
        if (!cancelled) {
          setAnalysisData(data);
          setHasNoData((data.exams || []).length === 0);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("加载个人分析数据失败", error);
          setHasNoData(true);
          setAnalysisData(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [effectiveToken, studentId]);

  return { analysisData, isLoading, hasNoData, setAnalysisData };
}

/** Build token + auth header from AuthContext */
export function useStudentAuth(token: string | null | undefined, loading: boolean) {
  const effectiveToken = useMemo(() => {
    if (token) return token;
    if (typeof window !== "undefined") return localStorage.getItem("accessToken");
    return null;
  }, [token]);

  return { effectiveToken, loading };
}

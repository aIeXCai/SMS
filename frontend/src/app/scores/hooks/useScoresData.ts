"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Option, ScoreRow, ScoreListResponse, ScoreOptions, SelectAllKeysResponse, Filters, ResultModalState } from "../types";
import { EMPTY_FILTERS } from "../types";
import { api } from "@/lib/api";
import { gradeToCohort } from "@/lib/gradeMapping";

export function useScoresData(effectiveToken: string | null, userManagedGrade?: string) {
  // ── State ──
  const [options, setOptions] = useState<ScoreOptions | null>(null);
  const [gradeClasses, setGradeClasses] = useState<Option[]>([]);
  const [rows, setRows] = useState<ScoreRow[]>([]);
  const [allSubjects, setAllSubjects] = useState<string[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [numPages, setNumPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [startIndex, setStartIndex] = useState(0);
  const [endIndex, setEndIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSelectingAll, _setIsSelectingAll] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [resultModal, setResultModal] = useState<ResultModalState>({
    show: false, type: "success", title: "操作结果", subtitle: "", message: "",
  });

  // ── Computed values ──
  const selectedKeys = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);
  const allFilteredSelected = totalCount > 0 && selectedKeys.length === totalCount;
  const hasAnySelection = selectedKeys.length > 0;
  const currentPageIndeterminate = hasAnySelection && !allFilteredSelected;
  const hasFiltersApplied = Object.values(appliedFilters).some((v) => v !== "");
  const showDataView = rows.length > 0 || hasFiltersApplied || isLoading;

  const showResultModal = (type: "success" | "error", title: string, subtitle: string, message: string) =>
    setResultModal({ show: true, type, title, subtitle, message });
  const closeResultModal = () => setResultModal((prev) => ({ ...prev, show: false }));

  // ── Data fetching ──
  const fetchOptions = useCallback(async (gradeLevel?: string) => {
    try {
      const params = gradeLevel ? { grade_level: gradeLevel } : undefined;
      const data = await api.get<ScoreOptions>('/scores/options/', params);
      setOptions(data);
      if (data.per_page_options?.length) setPageSize((prev) => data.per_page_options.includes(prev) ? prev : data.per_page_options[0]);
    } catch (e) { console.error("获取成绩筛选选项失败", e); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchGradeClasses = async (gradeValue: string) => {
    try {
      const data = await api.get<{ class_name_choices?: Option[] }>('/scores/options/', { grade_level: gradeValue });
      const classes: Option[] = data.class_name_choices || [];
      setGradeClasses(classes.sort((a, b) => {
        const aNum = Number((a.label.match(/\d+/) || ["999"])[0]);
        const bNum = Number((b.label.match(/\d+/) || ["999"])[0]);
        if (aNum !== bNum) return aNum - bNum;
        return a.label.localeCompare(b.label, "zh-CN");
      }));
    } catch (e) { console.error("获取班级列表失败", e); }
  };

  const fetchRows = async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string | number> = { page: currentPage, page_size: pageSize };
      Object.entries(appliedFilters).forEach(([k, v]) => { if (v) params[k] = v; });
      const data = await api.get<ScoreListResponse>('/scores/', params);
      setRows(data.results || []); setAllSubjects(data.all_subjects || []); setTotalCount(data.count || 0);
      setNumPages(data.num_pages || 1); setStartIndex(data.start_index || 0); setEndIndex(data.end_index || 0);
    } catch (e) { console.error("获取成绩列表失败", e); setRows([]); setAllSubjects([]); setTotalCount(0); setNumPages(1); setStartIndex(0); setEndIndex(0); }
    finally { setIsLoading(false); }
  };

  const buildFilterParams = (activeFilters: Filters): Record<string, string> => {
    const params: Record<string, string> = {};
    Object.entries(activeFilters).forEach(([k, v]) => { if (v) params[k] = v; });
    return params;
  };

  const fetchAllFilteredRecordKeys = async () => {
    const params = buildFilterParams(appliedFilters);
    const data = await api.get<SelectAllKeysResponse>('/scores/select-all-record-keys/', params);
    if (!data.success) throw new Error("全选接口返回失败");
    return Array.from(new Set(data.record_keys || []));
  };

  const deleteSelectedRecords = async (keys: string[]): Promise<boolean> => {
    try {
      const data = await api.post<{ success?: boolean; message?: string }>('/scores/batch-delete-selected/', { selected_records: keys });
      if (!data.success) { showResultModal("error", "删除失败", "操作未完成", data.message || "删除失败"); return false; }
      showResultModal("success", "删除成功", "数据已更新", data.message || "删除成功");
      setSelected({}); return true;
    } catch (e) { console.error(e); showResultModal("error", "删除失败", "网络或服务器异常", "删除失败，请稍后再试"); return false; }
  };

  const deleteFilteredRecords = async (): Promise<boolean> => {
    const params = buildFilterParams(appliedFilters);
    try {
      const data = await api.post<{ success?: boolean; message?: string }>('/scores/batch-delete-filtered/', undefined, params);
      if (!data.success) { showResultModal("error", "删除失败", "操作未完成", data.message || "按筛选删除失败"); return false; }
      showResultModal("success", "删除成功", "筛选结果已清理", data.message || "按筛选条件删除成功");
      setSelected({}); return true;
    } catch (e) { console.error(e); showResultModal("error", "删除失败", "网络或服务器异常", "按筛选删除失败，请稍后再试"); return false; }
  };

  // ── Effects ──
  useEffect(() => { if (!effectiveToken) return; fetchOptions(); }, [effectiveToken, fetchOptions]);

  // Role-aware default: grade_manager auto-filters by managed grade
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (hasInitialized.current || !effectiveToken || !userManagedGrade) return;
    const cohort = gradeToCohort(userManagedGrade);
    if (!cohort) return;
    hasInitialized.current = true;
    setFilters((prev) => ({ ...prev, grade_filter: cohort }));
    setAppliedFilters((prev) => ({ ...prev, grade_filter: cohort }));
    fetchOptions(cohort);
    fetchGradeClasses(cohort);
  }, [effectiveToken, userManagedGrade, fetchOptions]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!effectiveToken) return; fetchRows(); }, [effectiveToken, currentPage, pageSize, appliedFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    options, gradeClasses, setGradeClasses, rows, allSubjects, totalCount, numPages,
    currentPage, setCurrentPage, pageSize, setPageSize, startIndex, endIndex,
    isLoading, isSelectingAll, filters, setFilters, appliedFilters, setAppliedFilters,
    selected, setSelected, selectedKeys, allFilteredSelected, hasAnySelection,
    currentPageIndeterminate, showDataView, resultModal, showResultModal, closeResultModal,
    fetchOptions, fetchGradeClasses, fetchRows, fetchAllFilteredRecordKeys,
    deleteSelectedRecords, deleteFilteredRecords,
  };
}

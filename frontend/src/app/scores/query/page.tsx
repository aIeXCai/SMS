"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

import type { Filters, ScoreOptions, ScoreListResponse, ScoreRow } from "./types";
import { EMPTY_FILTERS } from "./types";
import QueryMessages from "./components/QueryMessages";
import QueryFilterBar from "./components/QueryFilterBar";
import QueryResultsTable from "./components/QueryResultsTable";
import QueryPagination from "./components/QueryPagination";
import QueryPageStyles from "./components/QueryPageStyles";

type Msg = { id: number; type: "success" | "danger" | "info"; text: string };

export default function ScoresQueryPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();

  // ── State ──
  const [options, setOptions] = useState<ScoreOptions | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);
  const [rows, setRows] = useState<ScoreRow[]>([]);
  const [allSubjects, setAllSubjects] = useState<string[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [startIndex, setStartIndex] = useState(0);
  const [endIndex, setEndIndex] = useState(0);
  const [subjectSort, setSubjectSort] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  // Dropdown open states
  const [open, setOpen] = useState({ subject: false, year: false, grade: false, exam: false, cls: false, sort: false });

  // ── Auth ──
  useEffect(() => { if (!loading && !token) router.push("/login"); }, [loading, token, router]);

  // ── Fetch options ──
  useEffect(() => {
    if (!token) return;
    api.get<ScoreOptions>('/scores/options/').then(setOptions).catch(console.error);
  }, [token]);

  // ── Click outside ──
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".app-custom-dropdown, .subject-dropdown"))
        setOpen({ subject: false, year: false, grade: false, exam: false, cls: false, sort: false });
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // ── Fetch rows ──
  useEffect(() => {
    if (!token) return;
    (async () => {
      setIsLoading(true);
      try {
        const p: Record<string, string | number | string[]> = { page: currentPage, page_size: "50", dynamic_subjects: "1" };
        if (subjectSort) { p.subject_sort = subjectSort; p.sort_order = sortOrder; }
        Object.entries(appliedFilters).forEach(([k, v]) => {
          if (k === "subject_filters") p[k] = v as string[]; else if (v) p[k] = String(v);
        });
        const d = await api.get<ScoreListResponse>('/scores/', p);
        setRows(d.results || []); setAllSubjects(d.all_subjects || []); setTotalCount(d.count || 0);
        setNumPages(d.num_pages || 1); setStartIndex(d.start_index || 0); setEndIndex(d.end_index || 0);
      } catch (e) {
        console.error(e);
        setRows([]); setAllSubjects([]); setTotalCount(0); setStartIndex(0); setEndIndex(0);
        setMessages((prev) => [...prev, msg("danger", "查询失败，请检查筛选条件或稍后重试。")]);
      } finally { setIsLoading(false); }
    })();
  }, [token, currentPage, appliedFilters, subjectSort, sortOrder]);

  // ── Helpers ──
  const msg = (type: Msg["type"], text: string): Msg => ({ id: Date.now(), type, text });
  const dismiss = (id: number) => setMessages((prev) => prev.filter((m) => m.id !== id));
  const toggle = (k: keyof typeof open) => () => setOpen({ subject: false, year: false, grade: false, exam: false, cls: false, sort: false, [k]: !open[k] as boolean });
  const setF = (patch: Partial<Filters>) => setFilters((p) => ({ ...p, ...patch }));

  const handleQuery = () => {
    const has = Object.entries(filters).some(([k, v]) => k === "subject_filters" ? (v as string[]).length > 0 : !!v);
    if (!has) return setMessages((prev) => [...prev, msg("info", "请至少设置一个查询条件后再查询。")]);
    setAppliedFilters(filters); setCurrentPage(1); setOpen((p) => ({ ...p, subject: false }));
  };

  const handleReset = () => { setFilters(EMPTY_FILTERS); setAppliedFilters(EMPTY_FILTERS); setSubjectSort(""); setSortOrder("desc"); setCurrentPage(1); };

  const handleExport = async () => {
    try {
      const p: Record<string, string | number | string[]> = { dynamic_subjects: "1" };
      if (subjectSort) { p.subject_sort = subjectSort; p.sort_order = sortOrder; }
      Object.entries(appliedFilters).forEach(([k, v]) => {
        if (k === "subject_filters") p[k] = v as string[]; else if (v) p[k] = String(v);
      });
      const res = await api.downloadBlob('/scores/query-export/', p);
      if (!res.ok) return setMessages((prev) => [...prev, msg("danger", "导出失败，请稍后重试。")]);
      const blob = await res.blob(), url = window.URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `成绩查询导出_${Date.now()}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
      setMessages((prev) => [...prev, msg("success", "导出成功，文件已开始下载。")]);
    } catch (e) { console.error(e); setMessages((prev) => [...prev, msg("danger", "导出失败，请稍后重试。")]); }
  };

  const allSelected = (options?.subjects?.length || 0) > 0 && filters.subject_filters.length === (options?.subjects?.length || 0);
  const toggleSubject = (v: string) => setFilters((p) => ({ ...p, subject_filters: p.subject_filters.includes(v) ? p.subject_filters.filter((s) => s !== v) : [...p.subject_filters, v] }));
  const toggleAllSubjects = () => setFilters((p) => ({ ...p, subject_filters: allSelected ? [] : (options?.subjects || []).map((s) => s.value) }));
  const subText = (() => {
    const c = filters.subject_filters.length, t = options?.subjects?.length || 0;
    if (c === 0) return "请选择科目"; if (c === t) return `全部科目 (${c})`;
    if (c === 1) return options?.subjects.find((s) => s.value === filters.subject_filters[0])?.label || "已选择 1 个科目";
    return `已选择 ${c} 个科目`;
  })();

  const handleSort = (target: string, def: "asc" | "desc" = "desc") => {
    if (subjectSort !== target) { setSubjectSort(target); setSortOrder(def); }
    else setSortOrder((p) => (p === "desc" ? "asc" : "desc"));
    setCurrentPage(1);
  };

  if (loading) return <div className="p-4">加载中...</div>;
  if (!user) return null;

  return (
    <div>
      <div className="page-header">
        <div className="w-full px-4 mx-auto max-w-[1400px]">
          <div className="flex flex-wrap items-center">
            <div className="w-full md:w-2/3">
              <h1><i className="fas fa-search mr-3"></i>成绩查询</h1>
              <p className="mb-0 opacity-75">快速查询学生成绩信息</p>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-4 mx-auto max-w-[1400px]">
        <QueryMessages messages={messages} onDismiss={dismiss} />

        <QueryFilterBar
          filters={filters} options={options}
          academicYearDropdownOpen={open.year} gradeDropdownOpen={open.grade}
          examDropdownOpen={open.exam} classDropdownOpen={open.cls}
          sortByDropdownOpen={open.sort} subjectMenuOpen={open.subject}
          selectedSubjectText={subText} allSubjectsSelected={allSelected}
          onToggleAcademicYear={toggle("year")} onToggleGrade={toggle("grade")}
          onToggleExam={toggle("exam")} onToggleClass={toggle("cls")}
          onToggleSortBy={toggle("sort")} onToggleSubjectMenu={toggle("subject")}
          onAcademicYearChange={(v) => { setF({ academic_year_filter: v }); setOpen((p) => ({ ...p, year: false })); }}
          onGradeChange={(v) => { setF({ grade_filter: v }); setOpen((p) => ({ ...p, grade: false })); }}
          onExamChange={(v) => { setF({ exam_filter: v }); setOpen((p) => ({ ...p, exam: false })); }}
          onClassChange={(v) => { setF({ class_filter: v }); setOpen((p) => ({ ...p, cls: false })); }}
          onSortByChange={(v) => { setF({ sort_by: v }); setSubjectSort(""); setSortOrder("desc"); setOpen((p) => ({ ...p, sort: false })); }}
          onDateFromChange={(v) => setF({ date_from_filter: v })}
          onDateToChange={(v) => setF({ date_to_filter: v })}
          onNameChange={(v) => setF({ student_name_filter: v })}
          onToggleSubject={toggleSubject} onToggleAllSubjects={toggleAllSubjects}
          onQuery={handleQuery} onReset={handleReset}
        />

        <QueryResultsTable isLoading={isLoading} rows={rows} allSubjects={allSubjects}
          totalCount={totalCount} startIndex={startIndex} endIndex={endIndex}
          numPages={numPages} subjectSort={subjectSort} sortOrder={sortOrder}
          onSort={handleSort} onExport={handleExport} onQuery={handleQuery} />

        <QueryPagination currentPage={currentPage} numPages={numPages} onPageChange={setCurrentPage} />

        <button type="button" className="app-btn-primary fixed bottom-0 right-0 m-4 z-[1000]"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <i className="fas fa-arrow-up"></i>
        </button>
      </div>

      <QueryPageStyles />
    </div>
  );
}

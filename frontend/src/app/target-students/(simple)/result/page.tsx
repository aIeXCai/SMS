"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import type { Option, RuleForm, ResultData, ExamScopeType, Msg } from "./types";
import { EMPTY_RULE } from "./types";
import { parseParams, buildQueryString, buildPayload } from "./utils";
import ResultMessages from "./components/ResultMessages";
import ResultFilterBar from "./components/ResultFilterBar";
import type { DropdownKeys } from "./components/ResultFilterBar";
import ResultTable from "./components/ResultTable";
import ResultPageStyles from "./components/ResultPageStyles";

type ApiResp = { success?: boolean; data?: ResultData; error?: string };

function TargetStudentsResultContent() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState<RuleForm>(EMPTY_RULE);
  const [selectedExamIds, setSelectedExamIds] = useState<string[]>([]);
  const [examOptions, setExamOptions] = useState<Option[]>([]);
  const [gradeOptions, setGradeOptions] = useState<Option[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [result, setResult] = useState<ResultData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [sortField, setSortField] = useState<"avg_rank" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const pageSize = 100;
  const [drop, setDrop] = useState<Record<DropdownKeys, boolean>>({
    grade: false, examScope: false, exam: false, quantifier: false, absentPolicy: false,
  });

  useEffect(() => { if (!loading && !token) router.push("/login"); }, [loading, token, router]);
  // Parse URL params → init form → auto-trigger query
  useEffect(() => {
    if (!token) return;
    const raw = searchParams.toString();
    if (!raw) { router.push("/target-students"); return; }
    try {
      const { form: f, ids } = parseParams(new URLSearchParams(decodeURIComponent(raw)));
      setForm(f); setSelectedExamIds(ids);
      const t = parseInt(f.threshold, 10);
      if (!f.threshold || isNaN(t) || t <= 0) return;
      const payload = buildPayload(f, ids, t);
      setIsLoading(true); setResult(null); setCurrentPage(1);
      api.post<ApiResp>("/scores/target-students-query/", payload)
        .then((data) => {
          setResult(data.data ?? null);
          setMessages([{ id: Date.now(), type: data.success ? "success" : "danger",
            text: data.success ? `查询完成，共 ${data.data?.matched_count ?? 0} 名目标生` : (data.error || "查询失败") }]);
        })
        .catch(() => setMessages([{ id: Date.now(), type: "danger", text: "查询失败，请稍后重试" }]))
        .finally(() => setIsLoading(false));
    } catch { router.push("/target-students"); }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  // Fetch options
  useEffect(() => {
    if (!token) return;
    api.get<{ grade_levels: Option[] }>("/scores/options/").then((d) => setGradeOptions(d.grade_levels || [])).catch(console.error);
  }, [token]);
  useEffect(() => {
    if (!token || !form.grade_level) { setExamOptions([]); return; }
    api.get<{ exams: Option[] }>("/scores/options/", { grade_level: form.grade_level })
      .then((d) => setExamOptions(d.exams || [])).catch(console.error);
  }, [token, form.grade_level]);
  // Click outside → close dropdowns
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".custom-dropdown"))
        setDrop({ grade: false, examScope: false, exam: false, quantifier: false, absentPolicy: false });
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  // ── Handlers ──
  const toggleDrop = (key: DropdownKeys) => setDrop((p) => ({ ...p, [key]: !p[key] }));
  const onGradeChange = (v: string) => { setForm((p) => ({ ...p, grade_level: v, exam_scope: { type: p.exam_scope.type } })); setSelectedExamIds([]); };
  const onScopeChange = (type: ExamScopeType) => { setForm((p) => ({ ...p, exam_scope: { type } })); if (type !== "selected_exam_ids") setSelectedExamIds([]); };
  const onThresholdChange = (v: string) => { if (v === "" || /^\d+$/.test(v)) setForm((p) => ({ ...p, threshold: v })); };
  const onKChange = (v: string) => { if (v === "" || /^\d+$/.test(v)) setForm((p) => ({ ...p, k: v })); };
  const onQuantifierChange = (v: "all" | "at_least") => setForm((p) => ({ ...p, quantifier: v }));
  const onAbsentPolicyChange = (v: "strict_fail" | "ignore_absent") => setForm((p) => ({ ...p, absent_policy: v }));
  const onDateFromChange = (v: string) => setForm((p) => ({ ...p, exam_scope: { ...p.exam_scope, date_from: v } }));
  const onDateToChange = (v: string) => setForm((p) => ({ ...p, exam_scope: { ...p.exam_scope, date_to: v } }));
  const toggleExam = (id: string) => setSelectedExamIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const toggleAllExams = () => setSelectedExamIds((p) => (p.length === examOptions.length ? [] : examOptions.map((e) => e.value)));
  const allExamsSelected = examOptions.length > 0 && selectedExamIds.length === examOptions.length;
  const examText = selectedExamIds.length === 0 ? "请选择考试"
    : selectedExamIds.length === examOptions.length ? `全部考试 (${examOptions.length})`
    : selectedExamIds.length === 1 ? (examOptions.find((e) => e.value === selectedExamIds[0])?.label || "已选择 1 个考试")
    : `已选择 ${selectedExamIds.length} 个考试`;

  const handleQuery = () => {
    if (!form.grade_level) return setMessages([{ id: Date.now(), type: "info", text: "请选择年级" }]);
    const t = parseInt(form.threshold, 10);
    if (!form.threshold || isNaN(t) || t <= 0) return setMessages([{ id: Date.now(), type: "info", text: "前N名阈值必须为正整数" }]);
    if (form.exam_scope.type === "selected_exam_ids" && selectedExamIds.length === 0)
      return setMessages([{ id: Date.now(), type: "info", text: "请选择至少一个考试" }]);
    if (form.exam_scope.type === "date_range") {
      if (!form.exam_scope.date_from || !form.exam_scope.date_to) return setMessages([{ id: Date.now(), type: "info", text: "请填写完整的日期范围" }]);
      if (form.exam_scope.date_from > form.exam_scope.date_to) return setMessages([{ id: Date.now(), type: "info", text: "开始日期不能晚于结束日期" }]);
    }
    if (form.quantifier === "at_least") {
      const kn = parseInt(form.k, 10);
      if (!form.k || isNaN(kn) || kn <= 0) return setMessages([{ id: Date.now(), type: "info", text: "K值必须为正整数" }]);
    }
    const payload = buildPayload(form, selectedExamIds, t);
    router.push(`/target-students/result?${buildQueryString(form, selectedExamIds)}`);
    setIsLoading(true); setMessages([]); setResult(null); setCurrentPage(1);
    api.post<ApiResp>("/scores/target-students-query/", payload)
      .then((data) => {
        setResult(data.data ?? null);
        setMessages([{ id: Date.now(), type: data.success ? "success" : "danger",
          text: data.success ? `查询完成，共 ${data.data?.matched_count ?? 0} 名目标生` : (data.error || "查询失败") }]);
      })
      .catch(() => setMessages([{ id: Date.now(), type: "danger", text: "查询失败，请稍后重试" }]))
      .finally(() => setIsLoading(false));
  };

  const handleReset = () => { setForm(EMPTY_RULE); setSelectedExamIds([]); setResult(null); setMessages([]); router.push("/target-students"); };

  const sortedStudents = useMemo(() => {
    if (!result?.students) return [];
    const list = [...result.students];
    if (sortField === "avg_rank")
      list.sort((a, b) => (a.avg_rank === null ? 1 : b.avg_rank === null ? -1 :
        sortDirection === "asc" ? a.avg_rank - b.avg_rank : b.avg_rank - a.avg_rank));
    return list;
  }, [result, sortField, sortDirection]);

  const paginatedStudents = useMemo(() => sortedStudents.slice((currentPage - 1) * pageSize, (currentPage - 1) * pageSize + pageSize), [sortedStudents, currentPage, pageSize]);
  const totalPages = useMemo(() => Math.max(1, Math.ceil(sortedStudents.length / pageSize)), [sortedStudents, pageSize]);

  const handleSort = () => {
    if (sortField === "avg_rank") setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField("avg_rank"); setSortDirection("asc"); }
  };

  if (loading) return <div className="p-4">加载中...</div>;
  if (!user) return null;

  return (
    <div>
      <div className="page-header">
        <div className="w-full px-4 mx-auto max-w-[1400px]">
          <div className="flex flex-wrap items-center">
            <div className="flex-1">
              <h1><i className="fas fa-bullseye mr-3"></i>目标生筛选结果</h1>
              <p className="mb-0 opacity-75">查看筛选结果或调整条件继续查询</p>
            </div>
            <div className="flex-shrink-0 text-right">
              <Link href="/target-students" className="secondary-action">
                <i className="fas fa-arrow-left mr-2"></i>返回筛选
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-4 mx-auto max-w-[1400px]">
        <ResultMessages messages={messages} onDismiss={(id) => setMessages((p) => p.filter((m) => m.id !== id))} />
        <ResultFilterBar
          form={form} gradeOptions={gradeOptions} examOptions={examOptions}
          selectedExamIds={selectedExamIds} allExamsSelected={allExamsSelected}
          selectedExamText={examText} drop={drop} isLoading={isLoading}
          onToggleDrop={toggleDrop} onGradeChange={onGradeChange}
          onExamScopeTypeChange={onScopeChange} onThresholdChange={onThresholdChange}
          onKChange={onKChange} onQuantifierChange={onQuantifierChange}
          onAbsentPolicyChange={onAbsentPolicyChange} onDateFromChange={onDateFromChange}
          onDateToChange={onDateToChange} onToggleExamSelection={toggleExam}
          onToggleAllExams={toggleAllExams} onQuery={handleQuery} onReset={handleReset}
        />
        {result && (
          <ResultTable result={result} students={paginatedStudents} currentPage={currentPage}
            pageSize={pageSize} totalPages={totalPages} sortField={sortField}
            sortDirection={sortDirection} onSort={handleSort} onPageChange={setCurrentPage} />
        )}
        <button type="button"
          className="bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg hover:bg-blue-700 transition-colors fixed bottom-0 right-0 m-4"
          style={{ zIndex: 1000 }} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <i className="fas fa-arrow-up"></i>
        </button>
      </div>
      <ResultPageStyles />
    </div>
  );
}

export default function TargetStudentsResultPage() {
  return (
    <Suspense fallback={<div className="p-4">加载中...</div>}>
      <TargetStudentsResultContent />
    </Suspense>
  );
}

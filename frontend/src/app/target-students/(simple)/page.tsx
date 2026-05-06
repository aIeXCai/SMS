"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

import type { Option, RuleForm, ExamScopeType, Message } from "./types";
import { EMPTY_RULE } from "./types";
import { validateAndBuildQuery } from "./validation";
import MessagesPanel from "./components/MessagesPanel";
import FilterForm from "./components/FilterForm";
import InstructionsPanel from "./components/InstructionsPanel";
import FeatureCards from "./components/FeatureCards";
import SimplePageStyles from "./components/SimplePageStyles";

type DropdownKey = "grade" | "examScope" | "exam" | "quantifier" | "absentPolicy";

export default function TargetStudentsPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState<RuleForm>(EMPTY_RULE);
  const [examOptions, setExamOptions] = useState<Option[]>([]);
  const [gradeOptions, setGradeOptions] = useState<Option[]>([]);
  const [selectedExamIds, setSelectedExamIds] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [open, setOpen] = useState<Record<DropdownKey, boolean>>({
    grade: false, examScope: false, exam: false, quantifier: false, absentPolicy: false,
  });

  // ── Auth guard ──
  useEffect(() => { if (!loading && !token) router.push("/login"); }, [loading, token, router]);

  // ── Fetch options ──
  useEffect(() => {
    if (!token) return;
    api.get<{ grade_levels: Option[] }>("/scores/options/")
      .then((d) => setGradeOptions(d.grade_levels || []))
      .catch(console.error);
  }, [token]);

  useEffect(() => {
    if (!token || !form.grade_level) { setExamOptions([]); return; }
    api.get<{ exams: Option[] }>("/scores/options/", { grade_level: form.grade_level })
      .then((d) => setExamOptions(d.exams || []))
      .catch(console.error);
  }, [token, form.grade_level]);

  // ── Click outside closes all dropdowns ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".custom-dropdown"))
        setOpen({ grade: false, examScope: false, exam: false, quantifier: false, absentPolicy: false });
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Helpers ──
  const toggle = (key: DropdownKey) => () => setOpen((p) => ({ ...p, [key]: !p[key] }));
  const close = (key: DropdownKey) => setOpen((p) => ({ ...p, [key]: false }));

  // ── Form handlers ──
  const handleGradeChange = (v: string) => {
    setForm((p) => ({ ...p, grade_level: v, exam_scope: { type: p.exam_scope.type } }));
    setSelectedExamIds([]);
    close("grade");
  };

  const handleExamScopeChange = (v: string) => {
    const type = v as ExamScopeType;
    setForm((p) => ({ ...p, exam_scope: { type } }));
    if (type !== "selected_exam_ids") setSelectedExamIds([]);
    close("examScope");
  };

  const handleThresholdChange = (v: string) => {
    if (v === "" || /^\d+$/.test(v)) setForm((p) => ({ ...p, threshold: v }));
  };

  const handleKChange = (v: string) => {
    if (v === "" || /^\d+$/.test(v)) setForm((p) => ({ ...p, k: v }));
  };

  const handleQuantifierChange = (v: "all" | "at_least") => {
    setForm((p) => ({ ...p, quantifier: v }));
    close("quantifier");
  };

  const handleAbsentPolicyChange = (v: "strict_fail" | "ignore_absent") => {
    setForm((p) => ({ ...p, absent_policy: v }));
    close("absentPolicy");
  };

  const handleDateFromChange = (v: string) =>
    setForm((p) => ({ ...p, exam_scope: { ...p.exam_scope, date_from: v } }));

  const handleDateToChange = (v: string) =>
    setForm((p) => ({ ...p, exam_scope: { ...p.exam_scope, date_to: v } }));

  const toggleExamSelection = (id: string) =>
    setSelectedExamIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const toggleAllExams = () =>
    setSelectedExamIds((p) =>
      p.length === examOptions.length ? [] : examOptions.map((e) => e.value));

  const handleQuery = () => {
    const result = validateAndBuildQuery(form, selectedExamIds);
    if (!result.ok) { setMessages([result.message]); return; }
    router.push(`/target-students/result?${result.params.toString()}`);
  };

  const handleReset = () => {
    setForm(EMPTY_RULE);
    setSelectedExamIds([]);
    setMessages([]);
  };

  // ── Computed ──
  const allExamsSelected = examOptions.length > 0 && selectedExamIds.length === examOptions.length;
  const selectedExamText = (() => {
    if (selectedExamIds.length === 0) return "请选择考试";
    if (selectedExamIds.length === examOptions.length) return `全部考试 (${examOptions.length})`;
    if (selectedExamIds.length === 1)
      return examOptions.find((e) => e.value === selectedExamIds[0])?.label || "已选择 1 个考试";
    return `已选择 ${selectedExamIds.length} 个考试`;
  })();

  if (loading) return <div className="p-4">加载中...</div>;
  if (!user) return null;

  return (
    <div>
      <div className="page-header">
        <div className="w-full px-4 mx-auto max-w-[1400px]">
          <div className="flex flex-wrap items-center">
            <div className="w-full md:w-2/3">
              <h1><i className="fas fa-bullseye mr-3"></i>目标生筛选</h1>
              <p className="mb-0 opacity-75">基于成绩排名自动识别目标学生</p>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-4 mx-auto max-w-[1400px]">
        <MessagesPanel messages={messages} onDismiss={(id) => setMessages((p) => p.filter((m) => m.id !== id))} />

        <FilterForm
          form={form}
          gradeOptions={gradeOptions}
          examOptions={examOptions}
          selectedExamIds={selectedExamIds}
          allExamsSelected={allExamsSelected}
          selectedExamText={selectedExamText}
          open={open}
          onToggle={toggle}
          onGradeChange={handleGradeChange}
          onExamScopeChange={handleExamScopeChange}
          onThresholdChange={handleThresholdChange}
          onKChange={handleKChange}
          onQuantifierChange={handleQuantifierChange}
          onAbsentPolicyChange={handleAbsentPolicyChange}
          onDateFromChange={handleDateFromChange}
          onDateToChange={handleDateToChange}
          onToggleExam={toggleExamSelection}
          onToggleAllExams={toggleAllExams}
          onQuery={handleQuery}
          onReset={handleReset}
        />

        <InstructionsPanel />
        <FeatureCards />

        <button type="button"
          className="bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg hover:bg-blue-700 transition-colors fixed bottom-0 right-0 m-4"
          style={{ zIndex: 1000 }}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <i className="fas fa-arrow-up"></i>
        </button>
      </div>

      <SimplePageStyles />
    </div>
  );
}

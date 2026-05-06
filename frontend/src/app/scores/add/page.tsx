"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { canWriteScores } from "@/lib/permissions";

import type { StudentItem, ScoreOptions, DuplicateInfo, ResultModalState } from "./types";
import { INITIAL_RESULT_MODAL } from "./types";
import PageHeader from "./components/PageHeader";
import StudentSelector from "./components/StudentSelector";
import ScoreGrid from "./components/ScoreGrid";
import ErrorBanner from "./components/ErrorBanner";
import ResultModal from "./components/ResultModal";
import AddPageStyles from "./components/AddPageStyles";

export default function ScoreAddPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const canScoreWrite = canWriteScores(user);

  const [options, setOptions] = useState<ScoreOptions | null>(null);
  const [studentQuery, setStudentQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<StudentItem[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentItem | null>(null);
  const [selectedExam, setSelectedExam] = useState("");
  const [scores, setScores] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateInfo | null>(null);
  const [resultModal, setResultModal] = useState<ResultModalState>(INITIAL_RESULT_MODAL);

  // ── Auth guards ──
  useEffect(() => {
    if (!loading && !token) { router.push("/login"); return; }
    if (!loading && user && !canScoreWrite) router.replace("/scores");
  }, [loading, token, user, canScoreWrite, router]);

  // ── Fetch options (exams + subjects) ──
  useEffect(() => {
    if (!token) return;
    api.get<ScoreOptions>("/scores/options/")
      .then((data) => setOptions({ exams: data.exams || [], subjects: data.subjects || [] }))
      .catch(console.error);
  }, [token]);

  // ── Student search with debounce ──
  useEffect(() => {
    const q = studentQuery.trim();
    if (!q || selectedStudent?.display === studentQuery) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const data = await api.get<{ results: StudentItem[] }>("/scores/student-search/", { q });
        setSearchResults(data.results || []);
      } catch (e) { console.error(e); setSearchResults([]); }
      finally { setSearchLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [studentQuery, selectedStudent]);

  // ── Helpers ──
  const showError = (message: string, title: string, subtitle: string) => {
    setErrorMessage(message);
    setResultModal({ show: true, type: "error", title, subtitle, message });
  };

  // ── Handlers ──
  const handleStudentQueryChange = (v: string) => { setStudentQuery(v); setSelectedStudent(null); };

  const handleSelectStudent = (s: StudentItem) => {
    setSelectedStudent(s); setStudentQuery(s.display); setSearchResults([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null); setDuplicateInfo(null);
    if (!selectedStudent) return showError("请选择学生", "输入错误", "缺少必要信息");
    if (!selectedExam)     return showError("请选择考试", "输入错误", "缺少必要信息");
    const hasAny = (options?.subjects || []).some((s) => (scores[s.value] || "").trim() !== "");
    if (!hasAny) return showError("请至少输入一个科目的成绩", "输入错误", "请补充成绩后重试");

    const payloadScores: Record<string, string> = {};
    (options?.subjects || []).forEach((s) => {
      const val = (scores[s.value] || "").trim();
      if (val) payloadScores[s.value] = val;
    });

    try {
      setSubmitting(true);
      const data = await api.post<{
        success?: boolean; message?: string; detail?: string; code?: string;
        duplicate_subjects?: string[]; student_id?: number; exam_id?: number;
      }>("/scores/manual-add/", { student_id: selectedStudent.id, exam_id: selectedExam, scores: payloadScores });

      if (!data.success) {
        if (data.code === "duplicate_scores") {
          setDuplicateInfo({ duplicate_subjects: data.duplicate_subjects || [], student_id: data.student_id ?? 0, exam_id: data.exam_id ?? 0 });
        }
        return showError(data.message || data.detail || "保存失败",
          "保存失败", data.code === "duplicate_scores" ? "检测到重复录入" : "操作未完成");
      }

      setResultModal({ show: true, type: "success", title: "保存成功", subtitle: "成绩已录入", message: data.message || "成绩已成功保存。" });
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "网络错误，请稍后重试";
      showError(msg, "保存失败", "网络或服务器异常");
    } finally { setSubmitting(false); }
  };

  const closeResultModal = () => {
    const shouldGoBack = resultModal.show && resultModal.type === "success";
    setResultModal((prev) => ({ ...prev, show: false }));
    if (shouldGoBack) router.push("/scores");
  };

  if (loading) return <div className="p-4">加载中...</div>;
  if (!user || !canScoreWrite) return null;

  return (
    <div>
      <PageHeader />

      <div className="w-full px-4 mx-auto max-w-[1400px]">
        <div className="help-alert" role="alert">
          <i className="fas fa-lightbulb mr-2"></i>
          <strong>操作提示：</strong>选择学生和考试后，输入各科成绩，留空表示不录入该科目。
        </div>

        <div className="form-card">
          <div className="form-card-header">
            <h5 className="mb-0"><i className="fas fa-edit mr-2"></i>成绩录入表单</h5>
          </div>
          <div className="form-card-body">
            <form onSubmit={handleSubmit}>
              <div className="flex flex-wrap mb-4">
                <div className="w-full md:w-1/2">
                  <StudentSelector studentQuery={studentQuery} searchLoading={searchLoading}
                    searchResults={searchResults} onQueryChange={handleStudentQueryChange}
                    onSelect={handleSelectStudent} />
                </div>
                <div className="w-full md:w-1/2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <i className="fas fa-clipboard-list mr-1"></i>选择考试 <span className="text-red-600">*</span>
                  </label>
                  <select className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    value={selectedExam} onChange={(e) => setSelectedExam(e.target.value)}>
                    <option value="">--- 选择考试 ---</option>
                    {(options?.exams || []).map((exam) => (
                      <option key={exam.value} value={exam.value}>{exam.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <ScoreGrid subjects={options?.subjects || []} scores={scores}
                onUpdateScore={(subject, value) => setScores((prev) => ({ ...prev, [subject]: value }))} />

              <ErrorBanner errorMessage={errorMessage} duplicateInfo={duplicateInfo} />

              <div className="flex justify-between items-center pt-3 border-t">
                <div className="text-gray-500 text-sm">
                  <i className="fas fa-info-circle mr-1"></i>提示：留空的科目将不会被录入系统
                </div>
                <div>
                  <Link href="/scores" className="btn-cancel mr-2">
                    <i className="fas fa-times mr-1"></i>取消
                  </Link>
                  <button type="submit" className="btn-save" disabled={submitting}>
                    <i className="fas fa-save mr-1"></i>{submitting ? "保存中..." : "保存成绩"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      <ResultModal modal={resultModal} duplicateInfo={duplicateInfo} onClose={closeResultModal} />
      <AddPageStyles />
    </div>
  );
}

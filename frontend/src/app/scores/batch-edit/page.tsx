"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { canWriteScores } from "@/lib/permissions";

import type { SubjectOption, EditDetail, ResultModalState } from "./types";
import { EMPTY_RESULT_MODAL } from "./types";
import PageHeader from "./components/PageHeader";
import HelpAlert from "./components/HelpAlert";
import StudentInfoCard from "./components/StudentInfoCard";
import ScoreForm from "./components/ScoreForm";
import ResultModal from "./components/ResultModal";

export default function ScoreBatchEditPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const canScoreWrite = canWriteScores(user);
  const [studentId, setStudentId] = useState("");
  const [examId, setExamId] = useState("");
  const [paramsReady, setParamsReady] = useState(false);
  const [detail, setDetail] = useState<EditDetail | null>(null);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resultModal, setResultModal] = useState<ResultModalState>(EMPTY_RESULT_MODAL);

  // ── Auth guard ──
  useEffect(() => { if (!loading && !token) router.push("/login"); }, [loading, token, router]);
  useEffect(() => { if (!loading && user && !canScoreWrite) router.replace("/scores"); }, [loading, user, canScoreWrite, router]);

  // ── Read URL params ──
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    setStudentId(p.get("student") || p.get("student_id") || "");
    setExamId(p.get("exam") || p.get("exam_id") || "");
    setParamsReady(true);
  }, []);

  // ── Fetch edit detail ──
  useEffect(() => {
    if (!token || !paramsReady) return;
    if (!studentId || !examId) {
      setErrorMessage("缺少必要参数：学生ID或考试ID");
      setLoadingData(false);
      return;
    }
    (async () => {
      try {
        setLoadingData(true);
        setErrorMessage(null);
        const res = await api.get<{ success?: boolean; message?: string } & EditDetail>(
          '/scores/batch-edit-detail/', { student: studentId, exam: examId }
        ) as { success?: boolean; message?: string } & EditDetail;

        if (!res.success) {
          setErrorMessage(res.message || "加载编辑信息失败");
          return;
        }
        setDetail(res);
        const init: Record<string, string> = {};
        (res.subjects || []).forEach((s: SubjectOption) => {
          const v = res.existing_scores?.[s.value];
          init[s.value] = v === undefined || v === null ? "" : String(v);
        });
        setScores(init);
      } catch (e) {
        console.error(e);
        setErrorMessage("加载编辑信息失败");
      } finally {
        setLoadingData(false);
      }
    })();
  }, [token, studentId, examId, paramsReady]);

  // ── Handlers ──
  const handleScoreChange = (code: string, value: string) =>
    setScores((prev) => ({ ...prev, [code]: value }));

  const validateScores = (): string | null => {
    if (!detail) return "页面数据未加载完成";
    if (!detail.subjects.some((s) => (scores[s.value] || "").trim() !== "")) {
      return "请至少输入一门科目的成绩后再保存。";
    }
    for (const s of detail.subjects) {
      const raw = (scores[s.value] || "").trim();
      if (!raw) continue;
      const n = Number(raw);
      const max = Number(detail.subject_max_scores?.[s.value] ?? 100);
      if (Number.isNaN(n) || n < 0 || n > max) return `${s.label}的分数必须在0-${max}分之间，请检查后重试。`;
    }
    return null;
  };

  const showErrorModal = (title: string, subtitle: string, message: string) => {
    setErrorMessage(message);
    setResultModal({ show: true, type: "error", title, subtitle, message });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const err = validateScores();
    if (err) return showErrorModal("输入错误", "请检查分数后重试", err);
    if (!detail) return;

    try {
      setSaving(true);
      const data = await api.post<{ success?: boolean; message?: string }>('/scores/batch-edit-save/', {
        student_id: detail.student.id, exam_id: detail.exam.id, scores,
      });
      if (!data.success) return showErrorModal("保存失败", "操作未完成", data.message || "保存失败");
      setResultModal({ show: true, type: "success", title: "保存成功", subtitle: "成绩已更新", message: data.message || "成绩已成功保存并更新排名。" });
    } catch (e) {
      console.error(e);
      showErrorModal("保存失败", "网络或服务器异常", "保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  const closeResultModal = () => {
    if (resultModal.show && resultModal.type === "success") router.push("/scores");
    setResultModal((prev) => ({ ...prev, show: false }));
  };

  // ── Early returns ──
  if (loading || loadingData) return <div className="p-4">加载中...</div>;
  if (!user) return null;
  if (!canScoreWrite) return null;

  // ── Render ──
  return (
    <div>
      <PageHeader />
      <div className="w-full px-4 mx-auto max-w-[1400px]">
        <HelpAlert />
        {errorMessage && <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded mb-4">{errorMessage}</div>}
        {detail && (
          <>
            <StudentInfoCard detail={detail} />
            <ScoreForm detail={detail} scores={scores} saving={saving} onScoreChange={handleScoreChange} onSubmit={handleSubmit} />
          </>
        )}
      </div>
      <ResultModal resultModal={resultModal} onClose={closeResultModal} />
    </div>
  );
}

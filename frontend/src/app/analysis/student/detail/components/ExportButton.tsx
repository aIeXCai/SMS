"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { AnalysisData } from "./types";

type Props = {
  studentId: string;
  disabled: boolean;
  studentInfo: AnalysisData["student_info"] | undefined;
};

function parseFileName(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback;
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try { return decodeURIComponent(utf8Match[1]).replace(/^"|"$/g, ""); } catch { return utf8Match[1].replace(/^"|"$/g, ""); }
  }
  const normalMatch = disposition.match(/filename=([^;]+)/i);
  if (normalMatch?.[1]) return normalMatch[1].trim().replace(/^"|"$/g, "");
  return fallback;
}

export default function ExportButton({ studentId, disabled, studentInfo }: Props) {
  const [isExporting, setIsExporting] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "danger"; text: string } | null>(null);

  const handleExport = async () => {
    if (!studentId || isExporting) return;
    setIsExporting(true);
    setNotice(null);
    try {
      const resp = await api.downloadBlob('/scores/student-analysis-report-export/', { student_id: studentId });
      if (!resp.ok) {
        let msg = "导出失败，请稍后重试。";
        try {
          const err = await resp.json();
          if (err?.error) msg = err.error;
        } catch {
          if (resp.status === 404) msg = "学生不存在，无法导出。";
          if (resp.status === 400) msg = "该学生暂无可导出的分析数据。";
        }
        throw new Error(msg);
      }

      const blob = await resp.blob();
      if (!blob || blob.size === 0) throw new Error("导出文件为空，请稍后重试。");

      const disposition = resp.headers.get("Content-Disposition") || resp.headers.get("content-disposition");
      const fallback = `${studentInfo?.grade_level || ""}${studentInfo?.class_name || ""}${studentInfo?.name || "未知学生"}个人成绩分析报告.xlsx`;
      const fileName = parseFileName(disposition, fallback);

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = fileName;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);

      setNotice({ type: "success", text: "导出成功，文件已开始下载。" });
    } catch (error) {
      setNotice({ type: "danger", text: error instanceof Error ? error.message : "导出失败，请稍后重试。" });
    } finally { setIsExporting(false); }
  };

  const alertClass = notice
    ? notice.type === "success"
      ? "bg-green-50 border border-green-200 text-green-800 p-4 rounded mb-3"
      : "bg-red-50 border border-red-200 text-red-800 p-4 rounded mb-3"
    : "";

  return (
    <>
      <button type="button" className="btn-export" onClick={handleExport} disabled={disabled || isExporting}>
        <i className={`fas ${isExporting ? "fa-spinner fa-spin" : "fa-file-excel"} mr-2`}></i>
        {isExporting ? "导出中..." : "导出个人报告"}
      </button>
      {notice && (
        <div className={`fixed top-4 right-4 z-50 shadow-lg ${alertClass}`} role="alert">
          <i className={`fas ${notice.type === "success" ? "fa-check-circle" : "fa-exclamation-circle"} mr-2`}></i>
          {notice.text}
          <button type="button" className="ml-3 bg-transparent border-none cursor-pointer opacity-50 hover:opacity-100" onClick={() => setNotice(null)}>&times;</button>
        </div>
      )}
    </>
  );
}

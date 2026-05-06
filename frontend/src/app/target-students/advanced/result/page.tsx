"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import * as XLSX from "xlsx";
import { FilterCondition, FilterLogic } from "../components/FilterBuilder";
import FilterResults from "../components/FilterResults";

type Option = { value: string; label: string };

type ConditionColumn = {
  index: number;
  subject: string;
  subject_label: string;
  dimension: "grade" | "class";
};

type StudentConditionDetail = {
  condition_index: number;
  subject: string;
  subject_label: string;
  score: number | null;
  rank: number | null;
};

type FilterStudent = {
  student_id: number;
  student_number: string;
  name: string;
  cohort: string;
  class_name: string;
  total_rank: number | null;
  condition_details: StudentConditionDetail[];
};

type AdvancedFilterResult = {
  count: number;
  logic: FilterLogic;
  condition_columns: ConditionColumn[];
  students: FilterStudent[];
};

const resolveErrorMessage = (payload: unknown, fallback: string) => {
  if (!payload || typeof payload !== "object") return fallback;

  const data = payload as Record<string, unknown>;

  if (typeof data.message === "string" && data.message.trim()) {
    return data.message;
  }

  if (typeof data.detail === "string" && data.detail.trim()) {
    return data.detail;
  }

  if (
    Array.isArray(data.non_field_errors) &&
    data.non_field_errors.length > 0 &&
    typeof data.non_field_errors[0] === "string"
  ) {
    return data.non_field_errors[0];
  }

  for (const value of Object.values(data)) {
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === "string") {
      return value[0];
    }
  }

  return fallback;
};

function AdvancedTargetStudentsResultContent() {
  const { token, loading, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [logic, setLogic] = useState<FilterLogic>("AND");
  const [conditions, setConditions] = useState<FilterCondition[]>([]);
  const [gradeLevel, setGradeLevel] = useState("");
  const [examId, setExamId] = useState("");
  const [gradeOptions, setGradeOptions] = useState<Option[]>([]);
  const [examOptions, setExamOptions] = useState<Option[]>([]);
  const [result, setResult] = useState<AdvancedFilterResult | null>(null);
  const [messages, setMessages] = useState<
    Array<{ id: number; type: "success" | "danger" | "info"; text: string }>
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingSnapshot, setIsSavingSnapshot] = useState(false);
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);
  const [snapshotNameDraft, setSnapshotNameDraft] = useState("");

  useEffect(() => {
    if (!loading && !token) {
      router.push("/login");
    }
  }, [loading, token, router]);

  useEffect(() => {
    const parsedExamId = searchParams.get("exam_id") || "";
    const parsedGradeLevel = searchParams.get("grade_level") || "";
    const parsedLogic = (searchParams.get("logic") || "AND").toUpperCase();
    const parsedConditionsRaw = searchParams.get("conditions") || "[]";

    if (!parsedExamId || !parsedGradeLevel) {
      router.push("/target-students/advanced");
      return;
    }

    try {
      const parsedConditions = JSON.parse(parsedConditionsRaw) as FilterCondition[];
      setExamId(parsedExamId);
      setGradeLevel(parsedGradeLevel);
      setLogic(parsedLogic === "OR" ? "OR" : "AND");
      setConditions(parsedConditions);
    } catch {
      router.push("/target-students/advanced");
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (!token) return;

    const fetchGradeOptions = async () => {
      try {
        const data = await api.get<{ grade_levels: Option[] }>('/scores/options/');
        setGradeOptions(data.grade_levels || []);
      } catch (error) {
        console.error("Failed to fetch grade options:", error);
      }
    };

    fetchGradeOptions();
  }, [token]);

  useEffect(() => {
    if (!token || !gradeLevel) {
      setExamOptions([]);
      return;
    }

    const fetchExamOptions = async () => {
      try {
        const data = await api.get<{ exams: Option[] }>('/scores/options/', { grade_level: gradeLevel });
        setExamOptions(data.exams || []);
      } catch (error) {
        console.error("Failed to fetch exam options:", error);
      }
    };

    fetchExamOptions();
  }, [token, gradeLevel]);

  useEffect(() => {
    if (!token || !examId || conditions.length === 0) return;

    const fetchResult = async () => {
      setIsLoading(true);
      setMessages([]);
      setResult(null);

      try {
        const data = await api.post<AdvancedFilterResult>('/students/advanced-filter/', {
          exam_id: Number(examId),
          logic,
          conditions,
        });

        setResult(data);
        setMessages([{ id: Date.now(), type: "success", text: `筛选完成，共 ${data.count} 名目标生` }]);
      } catch (error) {
        console.error("Advanced filter failed:", error);
        setMessages([{ id: Date.now(), type: "danger", text: "筛选失败，请稍后重试" }]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResult();
  }, [token, examId, logic, conditions]);

  const examLabel = useMemo(() => {
    return examOptions.find((item) => item.value === examId)?.label || examId;
  }, [examOptions, examId]);

  const buildDefaultSnapshotName = () => {
    const now = new Date();
    return `高级筛选快照_${examLabel}_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  };

  const handleExportExcel = () => {
    if (!result || result.students.length === 0) {
      setMessages([{ id: Date.now(), type: "info", text: "暂无可导出的筛选结果" }]);
      return;
    }

    const headers = ["序号", "姓名", "入学年级", "班级"];
    result.condition_columns.forEach((column) => {
      headers.push(column.subject_label);
      headers.push(`${column.subject_label}排名`);
    });

    const rows = result.students.map((student, index) => {
      const row: Record<string, string | number> = {
        序号: index + 1,
        姓名: student.name,
        入学年级: student.cohort || "-",
        班级: student.class_name || "-",
      };

      result.condition_columns.forEach((column) => {
        const detail = student.condition_details.find((item) => item.condition_index === column.index);
        const score = detail?.score;
        const rank = detail?.rank;

        row[column.subject_label] =
          score === null || score === undefined
            ? "-"
            : Number.isInteger(score)
              ? score
              : Number(score.toFixed(1));
        row[`${column.subject_label}排名`] =
          rank === null || rank === undefined ? "-" : rank;
      });

      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "高级筛选结果");

    const now = new Date();
    const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const fileName = `高级筛选结果_${examLabel}_${datePart}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const openSnapshotModal = () => {
    if (!result || result.students.length === 0) {
      setMessages([{ id: Date.now(), type: "info", text: "暂无可保存的筛选结果" }]);
      return;
    }

    setSnapshotNameDraft(buildDefaultSnapshotName());
    setShowSnapshotModal(true);
  };

  const handleSaveSnapshot = async (goToTrackingAfterSave: boolean) => {
    const snapshotName = snapshotNameDraft.trim();

    if (!snapshotName) {
      setMessages([{ id: Date.now(), type: "danger", text: "快照名称不能为空" }]);
      return;
    }

    if (!result || result.students.length === 0) {
      setMessages([{ id: Date.now(), type: "info", text: "暂无可保存的筛选结果" }]);
      setShowSnapshotModal(false);
      return;
    }

    try {
      setIsSavingSnapshot(true);
      const studentIds = result.students.map((student) => student.student_id);

      const data = await api.post<{ id?: number }>('/filter-snapshots/', {
        snapshot_name: snapshotName,
        exam_id: Number(examId),
        rule_config_snapshot: {
          logic,
          conditions,
        },
        result_snapshot: {
          student_ids: studentIds,
          count: studentIds.length,
        },
      });

      setMessages([
        {
          id: Date.now(),
          type: "success",
          text: `快照"${snapshotName}"已保存，可在变化追踪页发起对比`,
        },
      ]);
      setShowSnapshotModal(false);

      const snapshotId =
        data && typeof data === "object" && "id" in data && typeof data.id === "number"
          ? data.id
          : null;
      if (goToTrackingAfterSave) {
        const targetPath = snapshotId
          ? `/target-students/tracking?snapshot_id=${snapshotId}`
          : "/target-students/tracking";
        router.push(targetPath);
      }
    } catch (error) {
      console.error("Save snapshot failed:", error);
      const msg = error instanceof Error ? error.message : "保存快照失败，请稍后重试";
      setMessages([{ id: Date.now(), type: "danger", text: msg }]);
    } finally {
      setIsSavingSnapshot(false);
    }
  };

  if (loading) return <div className="p-4">加载中...</div>;
  if (!user) return null;

  return (
    <div>
      <div className="page-header">
        <div className="w-full px-4 mx-auto max-w-[1400px]">
          <div className="flex flex-wrap items-center">
            <div className="flex-1">
              <h1>
                <i className="fas fa-bullseye mr-3"></i>高级筛选结果
              </h1>
              <p className="mb-0 opacity-75">查看高级筛选结果或返回调整筛选条件</p>
            </div>
            <div className="flex-shrink-0 text-right">
              <Link href="/target-students/advanced" className="secondary-action">
                <i className="fas fa-arrow-left mr-2"></i>返回高级筛选
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-4 mx-auto max-w-[1400px]">
        {messages.length > 0 && (
          <div className="mb-3">
            {messages.map((msg) => {
              const alertStyles: Record<string, string> = {
                success: "bg-green-50 border border-green-200 text-green-800 p-4 rounded",
                danger: "bg-red-50 border border-red-200 text-red-800 p-4 rounded",
                info: "bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded",
              };
              return (
                <div key={msg.id} className={alertStyles[msg.type] || alertStyles.info} role="alert">
                  <i className="fas fa-info-circle mr-2"></i>
                  {msg.text}
                  <button type="button" className="bg-transparent border-none text-current opacity-50 hover:opacity-100 cursor-pointer text-lg leading-none ml-2" onClick={() => setMessages((prev) => prev.filter((m) => m.id !== msg.id))}></button>
                </div>
              );
            })}
          </div>
        )}

        <div className="bg-white rounded-lg shadow filter-card mb-3">
          <div className="px-4 py-3 border-b border-gray-200">
            <h5 className="mb-0"><i className="fas fa-sliders-h mr-2"></i>本次筛选条件</h5>
          </div>
          <div className="p-4">
            <div className="flex flex-wrap gap-3">
              <div className="w-full md:w-1/4">
                <label className="block text-sm font-medium text-gray-700 mb-1">年级</label>
                <input className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" value={gradeOptions.find((item) => item.value === gradeLevel)?.label || gradeLevel} disabled />
              </div>
              <div className="w-full md:w-1/4">
                <label className="block text-sm font-medium text-gray-700 mb-1">考试</label>
                <input className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" value={examLabel} disabled />
              </div>
              <div className="w-full md:w-1/4">
                <label className="block text-sm font-medium text-gray-700 mb-1">逻辑关系</label>
                <input className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" value={logic === "AND" ? "AND（同时满足）" : "OR（满足其一）"} disabled />
              </div>
              <div className="w-full">
                <label className="block text-sm font-medium text-gray-700 mb-1">条件列表</label>
                <div className="flex flex-wrap gap-2">
                  {conditions.map((condition, index) => {
                    const subjectLabelMap: Record<string, string> = {
                      total: "总分",
                      chinese: "语文",
                      math: "数学",
                      english: "英语",
                      physics: "物理",
                      chemistry: "化学",
                      biology: "生物",
                      history: "历史",
                      geography: "地理",
                      politics: "政治",
                    };
                    const dimensionLabel = condition.dimension === "grade" ? "年级" : "班级";
                    const operatorLabelMap: Record<string, string> = {
                      top_n: "前",
                      bottom_n: "后",
                      range: "区间",
                    };
                    const valueText = Array.isArray(condition.value)
                      ? `${condition.value[0]}-${condition.value[1]}`
                      : `${condition.value}`;

                    return (
                      <span key={condition.id} className="text-xs px-2 py-0.5 rounded bg-gray-100 border border-gray-300 text-gray-800">
                        条件{index + 1}：{subjectLabelMap[condition.subject] || condition.subject} · {dimensionLabel}
                        {operatorLabelMap[condition.operator] || condition.operator} {valueText}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow filter-card mt-3">
          <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <h5 className="mb-0"><i className="fas fa-list mr-2"></i>筛选结果</h5>
              <span className="bg-blue-100 text-blue-800 text-base px-2 py-0.5 rounded">
                共 {result?.count || 0} 名目标生
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 transition-colors text-sm"
                onClick={openSnapshotModal}
                disabled={isLoading || isSavingSnapshot || !result || result.students.length === 0}
              >
                <i className="fas fa-save mr-1"></i>
                {isSavingSnapshot ? "保存中..." : "保存为快照"}
              </button>
              <button
                type="button"
                className="bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 transition-colors text-sm"
                onClick={handleExportExcel}
                disabled={isLoading || !result || result.students.length === 0}
              >
                <i className="fas fa-file-excel mr-1"></i>导出 Excel
              </button>
              <button
                type="button"
                className="border border-blue-300 text-blue-600 px-2 py-1 rounded hover:bg-blue-50 transition-colors text-sm"
                onClick={() => router.push("/target-students/tracking")}
              >
                <i className="fas fa-chart-line mr-1"></i>前往变化追踪
              </button>
            </div>
          </div>
          <div className="p-4">
            {isLoading ? (
              <div className="text-center py-5 text-gray-500">
                <span className="animate-spin h-3 w-3 border-2 border-blue-600 border-t-transparent rounded-full mr-2 inline-block align-[-0.125em]"></span>
                正在筛选中...
              </div>
            ) : (
              <FilterResults
                students={result?.students || []}
                columns={result?.condition_columns || []}
              />
            )}
          </div>
        </div>

        <button type="button" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors fixed bottom-0 right-0 m-4" style={{ zIndex: 1000 }} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <i className="fas fa-arrow-up"></i>
        </button>
      </div>

        {showSnapshotModal && (
          <>
            <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
              <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
                  <h5 className="font-bold text-gray-900 text-lg">
                    <i className="fas fa-save mr-2 text-blue-600"></i>
                    保存筛选快照
                  </h5>
                  <button
                    type="button"
                    className="bg-transparent border-none text-xl leading-none opacity-50 hover:opacity-80 cursor-pointer"
                    aria-label="Close"
                    onClick={() => {
                      if (!isSavingSnapshot) setShowSnapshotModal(false);
                    }}
                  >&times;</button>
                </div>
                <div className="p-6">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">快照名称</label>
                    <input
                      className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={snapshotNameDraft}
                      onChange={(e) => setSnapshotNameDraft(e.target.value)}
                      maxLength={100}
                      placeholder="请输入快照名称"
                      disabled={isSavingSnapshot}
                    />
                  </div>
                  <div className="text-sm text-gray-500">
                    将保存本次筛选条件与目标生名单（共 {result?.count || 0} 人）。
                  </div>
                </div>
                <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
                  <button
                    type="button"
                    className="bg-white border border-gray-300 px-4 py-2 rounded hover:bg-gray-50 transition-colors"
                    onClick={() => setShowSnapshotModal(false)}
                    disabled={isSavingSnapshot}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                    onClick={() => handleSaveSnapshot(false)}
                    disabled={isSavingSnapshot}
                  >
                    {isSavingSnapshot ? "保存中..." : "保存快照"}
                  </button>
                  <button
                    type="button"
                    className="border border-blue-300 text-blue-600 px-4 py-2 rounded hover:bg-blue-50 transition-colors"
                    onClick={() => handleSaveSnapshot(true)}
                    disabled={isSavingSnapshot}
                  >
                    {isSavingSnapshot ? "保存中..." : "保存并前往追踪"}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

      <style jsx global>{`
        .page-header {
          background: rgb(1, 135, 108);
          color: white;
          padding: 2rem 0;
          margin-bottom: 2rem;
          border-radius: 10px;
        }
        a.secondary-action,
        a.secondary-action:link,
        a.secondary-action:visited,
        a.secondary-action:hover,
        a.secondary-action:active {
          display: inline-flex; align-items: center; justify-content: center;
          min-height: 44px; min-width: 144px; padding: 0 16px; border-radius: 12px;
          background: rgba(255,255,255,0.72); color: #2f3a4b; font-size: 14px;
          text-decoration: none; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
          transition: all 0.2s ease; cursor: pointer;
        }
        a.secondary-action:hover { background: rgba(255,255,255,0.9); color: #1a2535; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
      `}</style>
    </div>
  );
}

export default function AdvancedTargetStudentsResultPage() {
  return (
    <Suspense fallback={<div className="p-4">加载中...</div>}>
      <AdvancedTargetStudentsResultContent />
    </Suspense>
  );
}

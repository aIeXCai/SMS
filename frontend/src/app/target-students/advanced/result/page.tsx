"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
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

const backendBaseUrl =
  typeof window !== "undefined"
    ? `http://${window.location.hostname}:8000`
    : "http://localhost:8000";
const SCORES_API_BASE = `${backendBaseUrl}/api/scores`;
const ADVANCED_FILTER_API = `${backendBaseUrl}/api/students/advanced-filter/`;
const FILTER_SNAPSHOT_API = `${backendBaseUrl}/api/filter-snapshots/`;

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

export default function AdvancedTargetStudentsResultPage() {
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

  const effectiveToken = useMemo(() => {
    if (token) return token;
    if (typeof window !== "undefined") return localStorage.getItem("accessToken");
    return null;
  }, [token]);

  const authHeader = useMemo(() => {
    if (!effectiveToken) return undefined;
    return { Authorization: `Bearer ${effectiveToken}` };
  }, [effectiveToken]);

  useEffect(() => {
    if (!loading && !effectiveToken) {
      router.push("/login");
    }
  }, [loading, effectiveToken, router]);

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
    if (!effectiveToken) return;

    const fetchGradeOptions = async () => {
      try {
        const res = await fetch(`${SCORES_API_BASE}/options/`, {
          headers: { ...authHeader },
        });
        if (!res.ok) return;
        const data = await res.json();
        setGradeOptions(data.grade_levels || []);
      } catch (error) {
        console.error("Failed to fetch grade options:", error);
      }
    };

    fetchGradeOptions();
  }, [effectiveToken, authHeader]);

  useEffect(() => {
    if (!effectiveToken || !gradeLevel) {
      setExamOptions([]);
      return;
    }

    const fetchExamOptions = async () => {
      try {
        const params = new URLSearchParams({ grade_level: gradeLevel });
        const res = await fetch(`${SCORES_API_BASE}/options/?${params.toString()}`, {
          headers: { ...authHeader },
        });
        if (!res.ok) return;
        const data = await res.json();
        setExamOptions(data.exams || []);
      } catch (error) {
        console.error("Failed to fetch exam options:", error);
      }
    };

    fetchExamOptions();
  }, [effectiveToken, gradeLevel, authHeader]);

  useEffect(() => {
    if (!effectiveToken || !examId || conditions.length === 0) return;

    const fetchResult = async () => {
      setIsLoading(true);
      setMessages([]);
      setResult(null);

      try {
        const res = await fetch(ADVANCED_FILTER_API, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeader,
          },
          body: JSON.stringify({
            exam_id: Number(examId),
            logic,
            conditions,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setMessages([{ id: Date.now(), type: "danger", text: data.message || "筛选失败" }]);
          return;
        }

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
  }, [effectiveToken, authHeader, examId, logic, conditions]);

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

      const res = await fetch(FILTER_SNAPSHOT_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify({
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
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setMessages([
          {
            id: Date.now(),
            type: "danger",
            text: resolveErrorMessage(data, "保存快照失败，请稍后重试"),
          },
        ]);
        return;
      }

      setMessages([
        {
          id: Date.now(),
          type: "success",
          text: `快照“${snapshotName}”已保存，可在变化追踪页发起对比`,
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
      setMessages([{ id: Date.now(), type: "danger", text: "保存快照失败，请稍后重试" }]);
    } finally {
      setIsSavingSnapshot(false);
    }
  };

  if (loading) return <div className="p-4">加载中...</div>;
  if (!user) return null;

  return (
    <div>
      <div className="page-header">
        <div className="container-fluid">
          <div className="row align-items-center">
            <div className="col-md-8">
              <h1>
                <i className="fas fa-bullseye me-3"></i>高级筛选结果
              </h1>
              <p className="mb-0 opacity-75">查看高级筛选结果或返回调整筛选条件</p>
            </div>
            <div className="col-md-4 text-end">
              <button
                type="button"
                className="btn btn-light"
                onClick={() => router.push("/target-students/advanced")}
              >
                <i className="fas fa-arrow-left me-1"></i>返回高级筛选
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container-fluid">
        {messages.length > 0 && (
          <div className="mb-3">
            {messages.map((msg) => (
              <div key={msg.id} className={`alert alert-${msg.type} alert-dismissible fade show`} role="alert">
                <i className="fas fa-info-circle me-2"></i>
                {msg.text}
                <button type="button" className="btn-close" onClick={() => setMessages((prev) => prev.filter((m) => m.id !== msg.id))}></button>
              </div>
            ))}
          </div>
        )}

        <div className="card filter-card mb-3">
          <div className="card-header">
            <h5 className="mb-0"><i className="fas fa-sliders-h me-2"></i>本次筛选条件</h5>
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label">年级</label>
                <input className="form-control" value={gradeOptions.find((item) => item.value === gradeLevel)?.label || gradeLevel} disabled />
              </div>
              <div className="col-md-4">
                <label className="form-label">考试</label>
                <input className="form-control" value={examLabel} disabled />
              </div>
              <div className="col-md-4">
                <label className="form-label">逻辑关系</label>
                <input className="form-control" value={logic === "AND" ? "AND（同时满足）" : "OR（满足其一）"} disabled />
              </div>
              <div className="col-12">
                <label className="form-label">条件列表</label>
                <div className="d-flex flex-wrap gap-2">
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
                      <span key={condition.id} className="badge text-bg-light border text-dark">
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

        <div className="card filter-card mt-3">
          <div className="card-header d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center gap-2">
              <h5 className="mb-0"><i className="fas fa-list me-2"></i>筛选结果</h5>
              <span className="badge bg-primary fs-6">
                共 {result?.count || 0} 名目标生
              </span>
            </div>
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={openSnapshotModal}
                disabled={isLoading || isSavingSnapshot || !result || result.students.length === 0}
              >
                <i className="fas fa-save me-1"></i>
                {isSavingSnapshot ? "保存中..." : "保存为快照"}
              </button>
              <button
                type="button"
                className="btn btn-success btn-sm"
                onClick={handleExportExcel}
                disabled={isLoading || !result || result.students.length === 0}
              >
                <i className="fas fa-file-excel me-1"></i>导出 Excel
              </button>
              <button
                type="button"
                className="btn btn-outline-primary btn-sm"
                onClick={() => router.push("/target-students/tracking")}
              >
                <i className="fas fa-chart-line me-1"></i>前往变化追踪
              </button>
            </div>
          </div>
          <div className="card-body">
            {isLoading ? (
              <div className="text-center py-5 text-muted">
                <span className="spinner-border spinner-border-sm me-2"></span>
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

        <button type="button" className="btn btn-primary position-fixed bottom-0 end-0 m-4" style={{ zIndex: 1000 }} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <i className="fas fa-arrow-up"></i>
        </button>
      </div>

        {showSnapshotModal && (
          <>
            <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="saveSnapshotModalLabel">
              <div className="modal-dialog modal-dialog-centered" role="document">
                <div className="modal-content border-0 shadow">
                  <div className="modal-header bg-light">
                    <h5 className="modal-title" id="saveSnapshotModalLabel">
                      <i className="fas fa-save me-2 text-primary"></i>
                      保存筛选快照
                    </h5>
                    <button
                      type="button"
                      className="btn-close"
                      aria-label="Close"
                      onClick={() => {
                        if (!isSavingSnapshot) setShowSnapshotModal(false);
                      }}
                    ></button>
                  </div>
                  <div className="modal-body">
                    <div className="mb-3">
                      <label className="form-label">快照名称</label>
                      <input
                        className="form-control"
                        value={snapshotNameDraft}
                        onChange={(e) => setSnapshotNameDraft(e.target.value)}
                        maxLength={100}
                        placeholder="请输入快照名称"
                        disabled={isSavingSnapshot}
                      />
                    </div>
                    <div className="small text-secondary">
                      将保存本次筛选条件与目标生名单（共 {result?.count || 0} 人）。
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button
                      type="button"
                      className="btn btn-light"
                      onClick={() => setShowSnapshotModal(false)}
                      disabled={isSavingSnapshot}
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => handleSaveSnapshot(false)}
                      disabled={isSavingSnapshot}
                    >
                      {isSavingSnapshot ? "保存中..." : "保存快照"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-primary"
                      onClick={() => handleSaveSnapshot(true)}
                      disabled={isSavingSnapshot}
                    >
                      {isSavingSnapshot ? "保存中..." : "保存并前往追踪"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-backdrop fade show"></div>
          </>
        )}
    </div>
  );
}

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
            <h5 className="mb-0"><i className="fas fa-list me-2"></i>筛选结果</h5>
            <div className="d-flex align-items-center gap-2">
              <span className="badge bg-primary fs-6">
                共 {result?.count || 0} 名目标生
              </span>
              <button
                type="button"
                className="btn btn-success btn-sm"
                onClick={handleExportExcel}
                disabled={isLoading || !result || result.students.length === 0}
              >
                <i className="fas fa-file-excel me-1"></i>导出 Excel
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

      <style jsx global>{`
        .page-header {
          background: rgb(1, 135, 108);
          color: white;
          padding: 2rem 0;
          margin-bottom: 2rem;
          border-radius: 10px;
        }
        .filter-card {
          border: none;
          border-radius: 15px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          overflow: visible !important;
        }
        .filter-card .card-header {
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          border-bottom: 1px solid #dee2e6;
          border-radius: 15px 15px 0 0;
          padding: 1rem 1.5rem;
        }
        .result-table {
          border-collapse: separate;
          border-spacing: 0;
          border-radius: 8px;
          overflow: hidden;
        }
        .result-table thead th {
          background: linear-gradient(135deg, #2e7d32 0%, #43a047 100%);
          color: white;
          font-weight: 600;
          border: none;
          padding: 12px 16px;
          vertical-align: middle;
        }
        .result-table tbody tr {
          transition: all 0.2s ease;
        }
        .result-table tbody tr:hover {
          background-color: #f5f9f5;
          transform: scale(1.01);
        }
        .result-table tbody td {
          border-color: #e8f5e9;
          padding: 12px 16px;
          vertical-align: middle;
        }
        .result-table .badge {
          font-weight: 500;
          padding: 6px 10px;
          border-radius: 6px;
        }
      `}</style>
    </div>
  );
}

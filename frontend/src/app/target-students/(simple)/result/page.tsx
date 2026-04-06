"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

type Option = { value: string; label: string };

type ExamScopeType = "all_in_grade" | "selected_exam_ids" | "date_range";

type ExamScope = {
  type: ExamScopeType;
  exam_ids?: string[];
  date_from?: string;
  date_to?: string;
};

type RuleForm = {
  grade_level: string;
  exam_scope: ExamScope;
  metric: "total_score_rank_in_grade";
  operator: "lte";
  threshold: string;
  quantifier: "all" | "at_least";
  k: string;
  absent_policy: "strict_fail" | "ignore_absent";
};

type QueryPayload = {
  grade_level: string;
  exam_scope: {
    type: ExamScopeType;
    exam_ids?: string[];
    date_from?: string;
    date_to?: string;
  };
  metric: string;
  operator: string;
  threshold: number;
  quantifier: string;
  k?: number;
  absent_policy: string;
};

const EMPTY_RULE: RuleForm = {
  grade_level: "",
  exam_scope: { type: "all_in_grade" },
  metric: "total_score_rank_in_grade",
  operator: "lte",
  threshold: "",
  quantifier: "all",
  k: "",
  absent_policy: "strict_fail",
};

const QUANTIFIER_OPTIONS: Option[] = [
  { value: "all", label: "每次都满足" },
  { value: "at_least", label: "至少K次满足" },
];

const ABSENT_POLICY_OPTIONS: Option[] = [
  { value: "strict_fail", label: "缺考视为不达标" },
  { value: "ignore_absent", label: "忽略缺考" },
];

const EXAM_SCOPE_OPTIONS: Option[] = [
  { value: "all_in_grade", label: "该年级所有考试" },
  { value: "selected_exam_ids", label: "指定考试" },
  { value: "date_range", label: "日期范围" },
];

const backendBaseUrl =
  typeof window !== "undefined"
    ? `http://${window.location.hostname}:8000`
    : "http://localhost:8000";
const SCORES_API_BASE = `${backendBaseUrl}/api/scores`;

type StudentRecord = {
  student_pk: number;
  student_id: string;
  name: string;
  cohort: string;
  grade_level: string;
  grade_level_display: string;
  class_name: string | null;
  hit_count: number;
  required_count: number;
  participated_count: number;
  missed_exam_count: number;
  avg_rank: number | null;
};

type ResultData = {
  rule_summary: {
    grade_level: string;
    metric: string;
    operator: string;
    threshold: number;
    quantifier: string;
    k: number | null;
    absent_policy: string;
  };
  exam_count: number;
  matched_count: number;
  students: StudentRecord[];
  pagination?: {
    page: number;
    page_size: number;
    total: number;
    num_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
};

export default function TargetStudentsResultPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [form, setForm] = useState<RuleForm>(EMPTY_RULE);
  const [examOptions, setExamOptions] = useState<Option[]>([]);
  const [gradeOptions, setGradeOptions] = useState<Option[]>([]);
  const [selectedExamIds, setSelectedExamIds] = useState<string[]>([]);
  const [examDropdownOpen, setExamDropdownOpen] = useState(false);
  const [gradeDropdownOpen, setGradeDropdownOpen] = useState(false);
  const [examScopeDropdownOpen, setExamScopeDropdownOpen] = useState(false);
  const [quantifierDropdownOpen, setQuantifierDropdownOpen] = useState(false);
  const [absentPolicyDropdownOpen, setAbsentPolicyDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<
    Array<{ id: number; type: "success" | "danger" | "info"; text: string }>
  >([]);
  const [result, setResult] = useState<ResultData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(100);
  const [initialized, setInitialized] = useState(false);
  const [sortField, setSortField] = useState<"avg_rank" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const effectiveToken = useMemo(() => {
    if (token) return token;
    if (typeof window !== "undefined") return localStorage.getItem("accessToken");
    return null;
  }, [token]);

  const authHeader = useMemo(() => {
    if (!effectiveToken) return undefined;
    return { Authorization: `Bearer ${effectiveToken}` };
  }, [effectiveToken]);

  // Parse query parameters on mount
  useEffect(() => {
    if (!loading && !effectiveToken) {
      router.push("/login");
      return;
    }

    const params = searchParams.toString();
    if (!params) {
      // No params, redirect to main page
      router.push("/target-students");
      return;
    }

    try {
      const decoded = decodeURIComponent(params);
      const formData = new URLSearchParams(decoded);

      const savedForm: RuleForm = {
        grade_level: formData.get("grade_level") || "",
        exam_scope: {
          type: (formData.get("exam_scope_type") as ExamScopeType) || "all_in_grade",
          exam_ids: formData.get("exam_ids") ? formData.get("exam_ids")!.split(",") : undefined,
          date_from: formData.get("date_from") || undefined,
          date_to: formData.get("date_to") || undefined,
        },
        metric: "total_score_rank_in_grade",
        operator: "lte",
        threshold: formData.get("threshold") || "",
        quantifier: (formData.get("quantifier") as "all" | "at_least") || "all",
        k: formData.get("k") || "",
        absent_policy: (formData.get("absent_policy") as "strict_fail" | "ignore_absent") || "strict_fail",
      };

      setForm(savedForm);
      if (savedForm.exam_scope.type === "selected_exam_ids" && savedForm.exam_scope.exam_ids) {
        setSelectedExamIds(savedForm.exam_scope.exam_ids);
      }
      setInitialized(true);
    } catch (e) {
      console.error("Failed to parse query params:", e);
      router.push("/target-students");
    }
  }, [loading, effectiveToken, searchParams, router]);

  // Auto-trigger query when form is initialized from URL params
  useEffect(() => {
    if (!initialized || !effectiveToken) return;

    const thresholdNum = parseInt(form.threshold, 10);
    if (!form.threshold || isNaN(thresholdNum) || thresholdNum <= 0) return;

    const payload: QueryPayload = {
      grade_level: form.grade_level,
      exam_scope: { type: form.exam_scope.type },
      metric: form.metric,
      operator: form.operator,
      threshold: thresholdNum,
      quantifier: form.quantifier,
      absent_policy: form.absent_policy,
    };

    if (form.exam_scope.type === "selected_exam_ids") {
      payload.exam_scope.exam_ids = selectedExamIds;
    } else if (form.exam_scope.type === "date_range") {
      payload.exam_scope.date_from = form.exam_scope.date_from;
      payload.exam_scope.date_to = form.exam_scope.date_to;
    }

    if (form.quantifier === "at_least") {
      payload.k = parseInt(form.k, 10);
    }

    setIsLoading(true);
    setMessages([]);
    setResult(null);
    setCurrentPage(1);

    fetch(`${SCORES_API_BASE}/target-students-query/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeader,
      },
      body: JSON.stringify(payload),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setResult(data.data);
          setMessages([{ id: Date.now(), type: "success", text: `查询完成，共 ${data.data.matched_count} 名目标生` }]);
        } else {
          setMessages([{ id: Date.now(), type: "danger", text: data.error || "查询失败" }]);
        }
      })
      .catch((e) => {
        console.error("Query failed:", e);
        setMessages([{ id: Date.now(), type: "danger", text: "查询失败，请稍后重试" }]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [initialized, effectiveToken, authHeader]);

  // Fetch grade options from API
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
      } catch (e) {
        console.error("Failed to fetch grade options:", e);
      }
    };
    fetchGradeOptions();
  }, [effectiveToken, authHeader]);

  // Fetch exam options based on selected grade_level
  useEffect(() => {
    if (!effectiveToken || !form.grade_level) {
      setExamOptions([]);
      return;
    }
    const fetchExams = async () => {
      try {
        const params = new URLSearchParams({ grade_level: form.grade_level });
        const res = await fetch(`${SCORES_API_BASE}/options/?${params.toString()}`, {
          headers: { ...authHeader },
        });
        if (!res.ok) return;
        const data = await res.json();
        setExamOptions(data.exams || []);
      } catch (e) {
        console.error("Failed to fetch exams:", e);
      }
    };
    fetchExams();
  }, [effectiveToken, authHeader, form.grade_level]);

  // Close all dropdowns on outside click
  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".custom-dropdown")) {
        setExamDropdownOpen(false);
        setGradeDropdownOpen(false);
        setExamScopeDropdownOpen(false);
        setQuantifierDropdownOpen(false);
        setAbsentPolicyDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleGradeLevelChange = (value: string) => {
    setForm((prev) => ({
      ...prev,
      grade_level: value,
      exam_scope: { type: prev.exam_scope.type },
    }));
    setSelectedExamIds([]);
  };

  const handleExamScopeTypeChange = (value: string) => {
    const type = value as ExamScopeType;
    setForm((prev) => ({
      ...prev,
      exam_scope: { type },
    }));
    if (type !== "selected_exam_ids") {
      setSelectedExamIds([]);
    }
  };

  const handleThresholdChange = (value: string) => {
    if (value === "" || /^\d+$/.test(value)) {
      setForm((prev) => ({ ...prev, threshold: value }));
    }
  };

  const handleKChange = (value: string) => {
    if (value === "" || /^\d+$/.test(value)) {
      setForm((prev) => ({ ...prev, k: value }));
    }
  };

  const toggleExamSelection = (examId: string) => {
    setSelectedExamIds((prev) =>
      prev.includes(examId)
        ? prev.filter((id) => id !== examId)
        : [...prev, examId]
    );
  };

  const toggleAllExams = () => {
    if (selectedExamIds.length === examOptions.length) {
      setSelectedExamIds([]);
    } else {
      setSelectedExamIds(examOptions.map((e) => e.value));
    }
  };

  const allExamsSelected = examOptions.length > 0 && selectedExamIds.length === examOptions.length;

  const selectedExamText = (() => {
    if (selectedExamIds.length === 0) return "请选择考试";
    if (selectedExamIds.length === examOptions.length) return `全部考试 (${examOptions.length})`;
    if (selectedExamIds.length === 1) {
      return examOptions.find((e) => e.value === selectedExamIds[0])?.label || "已选择 1 个考试";
    }
    return `已选择 ${selectedExamIds.length} 个考试`;
  })();

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    params.set("grade_level", form.grade_level);
    params.set("exam_scope_type", form.exam_scope.type);
    if (form.exam_scope.type === "selected_exam_ids" && selectedExamIds.length > 0) {
      params.set("exam_ids", selectedExamIds.join(","));
    }
    if (form.exam_scope.type === "date_range") {
      if (form.exam_scope.date_from) params.set("date_from", form.exam_scope.date_from);
      if (form.exam_scope.date_to) params.set("date_to", form.exam_scope.date_to);
    }
    params.set("threshold", form.threshold);
    params.set("quantifier", form.quantifier);
    if (form.quantifier === "at_least") {
      params.set("k", form.k);
    }
    params.set("absent_policy", form.absent_policy);
    return params.toString();
  }, [form, selectedExamIds]);

  const handleQuery = async () => {
    if (!form.grade_level) {
      setMessages([{ id: Date.now(), type: "info", text: "请选择年级" }]);
      return;
    }
    const thresholdNum = parseInt(form.threshold, 10);
    if (!form.threshold || isNaN(thresholdNum) || thresholdNum <= 0) {
      setMessages([{ id: Date.now(), type: "info", text: "前N名阈值必须为正整数" }]);
      return;
    }
    if (form.exam_scope.type === "selected_exam_ids" && selectedExamIds.length === 0) {
      setMessages([{ id: Date.now(), type: "info", text: "请选择至少一个考试" }]);
      return;
    }
    if (form.exam_scope.type === "date_range") {
      if (!form.exam_scope.date_from || !form.exam_scope.date_to) {
        setMessages([{ id: Date.now(), type: "info", text: "请填写完整的日期范围" }]);
        return;
      }
      if (form.exam_scope.date_from > form.exam_scope.date_to) {
        setMessages([{ id: Date.now(), type: "info", text: "开始日期不能晚于结束日期" }]);
        return;
      }
    }
    if (form.quantifier === "at_least") {
      const kNum = parseInt(form.k, 10);
      if (!form.k || isNaN(kNum) || kNum <= 0) {
        setMessages([{ id: Date.now(), type: "info", text: "K值必须为正整数" }]);
        return;
      }
    }

    const payload: QueryPayload = {
      grade_level: form.grade_level,
      exam_scope: { type: form.exam_scope.type },
      metric: form.metric,
      operator: form.operator,
      threshold: thresholdNum,
      quantifier: form.quantifier,
      absent_policy: form.absent_policy,
    };

    if (form.exam_scope.type === "selected_exam_ids") {
      payload.exam_scope.exam_ids = selectedExamIds;
    } else if (form.exam_scope.type === "date_range") {
      payload.exam_scope.date_from = form.exam_scope.date_from;
      payload.exam_scope.date_to = form.exam_scope.date_to;
    }

    if (form.quantifier === "at_least") {
      payload.k = parseInt(form.k, 10);
    }

    // Update URL with query params
    const queryString = buildQueryString();
    router.push(`/target-students/result?${queryString}`);

    setIsLoading(true);
    setMessages([]);
    setResult(null);
    setCurrentPage(1);

    try {
      const res = await fetch(`${SCORES_API_BASE}/target-students-query/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages([{ id: Date.now(), type: "danger", text: data.error || "查询失败，请稍后重试" }]);
        return;
      }

      if (data.success) {
        setResult(data.data);
        setMessages([{ id: Date.now(), type: "success", text: `查询完成，共 ${data.data.matched_count} 名目标生` }]);
      } else {
        setMessages([{ id: Date.now(), type: "danger", text: data.error || "查询失败" }]);
      }
    } catch (e) {
      console.error("Query failed:", e);
      setMessages([{ id: Date.now(), type: "danger", text: "查询失败，请稍后重试" }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setForm(EMPTY_RULE);
    setSelectedExamIds([]);
    setResult(null);
    setMessages([]);
    router.push("/target-students");
  };

  // Sorted and paginated students
  const sortedStudents = useMemo(() => {
    if (!result || !result.students) return [];
    const students = [...result.students];
    if (sortField === "avg_rank") {
      students.sort((a, b) => {
        if (a.avg_rank === null && b.avg_rank === null) return 0;
        if (a.avg_rank === null) return 1;
        if (b.avg_rank === null) return -1;
        return sortDirection === "asc" ? a.avg_rank - b.avg_rank : b.avg_rank - a.avg_rank;
      });
    }
    return students;
  }, [result, sortField, sortDirection]);

  const paginatedStudents = useMemo(() => {
    if (!sortedStudents) return [];
    const start = (currentPage - 1) * pageSize;
    return sortedStudents.slice(start, start + pageSize);
  }, [sortedStudents, currentPage, pageSize]);

  const totalPages = useMemo(() => {
    if (!sortedStudents) return 1;
    return Math.ceil(sortedStudents.length / pageSize);
  }, [sortedStudents, pageSize]);

  if (loading) return <div className="p-4">加载中...</div>;
  if (!user) return null;

  return (
    <div>
      <div className="page-header">
        <div className="container-fluid">
          <div className="row align-items-center">
            <div className="col-md-8">
              <h1>
                <i className="fas fa-bullseye me-3"></i>目标生筛选结果
              </h1>
              <p className="mb-0 opacity-75">查看筛选结果或调整条件继续查询</p>
            </div>
            <div className="col-md-4 text-end">
              <button
                type="button"
                className="btn btn-light me-2"
                onClick={() => router.push("/target-students")}
              >
                <i className="fas fa-arrow-left me-1"></i>返回筛选
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
            <h5 className="mb-0"><i className="fas fa-sliders-h me-2"></i>筛选条件</h5>
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-3">
                <label className="form-label">年级</label>
                <div className="custom-dropdown">
                  <button type="button" className={`custom-dropdown-toggle ${gradeDropdownOpen ? "active" : ""}`} onClick={() => setGradeDropdownOpen((v) => !v)}>
                    <span>{gradeOptions.find(g => g.value === form.grade_level)?.label || "--- 请选择年级 ---"}</span>
                    <i className="fas fa-chevron-down custom-dropdown-arrow"></i>
                  </button>
                  <div className={`custom-dropdown-menu ${gradeDropdownOpen ? "show" : ""}`}>
                    {gradeOptions.map((opt) => (
                      <button key={opt.value} type="button" className="custom-dropdown-item" onClick={() => { handleGradeLevelChange(opt.value); setGradeDropdownOpen(false); }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="col-md-3">
                <label className="form-label">考试范围</label>
                <div className="custom-dropdown">
                  <button type="button" className={`custom-dropdown-toggle ${examScopeDropdownOpen ? "active" : ""}`} onClick={() => setExamScopeDropdownOpen((v) => !v)}>
                    <span>{EXAM_SCOPE_OPTIONS.find(o => o.value === form.exam_scope.type)?.label || "请选择"}</span>
                    <i className="fas fa-chevron-down custom-dropdown-arrow"></i>
                  </button>
                  <div className={`custom-dropdown-menu ${examScopeDropdownOpen ? "show" : ""}`}>
                    {EXAM_SCOPE_OPTIONS.map((opt) => (
                      <button key={opt.value} type="button" className="custom-dropdown-item" onClick={() => { handleExamScopeTypeChange(opt.value); setExamScopeDropdownOpen(false); }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="col-md-2">
                <label className="form-label">前N名</label>
                <input type="text" className="form-control" value={form.threshold} onChange={(e) => handleThresholdChange(e.target.value)} placeholder="如：50" />
              </div>

              <div className="col-md-2">
                <label className="form-label">满足方式</label>
                <div className="custom-dropdown">
                  <button type="button" className={`custom-dropdown-toggle ${quantifierDropdownOpen ? "active" : ""}`} onClick={() => setQuantifierDropdownOpen((v) => !v)}>
                    <span>{QUANTIFIER_OPTIONS.find(o => o.value === form.quantifier)?.label || "请选择"}</span>
                    <i className="fas fa-chevron-down custom-dropdown-arrow"></i>
                  </button>
                  <div className={`custom-dropdown-menu ${quantifierDropdownOpen ? "show" : ""}`}>
                    {QUANTIFIER_OPTIONS.map((opt) => (
                      <button key={opt.value} type="button" className="custom-dropdown-item" onClick={() => { setForm((prev) => ({ ...prev, quantifier: opt.value as "all" | "at_least" })); setQuantifierDropdownOpen(false); }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="col-md-2">
                <label className="form-label">K值 <span className="text-muted small">({form.quantifier === "at_least" ? "必填" : "选填"})</span></label>
                <input
                  type="text"
                  className="form-control"
                  value={form.k}
                  onChange={(e) => handleKChange(e.target.value)}
                  placeholder={form.quantifier === "at_least" ? "如：3" : "量词为至少K次时填写"}
                  disabled={form.quantifier !== "at_least"}
                />
              </div>
            </div>

            {form.exam_scope.type === "selected_exam_ids" && (
              <div className="mt-2 exam-selector-wrap">
                <label className="form-label">选择考试</label>
                <div className="custom-dropdown exam-selector-dropdown">
                  <button type="button" className={`custom-dropdown-toggle ${examDropdownOpen ? "active" : ""}`} onClick={() => setExamDropdownOpen((v) => !v)}>
                    <span className="text-truncate d-inline-block exam-selector-text">{selectedExamText}</span>
                    <i className="fas fa-chevron-down custom-dropdown-arrow"></i>
                  </button>
                  <div className={`custom-dropdown-menu exam-selector-menu ${examDropdownOpen ? "show" : ""}`}>
                    <div className="custom-dropdown-header">
                      <label className="form-check mb-0">
                        <input type="checkbox" className="form-check-input" checked={allExamsSelected} onChange={toggleAllExams} />
                        <span className="form-check-label fw-medium">全选/取消全选</span>
                      </label>
                    </div>
                    <div className="custom-dropdown-items">
                      {examOptions.length === 0 && (
                        <div className="text-muted px-2 py-2">{form.grade_level ? "该年级暂无考试" : "请先选择年级"}</div>
                      )}
                      {examOptions.map((exam) => (
                        <label key={exam.value} className="form-check custom-dropdown-item">
                          <input type="checkbox" className="form-check-input" checked={selectedExamIds.includes(exam.value)} onChange={() => toggleExamSelection(exam.value)} />
                          <span className="form-check-label">{exam.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {form.exam_scope.type === "date_range" && (
              <div className="row g-3 mt-2">
                <div className="col-md-3">
                  <label className="form-label">开始日期</label>
                  <input type="date" className="form-control" value={form.exam_scope.date_from || ""} onChange={(e) => setForm((prev) => ({ ...prev, exam_scope: { ...prev.exam_scope, date_from: e.target.value } }))} />
                </div>
                <div className="col-md-3">
                  <label className="form-label">结束日期</label>
                  <input type="date" className="form-control" value={form.exam_scope.date_to || ""} onChange={(e) => setForm((prev) => ({ ...prev, exam_scope: { ...prev.exam_scope, date_to: e.target.value } }))} />
                </div>
              </div>
            )}

            <div className="row g-3 mt-2">
              <div className="col-md-3">
                <label className="form-label">缺考判定</label>
                <div className="custom-dropdown">
                  <button type="button" className={`custom-dropdown-toggle ${absentPolicyDropdownOpen ? "active" : ""}`} onClick={() => setAbsentPolicyDropdownOpen((v) => !v)}>
                    <span>{ABSENT_POLICY_OPTIONS.find(o => o.value === form.absent_policy)?.label || "请选择"}</span>
                    <i className="fas fa-chevron-down custom-dropdown-arrow"></i>
                  </button>
                  <div className={`custom-dropdown-menu ${absentPolicyDropdownOpen ? "show" : ""}`}>
                    {ABSENT_POLICY_OPTIONS.map((opt) => (
                      <button key={opt.value} type="button" className="custom-dropdown-item" onClick={() => { setForm((prev) => ({ ...prev, absent_policy: opt.value as "strict_fail" | "ignore_absent" })); setAbsentPolicyDropdownOpen(false); }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="col-md-3 d-flex align-items-end gap-2">
                <button type="button" className="btn btn-primary" onClick={handleQuery} disabled={isLoading}>
                  {isLoading ? (<><span className="spinner-border spinner-border-sm me-2"></span>查询中...</>) : (<><i className="fas fa-search me-1"></i>查询</>)}
                </button>
                <button type="button" className="btn btn-secondary" onClick={handleReset}>
                  <i className="fas fa-undo me-1"></i>重置
                </button>
              </div>
            </div>
          </div>
        </div>

        {result && (
          <div className="card filter-card mt-3">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="mb-0"><i className="fas fa-list me-2"></i>筛选结果</h5>
              <span className="badge bg-primary fs-6">
                共 {result.matched_count} 名目标生
              </span>
            </div>
            <div className="card-body">
              <div className="alert alert-info mb-3">
                <strong>规则摘要：</strong>
                {result.rule_summary.grade_level} | 前 {result.rule_summary.threshold} 名 |
                {result.rule_summary.quantifier === "all" ? "每次都满足" : `至少${result.rule_summary.k}次满足`} |
                考试数量：{result.exam_count}
              </div>

              {sortedStudents.length === 0 ? (
                <div className="text-center py-5">
                  <i className="fas fa-search fa-3x text-muted mb-3"></i>
                  <h5 className="text-muted">暂无符合条件的学生</h5>
                  <p className="text-muted">请尝试调整筛选条件</p>
                </div>
              ) : (
                <>
                  <div className="table-responsive">
                    <table className="table table-hover table-bordered align-middle result-table">
                      <thead className="table-light">
                        <tr>
                          <th className="text-center" style={{ width: "70px" }}>序号</th>
                          <th className="text-center">姓名</th>
                          <th className="text-center">入学年级</th>
                          <th className="text-center">年级</th>
                          <th className="text-center">班级</th>
                          <th className="text-center">参加考试次数</th>
                          <th className="text-center">满足条件次数</th>
                          <th className="text-center">缺考次数</th>
                          <th
                            className="text-center sortable-header"
                            onClick={() => {
                              if (sortField === "avg_rank") {
                                setSortDirection(d => d === "asc" ? "desc" : "asc");
                              } else {
                                setSortField("avg_rank");
                                setSortDirection("asc");
                              }
                            }}
                            style={{ cursor: "pointer", minWidth: "100px" }}
                          >
                            <span>
                              平均排名
                              <i className={`fas fa-caret-down ms-1 ${sortField === "avg_rank" ? "text-warning" : "text-white-50"}`}></i>
                            </span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedStudents.map((student, index) => (
                          <tr key={student.student_pk}>
                            <td className="text-center text-muted">{(currentPage - 1) * pageSize + index + 1}</td>
                            <td className="text-center fw-medium">{student.name}</td>
                            <td className="text-center">{student.cohort || "-"}</td>
                            <td className="text-center">{student.grade_level_display || student.grade_level || "-"}</td>
                            <td className="text-center">{student.class_name || "-"}</td>
                            <td className="text-center">
                              <span className="badge bg-secondary">{student.participated_count}</span>
                            </td>
                            <td className="text-center">
                              <span className="badge bg-success">{student.hit_count}</span>
                            </td>
                            <td className="text-center">
                              <span className="badge bg-warning">{student.missed_exam_count}</span>
                            </td>
                            <td className="text-center">
                              {student.avg_rank !== null ? (
                                <span className="badge bg-info">{student.avg_rank}</span>
                              ) : (
                                <span className="text-muted">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {totalPages > 1 && (
                    <nav className="d-flex justify-content-center mt-3">
                      <ul className="pagination mb-0">
                        <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
                          <button className="page-link" onClick={() => setCurrentPage(1)}>首页</button>
                        </li>
                        <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
                          <button className="page-link" onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>上一页</button>
                        </li>
                        <li className="page-item active">
                          <span className="page-link">
                            第 {currentPage} / {totalPages} 页
                          </span>
                        </li>
                        <li className={`page-item ${currentPage === totalPages ? "disabled" : ""}`}>
                          <button className="page-link" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>下一页</button>
                        </li>
                        <li className={`page-item ${currentPage === totalPages ? "disabled" : ""}`}>
                          <button className="page-link" onClick={() => setCurrentPage(totalPages)}>末页</button>
                        </li>
                      </ul>
                    </nav>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        <button type="button" className="btn btn-primary position-fixed bottom-0 end-0 m-4" style={{ zIndex: 1000 }} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <i className="fas fa-arrow-up"></i>
        </button>
      </div>

      <style jsx global>{`
        .filter-card .card-body {
          overflow: visible !important;
        }
        .filter-card .card-body > .row {
          overflow: visible !important;
          flex-wrap: wrap;
        }
        .filter-card .card-body > .row > [class*="col-"] {
          overflow: visible !important;
        }
        .filter-card .form-control,
        .filter-card .custom-dropdown-toggle {
          height: 38px;
          padding: 0.375rem 0.75rem;
          font-size: 14px;
        }
        .custom-dropdown {
          position: relative;
          width: 100%;
          color: #495057;
        }
        .exam-selector-wrap {
          overflow: visible;
        }
        .exam-selector-dropdown {
          width: min(420px, 100%);
          min-width: 280px;
        }
        .exam-selector-text {
          max-width: calc(100% - 1.5rem);
        }
        .exam-selector-menu {
          width: 100%;
          min-width: 100%;
        }
        .custom-dropdown-toggle {
          width: 100%;
          border: 1px solid #ced4da;
          border-radius: 0.375rem;
          background-color: #fff;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: all 0.2s ease;
          text-align: left;
          font-size: 14px;
        }
        .custom-dropdown-toggle:hover,
        .custom-dropdown-toggle.active {
          border-color: #007bff;
          box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
        }
        .custom-dropdown-arrow {
          transition: transform 0.2s ease;
          color: #6c757d;
          margin-left: auto;
        }
        .custom-dropdown-toggle.active .custom-dropdown-arrow {
          transform: rotate(180deg);
        }
        .custom-dropdown-menu {
          position: absolute;
          top: calc(100% + 2px);
          left: 0;
          width: 100%;
          background: white;
          border: 1px solid #ced4da;
          border-radius: 0.375rem;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          z-index: 1050;
          max-height: 250px;
          overflow-y: auto;
          display: none;
          box-sizing: border-box;
        }
        .custom-dropdown-menu.show {
          display: block;
        }
        .custom-dropdown-header {
          padding: 0.5rem 0.75rem;
          border-bottom: 1px solid #e9ecef;
          background-color: #f8f9fa;
          border-radius: 0.375rem 0.375rem 0 0;
        }
        .custom-dropdown-items { padding: 0.25rem 0; }
        .custom-dropdown-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          width: 100%;
          padding: 0.375rem 0.75rem;
          cursor: pointer;
          transition: background-color 0.15s ease;
          font-size: 14px;
          border: none;
          background: transparent;
          text-align: left;
        }
        .custom-dropdown-item:hover {
          background-color: #f8f9fa;
        }
        .custom-dropdown-item input[type="checkbox"] {
          width: 16px;
          height: 16px;
          margin-right: 0.5rem;
        }
        .custom-dropdown-header .form-check,
        .custom-dropdown-item.form-check {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0;
          padding-left: 0.75rem;
        }
        .custom-dropdown-header .form-check-input,
        .custom-dropdown-item.form-check .form-check-input {
          float: none;
          margin: 0;
          position: static;
          flex-shrink: 0;
        }
        .custom-dropdown-header .form-check-label,
        .custom-dropdown-item.form-check .form-check-label {
          margin: 0;
        }
        @media (max-width: 576px) {
          .exam-selector-dropdown {
            width: 100%;
            min-width: 0;
          }
        }
        .sortable-header {
          user-select: none;
          transition: background-color 0.2s;
        }
        .sortable-header:hover {
          background-color: rgba(255, 255, 255, 0.15);
        }
        .text-muted {
          color: #6c757d !important;
        }
      `}</style>
    </div>
  );
}

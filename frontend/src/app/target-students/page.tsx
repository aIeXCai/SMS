"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

export default function TargetStudentsPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState<RuleForm>(EMPTY_RULE);
  const [examOptions, setExamOptions] = useState<Option[]>([]);
  const [gradeOptions, setGradeOptions] = useState<Option[]>([]);
  const [selectedExamIds, setSelectedExamIds] = useState<string[]>([]);
  const [examDropdownOpen, setExamDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<
    Array<{ id: number; type: "success" | "danger" | "info"; text: string }>
  >([]);
  const [result, setResult] = useState<any>(null);

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

  // Close exam dropdown on outside click
  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".exam-dropdown")) {
        setExamDropdownOpen(false);
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

    const payload: any = {
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
                <i className="fas fa-bullseye me-3"></i>目标生筛选
              </h1>
              <p className="mb-0 opacity-75">基于成绩排名自动识别目标学生</p>
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
            <h5 className="mb-0"><i className="fas fa-sliders-h me-2"></i>规则配置</h5>
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-3">
                <label className="form-label">年级</label>
                <select className="form-select" value={form.grade_level} onChange={(e) => handleGradeLevelChange(e.target.value)}>
                  <option value="">--- 请选择年级 ---</option>
                  {gradeOptions.map((x) => (
                    <option key={x.value} value={x.value}>{x.label}</option>
                  ))}
                </select>
              </div>

              <div className="col-md-3">
                <label className="form-label">考试范围</label>
                <select className="form-select" value={form.exam_scope.type} onChange={(e) => handleExamScopeTypeChange(e.target.value)}>
                  {EXAM_SCOPE_OPTIONS.map((x) => (
                    <option key={x.value} value={x.value}>{x.label}</option>
                  ))}
                </select>
              </div>

              <div className="col-md-2">
                <label className="form-label">前N名</label>
                <input type="text" className="form-control" value={form.threshold} onChange={(e) => handleThresholdChange(e.target.value)} placeholder="如：50" />
              </div>

              <div className="col-md-2">
                <label className="form-label">满足方式</label>
                <select className="form-select" value={form.quantifier} onChange={(e) => setForm((prev) => ({ ...prev, quantifier: e.target.value as "all" | "at_least" }))}>
                  {QUANTIFIER_OPTIONS.map((x) => (
                    <option key={x.value} value={x.value}>{x.label}</option>
                  ))}
                </select>
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
              <div className="row g-3 mt-2">
                <div className="col-md-6">
                  <label className="form-label">选择考试</label>
                  <div className="exam-dropdown">
                    <button type="button" className={`exam-dropdown-toggle ${examDropdownOpen ? "active" : ""}`} onClick={() => setExamDropdownOpen((v) => !v)}>
                      <span>{selectedExamText}</span>
                      <i className={`fas fa-chevron-${examDropdownOpen ? "up" : "down"}`}></i>
                    </button>
                    {examDropdownOpen && (
                      <div className="exam-dropdown-menu">
                        <div className="exam-dropdown-header">
                          <label className="form-check mb-0">
                            <input type="checkbox" className="form-check-input" checked={allExamsSelected} onChange={toggleAllExams} />
                            <span className="form-check-label fw-medium">全选/取消全选</span>
                          </label>
                        </div>
                        <div className="exam-dropdown-items">
                          {examOptions.length === 0 && (
                            <div className="text-muted px-2 py-2">{form.grade_level ? "该年级暂无考试" : "请先选择年级"}</div>
                          )}
                          {examOptions.map((exam) => (
                            <label key={exam.value} className="form-check exam-dropdown-item">
                              <input type="checkbox" className="form-check-input" checked={selectedExamIds.includes(exam.value)} onChange={() => toggleExamSelection(exam.value)} />
                              <span className="form-check-label">{exam.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
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
                <select className="form-select" value={form.absent_policy} onChange={(e) => setForm((prev) => ({ ...prev, absent_policy: e.target.value as "strict_fail" | "ignore_absent" }))}>
                  {ABSENT_POLICY_OPTIONS.map((x) => (
                    <option key={x.value} value={x.value}>{x.label}</option>
                  ))}
                </select>
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

        {/* 操作指南 */}
        <div className="row mt-0">
          <div className="col-12">
            <div className="alert alert-info border-0 tips-alert">
              <div className="d-flex align-items-center">
                <i className="fas fa-info-circle fa-2x me-3 text-success"></i>
                <div>
                  <h6 className="alert-heading mb-1 text-success"><i className="fas fa-lightbulb me-1"></i>操作指南</h6>
                  <p className="mb-0 small text-success">
                    <strong>1. 选择年级</strong> → <strong>2. 设置考试范围</strong> → <strong>3. 输入前N名阈值</strong> → <strong>4. 选择满足方式</strong> → <strong>5. 点击查询</strong>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 功能介绍 */}
        <div className="row g-4 mt-2">
          {/* 左侧：功能特点 */}
          <div className="col-lg-6">
            <div className="intro-card h-100">
              <div className="intro-card-header">
                <div className="intro-icon-wrapper">
                  <i className="fas fa-star"></i>
                </div>
                <h5 className="mb-0">功能特点</h5>
              </div>
              <div className="intro-card-body">
                <div className="feature-item">
                  <div className="feature-icon">
                    <i className="fas fa-chart-line"></i>
                  </div>
                  <div className="feature-content">
                    <h6>稳定优生识别</h6>
                    <p>筛选多次考试中持续保持前列的学生</p>
                  </div>
                </div>
                <div className="feature-item">
                  <div className="feature-icon">
                    <i className="fas fa-crown"></i>
                  </div>
                  <div className="feature-content">
                    <h6>拔尖生定位</h6>
                    <p>快速找出年级排名前列的目标学生</p>
                  </div>
                </div>
                <div className="feature-item">
                  <div className="feature-icon">
                    <i className="fas fa-sliders-h"></i>
                  </div>
                  <div className="feature-content">
                    <h6>灵活条件配置</h6>
                    <p>支持指定考试范围、K次命中、缺考处理等多种规则</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 右侧：指标说明 */}
          <div className="col-lg-6">
            <div className="intro-card h-100">
              <div className="intro-card-header">
                <div className="intro-icon-wrapper">
                  <i className="fas fa-info-circle"></i>
                </div>
                <h5 className="mb-0">指标说明</h5>
              </div>
              <div className="intro-card-body">
                <div className="indicator-item">
                  <div className="indicator-tag">总分年级排名</div>
                  <p>该学生在某次考试中的总分在年级所有学生中的排名</p>
                </div>
                <div className="indicator-item">
                  <div className="indicator-tag">前N名</div>
                  <p>排名数值 ≤ N 的学生（如前50名，即排名1-50名）</p>
                </div>
                <div className="indicator-item">
                  <div className="indicator-tag warning">缺考判定</div>
                  <p><strong>缺考视为不达标：</strong>缺考直接判定为不满足条件<br/><strong>忽略缺考：</strong>缺考不计入统计，仅统计有成绩的学生</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {result && (
          <div className="card mt-3">
            <div className="card-header">
              <h5 className="mb-0"><i className="fas fa-list me-2"></i>筛选结果</h5>
            </div>
            <div className="card-body">
              <div className="alert alert-info mb-3">
                <strong>规则摘要：</strong>
                {result.rule_summary.grade_level} | 前 {result.rule_summary.threshold} 名 |
                {result.rule_summary.quantifier === "all" ? "每次都满足" : `至少${result.rule_summary.k}次满足`} |
                考试数量：{result.exam_count} | 符合条件：{result.matched_count} 人
              </div>
              <p className="text-muted">结果显示功能（阶段C任务2）</p>
            </div>
          </div>
        )}

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
        }
        .filter-card .card-header {
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          border-bottom: 1px solid #dee2e6;
          border-radius: 15px 15px 0 0;
          padding: 1rem 1.5rem;
        }
        .exam-dropdown { position: relative; }
        .exam-dropdown-toggle {
          width: 100%;
          border: 1px solid #ced4da;
          background: #fff;
          padding: 0.375rem 0.75rem;
          border-radius: 0.375rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          text-align: left;
        }
        .exam-dropdown-toggle.active,
        .exam-dropdown-toggle:hover {
          border-color: #86b7fe;
          outline: 0;
          box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
        }
        .exam-dropdown-menu {
          position: absolute;
          z-index: 20;
          width: 100%;
          max-height: 320px;
          overflow: auto;
          border: 1px solid #dee2e6;
          border-radius: 0.5rem;
          background: #fff;
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.12);
          margin-top: 0.25rem;
        }
        .exam-dropdown-header {
          padding: 0.5rem 0.75rem;
          border-bottom: 1px solid #f1f3f4;
          background: #f8f9fa;
          border-radius: 0.5rem 0.5rem 0 0;
        }
        .exam-dropdown-items { padding: 0.5rem 0.75rem; }
        .exam-dropdown-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.35rem;
        }
        .tips-alert {
          background: linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%);
          border-radius: 12px;
        }
        .analysis-card {
          border: none;
          border-radius: 15px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }
        .analysis-card .card-body {
          padding: 2rem;
          text-align: center;
        }
        .analysis-icon {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1rem;
        }
        .analysis-icon i {
          font-size: 1.75rem;
          color: #2e7d32;
        }
        .target-student-intro .card-title {
          color: #2e7d32;
          font-weight: 600;
        }
        /* 功能介绍卡片样式 */
        .intro-card {
          background: #fff;
          border: none;
          border-radius: 16px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          overflow: hidden;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .intro-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
        }
        .intro-card-header {
          background: linear-gradient(135deg, #2e7d32 0%, #43a047 100%);
          color: white;
          padding: 1.25rem 1.5rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .intro-card-header h5 {
          font-weight: 600;
          margin: 0;
        }
        .intro-icon-wrapper {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .intro-icon-wrapper i {
          font-size: 1.25rem;
        }
        .intro-card-body {
          padding: 1.5rem;
        }
        .feature-item {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          margin-bottom: 1.25rem;
        }
        .feature-item:last-child {
          margin-bottom: 0;
        }
        .feature-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .feature-icon i {
          color: #2e7d32;
          font-size: 1.1rem;
        }
        .feature-content h6 {
          font-size: 0.95rem;
          font-weight: 600;
          color: #2c3e50;
          margin-bottom: 0.25rem;
        }
        .feature-content p {
          font-size: 0.85rem;
          color: #6c757d;
          margin: 0;
          line-height: 1.5;
        }
        .indicator-item {
          margin-bottom: 1rem;
        }
        .indicator-item:last-child {
          margin-bottom: 0;
        }
        .indicator-tag {
          display: inline-block;
          background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
          color: #1565c0;
          font-size: 0.8rem;
          font-weight: 600;
          padding: 0.25rem 0.75rem;
          border-radius: 6px;
          margin-bottom: 0.5rem;
        }
        .indicator-tag.warning {
          background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
          color: #e65100;
        }
        .indicator-item p {
          font-size: 0.85rem;
          color: #495057;
          margin: 0;
          line-height: 1.6;
        }
      `}</style>
    </div>
  );
}

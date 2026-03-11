"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

type Option = { value: string; label: string };

type ExamOptions = {
  academic_years: Option[];
  grade_levels: Option[];
};

type SubjectRow = {
  subject_code: string;
  max_score: number | "";
};

const backendBaseUrl =
  typeof window !== "undefined"
    ? `http://${window.location.hostname}:8000`
    : "http://localhost:8000";

export default function CreateExamPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [options, setOptions] = useState<ExamOptions | null>(null);
  const [allSubjects, setAllSubjects] = useState<Option[]>([]);

  // Step 1 fields
  const [academicYear, setAcademicYear] = useState("");
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [description, setDescription] = useState("");

  // Step 2 fields
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const authHeader = useMemo(() => {
    if (!token) return undefined;
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  useEffect(() => {
    if (!loading && !token) router.push("/login");
  }, [loading, token, router]);

  useEffect(() => {
    if (!token) return;
    fetch(`${backendBaseUrl}/api/exams/options/`, { headers: { ...authHeader } })
      .then((r) => r.json())
      .then((data) => setOptions(data))
      .catch(console.error);
  }, [token, authHeader]);

  const loadDefaultSubjects = async (grade: string) => {
    if (!grade) return;
    setLoadingSubjects(true);
    try {
      const res = await fetch(
        `${backendBaseUrl}/api/exams/default-subjects/?grade_level=${encodeURIComponent(grade)}`,
        { headers: { ...authHeader } }
      );
      if (res.ok) {
        const data = await res.json();
        setAllSubjects(data.all_subjects || []);
        setSubjects(
          (data.subjects || []).map((s: { subject_code: string; max_score: number }) => ({
            subject_code: s.subject_code,
            max_score: s.max_score,
          }))
        );
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSubjects(false);
    }
  };

  const handleGradeLevelChange = (grade: string) => {
    setGradeLevel(grade);
  };

  const validateStep1 = () => {
    const errs: Record<string, string> = {};
    if (!academicYear) errs.academicYear = "请选择学年";
    if (!name.trim()) errs.name = "请填写考试名称";
    if (!date) errs.date = "请选择考试日期";
    if (!gradeLevel) errs.gradeLevel = "请选择适用年级";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNextStep = async () => {
    if (!validateStep1()) return;
    // Load default subjects for the chosen grade
    await loadDefaultSubjects(gradeLevel);
    setStep(2);
  };

  const handleSubjectChange = (idx: number, field: "subject_code" | "max_score", value: string) => {
    const updated = [...subjects];
    if (field === "subject_code") {
      // check duplicate
      if (subjects.some((s, i) => i !== idx && s.subject_code === value)) {
        alert(`科目"${value}"已存在，请选择其他科目！`);
        return;
      }
      updated[idx] = { ...updated[idx], subject_code: value };
    } else {
      updated[idx] = { ...updated[idx], max_score: value === "" ? "" : Number(value) };
    }
    setSubjects(updated);
  };

  const handleAddSubject = () => {
    setSubjects([...subjects, { subject_code: "", max_score: "" }]);
  };

  const handleRemoveSubject = (idx: number) => {
    setSubjects(subjects.filter((_, i) => i !== idx));
  };

  const validateStep2 = () => {
    const validSubjects = subjects.filter((s) => s.subject_code && s.max_score !== "");
    if (validSubjects.length === 0) {
      alert("至少需要配置一个有效科目！");
      return false;
    }
    const codes = validSubjects.map((s) => s.subject_code);
    if (new Set(codes).size !== codes.length) {
      alert("存在重复的科目，请检查配置！");
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateStep2()) return;
    setSubmitting(true);
    try {
      const payload = {
        academic_year: academicYear,
        name: name.trim(),
        date,
        grade_level: gradeLevel,
        description: description.trim(),
        subjects: subjects
          .filter((s) => s.subject_code && s.max_score !== "")
          .map((s) => ({ subject_code: s.subject_code, max_score: Number(s.max_score) })),
      };
      const res = await fetch(`${backendBaseUrl}/api/exams/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        router.push("/exams");
      } else {
        const data = await res.json();
        const msg = Object.values(data).flat().join("；");
        alert(`创建失败：${msg}`);
      }
    } catch (e) {
      alert("创建时发生错误，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  const gradeLevelLabel =
    options?.grade_levels.find((g) => g.value === gradeLevel)?.label || gradeLevel;

  if (loading) return <div className="p-4">加载中...</div>;
  if (!user) return null;

  return (
    <div>
      {/* 页面头部 */}
      <div className="page-header">
        <div className="container-fluid">
          <div className="row align-items-center">
            <div className="col-md-8">
              <h1>
                <i className="fas fa-plus-circle me-3"></i>创建考试
              </h1>
              <p className="mb-0 opacity-75">创建新的考试并配置科目信息</p>
            </div>
            <div className="col-md-4 text-end">
              <Link href="/exams" className="btn btn-light border">
                <i className="fas fa-arrow-left me-2"></i>返回列表
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="container" style={{ maxWidth: 760 }}>
        {/* 步骤指示器 */}
        <div className="d-flex align-items-center justify-content-center mb-4 gap-0">
          {/* Step 1 */}
          <div className="d-flex flex-column align-items-center" style={{ minWidth: 100 }}>
            <div
              className={`d-flex align-items-center justify-content-center rounded-circle fw-bold border-2`}
              style={{
                width: 44,
                height: 44,
                fontSize: "1.1rem",
                background: step >= 1 ? "rgb(1,135,108)" : "#e9ecef",
                color: step >= 1 ? "white" : "#6c757d",
                border: `2px solid ${step >= 1 ? "rgb(1,135,108)" : "#dee2e6"}`,
              }}
            >
              {step > 1 ? <i className="fas fa-check" /> : "1"}
            </div>
            <small className={`mt-1 fw-bold ${step >= 1 ? "text-success" : "text-muted"}`}>基本信息</small>
          </div>

          {/* Connector */}
          <div
            style={{
              height: 3,
              width: 120,
              background: step >= 2 ? "rgb(1,135,108)" : "#dee2e6",
              marginBottom: 20,
            }}
          />

          {/* Step 2 */}
          <div className="d-flex flex-column align-items-center" style={{ minWidth: 100 }}>
            <div
              className="d-flex align-items-center justify-content-center rounded-circle fw-bold"
              style={{
                width: 44,
                height: 44,
                fontSize: "1.1rem",
                background: step >= 2 ? "rgb(1,135,108)" : "#e9ecef",
                color: step >= 2 ? "white" : "#6c757d",
                border: `2px solid ${step >= 2 ? "rgb(1,135,108)" : "#dee2e6"}`,
              }}
            >
              2
            </div>
            <small className={`mt-1 fw-bold ${step >= 2 ? "text-success" : "text-muted"}`}>科目配置</small>
          </div>
        </div>

        {/* ── STEP 1 ── */}
        {step === 1 && (
          <div className="card border-0 shadow-sm" style={{ borderRadius: 15 }}>
            <div className="card-body p-4">
              <h5 className="fw-bold mb-4 text-dark">
                <i className="fas fa-info-circle me-2 text-primary"></i>考试基本信息
              </h5>

              <div className="mb-3">
                <label className="form-label fw-bold">
                  学年 <span className="text-danger">*</span>
                </label>
                <select
                  className={`form-select ${errors.academicYear ? "is-invalid" : ""}`}
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                >
                  <option value="">-- 请选择学年 --</option>
                  {options?.academic_years.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {errors.academicYear && <div className="invalid-feedback">{errors.academicYear}</div>}
              </div>

              <div className="mb-3">
                <label className="form-label fw-bold">
                  考试名称 <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className={`form-control ${errors.name ? "is-invalid" : ""}`}
                  placeholder="例：期中考试、期末考试、月考"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                {errors.name && <div className="invalid-feedback">{errors.name}</div>}
              </div>

              <div className="mb-3">
                <label className="form-label fw-bold">
                  考试日期 <span className="text-danger">*</span>
                </label>
                <input
                  type="date"
                  className={`form-control ${errors.date ? "is-invalid" : ""}`}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
                {errors.date && <div className="invalid-feedback">{errors.date}</div>}
              </div>

              <div className="mb-3">
                <label className="form-label fw-bold">
                  适用年级 <span className="text-danger">*</span>
                </label>
                <select
                  className={`form-select ${errors.gradeLevel ? "is-invalid" : ""}`}
                  value={gradeLevel}
                  onChange={(e) => handleGradeLevelChange(e.target.value)}
                >
                  <option value="">-- 请选择年级 --</option>
                  {options?.grade_levels.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {errors.gradeLevel && <div className="invalid-feedback">{errors.gradeLevel}</div>}
                <div className="form-text text-muted">选择年级后，系统将在下一步自动推荐该年级的常考科目和标准满分</div>
              </div>

              <div className="mb-4">
                <label className="form-label fw-bold">考试描述（可选）</label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="可选：填写考试的相关说明或注意事项"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="d-flex justify-content-between">
                <Link href="/exams" className="btn btn-outline-secondary px-4">
                  取消
                </Link>
                <button className="btn btn-primary px-5" onClick={handleNextStep}>
                  下一步：配置科目 <i className="fas fa-arrow-right ms-2"></i>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2 ── */}
        {step === 2 && (
          <div>
            {/* 考试信息摘要 */}
            <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: 15 }}>
              <div className="card-body p-4">
                <h6 className="fw-bold text-dark mb-3">
                  <i className="fas fa-clipboard-check me-2 text-success"></i>考试信息确认
                </h6>
                <div className="row g-2 text-sm">
                  <div className="col-6 col-md-3">
                    <span className="text-muted small">学年</span>
                    <div className="fw-bold">{academicYear}</div>
                  </div>
                  <div className="col-6 col-md-3">
                    <span className="text-muted small">考试名称</span>
                    <div className="fw-bold">{name}</div>
                  </div>
                  <div className="col-6 col-md-3">
                    <span className="text-muted small">考试日期</span>
                    <div className="fw-bold">{date}</div>
                  </div>
                  <div className="col-6 col-md-3">
                    <span className="text-muted small">适用年级</span>
                    <div className="fw-bold">{gradeLevelLabel}</div>
                  </div>
                  {description && (
                    <div className="col-12 mt-1">
                      <span className="text-muted small">描述：</span>
                      <span className="small text-secondary">{description}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 科目配置 */}
            <div className="card border-0 shadow-sm" style={{ borderRadius: 15 }}>
              <div className="card-body p-4">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h5 className="fw-bold text-dark mb-0">
                    <i className="fas fa-book me-2 text-primary"></i>科目配置
                  </h5>
                  <span className="badge bg-secondary">{subjects.filter(s => s.subject_code).length} 个科目</span>
                </div>

                <div className="alert alert-info border-0 py-2 mb-4">
                  <i className="fas fa-lightbulb me-2"></i>
                  系统已根据 <strong>{gradeLevelLabel}</strong> 自动配置常考科目和标准满分，您可以根据实际情况调整或删除科目。
                </div>

                {loadingSubjects ? (
                  <div className="text-center py-3">
                    <div className="spinner-border spinner-border-sm text-primary me-2"></div>
                    正在加载默认科目...
                  </div>
                ) : (
                  <>
                    <div className="table-responsive mb-3">
                      <table className="table table-bordered align-middle mb-0" style={{ minWidth: 400 }}>
                        <thead className="table-light">
                          <tr>
                            <th className="text-center" style={{ width: "50%" }}>科目</th>
                            <th className="text-center" style={{ width: "35%" }}>满分</th>
                            <th className="text-center" style={{ width: "15%" }}>操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {subjects.map((row, idx) => (
                            <tr key={idx}>
                              <td>
                                <select
                                  className="form-select form-select-sm"
                                  value={row.subject_code}
                                  onChange={(e) => handleSubjectChange(idx, "subject_code", e.target.value)}
                                >
                                  <option value="">-- 选择科目 --</option>
                                  {allSubjects.map((s) => (
                                    <option key={s.value} value={s.value}>{s.label}</option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <input
                                  type="number"
                                  className="form-control form-control-sm text-center"
                                  min={1}
                                  value={row.max_score}
                                  onChange={(e) => handleSubjectChange(idx, "max_score", e.target.value)}
                                  placeholder="满分"
                                />
                              </td>
                              <td className="text-center">
                                <button
                                  type="button"
                                  className="btn btn-outline-danger btn-sm"
                                  onClick={() => handleRemoveSubject(idx)}
                                  title="删除此科目"
                                >
                                  <i className="fas fa-trash"></i>
                                </button>
                              </td>
                            </tr>
                          ))}
                          {subjects.length === 0 && (
                            <tr>
                              <td colSpan={3} className="text-center text-muted py-3">
                                暂无科目，点击下方按钮添加
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <button
                      type="button"
                      className="btn btn-outline-success btn-sm mb-4"
                      onClick={handleAddSubject}
                    >
                      <i className="fas fa-plus me-2"></i>添加科目
                    </button>
                  </>
                )}

                <div className="d-flex justify-content-between">
                  <button className="btn btn-outline-secondary px-4" onClick={() => setStep(1)}>
                    <i className="fas fa-arrow-left me-2"></i>上一步
                  </button>
                  <button
                    className="btn btn-success px-5"
                    onClick={handleSubmit}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        创建中...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-check me-2"></i>创建考试
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        .page-header {
          background: rgb(1, 135, 108);
          color: white;
          padding: 2rem 0;
          margin-bottom: 2rem;
          border-radius: 10px;
        }
        .page-header h1 {
          margin: 0;
          font-weight: 600;
        }
        @media (max-width: 768px) {
          .page-header {
            padding: 1rem 0;
            margin-bottom: 1rem;
          }
        }
      `}</style>
    </div>
  );
}

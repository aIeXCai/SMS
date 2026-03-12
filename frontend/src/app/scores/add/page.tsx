"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

type Option = { value: string; label: string };
type StudentItem = {
  id: number;
  student_id: string;
  name: string;
  grade_level: string;
  grade_level_display: string;
  class_name: string;
  display: string;
};

type ScoreOptions = {
  exams: Option[];
  subjects: Option[];
};

const SCORES_API_BASE = "/api/scores";

export default function ScoreAddPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();

  const [options, setOptions] = useState<ScoreOptions | null>(null);
  const [studentQuery, setStudentQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<StudentItem[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentItem | null>(null);
  const [selectedExam, setSelectedExam] = useState("");
  const [scores, setScores] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<{
    duplicate_subjects: string[];
    student_id: number;
    exam_id: number;
  } | null>(null);
  const [resultModal, setResultModal] = useState<{
    show: boolean;
    type: "success" | "error";
    title: string;
    subtitle: string;
    message: string;
  }>({
    show: false,
    type: "success",
    title: "操作结果",
    subtitle: "",
    message: "",
  });

  const authHeader = useMemo(() => {
    if (!token) return undefined;
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  useEffect(() => {
    if (!loading && !token) {
      router.push("/login");
    }
  }, [loading, token, router]);

  useEffect(() => {
    if (!token) return;

    const fetchOptions = async () => {
      try {
        const res = await fetch(`${SCORES_API_BASE}/options/`, { headers: { ...authHeader } });
        if (!res.ok) return;
        const data = await res.json();
        setOptions({ exams: data.exams || [], subjects: data.subjects || [] });
      } catch (e) {
        console.error(e);
      }
    };

    fetchOptions();
  }, [token, authHeader]);

  useEffect(() => {
    const q = studentQuery.trim();
    if (!q || selectedStudent?.display === studentQuery) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSearchLoading(true);
        const res = await fetch(`${SCORES_API_BASE}/student-search/?q=${encodeURIComponent(q)}`, {
          headers: { ...authHeader },
        });
        const data = await res.json().catch(() => ({ results: [] }));
        if (!res.ok) {
          setSearchResults([]);
          return;
        }
        setSearchResults(data.results || []);
      } catch (e) {
        console.error(e);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [studentQuery, authHeader, selectedStudent]);

  const handleSelectStudent = (student: StudentItem) => {
    setSelectedStudent(student);
    setStudentQuery(student.display);
    setSearchResults([]);
  };

  const updateScore = (subject: string, value: string) => {
    setScores((prev) => ({ ...prev, [subject]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setDuplicateInfo(null);

    if (!selectedStudent) {
      const message = "请选择学生";
      setErrorMessage(message);
      setResultModal({
        show: true,
        type: "error",
        title: "输入错误",
        subtitle: "缺少必要信息",
        message,
      });
      return;
    }
    if (!selectedExam) {
      const message = "请选择考试";
      setErrorMessage(message);
      setResultModal({
        show: true,
        type: "error",
        title: "输入错误",
        subtitle: "缺少必要信息",
        message,
      });
      return;
    }

    const hasAny = (options?.subjects || []).some((s) => (scores[s.value] || "").trim() !== "");
    if (!hasAny) {
      const message = "请至少输入一个科目的成绩";
      setErrorMessage(message);
      setResultModal({
        show: true,
        type: "error",
        title: "输入错误",
        subtitle: "请补充成绩后重试",
        message,
      });
      return;
    }

    const payloadScores: Record<string, string> = {};
    (options?.subjects || []).forEach((s) => {
      const val = (scores[s.value] || "").trim();
      if (val !== "") payloadScores[s.value] = val;
    });

    try {
      setSubmitting(true);
      const res = await fetch(`${SCORES_API_BASE}/manual-add/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify({
          student_id: selectedStudent.id,
          exam_id: selectedExam,
          scores: payloadScores,
        }),
      });

      const data = await res.json().catch(() => ({ success: false, message: "提交失败" }));
      const backendMessage = data.message || data.detail || "保存失败";
      if (!res.ok || !data.success) {
        if (data.code === "duplicate_scores") {
          setDuplicateInfo({
            duplicate_subjects: data.duplicate_subjects || [],
            student_id: data.student_id,
            exam_id: data.exam_id,
          });
        }
        setErrorMessage(backendMessage);
        setResultModal({
          show: true,
          type: "error",
          title: "保存失败",
          subtitle: data.code === "duplicate_scores" ? "检测到重复录入" : "操作未完成",
          message: backendMessage,
        });
        return;
      }

      setResultModal({
        show: true,
        type: "success",
        title: "保存成功",
        subtitle: "成绩已录入",
        message: data.message || "成绩已成功保存。",
      });
    } catch (e) {
      console.error(e);
      const message = "网络错误，请稍后重试";
      setErrorMessage(message);
      setResultModal({
        show: true,
        type: "error",
        title: "保存失败",
        subtitle: "网络或服务器异常",
        message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const closeResultModal = () => {
    const shouldGoBack = resultModal.show && resultModal.type === "success";
    setResultModal((prev) => ({ ...prev, show: false }));
    if (shouldGoBack) {
      router.push("/scores");
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
              <h1><i className="fas fa-plus me-3"></i>手动新增成绩</h1>
              <nav aria-label="breadcrumb" className="mt-2">
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item"><Link href="/scores" className="text-white-50">成绩管理</Link></li>
                  <li className="breadcrumb-item active text-white">手动新增成绩</li>
                </ol>
              </nav>
            </div>
            <div className="col-md-4 text-end">
              <Link href="/scores" className="btn btn-light border me-2">
                <i className="fas fa-arrow-left me-2"></i>返回列表
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="container-fluid">
        <div className="alert alert-info help-alert" role="alert">
          <i className="fas fa-lightbulb me-2"></i>
          <strong>操作提示：</strong>选择学生和考试后，输入各科成绩，留空表示不录入该科目。
        </div>

        <div className="form-card">
          <div className="form-card-header">
            <h5 className="mb-0"><i className="fas fa-edit me-2"></i>成绩录入表单</h5>
          </div>
          <div className="form-card-body">
            <form onSubmit={handleSubmit}>
              <div className="row mb-4">
                <div className="col-md-6">
                  <label className="form-label"><i className="fas fa-user me-1"></i>选择学生 <span className="text-danger">*</span></label>
                  <div className="student-search-container">
                    <input
                      className="form-control"
                      placeholder="输入学生姓名、学号或班级进行搜索..."
                      value={studentQuery}
                      onChange={(e) => {
                        setStudentQuery(e.target.value);
                        setSelectedStudent(null);
                      }}
                    />
                    {(searchLoading || searchResults.length > 0) && (
                      <div className="student-search-dropdown">
                        {searchLoading ? (
                          <div className="student-search-loading">搜索中...</div>
                        ) : (
                          searchResults.map((item) => (
                            <div
                              key={item.id}
                              className="student-search-item"
                              onClick={() => handleSelectStudent(item)}
                            >
                              <strong>{item.name}</strong> ({item.student_id})
                              <div className="small text-muted">{item.grade_level_display}{item.class_name}</div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="col-md-6">
                  <label className="form-label"><i className="fas fa-clipboard-list me-1"></i>选择考试 <span className="text-danger">*</span></label>
                  <select className="form-select" value={selectedExam} onChange={(e) => setSelectedExam(e.target.value)}>
                    <option value="">--- 选择考试 ---</option>
                    {(options?.exams || []).map((exam) => (
                      <option key={exam.value} value={exam.value}>{exam.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <h6 className="mb-3">
                  <i className="fas fa-chart-line me-2"></i>各科成绩录入
                  <small className="text-muted">(支持小数)</small>
                </h6>
                <div className="score-grid">
                  {(options?.subjects || []).map((subject) => (
                    <div className="score-item" key={subject.value}>
                      <label>
                        <i className="fas fa-book me-1"></i>{subject.label}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="150"
                        placeholder="请输入分数"
                        value={scores[subject.value] || ""}
                        onChange={(e) => updateScore(subject.value, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {errorMessage && (
                <div className="alert alert-danger">
                  <div className="fw-semibold mb-1">保存失败：{errorMessage}</div>
                  {duplicateInfo && (
                    <>
                      <div className="small mb-2">检测到重复录入科目：</div>
                      <div className="d-flex flex-wrap gap-2 mb-2">
                        {duplicateInfo.duplicate_subjects.map((subject) => (
                          <span key={subject} className="badge bg-danger-subtle text-danger border border-danger-subtle">{subject}</span>
                        ))}
                      </div>
                      <div className="small mb-2">建议：请改为编辑已存在成绩，而不是重复新增。</div>
                      <a
                        href={`/scores/batch-edit?student=${duplicateInfo.student_id}&exam=${duplicateInfo.exam_id}`}
                        className="btn btn-sm btn-outline-danger"
                      >
                        <i className="fas fa-edit me-1"></i>去编辑该考试成绩
                      </a>
                    </>
                  )}
                </div>
              )}

              <div className="d-flex justify-content-between align-items-center pt-3 border-top">
                <div className="text-muted small">
                  <i className="fas fa-info-circle me-1"></i>
                  提示：留空的科目将不会被录入系统
                </div>
                <div>
                  <Link href="/scores" className="btn btn-cancel me-2">
                    <i className="fas fa-times me-1"></i>取消
                  </Link>
                  <button type="submit" className="btn btn-save" disabled={submitting}>
                    <i className="fas fa-save me-1"></i>{submitting ? "保存中..." : "保存成绩"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      {resultModal.show && (
        <div className="custom-modal show" onClick={(e) => e.currentTarget === e.target && closeResultModal()}>
          <div className="modal-content">
            <div className={`modal-header ${resultModal.type}`}>
              <h5>
                <i className={`fas ${resultModal.type === "success" ? "fa-check" : "fa-exclamation-triangle"} me-2`}></i>
                {resultModal.title}
              </h5>
              <button type="button" className="close" onClick={closeResultModal}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className={`icon ${resultModal.type}`}>
                <i className={`fas ${resultModal.type === "success" ? "fa-check" : "fa-exclamation-triangle"}`}></i>
              </div>
              <h6>{resultModal.subtitle}</h6>
              <p>{resultModal.message}</p>

              {resultModal.type === "error" && duplicateInfo && (
                <div className="mt-3 text-start">
                  <div className="small mb-2">检测到重复录入科目：</div>
                  <div className="d-flex flex-wrap gap-2 mb-2">
                    {duplicateInfo.duplicate_subjects.map((subject) => (
                      <span key={subject} className="badge bg-danger-subtle text-danger border border-danger-subtle">{subject}</span>
                    ))}
                  </div>
                  <div className="small mb-2">建议：请改为编辑已存在成绩，而不是重复新增。</div>
                  <a
                    href={`/scores/batch-edit?student=${duplicateInfo.student_id}&exam=${duplicateInfo.exam_id}`}
                    className="btn btn-sm btn-outline-danger"
                  >
                    <i className="fas fa-edit me-1"></i>去编辑该考试成绩
                  </a>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className={`btn-modal ${resultModal.type === "success" ? "btn-success" : "btn-primary"}`}
                onClick={closeResultModal}
              >
                <i className={`fas ${resultModal.type === "success" ? "fa-check" : "fa-redo"} me-2`}></i>
                {resultModal.type === "success" ? "确定" : "重试"}
              </button>
            </div>
          </div>
        </div>
      )}

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

        .form-card {
          background: white;
          border-radius: 15px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          overflow: hidden;
          margin-bottom: 2rem;
        }

        .form-card-header {
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          padding: 1.5rem;
          border-bottom: 1px solid #dee2e6;
        }

        .form-card-body {
          padding: 2rem;
        }

        .score-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1rem;
          margin-top: 1.5rem;
        }

        .score-item {
          background: #f8f9fa;
          border: 2px solid #e9ecef;
          border-radius: 10px;
          padding: 1rem;
          transition: all 0.3s ease;
        }

        .score-item:hover {
          border-color: #007bff;
          box-shadow: 0 2px 8px rgba(0, 123, 255, 0.15);
        }

        .score-item label {
          font-weight: 600;
          color: #495057;
          margin-bottom: 0.5rem;
          display: block;
        }

        .score-item input {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid #ced4da;
          border-radius: 8px;
          text-align: center;
          font-size: 1.1rem;
          font-weight: 500;
        }

        .help-alert {
          background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
          border: none;
          border-radius: 10px;
          color: #1565c0;
        }

        .btn-save {
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          border: none;
          padding: 0.75rem 2rem;
          font-weight: 600;
          border-radius: 10px;
          color: white;
        }

        .btn-cancel {
          background: linear-gradient(135deg, #6c757d 0%, #495057 100%);
          border: none;
          padding: 0.75rem 2rem;
          font-weight: 600;
          border-radius: 10px;
          color: white;
        }

        .student-search-container {
          position: relative;
        }

        .student-search-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: white;
          border: 1px solid #ced4da;
          border-top: none;
          border-radius: 0 0 8px 8px;
          max-height: 200px;
          overflow-y: auto;
          z-index: 1000;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .student-search-item {
          padding: 0.75rem;
          cursor: pointer;
          border-bottom: 1px solid #f8f9fa;
        }

        .student-search-item:hover {
          background-color: #f8f9fa;
        }

        .student-search-loading {
          padding: 0.75rem;
          text-align: center;
          color: #6c757d;
          font-style: italic;
        }

        .custom-modal {
          display: none;
          position: fixed;
          z-index: 1050;
          left: 0;
          top: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(5px);
        }

        .custom-modal.show {
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn 0.3s ease;
        }

        .modal-content {
          background: white;
          border-radius: 15px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
          max-width: 500px;
          width: 90%;
          overflow: hidden;
          animation: slideInDown 0.3s ease;
        }

        .modal-header {
          color: white;
          padding: 1.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .modal-header.success {
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
        }

        .modal-header.error {
          background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
        }

        .modal-header h5 {
          margin: 0;
          font-weight: 600;
          display: flex;
          align-items: center;
        }

        .modal-header .close {
          background: none;
          border: none;
          color: white;
          font-size: 1.5rem;
          cursor: pointer;
          opacity: 0.8;
        }

        .modal-body {
          padding: 2rem;
          text-align: center;
        }

        .modal-body .icon {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 1.5rem;
          margin: 0 auto 1rem;
        }

        .modal-body .icon.success {
          background: linear-gradient(135deg, #28a745, #20c997);
        }

        .modal-body .icon.error {
          background: linear-gradient(135deg, #dc3545, #c82333);
        }

        .modal-body h6 {
          color: #495057;
          margin-bottom: 1rem;
          font-weight: 600;
        }

        .modal-body p {
          color: #6c757d;
          margin-bottom: 0;
          line-height: 1.6;
        }

        .modal-footer {
          background: #f8f9fa;
          padding: 1rem 2rem;
          display: flex;
          justify-content: center;
          gap: 1rem;
        }

        .btn-modal {
          padding: 0.6rem 1.5rem;
          border: none;
          border-radius: 20px;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-modal.btn-primary {
          background: linear-gradient(135deg, #007bff, #0056b3);
          color: white;
        }

        .btn-modal.btn-success {
          background: linear-gradient(135deg, #28a745, #20c997);
          color: white;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideInDown {
          from {
            opacity: 0;
            transform: translateY(-30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

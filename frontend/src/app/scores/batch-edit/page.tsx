"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

type SubjectOption = { value: string; label: string };

type EditDetail = {
  student: {
    id: number;
    name: string;
    student_id: string;
    grade_level: string;
    grade_level_display: string;
    class_name: string;
  };
  exam: {
    id: number;
    name: string;
    academic_year: string;
    date: string;
  };
  subjects: SubjectOption[];
  existing_scores: Record<string, number>;
  subject_max_scores: Record<string, number>;
};

const SCORES_API_BASE = "/api/scores";

export default function ScoreBatchEditPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const [studentId, setStudentId] = useState("");
  const [examId, setExamId] = useState("");
  const [paramsReady, setParamsReady] = useState(false);

  const [detail, setDetail] = useState<EditDetail | null>(null);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setStudentId(
      params.get("student") ||
      params.get("student_id") ||
      ""
    );
    setExamId(
      params.get("exam") ||
      params.get("exam_id") ||
      ""
    );
    setParamsReady(true);
  }, []);

  useEffect(() => {
    if (!token) return;
    if (!paramsReady) return;

    const fetchDetail = async () => {
      if (!studentId || !examId) {
        setErrorMessage("缺少必要参数：学生ID或考试ID");
        setLoadingData(false);
        return;
      }

      try {
        setLoadingData(true);
        setErrorMessage(null);
        const res = await fetch(
          `${SCORES_API_BASE}/batch-edit-detail/?student=${encodeURIComponent(studentId)}&exam=${encodeURIComponent(examId)}`,
          { headers: { ...authHeader } }
        );
        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data.success) {
          setErrorMessage(data.message || "加载编辑信息失败");
          setLoadingData(false);
          return;
        }

        setDetail(data);

        const initScores: Record<string, string> = {};
        (data.subjects || []).forEach((subject: SubjectOption) => {
          const value = data.existing_scores?.[subject.value];
          initScores[subject.value] = value === undefined || value === null ? "" : String(value);
        });
        setScores(initScores);
      } catch (e) {
        console.error(e);
        setErrorMessage("加载编辑信息失败");
      } finally {
        setLoadingData(false);
      }
    };

    fetchDetail();
  }, [token, authHeader, studentId, examId, paramsReady]);

  const handleScoreChange = (subjectCode: string, value: string) => {
    setScores((prev) => ({ ...prev, [subjectCode]: value }));
  };

  const validateScores = (): string | null => {
    if (!detail) return "页面数据未加载完成";

    const filled = detail.subjects.filter((s) => (scores[s.value] || "").trim() !== "");
    if (!filled.length) {
      return "请至少输入一门科目的成绩后再保存。";
    }

    for (const subject of detail.subjects) {
      const raw = (scores[subject.value] || "").trim();
      if (!raw) continue;
      const parsed = Number(raw);
      const maxScore = Number(detail.subject_max_scores?.[subject.value] ?? 100);
      if (Number.isNaN(parsed) || parsed < 0 || parsed > maxScore) {
        return `${subject.label}的分数必须在0-${maxScore}分之间，请检查后重试。`;
      }
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const validationError = validateScores();
    if (validationError) {
      setErrorMessage(validationError);
      setResultModal({
        show: true,
        type: "error",
        title: "输入错误",
        subtitle: "请检查分数后重试",
        message: validationError,
      });
      return;
    }

    if (!detail) return;

    try {
      setSaving(true);
      const res = await fetch(`${SCORES_API_BASE}/batch-edit-save/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify({
          student_id: detail.student.id,
          exam_id: detail.exam.id,
          scores,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        const message = data.message || "保存失败";
        setErrorMessage(message);
        setResultModal({
          show: true,
          type: "error",
          title: "保存失败",
          subtitle: "操作未完成",
          message,
        });
        return;
      }

      setResultModal({
        show: true,
        type: "success",
        title: "保存成功",
        subtitle: "成绩已更新",
        message: data.message || "成绩已成功保存并更新排名。",
      });
    } catch (e) {
      console.error(e);
      const message = "保存失败，请稍后重试";
      setErrorMessage(message);
      setResultModal({
        show: true,
        type: "error",
        title: "保存失败",
        subtitle: "网络或服务器异常",
        message,
      });
    } finally {
      setSaving(false);
    }
  };

  const closeResultModal = () => {
    const shouldGoBack = resultModal.show && resultModal.type === "success";
    setResultModal((prev) => ({ ...prev, show: false }));
    if (shouldGoBack) {
      router.push("/scores");
    }
  };

  if (loading || loadingData) return <div className="p-4">加载中...</div>;
  if (!user) return null;

  return (
    <div>
      <div className="page-header animate-in">
        <div className="container-fluid">
          <div className="row align-items-center">
            <div className="col-md-8">
              <h1><i className="fas fa-edit me-3"></i>成绩编辑</h1>
              <nav aria-label="breadcrumb" className="mt-2">
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item"><Link href="/scores" className="text-white-50">成绩管理</Link></li>
                  <li className="breadcrumb-item active text-white">编辑成绩</li>
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
        <div className="alert help-alert animate-in" role="alert">
          <i className="fas fa-lightbulb me-2"></i>
          <strong>操作提示：</strong>输入分数后点击保存，留空表示删除该科目成绩。
        </div>

        {errorMessage && <div className="alert alert-danger">{errorMessage}</div>}

        {detail && (
          <>
            <div className="card student-info-card animate-in">
              <h5 className="student-info-header">
                <i className="fas fa-user-graduate me-2"></i>学生信息
              </h5>
              <div className="student-info-body">
                <div className="row">
                  <div className="col-md-6">
                    <div className="info-item">
                      <div className="info-icon"><i className="fas fa-user"></i></div>
                      <div><strong>学生姓名：</strong>{detail.student.name}</div>
                    </div>
                    <div className="info-item">
                      <div className="info-icon"><i className="fas fa-id-card"></i></div>
                      <div><strong>学号：</strong>{detail.student.student_id}</div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="info-item">
                      <div className="info-icon"><i className="fas fa-graduation-cap"></i></div>
                      <div>
                        <strong>年级班级：</strong>
                        {detail.student.grade_level_display || "未设置"} {detail.student.class_name || "未分班"}
                      </div>
                    </div>
                    <div className="info-item">
                      <div className="info-icon"><i className="fas fa-clipboard-list"></i></div>
                      <div><strong>考试：</strong>{detail.exam.name} ({detail.exam.academic_year})</div>
                    </div>
                  </div>
                </div>
                <div className="info-item mt-2">
                  <div className="info-icon"><i className="fas fa-calendar-alt"></i></div>
                  <div><strong>考试日期：</strong>{detail.exam.date?.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$1年$2月$3日")}</div>
                </div>
              </div>
            </div>

            <div className="card score-form-card animate-in">
              <h5 className="score-form-header">
                <i className="fas fa-pencil-alt me-2"></i>成绩录入
              </h5>

              <form onSubmit={handleSubmit} id="scoreForm">
                <div className="score-grid">
                  {detail.subjects.map((subject) => (
                    <div className="score-item" key={subject.value}>
                      <label className="score-label" htmlFor={`score_${subject.value}`}>
                        <div className="subject-icon"><i className="fas fa-book-open"></i></div>
                        {subject.label}
                      </label>
                      <input
                        type="number"
                        className="score-input"
                        id={`score_${subject.value}`}
                        name={`score_${subject.value}`}
                        value={scores[subject.value] || ""}
                        step="0.5"
                        min="0"
                        max={detail.subject_max_scores?.[subject.value] ?? 100}
                        onChange={(e) => handleScoreChange(subject.value, e.target.value)}
                        data-subject-name={subject.label}
                        placeholder={`0 - ${detail.subject_max_scores?.[subject.value] ?? 100}`}
                      />
                    </div>
                  ))}
                </div>

                <div className="action-buttons">
                  <button type="submit" className="btn btn-save" disabled={saving}>
                    <i className="fas fa-save me-2"></i>{saving ? "保存中..." : "保存所有成绩"}
                  </button>
                  <Link href="/scores" className="btn btn-cancel">
                    <i className="fas fa-times me-2"></i>取消
                  </Link>
                </div>
              </form>
            </div>
          </>
        )}
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
          border-radius: 15px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }

        .page-header h1 {
          margin: 0;
          font-weight: 600;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .student-info-card {
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          border: none;
          border-radius: 15px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          margin-bottom: 2rem;
          overflow: hidden;
        }

        .student-info-header {
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          color: white;
          padding: 1rem 1.5rem;
          margin: 0;
        }

        .student-info-body {
          padding: 1.5rem;
        }

        .info-item {
          display: flex;
          align-items: center;
          margin-bottom: 0.8rem;
          padding: 0.5rem;
          background: rgba(255, 255, 255, 0.7);
          border-radius: 8px;
        }

        .info-icon {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #007bff, #0056b3);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          margin-right: 1rem;
          font-size: 0.9rem;
        }

        .score-form-card {
          background: white;
          border: none;
          border-radius: 15px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          overflow: hidden;
        }

        .score-form-header {
          background: linear-gradient(135deg, #6f42c1 0%, #e83e8c 100%);
          color: white;
          padding: 1rem 1.5rem;
          margin: 0;
        }

        .score-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.5rem;
          padding: 2rem;
        }

        .score-item {
          background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
          border: 2px solid #e9ecef;
          border-radius: 12px;
          padding: 1.5rem;
          transition: all 0.3s ease;
        }

        .score-label {
          font-weight: 600;
          color: #495057;
          margin-bottom: 0.8rem;
          display: flex;
          align-items: center;
          font-size: 1rem;
        }

        .subject-icon {
          width: 24px;
          height: 24px;
          background: linear-gradient(135deg, #17a2b8, #138496);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          margin-right: 0.5rem;
          font-size: 0.7rem;
        }

        .score-input {
          width: 100%;
          padding: 0.8rem 1rem;
          border: 2px solid #e9ecef;
          border-radius: 8px;
          font-size: 1.1rem;
          text-align: center;
          font-weight: 500;
          background: white;
        }

        .help-alert {
          background: linear-gradient(135deg, #d1ecf1 0%, #bee5eb 100%);
          border: none;
          border-radius: 12px;
          border-left: 4px solid #17a2b8;
          margin-bottom: 2rem;
        }

        .action-buttons {
          background: #f8f9fa;
          padding: 1.5rem 2rem;
          border-top: 1px solid #e9ecef;
          display: flex;
          gap: 1rem;
          justify-content: center;
        }

        .btn-save {
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          border: none;
          color: white;
          padding: 0.8rem 2rem;
          border-radius: 25px;
          font-weight: 600;
        }

        .btn-cancel {
          background: linear-gradient(135deg, #6c757d 0%, #5a6268 100%);
          border: none;
          color: white;
          padding: 0.8rem 2rem;
          border-radius: 25px;
          font-weight: 600;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
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

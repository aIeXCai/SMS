"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { canWriteStudents } from "@/lib/permissions";

const backendBaseUrl = typeof window !== "undefined" ? `http://${window.location.hostname}:8000` : "http://localhost:8000";

export default function BatchPromotePage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const canStudentWrite = canWriteStudents(user);

  const [studentIds, setStudentIds] = useState<number[]>([]);
  const [statsChoices, setStatsChoices] = useState({
    grade_level_choices: [] as string[],
  });

  const [formData, setFormData] = useState({
    target_grade_level: "",
    current_grade_level: "",
    auto_create_classes: false,
  });

  const [isInitializing, setIsInitializing] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const authHeader = useMemo(() => {
    if (!token) return undefined;
    return {
      Authorization: `Bearer ${token}`,
    };
  }, [token]);

  useEffect(() => {
    if (!token) return;

    const storedIds = localStorage.getItem("selectedStudentIdsForPromote");
    if (storedIds) {
      try {
        const ids = JSON.parse(storedIds);
        setStudentIds(ids);
      } catch (e) {
        console.error("无法解析选中的学生 ID", e);
      }
    }

    const fetchStats = async () => {
      try {
        const statsRes = await fetch(`${backendBaseUrl}/api/students/stats/`, {
          headers: { ...authHeader }
        });
        if (statsRes.ok) {
          const data = await statsRes.json();
          setStatsChoices({
            grade_level_choices: data.grade_level_choices || [],
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsInitializing(false);
      }
    };

    fetchStats();
  }, [token, authHeader]);

  useEffect(() => {
    if (!loading && user && !canStudentWrite) {
      router.replace("/students");
    }
  }, [loading, user, canStudentWrite, router]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !studentIds.length) return;

    setIsSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch(`${backendBaseUrl}/api/students/batch-promote/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify({
          student_ids: studentIds,
          target_grade_level: formData.target_grade_level,
          current_grade_level: formData.current_grade_level || undefined,
          auto_create_classes: formData.auto_create_classes,
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(data.message || `成功升年级！`);
        // 可选：展示 errors 如果有部分失败
        if (data.errors && data.errors.length) {
          setErrorMsg("部分学生升年级失败:\n" + data.errors.join("\n"));
        } else {
          // 全部成功，清除 localStorage
          localStorage.removeItem("selectedStudentIdsForPromote");
          setTimeout(() => {
            router.push("/students");
          }, 1500);
        }
      } else {
        setErrorMsg(data.message || "请求失败，请检查填写内容。");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("网络异常或服务器错误");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || isInitializing) return <div className="text-center py-5">加载中...</div>;
  if (!user) {
    router.push("/login");
    return null;
  }
  if (!canStudentWrite) return null;

  return (
    <div>
      {/* 页面头部 */}
      <div className="page-header">
        <div className="container-fluid">
          <div className="row align-items-center">
            <div className="col-md-8">
              <h1>
                <i className="fas fa-level-up-alt me-3"></i>批量升年级
              </h1>
              <p className="mb-0 opacity-75">批量升级学生年级，自动调整班级信息</p>
            </div>
            <div className="col-md-4 text-end">
              <Link href="/students" className="btn btn-outline-light">
                <i className="fas fa-arrow-left me-1"></i>返回列表
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="container-fluid">
        {successMsg && (
          <div className="alert alert-success alert-dismissible fade show mb-3" role="alert">
            <i className="fas fa-info-circle me-2"></i>{successMsg}
            <button type="button" className="btn-close" onClick={() => setSuccessMsg("")}></button>
          </div>
        )}
        {errorMsg && (
          <div className="alert alert-danger alert-dismissible fade show mb-3" role="alert" style={{ whiteSpace: "pre-wrap" }}>
            <i className="fas fa-exclamation-triangle me-2"></i>{errorMsg}
            <button type="button" className="btn-close" onClick={() => setErrorMsg("")}></button>
          </div>
        )}

        <div className="row justify-content-center">
          <div className="col-lg-8">
            {/* 升年级操作卡片 */}
            <div className="card promote-card mb-5">
              <div className="card-header">
                <h5 className="mb-0 text-info">
                  <i className="fas fa-graduation-cap me-2"></i>批量升年级操作
                </h5>
              </div>
              <div className="card-body">
                {/* 选中学生信息 */}
                <div className="selected-students-preview text-center">
                  <div className="row align-items-center">
                    <div className="col-md-4">
                      <div className="student-count">{studentIds.length}</div>
                      <small className="text-muted">选中学生</small>
                    </div>
                    <div className="col-md-8">
                      <h6 className="mb-2">
                        <i className="fas fa-users text-primary me-2"></i>已选择学生
                      </h6>
                      <p className="mb-0 text-muted">
                        您已选择了 <span className="fw-bold text-primary">{studentIds.length}</span> 名学生进行升年级操作
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* 操作说明 */}
                <div className="info-box">
                  <div className="info-icon">
                    <i className="fas fa-lightbulb"></i>
                  </div>
                  <h6 className="text-success fw-bold mb-2">操作说明</h6>
                  <p className="mb-0 text-muted">
                    升年级操作将自动为学生分配到对应年级的班级。如果目标班级不存在，系统将自动创建新班级。
                  </p>
                </div>
                
                {/* 警告提示 */}
                <div className="warning-box">
                  <div className="warning-icon text-center">
                    <i className="fas fa-exclamation-triangle"></i>
                  </div>
                  <h6 className="text-warning fw-bold mb-2">
                    <i className="fas fa-exclamation-triangle me-2"></i>重要提示
                  </h6>
                  <ul className="mb-0 text-muted list-unstyled text-start d-inline-block mx-auto" style={{ maxWidth: '400px' }}>
                    <li><i className="fas fa-check text-warning me-2"></i>升年级操作将修改学生所属班级信息</li>
                    <li><i className="fas fa-check text-warning me-2"></i>如果目标班级不存在，系统可能会自动创建</li>
                    <li><i className="fas fa-check text-warning me-2"></i>此操作执行后不可撤销，请谨慎操作</li>
                  </ul>
                </div>
                
                {/* 升年级表单 */}
                <form onSubmit={handleSubmit}>
                  
                  {/* 目标年级选择 */}
                  <div className="form-group-custom">
                    <label htmlFor="target_grade_level" className="form-label">
                      <i className="fas fa-graduation-cap me-2 text-info"></i>目标年级
                    </label>
                    <select 
                      className="form-select" 
                      name="target_grade_level" 
                      id="target_grade_level" 
                      value={formData.target_grade_level}
                      onChange={handleChange}
                      required
                    >
                      <option value="">请选择目标年级</option>
                      {statsChoices.grade_level_choices.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <div className="form-text">
                      <i className="fas fa-info-circle me-1"></i>学生将要升入的年级
                    </div>
                  </div>
                  
                  {/* 当前年级选择（可选） */}
                  <div className="form-group-custom">
                    <label htmlFor="current_grade_level" className="form-label">
                      <i className="fas fa-filter me-2 text-secondary"></i>限定当前年级 (可选)
                    </label>
                    <select 
                      className="form-select" 
                      name="current_grade_level" 
                      id="current_grade_level"
                      value={formData.current_grade_level}
                      onChange={handleChange}
                    >
                      <option value="">不限定（全部选中学生均执行）</option>
                      {statsChoices.grade_level_choices.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <div className="form-text">
                      <i className="fas fa-info-circle me-1"></i>如果设置，只有属于此年级的选中学生才会被升级
                    </div>
                  </div>
                  
                  {/* 自动创建班级选项 */}
                  <div className="form-group-custom mt-4">
                    <div className="form-check form-switch ps-0 d-flex align-items-center">
                      <div className="me-3">
                        <input 
                          type="checkbox" 
                          className="form-check-input ms-0" 
                          name="auto_create_classes" 
                          id="auto_create_classes" 
                          checked={formData.auto_create_classes}
                          onChange={handleChange}
                        />
                      </div>
                      <div>
                        <label className="form-check-label fw-medium mb-0" htmlFor="auto_create_classes">
                          <i className="fas fa-plus-circle me-2 text-success"></i>自动创建缺失的目标班级
                        </label>
                        <div className="form-text mt-1">
                          <i className="fas fa-info-circle me-1"></i>例如：某生原为"一年级1班"，如勾选此项，在目标年级找不到"1班"时会自动创建"{formData.target_grade_level || '目标年级'}1班"
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="d-flex justify-content-center mt-5">
                    <div className="btn-group-custom d-flex">
                      <Link href="/students" className="btn btn-outline-secondary btn-custom me-3">
                        <i className="fas fa-times me-2"></i>取消
                      </Link>
                      <button type="submit" className="btn btn-info-custom btn-custom" disabled={isSubmitting || studentIds.length === 0}>
                        <i className="fas fa-save me-2"></i>
                        {isSubmitting ? "处理中..." : "确认升年级"}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .page-header {
          background: rgb(1,135, 108);
          color: white;
          padding: 2rem 0;
          margin-bottom: 2rem;
          border-radius: 10px;
        }

        .page-header h1 {
          margin: 0;
          font-weight: 600;
        }

        .promote-card {
          border: none;
          border-radius: 15px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          overflow: hidden;
          border-left: 4px solid #17a2b8;
        }

        .promote-card .card-header {
          background: linear-gradient(135deg, #d1ecf1 0%, #bee5eb 100%);
          border-bottom: 1px solid #bee5eb;
          padding: 1.5rem;
        }

        .promote-card .card-body {
          padding: 2rem;
        }

        .info-box {
          background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
          border: 1px solid #c3e6cb;
          border-radius: 10px;
          padding: 1.5rem;
          margin-bottom: 2rem;
          text-align: center;
        }

        .info-box .info-icon {
          font-size: 2.5rem;
          color: #155724;
          margin-bottom: 1rem;
        }

        .warning-box {
          background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
          border: 1px solid #ffeaa7;
          border-radius: 10px;
          padding: 1.5rem;
          margin-bottom: 2rem;
        }

        .warning-box .warning-icon {
          font-size: 2rem;
          color: #856404;
          margin-bottom: 1rem;
        }

        .form-group-custom {
          margin-bottom: 1.5rem;
        }

        .form-group-custom label.form-label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 500;
          color: #495057;
          font-size: 0.95rem;
        }

        .form-group-custom .form-select {
          height: calc(3.5rem + 2px);
          padding: 1rem 0.75rem;
          border-radius: 10px;
          border: 2px solid #e9ecef;
          transition: all 0.3s ease;
          background-color: #fff;
          font-size: 1rem;
        }

        .form-group-custom .form-select:focus {
          border-color: #17a2b8;
          box-shadow: 0 0 0 0.2rem rgba(23, 162, 184, 0.25);
          outline: 0;
        }

        .form-group-custom .form-text {
          margin-top: 0.25rem;
          font-size: 0.875rem;
          color: #6c757d;
        }

        .form-switch .form-check-input {
          width: 3em;
          height: 1.5em;
          cursor: pointer;
        }
        
        .form-switch .form-check-input:checked {
          background-color: #17a2b8;
          border-color: #17a2b8;
        }

        .btn-group-custom {
          gap: 1rem;
        }

        .btn-custom {
          padding: 0.75rem 2rem;
          font-weight: 500;
          border-radius: 25px;
          transition: all 0.3s ease;
          min-width: 150px;
        }

        .btn-custom:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }

        .btn-info-custom {
          background: linear-gradient(135deg, #17a2b8 0%, #138496 100%);
          border: none;
          color: white;
        }

        .btn-info-custom:hover {
          background: linear-gradient(135deg, #138496 0%, #117a8b 100%);
          color: white;
        }

        .selected-students-preview {
          background: #f8f9fa;
          border-radius: 10px;
          padding: 1.5rem;
          margin-bottom: 2rem;
          border-left: 4px solid #007bff;
        }

        .student-count {
          font-size: 2rem;
          font-weight: bold;
          color: #007bff;
        }

        @media (max-width: 768px) {
          .page-header {
            padding: 1rem 0;
            margin-bottom: 1rem;
          }
          
          .promote-card .card-body {
            padding: 1rem;
          }
          
          .btn-group-custom {
            flex-direction: column;
          }

          .btn-custom {
            width: 100%;
            margin-bottom: 0.5rem;
          }
        }
      `}</style>
    </div>
  );
}

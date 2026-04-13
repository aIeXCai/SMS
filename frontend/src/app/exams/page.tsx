"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { canWriteExams } from "@/lib/permissions";

type Exam = {
  id: number;
  name: string;
  academic_year: string;
  grade_level: string;
  date: string;
  description: string;
};

type Option = {
  value: string;
  label: string;
};

type ExamOptions = {
  academic_years: Option[];
  grade_levels: Option[];
};

const backendBaseUrl = typeof window !== "undefined" ? `http://${window.location.hostname}:8000` : "http://localhost:8000";

export default function ExamsList() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const canExamWrite = canWriteExams(user);

  const [exams, setExams] = useState<Exam[]>([]);
  const [options, setOptions] = useState<ExamOptions | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Filters
  const [academicYear, setAcademicYear] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [academicYearDropdownOpen, setAcademicYearDropdownOpen] = useState(false);
  const [gradeLevelDropdownOpen, setGradeLevelDropdownOpen] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  
  // Modals
  const [deleteData, setDeleteData] = useState<{ id: number; name: string } | null>(null);

  const authHeader = useMemo(() => {
    if (!token) return undefined;
    return {
      Authorization: `Bearer ${token}`,
    };
  }, [token]);

  const fetchOptions = async () => {
    try {
      const res = await fetch(`${backendBaseUrl}/api/exams/options/`, {
        headers: { ...authHeader }
      });
      if (res.ok) {
        const data = await res.json();
        setOptions(data);
      }
    } catch (e) {
      console.error("Fetch options failed", e);
    }
  };

  const fetchExams = async (page = 1) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: pageSize.toString(),
      });
      if (academicYear) params.append("academic_year", academicYear);
      if (gradeLevel) params.append("grade_level", gradeLevel);

      const res = await fetch(`${backendBaseUrl}/api/exams/?${params.toString()}`, {
        headers: { ...authHeader }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.results) {
          setExams(data.results);
          setTotalCount(data.count);
        } else {
          setExams(data);
          setTotalCount(data.length);
        }
      }
    } catch (e) {
      console.error("Fetch exams failed", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!loading && !token) {
      router.push("/login");
    }
  }, [loading, token, router]);

  useEffect(() => {
    if (!token) return;
    fetchOptions();
  }, [token, authHeader]);

  useEffect(() => {
    if (!token) return;
    fetchExams(currentPage);
  }, [token, authHeader, currentPage, academicYear, gradeLevel]);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".app-custom-dropdown")) {
        setAcademicYearDropdownOpen(false);
        setGradeLevelDropdownOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const handleFilter = () => {
    if (currentPage === 1) {
      // 页码已在第1页，useEffect 不会因页码变化而触发，需手动刷新
      fetchExams(1);
    } else {
      // 重置到第1页会触发 useEffect 自动刷新，无需手动调用
      setCurrentPage(1);
    }
  };

  const resetFilters = () => {
    setAcademicYear("");
    setGradeLevel("");
    setCurrentPage(1);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteData) return;
    try {
      const res = await fetch(`${backendBaseUrl}/api/exams/${deleteData.id}/`, {
        method: "DELETE",
        headers: { ...authHeader }
      });
      if (res.ok) {
        setDeleteData(null);
        fetchExams(currentPage);
      } else {
        alert("删除失败");
      }
    } catch (e) {
      alert("删除时发生错误");
    }
  };

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
                <i className="fas fa-clipboard-list me-3"></i>考试管理
              </h1>
              <p className="mb-0 opacity-75">管理学校的各类考试信息</p>
            </div>
            <div className="col-md-4 text-end">
              {canExamWrite && (
                <Link href="/exams/create" className="btn btn-light border">
                  <i className="fas fa-plus me-2"></i>创建考试
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container-fluid">
      {/* 统计信息 */}
      <div className="row mb-4">
        <div className="col-lg-3 col-md-6 mb-3">
          <div className="card stats-card border-0 shadow-sm transition-all" style={{ borderRadius: '15px' }}>
            <div className="card-body p-4">
              <div className="d-flex align-items-center">
                <div className="stats-icon bg-primary text-white rounded-circle me-3 d-flex align-items-center justify-content-center shadow-sm" style={{ width: '60px', height: '60px', fontSize: '1.5rem' }}>
                  <i className="fas fa-clipboard-list"></i>
                </div>
                <div>
                  <h5 className="card-title mb-0 fw-bold fs-4">{totalCount}</h5>
                  <p className="card-text text-muted mb-0">总考试数</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 筛选模块 */}
      <div className="card app-filter-card border-0">
        <div className="card-header">
          <h5 className="mb-0">
            <i className="fas fa-filter me-2"></i>筛选条件
          </h5>
        </div>
        <div className="card-body p-4">
          <div className="row g-3 align-items-end">
            <div className="col-md-3">
              <label className="form-label small fw-bold" style={{ color: '#5a6b63' }}>学年</label>
              <div className="app-custom-dropdown">
                <button
                  type="button"
                  className={`app-custom-dropdown-toggle ${academicYearDropdownOpen ? "active" : ""}`}
                  onClick={() => setAcademicYearDropdownOpen(v => !v)}
                >
                  <span>{academicYear ? options?.academic_years.find(o => o.value === academicYear)?.label || academicYear : "全部学年"}</span>
                  <i className="fas fa-chevron-down app-custom-dropdown-arrow"></i>
                </button>
                <div className={`app-custom-dropdown-menu ${academicYearDropdownOpen ? "show" : ""}`}>
                  <button type="button" className="app-custom-dropdown-item" onClick={() => { setAcademicYear(""); setAcademicYearDropdownOpen(false); }}>
                    全部学年
                  </button>
                  {options?.academic_years.map(oy => (
                    <button key={oy.value} type="button" className="app-custom-dropdown-item" onClick={() => { setAcademicYear(oy.value); setAcademicYearDropdownOpen(false); }}>
                      {oy.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <label className="form-label small fw-bold" style={{ color: '#5a6b63' }}>年级</label>
              <div className="app-custom-dropdown">
                <button
                  type="button"
                  className={`app-custom-dropdown-toggle ${gradeLevelDropdownOpen ? "active" : ""}`}
                  onClick={() => setGradeLevelDropdownOpen(v => !v)}
                >
                  <span>{gradeLevel ? options?.grade_levels.find(o => o.value === gradeLevel)?.label || gradeLevel : "全部年级"}</span>
                  <i className="fas fa-chevron-down app-custom-dropdown-arrow"></i>
                </button>
                <div className={`app-custom-dropdown-menu ${gradeLevelDropdownOpen ? "show" : ""}`}>
                  <button type="button" className="app-custom-dropdown-item" onClick={() => { setGradeLevel(""); setGradeLevelDropdownOpen(false); }}>
                    全部年级
                  </button>
                  {options?.grade_levels.map(og => (
                    <button key={og.value} type="button" className="app-custom-dropdown-item" onClick={() => { setGradeLevel(og.value); setGradeLevelDropdownOpen(false); }}>
                      {og.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="col-md-3 d-flex align-items-end gap-2">
              <button type="button" className="app-btn-primary" onClick={handleFilter}>
                <i className="fas fa-search me-1"></i>筛选
              </button>
              <button type="button" className="app-btn-outline" onClick={resetFilters}>
                <i className="fas fa-undo me-1"></i>重置
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 考试列表 */}
      <div className="card border-0 shadow-sm" style={{ borderRadius: '15px', overflow: 'hidden' }}>
        <div className="card-header bg-white border-bottom-0 py-3 px-4 d-flex justify-content-between align-items-center">
            <h5 className="mb-0 fw-bold text-dark">
                <i className="fas fa-list me-2 text-primary"></i>考试列表
            </h5>
        </div>
        
        {isLoading ? (
          <div className="text-center p-5 text-muted">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">加载中...</span>
            </div>
          </div>
        ) : exams.length > 0 ? (
          <div className="app-table-wrapper">
            <div className="app-table-scroll">
              <table className="app-table">
                  <thead>
                      <tr>
                          <th><i className="fas fa-calendar-alt me-1"></i>学年</th>
                          <th><i className="fas fa-tag me-1"></i>考试名称</th>
                          <th><i className="fas fa-users me-1"></i>适用年级</th>
                          <th><i className="fas fa-clock me-1"></i>考试日期</th>
                          <th><i className="fas fa-info-circle me-1"></i>考试描述</th>
                          <th><i className="fas fa-cogs me-1"></i>操作</th>
                      </tr>
                  </thead>
                  <tbody>
                      {exams.map(exam => (
                        <tr key={exam.id} style={{ cursor: 'pointer' }}>
                            <td>
                                <span className="badge rounded-pill px-3 py-2" style={{ background: '#c8eee8', color: '#01876c', border: '1px solid #8cd4c4', fontSize: '0.9rem' }}>{exam.academic_year}</span>
                            </td>
                            <td>
                                <span className="fw-bold" style={{ color: '#1e2a25' }}>{exam.name}</span>
                            </td>
                            <td>
                                <span className="badge rounded-pill px-3 py-2" style={{ background: '#d4e8fc', color: '#0369a1', border: '1px solid #a0c4e8', fontSize: '0.9rem' }}>
                                  {options?.grade_levels.find(g => g.value === exam.grade_level)?.label || exam.grade_level}
                                </span>
                            </td>
                            <td>
                                <span style={{ color: '#1e2a25' }}>
                                    <i className="fas fa-calendar me-1" style={{ color: '#5a6b63' }}></i>
                                    {exam.date ? exam.date.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$1年$2月$3日') : ''}
                                </span>
                            </td>
                            <td>
                                <span style={{ maxWidth: '200px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: '0 auto', color: '#1e2a25', fontSize: '0.85rem' }}>
                                    {exam.description || "暂无描述"}
                                </span>
                            </td>
                            <td>
                                {canExamWrite ? (
                                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                      <Link href={`/exams/${exam.id}/edit`} className="btn btn-sm" style={{ background: '#b8ddd5', color: '#015a4a', border: '1px solid #8cd4c4' }} title="编辑考试">
                                          <i className="fas fa-edit"></i>
                                      </Link>
                                      <button
                                        type="button"
                                        className="btn btn-sm"
                                        style={{ background: '#fecaca', color: '#b91c1c', border: '1px solid #fca5a5' }}
                                        title="删除考试"
                                        onClick={() => setDeleteData({ id: exam.id, name: exam.name })}
                                      >
                                          <i className="fas fa-trash"></i>
                                      </button>
                                  </div>
                                ) : (
                                  <span className="text-muted">只读</span>
                                )}
                            </td>
                        </tr>
                      ))}
                  </tbody>
              </table>
            </div>
            <div style={{ padding: '14px 16px', borderTop: '1px solid #e2e8e5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafcfb', borderRadius: '0 0 15px 15px' }}>
              <span style={{ color: '#8fa398', fontSize: '0.82rem' }}>共 {totalCount} 条记录</span>
              <div>
                <button className="btn btn-sm" style={{ background: '#fff', color: '#5a6b63', border: '1px solid #e2e8e5', marginRight: '8px' }} disabled={currentPage === 1} onClick={() => setCurrentPage(c => c - 1)}>上一页</button>
                <span style={{ color: '#5a6b63', fontSize: '0.82rem', marginRight: '8px' }}>第 {currentPage} 页</span>
                <button className="btn btn-sm" style={{ background: '#fff', color: '#5a6b63', border: '1px solid #e2e8e5' }} disabled={currentPage * pageSize >= totalCount} onClick={() => setCurrentPage(c => c + 1)}>下一页</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-5 text-muted">
              <i className="fas fa-clipboard-list mb-3 opacity-25" style={{ fontSize: '4rem' }}></i>
              <h5 className="fw-bold mb-2">暂无考试记录</h5>
              <p className="small mb-4">还没有创建任何考试，点击上方按钮开始创建第一个考试吧！</p>
              {canExamWrite && (
                <Link href="/exams/create" className="btn btn-primary px-4 rounded-pill shadow-sm">
                    <i className="fas fa-plus me-2"></i>创建第一个考试
                </Link>
              )}
          </div>
        )}
      </div>

      {/* 删除确认模态框 */}
      {canExamWrite && deleteData && (
        <div className="modal d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '15px' }}>
              <div className="modal-header border-bottom bg-danger text-white" style={{ borderRadius: '15px 15px 0 0' }}>
                <h5 className="modal-title fw-bold">
                  <i className="fas fa-exclamation-triangle me-2"></i>确认删除考试
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setDeleteData(null)}></button>
              </div>
              <div className="modal-body p-4">
                <div className="alert alert-danger border-0 d-flex mb-0">
                  <i className="fas fa-exclamation-triangle fs-3 me-3 mt-1"></i>
                  <div>
                    <h6 className="fw-bold mb-2">危险操作警告</h6>
                    <p className="mb-2">确定要删除考试 <strong>"{deleteData.name}"</strong> 吗？</p>
                    <small className="opacity-75">此操作将同时删除该考试的所有成绩记录，且不可撤销！</small>
                  </div>
                </div>
              </div>
              <div className="modal-footer bg-light border-top-0" style={{ borderRadius: '0 0 15px 15px' }}>
                <button type="button" className="btn btn-light border px-4 shadow-sm" onClick={() => setDeleteData(null)}>取消</button>
                <button type="button" className="btn btn-danger px-4 shadow-sm" onClick={handleDeleteConfirm}>
                  <i className="fas fa-trash me-2"></i>确认删除
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

        .stats-card {
          border: none;
          border-radius: 15px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          transition: transform 0.3s ease;
        }

        .stats-card:hover {
          transform: translateY(-5px);
        }

        .stats-card .card-body {
          padding: 1.5rem;
        }

        .stats-icon {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          color: white;
        }

        @media (max-width: 768px) {
          .page-header {
            padding: 1rem 0;
            margin-bottom: 1rem;
          }

          .stats-card {
            margin-bottom: 1rem;
          }
        }
      `}</style>
    </div>
  );
}
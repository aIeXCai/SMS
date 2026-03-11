"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

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

  const [exams, setExams] = useState<Exam[]>([]);
  const [options, setOptions] = useState<ExamOptions | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Filters
  const [academicYear, setAcademicYear] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  
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
              <Link href="/exams/create" className="btn btn-light border">
                <i className="fas fa-plus me-2"></i>创建考试
              </Link>
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
      <div className="card mb-4 border-0 shadow-sm" style={{ borderRadius: '15px' }}>
        <div className="card-body p-4">
          <h6 className="card-title mb-3 fw-bold text-dark">
            <i className="fas fa-filter me-2 text-primary"></i>筛选条件
          </h6>
          <div className="row g-3">
            <div className="col-md-3">
              <label htmlFor="academicYearFilter" className="form-label text-muted small fw-bold">学年</label>
              <select 
                className="form-select border-0 bg-light" 
                id="academicYearFilter"
                value={academicYear}
                onChange={e => setAcademicYear(e.target.value)}
              >
                <option value="">全部学年</option>
                {options?.academic_years.map(oy => (
                  <option key={oy.value} value={oy.value}>{oy.label}</option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label htmlFor="gradeFilter" className="form-label text-muted small fw-bold">年级</label>
              <select 
                className="form-select border-0 bg-light" 
                id="gradeFilter"
                value={gradeLevel}
                onChange={e => setGradeLevel(e.target.value)}
              >
                <option value="">全部年级</option>
                {options?.grade_levels.map(og => (
                  <option key={og.value} value={og.value}>{og.label}</option>
                ))}
              </select>
            </div>
            <div className="col-md-3 d-flex align-items-end">
              <button type="button" className="btn btn-primary me-2 px-4 shadow-sm" onClick={handleFilter}>
                <i className="fas fa-search me-2"></i>筛选
              </button>
              <button type="button" className="btn btn-outline-secondary px-4 bg-white" onClick={resetFilters}>
                <i className="fas fa-undo me-2"></i>重置
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
        
        <div className="card-body p-0">
          {isLoading ? (
            <div className="text-center p-5 text-muted">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">加载中...</span>
              </div>
            </div>
          ) : exams.length > 0 ? (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                      <tr>
                          <th className="text-center py-3 text-muted"><i className="fas fa-calendar-alt me-2"></i>学年</th>
                          <th className="text-center py-3 text-muted"><i className="fas fa-tag me-2"></i>考试名称</th>
                          <th className="text-center py-3 text-muted"><i className="fas fa-users me-2"></i>适用年级</th>
                          <th className="text-center py-3 text-muted"><i className="fas fa-clock me-2"></i>考试日期</th>
                          <th className="text-center py-3 text-muted"><i className="fas fa-info-circle me-2"></i>考试描述</th>
                          <th className="text-center py-3 text-muted"><i className="fas fa-cogs me-2"></i>操作</th>
                      </tr>
                  </thead>
                  <tbody>
                      {exams.map(exam => (
                        <tr key={exam.id} style={{ cursor: 'pointer' }} className="transition-all">
                            <td className="text-center">
                                <span className="badge bg-info bg-opacity-10 text-info border border-info rounded-pill px-3 py-2">{exam.academic_year}</span>
                            </td>
                            <td className="text-center">
                                <div className="fw-bold text-dark">{exam.name}</div>
                            </td>
                            <td className="text-center">
                                <span className="badge bg-success bg-opacity-10 text-success border border-success rounded-pill px-3 py-2">
                                  {options?.grade_levels.find(g => g.value === exam.grade_level)?.label || exam.grade_level}
                                </span>
                            </td>
                            <td className="text-center text-secondary">
                                <i className="fas fa-calendar text-muted me-2"></i>
                                {exam.date ? exam.date.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$1年$2月$3日') : ''}
                            </td>
                            <td className="text-center">
                                <div className="text-muted small" style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: '0 auto' }}>
                                    {exam.description || "暂无描述"}
                                </div>
                            </td>
                            <td className="text-center">
                                <div className="btn-group shadow-sm" role="group">
                                    <Link href={`/exams/${exam.id}/edit`} className="btn btn-light btn-sm text-primary border" title="编辑考试">
                                        <i className="fas fa-edit"></i>
                                    </Link>
                                    <button 
                                      type="button" 
                                      className="btn btn-light btn-sm text-danger border" 
                                      title="删除考试"
                                      onClick={() => setDeleteData({ id: exam.id, name: exam.name })}
                                    >
                                        <i className="fas fa-trash"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                      ))}
                  </tbody>
              </table>
              <div className="p-3 border-top d-flex justify-content-between align-items-center bg-light">
                <span className="text-muted small">共 {totalCount} 条记录</span>
                <div>
                  <button className="btn btn-sm btn-outline-secondary me-2 bg-white" disabled={currentPage === 1} onClick={() => setCurrentPage(c => c - 1)}>上一页</button>
                  <span className="mx-2 text-muted small">第 {currentPage} 页</span>
                  <button className="btn btn-sm btn-outline-secondary bg-white" disabled={currentPage * pageSize >= totalCount} onClick={() => setCurrentPage(c => c + 1)}>下一页</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-5 text-muted">
                <i className="fas fa-clipboard-list mb-3 opacity-25" style={{ fontSize: '4rem' }}></i>
                <h5 className="fw-bold mb-2">暂无考试记录</h5>
                <p className="small mb-4">还没有创建任何考试，点击上方按钮开始创建第一个考试吧！</p>
                <Link href="/exams/create" className="btn btn-primary px-4 rounded-pill shadow-sm">
                    <i className="fas fa-plus me-2"></i>创建第一个考试
                </Link>
            </div>
          )}
        </div>
      </div>

      {/* 删除确认模态框 */}
      {deleteData && (
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
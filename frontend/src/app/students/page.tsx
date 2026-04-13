"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import BatchImportModal from "./BatchImportModal";
import { canWriteStudents } from "@/lib/permissions";

type Student = {
  id: number;
  student_id: string;
  name: string;
  gender: string | null;
  current_class: {
    id: number;
    grade_level: string;
    cohort: string;
    class_name: string;
  } | null;
  status: string;
  graduation_date?: string;
  id_card_number?: string;
  student_enrollment_number?: string;
  home_address?: string;
  guardian_name?: string;
  guardian_contact_phone?: string;
};

type Stats = {
  total_students: number;
  active_students: number;
  graduated_students: number;
  suspended_students: number;
  status_choices: string[];
  grade_level_choices: string[];
  cohort_choices: string[];
  class_name_choices: string[];
};

const backendBaseUrl = typeof window !== "undefined" ? `http://${window.location.hostname}:8000` : "http://localhost:8000";

export default function StudentsPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const canStudentWrite = canWriteStudents(user);

  const [students, setStudents] = useState<Student[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterGrade, setFilterGrade] = useState("");
  const [filterClass, setFilterClass] = useState("");
  const [filterGradeDropdownOpen, setFilterGradeDropdownOpen] = useState(false);
  const [filterClassDropdownOpen, setFilterClassDropdownOpen] = useState(false);
  const [filterStatusDropdownOpen, setFilterStatusDropdownOpen] = useState(false);

  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [batchStatus, setBatchStatus] = useState<string>("");
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => Number(k)),
    [selected]
  );
  const selectedCount = selectedIds.length;

  const allSelected = useMemo(() => {
    if (!students.length) return false;
    return students.every((s) => selected[s.id]);
  }, [students, selected]);

  useEffect(() => {
    if (!selectAllRef.current) return;

    if (selectedCount === 0 || selectedCount === students.length) {
      selectAllRef.current.indeterminate = false;
    } else {
      selectAllRef.current.indeterminate = true;
    }
  }, [selectedCount, students.length]);

  const authHeader = useMemo(() => {
    if (!token) return undefined;
    return {
      Authorization: `Bearer ${token}`,
    };
  }, [token]);

  const fetchStats = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${backendBaseUrl}/api/students/stats/`, {
        headers: {
          ...authHeader,
        },
      });
      if (!res.ok) throw new Error("无法获取统计数据");
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error(e);
      setError("无法获取统计信息，请稍后重试。");
    }
  };

  const buildListUrl = () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (filterStatus) params.set("status", filterStatus);
    if (filterGrade) params.set("current_class__cohort", filterGrade);
    if (filterClass) params.set("current_class__class_name", filterClass);
    return `${backendBaseUrl}/api/students/?${params.toString()}`;
  };

  const fetchStudents = async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(buildListUrl(), {
        headers: {
          ...authHeader,
        },
      });
      if (!res.ok) {
        throw new Error(`请求失败 ${res.status}`);
      }
      const data = await res.json();
      setStudents(Array.isArray(data) ? data : data.results ?? []);
      setSelected({});
    } catch (e) {
      console.error(e);
      setError("获取学生列表失败，请检查网络或重新登录。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (!students.length) return;
    const next: Record<number, boolean> = {};
    if (!allSelected) {
      students.forEach((s) => {
        next[s.id] = true;
      });
    }
    setSelected(next);
  };

  const handleSelectOne = (id: number) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDelete = async (student: Student) => {
    if (!confirm(`确定要删除学生 ${student.name} 吗？此操作不可逆！`)) return;
    if (!token) return;
    try {
      const res = await fetch(`${backendBaseUrl}/api/students/${student.id}/`, {
        method: "DELETE",
        headers: {
          ...authHeader,
        },
      });
      if (!res.ok) {
        throw new Error(`删除失败 ${res.status}`);
      }
      setStudents((prev) => prev.filter((s) => s.id !== student.id));
    } catch (e) {
      console.error(e);
      alert("删除失败，请稍后重试。");
    }
  };

  const patchStudentData = async (studentId: number, data: Partial<Student>) => {
    if (!token) return false;
    try {
      const res = await fetch(`${backendBaseUrl}/api/students/${studentId}/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        console.error(`更新字段失败 ${res.status}`);
        return false;
      }

      setStudents((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, ...data } : s))
      );
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const handleStatusChange = async (
    studentId: number,
    newStatus: string,
    currentStatus?: string
  ) => {
    if (currentStatus && currentStatus === newStatus) return;

    if (!confirm(`确定要将状态修改为 "${newStatus}" 吗？`)) return;

    const success = await patchStudentData(studentId, { status: newStatus });
    if (!success) {
      alert("状态更新失败，请稍后再试。");
    }
  };

  const handleBatchDelete = async () => {
    if (!selectedIds.length) {
      return alert("请先选择要删除的学生");
    }
    if (!confirm(`确定要删除选中的 ${selectedIds.length} 个学生吗？此操作不可逆！`)) return;

    try {
      const res = await fetch(`${backendBaseUrl}/api/students/batch-delete/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify({ student_ids: selectedIds }),
      });
      if (res.ok) {
        alert(`已成功删除选中的 ${selectedIds.length} 个学生。`);
        setSelected({});
        fetchStats();
        fetchStudents();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(`批量删除失败: ${data.message || '未知错误'}`);
      }
    } catch (e) {
      console.error(e);
      alert("批量删除过程出错");
    }
  };

  const handleBatchStatusLogic = async (newStatus: string, successMessage: string) => {
    try {
      const res = await fetch(`${backendBaseUrl}/api/students/batch-update-status/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify({ student_ids: selectedIds, status: newStatus }),
      });
      if (res.ok) {
        alert(successMessage);
        setSelected({});
        if (newStatus !== "毕业") {
          setBatchStatus("");
        }
        fetchStats();
        fetchStudents();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(`状态更新失败: ${data.message || '未知错误'}`);
      }
    } catch (e) {
      console.error(e);
      alert("状态更新过程出错");
    }
  };

  const handleBatchUpdateStatus = async () => {
    if (!selectedIds.length) {
      return alert("请先选择要修改状态的学生");
    }
    if (!batchStatus) {
      return alert("请选择要批量设置的状态");
    }
    if (!confirm(`确定要将选中的 ${selectedIds.length} 个学生的状态修改为 "${batchStatus}" 吗？`)) return;

    await handleBatchStatusLogic(batchStatus, `已成功将 ${selectedIds.length} 个学生的状态更新为 "${batchStatus}"。`);
  };

  const handleBatchGraduate = async () => {
    if (!selectedIds.length) {
      return alert("请先选择要标记毕业的学生");
    }
    if (!confirm(`确定要将选中的 ${selectedIds.length} 个学生批量标记为毕业吗？\n该操作会自动将状态修改为"毕业"并记录毕业日期为今天。`)) return;

    await handleBatchStatusLogic("毕业", `已成功将 ${selectedIds.length} 个学生批量标记为毕业。`);
  };

  const handleBatchPromote = () => {
    if (!selectedIds.length) {
      return alert("请先选择要升年级的学生");
    }
    localStorage.setItem("selectedStudentIdsForPromote", JSON.stringify(selectedIds));
    router.push("/students/batch-promote");
  };

  // Close all dropdowns on outside click
  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".custom-dropdown")) {
        setFilterGradeDropdownOpen(false);
        setFilterClassDropdownOpen(false);
        setFilterStatusDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (!token) return;
    fetchStats();
    fetchStudents();
  }, [token]);

  // 默认批量状态为第一个可用选项
  useEffect(() => {
    if (!batchStatus && stats?.status_choices?.length) {
      setBatchStatus(stats.status_choices[0]);
    }
  }, [stats, batchStatus]);

  useEffect(() => {
    if (!token) return;
    // 过滤变化时重新加载列表
    fetchStudents();
  }, [search, filterStatus, filterGrade, filterClass]);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: "100vh", backgroundColor: "#f8f9fa" }}>
        <div className="text-center">
          <div className="spinner-border text-primary" role="status"></div>
          <p className="mt-2">加载中...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    router.push("/login");
    return null;
  }

  return (
    <div>
      <div className="page-header">
        <div className="container-fluid">
          <div className="row align-items-center">
            <div className="col-md-8">
              <h1>
                <i className="fas fa-users me-3"></i>学生管理
              </h1>
              <p className="mb-0 opacity-75">管理学校所有学生信息，支持批量操作和数据导入</p>
            </div>
            <div className="col-md-4 text-end">
              {canStudentWrite && (
                <>
                  <Link href="/students/add" className="btn btn-light border me-2">
                    <i className="fas fa-plus me-2"></i>新增学生
                  </Link>
                  <button onClick={() => setIsImportModalOpen(true)} className="btn btn-light border">
                    <i className="fas fa-file-import me-2"></i>批量导入
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container-fluid">
        {/* 统计卡片区域 */}
        <div className="row mb-4">
          <div className="col-lg-3 col-md-6 mb-3">
            <div className="card stats-card">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h5 className="card-title">学生总数</h5>
                    <p className="card-text fs-3 mb-0">
                      {stats ? stats.total_students : "--"}
                    </p>
                  </div>
                  <div className="stats-icon bg-primary">
                    <i className="fas fa-users"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-lg-3 col-md-6 mb-3">
            <div className="card stats-card">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h5 className="card-title">在读学生</h5>
                    <p className="card-text fs-3 mb-0">
                      {stats ? stats.active_students : "--"}
                    </p>
                  </div>
                  <div className="stats-icon bg-success">
                    <i className="fas fa-user-check"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-lg-3 col-md-6 mb-3">
            <div className="card stats-card">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h5 className="card-title">已毕业</h5>
                    <p className="card-text fs-3 mb-0">
                      {stats ? stats.graduated_students : "--"}
                    </p>
                  </div>
                  <div className="stats-icon bg-info">
                    <i className="fas fa-graduation-cap"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-lg-3 col-md-6 mb-3">
            <div className="card stats-card">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h5 className="card-title">休学</h5>
                    <p className="card-text fs-3 mb-0">
                      {stats ? stats.suspended_students : "--"}
                    </p>
                  </div>
                  <div className="stats-icon bg-warning">
                    <i className="fas fa-user-slash"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 过滤条件区域 - 独立成行 */}
        <div className="row mb-0">
          <div className="col-12">
            <div className="card filter-card">
              <div className="card-header">
                <h5 className="mb-0">
                  <i className="fas fa-filter me-2"></i>筛选条件
                </h5>
              </div>
              <div className="card-body">
                <div className="row">
                  <div className="col-lg-3 col-md-6 mb-3">
                    <label className="form-label">搜索学号/姓名</label>
                    <input
                      type="text"
                      className="form-control"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="输入关键字后自动更新"
                    />
                  </div>
                  <div className="col-lg-3 col-md-6 mb-3">
                    <label className="form-label">入学年份</label>
                    <div className="custom-dropdown">
                      <button type="button" className={`custom-dropdown-toggle ${filterGradeDropdownOpen ? "active" : ""}`} onClick={() => setFilterGradeDropdownOpen((v) => !v)}>
                        <span>{filterGrade || "全部"}</span>
                        <i className="fas fa-chevron-down custom-dropdown-arrow"></i>
                      </button>
                      <div className={`custom-dropdown-menu ${filterGradeDropdownOpen ? "show" : ""}`}>
                        <button type="button" className="custom-dropdown-item" onClick={() => { setFilterGrade(""); setFilterGradeDropdownOpen(false); }}>
                          全部
                        </button>
                        {stats?.cohort_choices.map((cohort) => (
                          <button key={cohort} type="button" className="custom-dropdown-item" onClick={() => { setFilterGrade(cohort); setFilterGradeDropdownOpen(false); }}>
                            {cohort}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="col-lg-2 col-md-6 mb-3">
                    <label className="form-label">班级</label>
                    <div className="custom-dropdown">
                      <button type="button" className={`custom-dropdown-toggle ${filterClassDropdownOpen ? "active" : ""}`} onClick={() => setFilterClassDropdownOpen((v) => !v)}>
                        <span>{filterClass || "全部"}</span>
                        <i className="fas fa-chevron-down custom-dropdown-arrow"></i>
                      </button>
                      <div className={`custom-dropdown-menu ${filterClassDropdownOpen ? "show" : ""}`}>
                        <button type="button" className="custom-dropdown-item" onClick={() => { setFilterClass(""); setFilterClassDropdownOpen(false); }}>
                          全部
                        </button>
                        {stats?.class_name_choices.map((cls) => (
                          <button key={cls} type="button" className="custom-dropdown-item" onClick={() => { setFilterClass(cls); setFilterClassDropdownOpen(false); }}>
                            {cls}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="col-lg-2 col-md-6 mb-3">
                    <label className="form-label">状态</label>
                    <div className="custom-dropdown">
                      <button type="button" className={`custom-dropdown-toggle ${filterStatusDropdownOpen ? "active" : ""}`} onClick={() => setFilterStatusDropdownOpen((v) => !v)}>
                        <span>{filterStatus || "全部"}</span>
                        <i className="fas fa-chevron-down custom-dropdown-arrow"></i>
                      </button>
                      <div className={`custom-dropdown-menu ${filterStatusDropdownOpen ? "show" : ""}`}>
                        <button type="button" className="custom-dropdown-item" onClick={() => { setFilterStatus(""); setFilterStatusDropdownOpen(false); }}>
                          全部
                        </button>
                        {stats?.status_choices.map((st) => (
                          <button key={st} type="button" className="custom-dropdown-item" onClick={() => { setFilterStatus(st); setFilterStatusDropdownOpen(false); }}>
                            {st}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="col-lg-2 col-md-12 mb-3 d-flex align-items-end">
                    <button 
                      className="btn btn-outline-secondary w-100"
                      onClick={() => {
                        setSearch("");
                        setFilterStatus("");
                        setFilterGrade("");
                        setFilterClass("");
                      }}
                    >
                      <i className="fas fa-refresh me-2"></i>重置过滤条件
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 批量操作区域 - 独立成行 */}
        {canStudentWrite ? (
          <div className="row mb-0">
            <div className="col-12">
              <div className="card batch-operations-card">
                <div className="card-header d-flex align-items-center justify-content-between">
                  <h5 className="mb-0">
                    <i className="fas fa-cogs me-2"></i>批量操作
                  </h5>
                  <span className={`badge ${selectedCount > 0 ? "bg-primary" : "bg-secondary"} ms-2`}>
                    已选择 {selectedCount} 个学生
                  </span>
                </div>
                <div className="card-body">
                  <div className="row g-3 align-items-end mb-3">
                    <div className="col-md-2">
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="selectAll"
                          checked={allSelected}
                          onChange={handleSelectAll}
                          ref={selectAllRef}
                        />
                        <label className="form-check-label" htmlFor="selectAll">
                          全选
                        </label>
                      </div>
                    </div>

                    <div className="col-md-3">
                      <label className="form-label">批量修改状态为</label>
                      <select
                        className="form-select"
                        value={batchStatus}
                        onChange={(e) => setBatchStatus(e.target.value)}
                      >
                        <option value="">请选择</option>
                        {stats?.status_choices.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-md-7">
                      <div className="btn-group" role="group">
                        <button
                          type="button"
                          className="btn btn-warning btn-sm"
                          onClick={handleBatchUpdateStatus}
                        >
                          <i className="fas fa-edit me-1"></i>应用状态修改
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={handleBatchDelete}
                        >
                          <i className="fas fa-trash me-1"></i>批量删除
                        </button>
                        <button
                          type="button"
                          className="btn btn-info btn-sm"
                          onClick={handleBatchPromote}
                        >
                          <i className="fas fa-level-up-alt me-1"></i>批量升年级
                        </button>
                        <button
                          type="button"
                          className="btn btn-success btn-sm"
                          onClick={handleBatchGraduate}
                        >
                          <i className="fas fa-graduation-cap me-1"></i>批量毕业
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 全局错误提示 - 移到批量操作卡片外 */}
              {error && (
                <div className="alert alert-danger mt-3" role="alert">
                  {error}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="alert alert-info mb-4" role="alert">
            当前角色仅可查看学生信息，写操作入口已隐藏。
          </div>
        )}

        {/* 学生列表区域 */}
        <div className="app-table-wrapper">
          {isLoading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status"></div>
            </div>
          ) : students.length ? (
            <div className="app-table-scroll">
              <table className="app-table">
                <thead>
                  <tr>
                    <th style={{ width: 50 }}>
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={allSelected}
                          onChange={handleSelectAll}
                        />
                      </div>
                    </th>
                    <th>
                      <i className="fas fa-id-card me-1"></i>学号
                    </th>
                    <th>
                      <i className="fas fa-user me-1"></i>姓名
                    </th>
                    <th>
                      <i className="fas fa-venus-mars me-1"></i>性别
                    </th>
                    <th>
                      <i className="fas fa-layer-group me-1"></i>入学年份
                    </th>
                    <th>
                      <i className="fas fa-layer-group me-1"></i>年级
                    </th>
                    <th>
                      <i className="fas fa-users me-1"></i>班级
                    </th>
                    <th>
                      <i className="fas fa-info-circle me-1"></i>状态
                    </th>
                    <th style={{ width: canStudentWrite ? 50 : 88 }}>
                      <i className="fas fa-cogs me-1"></i>操作
                    </th>
                    {canStudentWrite && (
                      <th style={{ width: 50 }}>
                        <i className="fas fa-edit me-1"></i>状态切换
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => {
                    const statusClass = `status-badge status-${student.status}`;
                    return (
                      <tr key={student.id}>
                        <td>
                          {canStudentWrite && (
                            <div className="form-check">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                checked={Boolean(selected[student.id])}
                                onChange={() => handleSelectOne(student.id)}
                              />
                            </div>
                          )}
                        </td>
                        <td>
                          <span className="fw-bold" style={{ color: '#1e2a25', fontSize: '0.9rem' }}>{student.student_id}</span>
                        </td>
                        <td>
                          <span className="fw-medium" style={{ color: '#1e2a25', fontSize: '0.9rem' }}>{student.name}</span>
                        </td>
                        <td>
                          {student.gender === "男" ? (
                            <span className="badge rounded-pill px-3 py-2" style={{ background: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe', fontSize: '0.88rem' }}>
                              <i className="fas fa-mars me-1"></i>
                              {student.gender}
                            </span>
                          ) : (
                            <span className="badge rounded-pill px-3 py-2" style={{ background: '#fce7f3', color: '#be185d', border: '1px solid #f9a8d4', fontSize: '0.88rem' }}>
                              <i className="fas fa-venus me-1"></i>
                              {student.gender || "-"}
                            </span>
                          )}
                        </td>
                        <td>
                          {student.current_class ? (
                            <span className="badge rounded-pill px-3 py-2" style={{ background: '#e8f7f4', color: '#01876c', border: '1px solid #b8ddd5', fontSize: '0.88rem' }}>{student.current_class.cohort}</span>
                          ) : (
                            <span style={{ color: '#8fa398' }}>-</span>
                          )}
                        </td>
                        <td>
                          {student.current_class ? (
                            <span className="badge rounded-pill px-3 py-2" style={{ background: '#d4e8fc', color: '#0369a1', border: '1px solid #a0c4e8', fontSize: '0.88rem' }}>{student.current_class.grade_level}</span>
                          ) : (
                            <span style={{ color: '#8fa398' }}>-</span>
                          )}
                        </td>
                        <td>
                          {student.current_class ? (
                            <span className="badge rounded-pill px-3 py-2" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', fontSize: '0.88rem' }}>{student.current_class.class_name}</span>
                          ) : (
                            <span style={{ color: '#8fa398' }}>未分配</span>
                          )}
                        </td>
                        <td>
                          <span className={statusClass}>{student.status}</span>
                        </td>
                        <td>
                          {canStudentWrite ? (
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                              <a
                                href={`/students/${student.id}/edit/`}
                                className="btn btn-sm"
                                style={{ background: '#b8ddd5', color: '#015a4a', border: '1px solid #8cd4c4' }}
                                title="编辑学生信息"
                              >
                                <i className="fas fa-edit"></i>
                              </a>
                              <button
                                type="button"
                                className="btn btn-sm"
                                style={{ background: '#fecaca', color: '#b91c1c', border: '1px solid #fca5a5' }}
                                title="删除学生"
                                onClick={() => handleDelete(student)}
                              >
                                <i className="fas fa-trash"></i>
                              </button>
                            </div>
                          ) : (
                            <span className="text-muted">只读</span>
                          )}
                        </td>
                        {canStudentWrite && (
                          <td>
                            <div className="d-flex align-items-center gap-2">
                              <select
                                className="form-select form-select-sm"
                                style={{ minWidth: "100px" }}
                                value={student.status}
                                onChange={(e) => handleStatusChange(student.id, e.target.value, student.status)}
                              >
                                {stats?.status_choices.map((st) => (
                                  <option key={st} value={st}>
                                    {st}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                className="btn btn-outline-success btn-sm"
                                title="更新状态"
                                onClick={() => handleStatusChange(student.id, student.status, student.status)}
                              >
                                <i className="fas fa-check"></i>
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <i className="fas fa-users"></i>
              <h4>暂无学生数据</h4>
              <p className="mb-3">还没有添加任何学生，点击下方按钮开始添加</p>
              {canStudentWrite ? (
                <Link href="/students/add" className="btn btn-primary">
                  <i className="fas fa-plus me-1"></i>添加第一个学生
                </Link>
              ) : null}
            </div>
          )}
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

        .filter-card {
          border: none;
          border-radius: 15px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          margin-bottom: 2rem;
          overflow: visible !important;
        }

        .filter-card .card-header {
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          border-bottom: 1px solid #dee2e6;
          border-radius: 15px 15px 0 0;
          padding: 1rem 1.5rem;
          font-weight: 600;
        }

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

        .batch-operations-card {
          border: none;
          border-radius: 15px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          margin-bottom: 2rem;
          border-left: 4px solid #28a745;
        }
        
        .batch-operations-card .card-header {
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          border-bottom: 1px solid #dee2e6;
          border-radius: 15px 15px 0 0;
          padding: 1rem 1.5rem;
          font-weight: 600;
        }

        .btn-action {
          padding: 0.25rem 0.5rem;
          font-size: 0.875rem;
          border-radius: 20px;
          margin-right: 0.25rem;
        }

        .status-badge {
          padding: 0.375rem 0.75rem;
          border-radius: 20px;
          font-size: 0.82rem;
          font-weight: 500;
        }

        .status-在读 {
          background-color: #e8f7f4;
          color: #01876c;
          border: 1px solid #b8ddd5;
        }

        .status-休学 {
          background-color: #fef3c7;
          color: #92400e;
          border: 1px solid #fde68a;
        }

        .status-退学 {
          background-color: #fee2e2;
          color: #dc2626;
          border: 1px solid #fecaca;
        }

        .status-毕业 {
          background-color: #e8f4fc;
          color: #0369a1;
          border: 1px solid #b8d4f0;
        }

        .quick-actions {
          background: #f8f9fa;
          border-radius: 10px;
          padding: 1rem;
          margin-bottom: 1rem;
        }

        .quick-actions .btn {
          margin-right: 0.5rem;
          margin-bottom: 0.5rem;
        }

        .empty-state {
          text-align: center;
          padding: 3rem;
          color: #6c757d;
        }

        .empty-state i {
          font-size: 4rem;
          margin-bottom: 1rem;
          opacity: 0.5;
        }

        @media (max-width: 768px) {
          .page-header {
            padding: 1rem 0;
            margin-bottom: 1rem;
          }

          .stats-card {
            margin-bottom: 1rem;
          }

          .table-responsive {
            font-size: 0.875rem;
          }

          .btn-action {
            padding: 0.125rem 0.25rem;
            font-size: 0.75rem;
          }

        }

        /* 自定义下拉框样式 */
        .custom-dropdown {
          position: relative;
          width: 100%;
          color: #495057;
        }
        .filter-card .form-control,
        .filter-card .custom-dropdown-toggle {
          height: 38px !important;
          padding: 0.375rem 0.75rem !important;
          font-size: 14px !important;
          line-height: 1.5 !important;
        }
        .custom-dropdown-toggle {
          width: 100%;
          padding: 0.375rem 0.75rem;
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
          min-width: 100%;
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
        .custom-dropdown-item {
          display: block;
          width: 100%;
          padding: 0.375rem 0.75rem;
          cursor: pointer;
          transition: background-color 0.15s ease;
          font-size: 14px;
          border: none;
          background: transparent;
          text-align: left;
          color: inherit;
        }
        .custom-dropdown-item:hover {
          background-color: #f8f9fa;
        }
      `}</style>
      
      {canStudentWrite && (
        <BatchImportModal 
          isOpen={isImportModalOpen} 
          onClose={() => setIsImportModalOpen(false)} 
          onSuccess={() => {
            fetchStudents();
            fetchStats();
          }}
          backendBaseUrl={backendBaseUrl}
          authHeader={authHeader}
        />
      )}
    </div>
  );
}
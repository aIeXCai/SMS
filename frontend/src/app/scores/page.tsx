"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { canWriteScores } from "@/lib/permissions";

type Option = { value: string; label: string };

type ScoreRow = {
  record_key: string;
  student_id: number;
  exam_id: number;
  student: {
    student_id: string;
    name: string;
    grade_level: string;
    grade_level_display: string;
  };
  class: {
    class_name: string | null;
  };
  exam: {
    id: number;
    name: string;
    academic_year: string;
    date: string;
  };
  scores: Record<string, number>;
};

type ScoreListResponse = {
  count: number;
  num_pages: number;
  current_page: number;
  has_previous: boolean;
  has_next: boolean;
  previous_page: number | null;
  next_page: number | null;
  start_index: number;
  end_index: number;
  page_size: number;
  results: ScoreRow[];
  all_subjects: string[];
};

type ScoreOptions = {
  exams: Option[];
  grade_levels: Option[];
  class_name_choices: Option[];
  subjects: Option[];
  all_subjects: string[];
  per_page_options: number[];
};

type SelectAllKeysResponse = {
  success: boolean;
  count: number;
  record_keys: string[];
};

type Filters = {
  student_id_filter: string;
  student_name_filter: string;
  exam_filter: string;
  grade_filter: string;
  class_filter: string;
  subject_filter: string;
};

const EMPTY_FILTERS: Filters = {
  student_id_filter: "",
  student_name_filter: "",
  exam_filter: "",
  grade_filter: "",
  class_filter: "",
  subject_filter: "",
};

const backendBaseUrl = typeof window !== "undefined" ? `http://${window.location.hostname}:8000` : "http://localhost:8000";
const SCORES_API_BASE = `${backendBaseUrl}/api/scores`;

export default function ScoresPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const canScoreWrite = canWriteScores(user);

  const [options, setOptions] = useState<ScoreOptions | null>(null);
  const [gradeClasses, setGradeClasses] = useState<Option[]>([]);
  const [rows, setRows] = useState<ScoreRow[]>([]);
  const [allSubjects, setAllSubjects] = useState<string[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [numPages, setNumPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [startIndex, setStartIndex] = useState(0);
  const [endIndex, setEndIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSelectingAll, setIsSelectingAll] = useState(false);

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [examDropdownOpen, setExamDropdownOpen] = useState(false);
  const [gradeDropdownOpen, setGradeDropdownOpen] = useState(false);
  const [classDropdownOpen, setClassDropdownOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
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

  const [importModalVisible, setImportModalVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importExam, setImportExam] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message: string;
    imported_count: number;
    failed_count: number;
    execution_time?: number;
    error_details?: Array<{ row: number; student_id: string; student_name: string; errors: string[] }>;
  } | null>(null);

  const effectiveToken = useMemo(() => {
    if (token) return token;
    if (typeof window !== "undefined") return localStorage.getItem("accessToken");
    return null;
  }, [token]);

  const authHeader = useMemo(() => {
    if (!effectiveToken) return undefined;
    return { Authorization: `Bearer ${effectiveToken}` };
  }, [effectiveToken]);

  const selectedKeys = Object.keys(selected).filter((k) => selected[k]);
  const allFilteredSelected = totalCount > 0 && selectedKeys.length === totalCount;
  const hasAnySelection = selectedKeys.length > 0;

  const showResultModal = (
    type: "success" | "error",
    title: string,
    subtitle: string,
    message: string
  ) => {
    setResultModal({ show: true, type, title, subtitle, message });
  };

  const closeResultModal = () => {
    setResultModal((prev) => ({ ...prev, show: false }));
  };

  useEffect(() => {
    if (!loading && !effectiveToken) {
      router.push("/login");
    }
  }, [loading, effectiveToken, router]);

  const fetchOptions = useCallback(async (gradeLevel?: string) => {
    try {
      const url = gradeLevel ? `${SCORES_API_BASE}/options/?grade_level=${encodeURIComponent(gradeLevel)}` : `${SCORES_API_BASE}/options/`;
      const res = await fetch(url, { headers: { ...authHeader } });
      if (!res.ok) return;
      const data: ScoreOptions = await res.json();
      setOptions(data);
      if (data.per_page_options?.length && !data.per_page_options.includes(pageSize)) {
        setPageSize(data.per_page_options[0]);
      }
    } catch (e) {
      console.error("获取成绩筛选选项失败", e);
    }
  }, [effectiveToken]);

  const fetchGradeClasses = async (gradeValue: string) => {
    try {
      const res = await fetch(`${SCORES_API_BASE}/options/?grade_level=${encodeURIComponent(gradeValue)}`, { headers: { ...authHeader } });
      if (!res.ok) return;
      const data = await res.json();
      const classes: Option[] = data.class_name_choices || [];
      const sorted = classes.sort((a, b) => {
        const aNum = Number((a.label.match(/\d+/) || ["999"])[0]);
        const bNum = Number((b.label.match(/\d+/) || ["999"])[0]);
        if (aNum !== bNum) return aNum - bNum;
        return a.label.localeCompare(b.label, "zh-CN");
      });
      setGradeClasses(sorted);
    } catch (e) {
      console.error("获取班级列表失败", e);
    }
  };

  const fetchRows = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        page_size: String(pageSize),
      });

      Object.entries(appliedFilters).forEach(([k, v]) => {
        if (v) params.set(k, v);
      });

      const res = await fetch(`${SCORES_API_BASE}/?${params.toString()}`, {
        headers: { ...authHeader },
      });
      if (!res.ok) {
        throw new Error(`请求失败: ${res.status}`);
      }
      const data: ScoreListResponse = await res.json();
      setRows(data.results || []);
      setAllSubjects(data.all_subjects || []);
      setTotalCount(data.count || 0);
      setNumPages(data.num_pages || 1);
      setStartIndex(data.start_index || 0);
      setEndIndex(data.end_index || 0);
    } catch (e) {
      console.error("获取成绩列表失败", e);
      setRows([]);
      setAllSubjects([]);
      setTotalCount(0);
      setNumPages(1);
      setStartIndex(0);
      setEndIndex(0);
    } finally {
      setIsLoading(false);
    }
  };

  const buildFilterParams = (activeFilters: Filters) => {
    const params = new URLSearchParams();
    Object.entries(activeFilters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    return params;
  };

  const fetchAllFilteredRecordKeys = async () => {
    const params = buildFilterParams(appliedFilters);
    const res = await fetch(`${SCORES_API_BASE}/select-all-record-keys/?${params.toString()}`, {
      headers: { ...authHeader },
    });
    if (!res.ok) {
      throw new Error(`请求失败: ${res.status}`);
    }

    const data: SelectAllKeysResponse = await res.json();
    if (!data.success) {
      throw new Error("全选接口返回失败");
    }

    return Array.from(new Set(data.record_keys || []));
  };

  useEffect(() => {
    if (!effectiveToken) return;
    fetchOptions();
  }, [effectiveToken, authHeader]);

  // 选年级后过滤考试和班级选项（级联下拉）
  const handleGradeSelect = (gradeValue: string) => {
    setFilters((p) => ({ ...p, grade_filter: gradeValue, exam_filter: "", class_filter: "" }));
    setGradeDropdownOpen(false);
    fetchOptions(gradeValue || undefined);
    if (gradeValue) {
      fetchGradeClasses(gradeValue);
    } else {
      setGradeClasses([]);
    }
  };

  useEffect(() => {
    if (!effectiveToken) return;
    fetchRows();
  }, [effectiveToken, authHeader, currentPage, pageSize, appliedFilters]);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".app-custom-dropdown")) {
        setExamDropdownOpen(false);
        setGradeDropdownOpen(false);
        setClassDropdownOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const handleFilter = () => {
    setSelected({});
    setAppliedFilters(filters);
    if (currentPage === 1) return;
    setCurrentPage(1);
  };

  const handleReset = () => {
    setFilters(EMPTY_FILTERS);
    setSelected({});
    setAppliedFilters(EMPTY_FILTERS);
    setCurrentPage(1);
  };

  const currentPageKeys = rows.map((r) => r.record_key);
  const currentPageIndeterminate = hasAnySelection && !allFilteredSelected;

  const toggleSelectAll = async () => {
    if (!totalCount || isSelectingAll) return;
    if (allFilteredSelected) {
      setSelected({});
      return;
    }

    try {
      setIsSelectingAll(true);
      const allKeys = await fetchAllFilteredRecordKeys();
      const next: Record<string, boolean> = {};
      allKeys.forEach((key) => {
        next[key] = true;
      });
      setSelected(next);
    } catch (e) {
      console.error("全选失败", e);
      showResultModal("error", "全选失败", "无法完成跨分页全选", "请稍后重试");
    } finally {
      setIsSelectingAll(false);
    }
  };

  const toggleOne = (key: string) => {
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const deleteSelected = () => {
    if (!selectedKeys.length) {
      showResultModal("error", "操作提示", "未选择记录", "请先选择要删除的记录");
      return;
    }
    setDeleteConfirmVisible(true);
  };

  const confirmDeleteSelected = async () => {
    try {
      const res = await fetch(`${SCORES_API_BASE}/batch-delete-selected/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify({ selected_records: selectedKeys }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        showResultModal("error", "删除失败", "操作未完成", data.message || "删除失败");
        return;
      }

      showResultModal("success", "删除成功", "数据已更新", data.message || "删除成功");
      setDeleteConfirmVisible(false);
      setSelected({});
      fetchRows();
    } catch (e) {
      console.error(e);
      showResultModal("error", "删除失败", "网络或服务器异常", "删除失败，请稍后再试");
    }
  };

  const deleteFiltered = async () => {
    const params = buildFilterParams(appliedFilters);
    try {
      const res = await fetch(`${SCORES_API_BASE}/batch-delete-filtered/?${params.toString()}`, {
        method: "POST",
        headers: {
          ...authHeader,
        },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        showResultModal("error", "删除失败", "操作未完成", data.message || "按筛选删除失败");
        return;
      }

      showResultModal("success", "删除成功", "筛选结果已清理", data.message || "按筛选条件删除成功");
      setSelected({});
      fetchRows();
    } catch (e) {
      console.error(e);
      showResultModal("error", "删除失败", "网络或服务器异常", "按筛选删除失败，请稍后再试");
    }
  };

  const downloadTemplate = async () => {
    try {
      const res = await fetch(`${SCORES_API_BASE}/download-template/`, {
        headers: { ...authHeader },
      });
      if (!res.ok) {
        showResultModal("error", "下载失败", "模板下载失败", "模板下载失败");
        return;
      }
      const blob = await res.blob();
      downloadBlob(blob, "score_import_template.xlsx");
      showResultModal("success", "下载成功", "模板已下载", "模板文件已成功下载。请按模板填写后再导入。");
    } catch (e) {
      console.error(e);
      showResultModal("error", "下载失败", "模板下载失败", "模板下载失败");
    }
  };

  const handleBatchImport = async () => {
    if (!importExam) {
      showResultModal("error", "导入提示", "缺少考试信息", "请选择考试");
      return;
    }
    if (!importFile) {
      showResultModal("error", "导入提示", "缺少文件", "请选择Excel文件");
      return;
    }

    const ext = importFile.name.split(".").pop()?.toLowerCase();
    if (!ext || !["xlsx", "xls"].includes(ext)) {
      showResultModal("error", "导入提示", "文件格式不正确", "请选择有效的Excel文件（.xlsx或.xls）");
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("exam", importExam);
      formData.append("excel_file", importFile);

      const res = await fetch(`${SCORES_API_BASE}/batch-import/`, {
        method: "POST",
        headers: { ...authHeader },
        body: formData,
      });

      const data = await res.json().catch(() => ({ success: false, message: "响应解析失败", imported_count: 0, failed_count: 0 }));
      if (!res.ok) {
        setImportResult({
          success: false,
          message: data.message || "导入失败",
          imported_count: data.imported_count || 0,
          failed_count: data.failed_count || 0,
          error_details: data.error_details || [],
        });
      } else {
        setImportResult({
          success: !!data.success,
          message: data.message || "导入完成",
          imported_count: data.imported_count || 0,
          failed_count: data.failed_count || 0,
          execution_time: data.execution_time,
          error_details: data.error_details || [],
        });
        fetchRows();
      }

      setImportModalVisible(false);
      setImportExam("");
      setImportFile(null);
    } catch (e) {
      console.error(e);
      setImportResult({
        success: false,
        message: "网络错误，请稍后重试",
        imported_count: 0,
        failed_count: 0,
      });
      setImportModalVisible(false);
    } finally {
      setUploading(false);
    }
  };

  const pageRange = (() => {
    const pages: number[] = [];
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(numPages, currentPage + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  })();

  if (loading) return <div className="p-4">加载中...</div>;
  if (!user) return null;

  return (
    <div>
      <div className="page-header">
        <div className="container-fluid">
          <div className="row align-items-center">
            <div className="col-md-8">
              <h1><i className="fas fa-chart-line me-3"></i>成绩管理</h1>
              <p className="mb-0 opacity-75">管理学生考试成绩，支持手动录入和批量导入</p>
            </div>
            <div className="col-md-4 text-end">
              {canScoreWrite && (
                <>
                  <Link href="/scores/add" className="btn btn-light border me-2">
                    <i className="fas fa-plus me-2"></i>手动新增成绩
                  </Link>
                  <button type="button" className="btn btn-light border" onClick={() => setImportModalVisible(true)}>
                    <i className="fas fa-file-import me-2"></i>批量导入
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container-fluid">
        <div className="card app-filter-card">
          <div className="card-header">
            <h5 className="mb-0"><i className="fas fa-filter me-2"></i>筛选成绩</h5>
          </div>
          <div className="card-body">
            <div className="row g-3 align-items-end">
              <div className="col-md-2">
                <label className="form-label small fw-bold" style={{ color: '#5a6b63' }}>年级</label>
                <div className="app-custom-dropdown">
                  <button type="button" className={`app-custom-dropdown-toggle ${gradeDropdownOpen ? "active" : ""}`} onClick={() => setGradeDropdownOpen(v => !v)}>
                    <span>{filters.grade_filter ? options?.grade_levels.find(o => o.value === filters.grade_filter)?.label || filters.grade_filter : "全部年级"}</span>
                    <i className="fas fa-chevron-down app-custom-dropdown-arrow"></i>
                  </button>
                  <div className={`app-custom-dropdown-menu ${gradeDropdownOpen ? "show" : ""}`}>
                    <button type="button" className="app-custom-dropdown-item" onClick={() => handleGradeSelect("")}>全部年级</button>
                    {options?.grade_levels.map((x) => (
                      <button key={x.value} type="button" className="app-custom-dropdown-item" onClick={() => handleGradeSelect(x.value)}>{x.label}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <label className="form-label small fw-bold" style={{ color: '#5a6b63' }}>考试</label>
                <div className="app-custom-dropdown">
                  <button type="button" className={`app-custom-dropdown-toggle ${examDropdownOpen ? "active" : ""}`} onClick={() => setExamDropdownOpen(v => !v)} disabled={!filters.grade_filter}>
                    <span>
                      {!filters.grade_filter ? "请先选择年级" : filters.exam_filter ? options?.exams.find(o => o.value === filters.exam_filter)?.label || filters.exam_filter : "全部考试"}
                    </span>
                    <i className="fas fa-chevron-down app-custom-dropdown-arrow"></i>
                  </button>
                  <div className={`app-custom-dropdown-menu ${examDropdownOpen ? "show" : ""}`}>
                    <button type="button" className="app-custom-dropdown-item" onClick={() => { setFilters(p => ({ ...p, exam_filter: "" })); setExamDropdownOpen(false); }}>全部考试</button>
                    {options?.exams.map((x) => (
                      <button key={x.value} type="button" className="app-custom-dropdown-item" onClick={() => { setFilters(p => ({ ...p, exam_filter: x.value })); setExamDropdownOpen(false); }}>{x.label}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="col-md-2">
                <label className="form-label small fw-bold" style={{ color: '#5a6b63' }}>班级</label>
                <div className="app-custom-dropdown">
                  <button type="button" className={`app-custom-dropdown-toggle ${classDropdownOpen ? "active" : ""}`} onClick={() => setClassDropdownOpen(v => !v)} disabled={!filters.grade_filter}>
                    <span>
                      {!filters.grade_filter ? "请先选择年级" : filters.class_filter ? gradeClasses.find(o => o.value === filters.class_filter)?.label || filters.class_filter : "全部班级"}
                    </span>
                    <i className="fas fa-chevron-down app-custom-dropdown-arrow"></i>
                  </button>
                  <div className={`app-custom-dropdown-menu ${classDropdownOpen ? "show" : ""}`}>
                    <button type="button" className="app-custom-dropdown-item" onClick={() => { setFilters(p => ({ ...p, class_filter: "" })); setClassDropdownOpen(false); }}>全部班级</button>
                    {gradeClasses.map((x) => (
                      <button key={x.value} type="button" className="app-custom-dropdown-item" onClick={() => { setFilters(p => ({ ...p, class_filter: x.value })); setClassDropdownOpen(false); }}>{x.label}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="col-md-2">
                <label className="form-label small fw-bold" style={{ color: '#5a6b63' }}>学号</label>
                <input
                  type="text"
                  className="form-control"
                  value={filters.student_id_filter}
                  onChange={(e) => setFilters((p) => ({ ...p, student_id_filter: e.target.value }))}
                  placeholder="输入学号"
                />
              </div>
              <div className="col-md-2">
                <label className="form-label small fw-bold" style={{ color: '#5a6b63' }}>学生姓名</label>
                <input
                  type="text"
                  className="form-control"
                  value={filters.student_name_filter}
                  onChange={(e) => setFilters((p) => ({ ...p, student_name_filter: e.target.value }))}
                  placeholder="输入姓名"
                />
              </div>
            </div>
            <div className="row mt-3">
              <div className="col-12">
                <button type="button" className="app-btn-primary" onClick={handleFilter} style={{ marginRight: '8px' }}>
                  <i className="fas fa-search"></i> 筛选
                </button>
                <button type="button" className="app-btn-outline" onClick={handleReset}>
                  <i className="fas fa-undo"></i> 重置筛选
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ border: 'none', borderRadius: '15px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', marginBottom: '1.5rem', overflow: 'hidden' }}>
          <div className="card-header" style={{ background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)', borderBottom: '1px solid #dee2e6', borderRadius: '15px 15px 0 0', padding: '1rem 1.5rem' }}>
            <h5 className="mb-0"><i className="fas fa-tasks me-2"></i>批量操作</h5>
          </div>
          <div className="card-body">
            <div className="row align-items-center">
              <div className="col-md-6">
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={allFilteredSelected}
                    disabled={isSelectingAll || totalCount === 0}
                    ref={(el) => {
                      if (el) el.indeterminate = currentPageIndeterminate;
                    }}
                    onChange={toggleSelectAll}
                  />
                  <label className="form-check-label fw-bold">全选/取消全选</label>
                  <span className="ms-3 text-muted">
                    已选择: {selectedKeys.length} / {totalCount} 条记录
                    {isSelectingAll ? "（全选处理中...）" : ""}
                  </span>
                </div>
              </div>
              <div className="col-md-6 text-end">
                {canScoreWrite ? (
                  <>
                    <button type="button" className="btn btn-outline-danger me-2" onClick={deleteFiltered}>
                      <i className="fas fa-filter"></i> 删除筛选结果
                    </button>
                    <button type="button" className="btn btn-danger" onClick={deleteSelected}>
                      <i className="fas fa-trash"></i> 删除选中项
                    </button>
                  </>
                ) : (
                  <span className="text-muted">当前角色为只读，写操作已隐藏</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status"></div>
          </div>
        ) : rows.length > 0 ? (
          <div className="app-table-wrapper">
            <div className="app-table-scroll">
              <table className="app-table">
                <thead>
                  <tr>
                    <th style={{ width: "50px" }}>
                      {canScoreWrite && (
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={allFilteredSelected}
                          disabled={isSelectingAll || totalCount === 0}
                          ref={(el) => {
                            if (el) el.indeterminate = currentPageIndeterminate;
                          }}
                          onChange={toggleSelectAll}
                        />
                      )}
                    </th>
                    <th>学号</th>
                    <th>学生姓名</th>
                    <th>年级</th>
                    <th>班级</th>
                    <th>考试名称</th>
                    {allSubjects.map((subject) => (
                      <th key={subject}>{subject}</th>
                    ))}
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.record_key}>
                      <td>
                        {canScoreWrite && (
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={!!selected[row.record_key]}
                            onChange={() => toggleOne(row.record_key)}
                          />
                        )}
                      </td>
                      <td>{row.student.student_id}</td>
                      <td>{row.student.name}</td>
                      <td>{row.student.grade_level_display}</td>
                      <td>{row.class.class_name || "N/A"}</td>
                      <td>{row.exam.name}</td>
                      {allSubjects.map((subject) => (
                        <td key={`${row.record_key}_${subject}`}>
                          {row.scores[subject] !== undefined ? (
                            <span className="badge bg-primary">{row.scores[subject]}</span>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                      ))}
                      <td>
                        {canScoreWrite ? (
                          <Link
                            href={`/scores/batch-edit?student=${row.student_id}&exam=${row.exam_id}`}
                            className="btn btn-sm btn-warning"
                          >
                            <i className="fas fa-edit"></i> 编辑成绩
                          </Link>
                        ) : (
                          <span className="text-muted">只读</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="alert alert-info text-center">
            <i className="fas fa-info-circle"></i> 目前没有任何成绩记录。
          </div>
        )}

        {numPages > 0 && (
          <nav aria-label="成绩列表分页">
            <ul className="pagination justify-content-center mt-4">
              <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
                <button className="page-link" onClick={() => setCurrentPage(1)} aria-label="首页">««</button>
              </li>
              <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
                <button className="page-link" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} aria-label="上一页">«</button>
              </li>
              {pageRange.map((num) => (
                <li key={num} className={`page-item ${currentPage === num ? "active" : ""}`}>
                  <button className="page-link" onClick={() => setCurrentPage(num)}>{num}</button>
                </li>
              ))}
              <li className={`page-item ${currentPage >= numPages ? "disabled" : ""}`}>
                <button className="page-link" onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))} aria-label="下一页">»</button>
              </li>
              <li className={`page-item ${currentPage >= numPages ? "disabled" : ""}`}>
                <button className="page-link" onClick={() => setCurrentPage(numPages)} aria-label="末页">»»</button>
              </li>
            </ul>

            <div className="d-flex justify-content-between align-items-center mt-2 mb-4">
              <small className="text-muted">
                显示第 {startIndex} - {endIndex} 条记录，共 {totalCount} 条
              </small>
              <div className="d-flex align-items-center">
                <small className="text-muted me-2">每页显示：</small>
                <select
                  className="form-select form-select-sm"
                  style={{ width: "auto" }}
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                >
                  {(options?.per_page_options || [10, 20, 50, 100]).map((n) => (
                    <option key={n} value={n}>{n} 条</option>
                  ))}
                </select>
              </div>
            </div>
          </nav>
        )}
      </div>

      {canScoreWrite && deleteConfirmVisible && (
        <div className="custom-modal show" onClick={(e) => e.currentTarget === e.target && setDeleteConfirmVisible(false)}>
          <div className="modal-content">
            <div className="modal-header error">
              <h5 className="modal-title">
                <i className="fas fa-exclamation-triangle me-2"></i>确认批量删除
              </h5>
              <button type="button" className="close" onClick={() => setDeleteConfirmVisible(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="icon error">
                <i className="fas fa-trash"></i>
              </div>
              <h6>危险操作警告</h6>
              <p>
                您即将删除选中的 {selectedKeys.length} 条成绩记录。<br />
                此操作不可逆，请谨慎操作！
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-modal btn-primary" onClick={() => setDeleteConfirmVisible(false)}>
                <i className="fas fa-times me-2"></i>取消
              </button>
              <button type="button" className="btn-modal btn-danger" onClick={confirmDeleteSelected}>
                <i className="fas fa-trash me-2"></i>确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {canScoreWrite && importModalVisible && (
        <div
          className="modal d-block score-import-modal"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={(e) => e.currentTarget === e.target && setImportModalVisible(false)}
        >
          <div className="modal-dialog modal-dialog-centered score-import-dialog">
            <div className="modal-content score-import-content">
              <div className="modal-header">
                <h5 className="modal-title"><i className="fas fa-upload"></i> 批量导入成绩 (Excel)</h5>
                <button type="button" className="btn-close" onClick={() => setImportModalVisible(false)}></button>
              </div>
              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">选择考试 <span className="text-danger">*</span></label>
                    <select className="form-select" value={importExam} onChange={(e) => setImportExam(e.target.value)}>
                      <option value="">--- 请选择考试 ---</option>
                      {options?.exams.map((x) => (
                        <option key={x.value} value={x.value}>{x.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">选择Excel文件 <span className="text-danger">*</span></label>
                    <input
                      type="file"
                      className="form-control"
                      accept=".xlsx,.xls"
                      onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    />
                  </div>
                </div>
                <div className="row mt-3">
                  <div className="col-12">
                    <div className="alert alert-info">
                      <i className="fas fa-info-circle"></i>
                      <strong>使用说明：</strong>
                      <ul className="mb-0 mt-2">
                        <li>请确保Excel文件格式正确，第一行为标题行</li>
                        <li>必须包含“学号”和“学生姓名”列</li>
                        <li>科目列名必须与系统中的科目名称完全一致</li>
                        <li>
                          <button type="button" className="btn btn-link p-0 text-decoration-none" onClick={downloadTemplate}>
                            <i className="fas fa-download"></i> 下载模板文件
                          </button>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setImportModalVisible(false)}>取消</button>
                <button type="button" className="btn btn-success" disabled={uploading} onClick={handleBatchImport}>
                  {uploading ? <><i className="fas fa-spinner fa-spin"></i> 上传中...</> : <><i className="fas fa-upload"></i> 开始上传</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {importResult && (
        <div className="custom-modal show" onClick={(e) => e.currentTarget === e.target && setImportResult(null)}>
          <div className="modal-content modal-lg-content">
            <div className={`modal-header ${importResult.success ? "success" : "error"}`}>
              <h5 className="modal-title">
                <i className={`fas ${importResult.success ? "fa-check-circle" : "fa-exclamation-triangle"} me-2`}></i>
                导入结果
              </h5>
            </div>
            <div className="modal-body">
              {importResult.success ? (
                <div className="alert alert-success">
                  <h5><i className="fas fa-check-circle"></i> 导入成功！</h5>
                  <p>成功导入 <strong>{importResult.imported_count}</strong> 个学生</p>
                  {importResult.failed_count > 0 && <p>失败 <strong>{importResult.failed_count}</strong> 个学生</p>}
                  {importResult.execution_time !== undefined && <p><i className="fas fa-clock"></i> 执行时间: <strong>{importResult.execution_time}秒</strong></p>}
                </div>
              ) : (
                <div className="alert alert-danger">
                  <h5><i className="fas fa-exclamation-circle"></i> 导入失败！</h5>
                  <p>{importResult.message}</p>
                </div>
              )}

              {!!importResult.error_details?.length && (
                <div className="table-responsive" style={{ maxHeight: "280px", overflowY: "auto" }}>
                  <table className="table table-striped table-sm">
                    <thead className="table-dark">
                      <tr>
                        <th>行号</th>
                        <th>学号</th>
                        <th>学生姓名</th>
                        <th>失败原因</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importResult.error_details.map((error) => (
                        <tr key={`${error.row}_${error.student_id}`}>
                          <td>{error.row}</td>
                          <td>{error.student_id || "-"}</td>
                          <td>{error.student_name || "-"}</td>
                          <td>
                            <ul className="mb-0">
                              {error.errors.map((msg, idx) => <li key={idx}>{msg}</li>)}
                            </ul>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className={`btn-modal ${importResult.success ? "btn-success" : "btn-primary"}`} onClick={() => setImportResult(null)}>
                <i className={`fas ${importResult.success ? "fa-check" : "fa-redo"} me-2`}></i>关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {resultModal.show && (
        <div className="custom-modal show" onClick={(e) => e.currentTarget === e.target && closeResultModal()}>
          <div className="modal-content">
            <div className={`modal-header ${resultModal.type}`}>
              <h5 className="modal-title">
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
              <p style={{ whiteSpace: "pre-line" }}>{resultModal.message}</p>
            </div>
            <div className="modal-footer">
              <button type="button" className={`btn-modal ${resultModal.type === "success" ? "btn-success" : "btn-primary"}`} onClick={closeResultModal}>
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

        .badge {
          font-size: 0.75rem;
          padding: 0.25em 0.5em;
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

        .modal-lg-content {
          max-width: 900px;
          width: 95%;
        }

        .score-import-modal {
          z-index: 1055;
        }

        .score-import-modal .score-import-dialog {
          width: min(920px, calc(100vw - 2rem));
          max-width: min(920px, calc(100vw - 2rem));
          margin: 0 auto;
        }

        .score-import-modal .score-import-content {
          width: 100%;
          max-width: none;
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

        .btn-modal.btn-danger {
          background: linear-gradient(135deg, #dc3545, #c82333);
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

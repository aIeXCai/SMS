"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

type Option = { value: string; label: string };

type ScoreRow = {
  record_key: string;
  student_id: number;
  exam_id: number;
  total_score: number;
  grade_rank: number | null;
  student: {
    student_id: string;
    name: string;
    grade_level_display: string;
  };
  class: {
    class_name: string | null;
  };
  exam: {
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
  has_previous?: boolean;
  has_next?: boolean;
  previous_page?: number | null;
  next_page?: number | null;
  start_index?: number;
  end_index?: number;
  page_size: number;
  results: ScoreRow[];
  all_subjects: string[];
};

type ScoreOptions = {
  exams: Option[];
  academic_years: Option[];
  sort_by_options: Option[];
  grade_levels: Option[];
  class_name_choices: Option[];
  subjects: Option[];
};

type Filters = {
  student_name_filter: string;
  academic_year_filter: string;
  exam_filter: string;
  grade_filter: string;
  class_filter: string;
  date_from_filter: string;
  date_to_filter: string;
  sort_by: string;
  subject_filters: string[];
};

const EMPTY_FILTERS: Filters = {
  student_name_filter: "",
  academic_year_filter: "",
  exam_filter: "",
  grade_filter: "",
  class_filter: "",
  date_from_filter: "",
  date_to_filter: "",
  sort_by: "",
  subject_filters: [],
};

const backendBaseUrl = typeof window !== "undefined" ? `http://${window.location.hostname}:8000` : "http://localhost:8000";
const SCORES_API_BASE = `${backendBaseUrl}/api/scores`;

export default function ScoresQueryPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();

  const [options, setOptions] = useState<ScoreOptions | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);

  const [rows, setRows] = useState<ScoreRow[]>([]);
  const [allSubjects, setAllSubjects] = useState<string[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [startIndex, setStartIndex] = useState(0);
  const [endIndex, setEndIndex] = useState(0);
  const [subjectSort, setSubjectSort] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [subjectMenuOpen, setSubjectMenuOpen] = useState(false);
  const [academicYearDropdownOpen, setAcademicYearDropdownOpen] = useState(false);
  const [gradeDropdownOpen, setGradeDropdownOpen] = useState(false);
  const [examDropdownOpen, setExamDropdownOpen] = useState(false);
  const [classDropdownOpen, setClassDropdownOpen] = useState(false);
  const [sortByDropdownOpen, setSortByDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Array<{ id: number; type: "success" | "danger" | "info"; text: string }>>([]);

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

  useEffect(() => {
    if (!effectiveToken) return;
    const fetchOptions = async () => {
      const res = await fetch(`${SCORES_API_BASE}/options/`, { headers: { ...authHeader } });
      if (!res.ok) return;
      const data = await res.json();
      setOptions(data);
    };
    fetchOptions();
  }, [effectiveToken, authHeader]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".app-custom-dropdown") && !target.closest(".subject-dropdown")) {
        setAcademicYearDropdownOpen(false);
        setGradeDropdownOpen(false);
        setExamDropdownOpen(false);
        setClassDropdownOpen(false);
        setSortByDropdownOpen(false);
        setSubjectMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (!effectiveToken) return;
    const fetchRows = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({ page: String(currentPage), page_size: "50", dynamic_subjects: "1" });
        if (subjectSort) {
          params.set("subject_sort", subjectSort);
          params.set("sort_order", sortOrder);
        }
        Object.entries(appliedFilters).forEach(([k, v]) => {
          if (k === "subject_filters") {
            (v as string[]).forEach((subject) => params.append("subject_filters", subject));
          } else if (v) {
            params.set(k, String(v));
          }
        });

        const res = await fetch(`${SCORES_API_BASE}/?${params.toString()}`, { headers: { ...authHeader } });
        if (!res.ok) throw new Error("查询失败");

        const data: ScoreListResponse = await res.json();
        setRows(data.results || []);
        setAllSubjects(data.all_subjects || []);
        setTotalCount(data.count || 0);
        setNumPages(data.num_pages || 1);
        setStartIndex(data.start_index || 0);
        setEndIndex(data.end_index || 0);
      } catch (e) {
        console.error(e);
        setRows([]);
        setAllSubjects([]);
        setTotalCount(0);
        setStartIndex(0);
        setEndIndex(0);
        setMessages((prev) => [
          ...prev,
          { id: Date.now(), type: "danger", text: "查询失败，请检查筛选条件或稍后重试。" },
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRows();
  }, [effectiveToken, authHeader, currentPage, appliedFilters, subjectSort, sortOrder]);

  const handleQuery = () => {
    const hasCondition =
      !!filters.student_name_filter ||
      !!filters.academic_year_filter ||
      !!filters.exam_filter ||
      !!filters.grade_filter ||
      !!filters.class_filter ||
      !!filters.date_from_filter ||
      !!filters.date_to_filter ||
      !!filters.sort_by ||
      filters.subject_filters.length > 0;

    if (!hasCondition) {
      setMessages((prev) => [
        ...prev,
        { id: Date.now(), type: "info", text: "请至少设置一个查询条件后再查询。" },
      ]);
      return;
    }
    setAppliedFilters(filters);
    setCurrentPage(1);
    setSubjectMenuOpen(false);
  };

  const handleReset = () => {
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setSubjectSort("");
    setSortOrder("desc");
    setCurrentPage(1);
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

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({ dynamic_subjects: "1" });
      if (subjectSort) {
        params.set("subject_sort", subjectSort);
        params.set("sort_order", sortOrder);
      }
      Object.entries(appliedFilters).forEach(([k, v]) => {
        if (k === "subject_filters") {
          (v as string[]).forEach((subject) => params.append("subject_filters", subject));
        } else if (v) {
          params.set(k, String(v));
        }
      });
      const res = await fetch(`${SCORES_API_BASE}/query-export/?${params.toString()}`, { headers: { ...authHeader } });
      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { id: Date.now(), type: "danger", text: "导出失败，请稍后重试。" },
        ]);
        return;
      }
      const blob = await res.blob();
      downloadBlob(blob, `成绩查询导出_${Date.now()}.xlsx`);
      setMessages((prev) => [
        ...prev,
        { id: Date.now(), type: "success", text: "导出成功，文件已开始下载。" },
      ]);
    } catch (e) {
      console.error(e);
      setMessages((prev) => [
        ...prev,
        { id: Date.now(), type: "danger", text: "导出失败，请稍后重试。" },
      ]);
    }
  };

  const allSubjectsSelected = (options?.subjects?.length || 0) > 0 && filters.subject_filters.length === (options?.subjects?.length || 0);

  const toggleSubject = (subjectValue: string) => {
    setFilters((prev) => {
      const exists = prev.subject_filters.includes(subjectValue);
      return {
        ...prev,
        subject_filters: exists
          ? prev.subject_filters.filter((s) => s !== subjectValue)
          : [...prev.subject_filters, subjectValue],
      };
    });
  };

  const toggleAllSubjects = () => {
    setFilters((prev) => ({
      ...prev,
      subject_filters: allSubjectsSelected ? [] : (options?.subjects || []).map((s) => s.value),
    }));
  };

  const selectedSubjectText = (() => {
    const count = filters.subject_filters.length;
    const total = options?.subjects?.length || 0;
    if (count === 0) return "请选择科目";
    if (count === total) return `全部科目 (${count})`;
    if (count === 1) {
      return options?.subjects.find((s) => s.value === filters.subject_filters[0])?.label || "已选择 1 个科目";
    }
    return `已选择 ${count} 个科目`;
  })();

  const handleHeaderSort = (target: string, defaultOrder: "asc" | "desc" = "desc") => {
    if (subjectSort !== target) {
      setSubjectSort(target);
      setSortOrder(defaultOrder);
    } else {
      setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
    }
    setCurrentPage(1);
  };

  const renderSortBtn = (target: string, defaultOrder: "asc" | "desc" = "desc") => {
    const active = subjectSort === target;
    const arrow = active ? (sortOrder === "desc" ? "▼" : "▲") : (defaultOrder === "desc" ? "▼" : "▲");
    return (
      <button
        type="button"
        className={`sort-btn ${active ? "active" : ""}`}
        onClick={() => handleHeaderSort(target, defaultOrder)}
      >
        {arrow}
      </button>
    );
  };

  if (loading) return <div className="p-4">加载中...</div>;
  if (!user) return null;

  return (
    <div>
      <div className="page-header">
        <div className="container-fluid">
          <div className="row align-items-center">
            <div className="col-md-8">
              <h1><i className="fas fa-search me-3"></i>成绩查询</h1>
              <p className="mb-0 opacity-75">快速查询学生成绩信息</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container-fluid">
        {messages.length > 0 && (
          <div className="mb-3">
            {messages.map((msg) => (
              <div key={msg.id} className={`alert alert-${msg.type} alert-dismissible fade show`} role="alert">
                <i className="fas fa-info-circle me-2"></i>{msg.text}
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setMessages((prev) => prev.filter((m) => m.id !== msg.id))}
                ></button>
              </div>
            ))}
          </div>
        )}

        <div className="card app-filter-card">
          <div className="card-header"><h5 className="mb-0"><i className="fas fa-filter me-2"></i>快速筛选与操作</h5></div>
          <div className="card-body">
            <div className="row g-3 align-items-end">
              <div className="col-md-2">
                <label className="form-label small fw-bold" style={{ color: '#5a6b63' }}>学年</label>
                <div className="app-custom-dropdown">
                  <button type="button" className={`app-custom-dropdown-toggle ${academicYearDropdownOpen ? "active" : ""}`} onClick={() => setAcademicYearDropdownOpen(v => !v)}>
                    <span>{filters.academic_year_filter ? options?.academic_years.find(o => o.value === filters.academic_year_filter)?.label || filters.academic_year_filter : "--- 所有学年 ---"}</span>
                    <i className="fas fa-chevron-down app-custom-dropdown-arrow"></i>
                  </button>
                  <div className={`app-custom-dropdown-menu ${academicYearDropdownOpen ? "show" : ""}`}>
                    <button type="button" className="app-custom-dropdown-item" onClick={() => { setFilters(p => ({ ...p, academic_year_filter: "" })); setAcademicYearDropdownOpen(false); }}>--- 所有学年 ---</button>
                    {options?.academic_years.map((x) => (
                      <button key={x.value} type="button" className="app-custom-dropdown-item" onClick={() => { setFilters(p => ({ ...p, academic_year_filter: x.value })); setAcademicYearDropdownOpen(false); }}>{x.label}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="col-md-2">
                <label className="form-label small fw-bold" style={{ color: '#5a6b63' }}>年级</label>
                <div className="app-custom-dropdown">
                  <button type="button" className={`app-custom-dropdown-toggle ${gradeDropdownOpen ? "active" : ""}`} onClick={() => setGradeDropdownOpen(v => !v)}>
                    <span>{filters.grade_filter ? options?.grade_levels.find(o => o.value === filters.grade_filter)?.label || filters.grade_filter : "--- 所有年级 ---"}</span>
                    <i className="fas fa-chevron-down app-custom-dropdown-arrow"></i>
                  </button>
                  <div className={`app-custom-dropdown-menu ${gradeDropdownOpen ? "show" : ""}`}>
                    <button type="button" className="app-custom-dropdown-item" onClick={() => { setFilters(p => ({ ...p, grade_filter: "" })); setGradeDropdownOpen(false); }}>--- 所有年级 ---</button>
                    {options?.grade_levels.map((x) => (
                      <button key={x.value} type="button" className="app-custom-dropdown-item" onClick={() => { setFilters(p => ({ ...p, grade_filter: x.value })); setGradeDropdownOpen(false); }}>{x.label}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="col-md-2">
                <label className="form-label small fw-bold" style={{ color: '#5a6b63' }}>开始日期</label>
                <input type="date" className="form-control" value={filters.date_from_filter} onChange={(e) => setFilters((p) => ({ ...p, date_from_filter: e.target.value }))} />
              </div>
              <div className="col-md-2">
                <label className="form-label small fw-bold" style={{ color: '#5a6b63' }}>结束日期</label>
                <input type="date" className="form-control" value={filters.date_to_filter} onChange={(e) => setFilters((p) => ({ ...p, date_to_filter: e.target.value }))} />
              </div>
              <div className="col-md-2">
                <label className="form-label small fw-bold" style={{ color: '#5a6b63' }}>考试</label>
                <div className="app-custom-dropdown">
                  <button type="button" className={`app-custom-dropdown-toggle ${examDropdownOpen ? "active" : ""}`} onClick={() => setExamDropdownOpen(v => !v)}>
                    <span>{filters.exam_filter ? options?.exams.find(o => o.value === filters.exam_filter)?.label || filters.exam_filter : "--- 所有考试 ---"}</span>
                    <i className="fas fa-chevron-down app-custom-dropdown-arrow"></i>
                  </button>
                  <div className={`app-custom-dropdown-menu ${examDropdownOpen ? "show" : ""}`}>
                    <button type="button" className="app-custom-dropdown-item" onClick={() => { setFilters(p => ({ ...p, exam_filter: "" })); setExamDropdownOpen(false); }}>--- 所有考试 ---</button>
                    {options?.exams.map((x) => (
                      <button key={x.value} type="button" className="app-custom-dropdown-item" onClick={() => { setFilters(p => ({ ...p, exam_filter: x.value })); setExamDropdownOpen(false); }}>{x.label}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="col-md-2">
                <label className="form-label small fw-bold" style={{ color: '#5a6b63' }}>排序方式</label>
                <div className="app-custom-dropdown">
                  <button type="button" className={`app-custom-dropdown-toggle ${sortByDropdownOpen ? "active" : ""}`} onClick={() => setSortByDropdownOpen(v => !v)}>
                    <span>{filters.sort_by ? options?.sort_by_options.find(o => o.value === filters.sort_by)?.label || filters.sort_by : "--- 默认排序 ---"}</span>
                    <i className="fas fa-chevron-down app-custom-dropdown-arrow"></i>
                  </button>
                  <div className={`app-custom-dropdown-menu ${sortByDropdownOpen ? "show" : ""}`}>
                    <button type="button" className="app-custom-dropdown-item" onClick={() => { setFilters(p => ({ ...p, sort_by: "" })); setSubjectSort(""); setSortOrder("desc"); setSortByDropdownOpen(false); }}>--- 默认排序 ---</button>
                    {(options?.sort_by_options || []).filter(x => x.value).map((x) => (
                      <button key={x.value} type="button" className="app-custom-dropdown-item" onClick={() => { setFilters(p => ({ ...p, sort_by: x.value })); setSubjectSort(""); setSortOrder("desc"); setSortByDropdownOpen(false); }}>{x.label}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="row g-3 mt-2 align-items-end">
              <div className="col-md-2">
                <label className="form-label small fw-bold" style={{ color: '#5a6b63' }}>班级</label>
                <div className="app-custom-dropdown">
                  <button type="button" className={`app-custom-dropdown-toggle ${classDropdownOpen ? "active" : ""}`} onClick={() => setClassDropdownOpen(v => !v)}>
                    <span>{filters.class_filter ? options?.class_name_choices.find(o => o.value === filters.class_filter)?.label || filters.class_filter : "--- 所有班级 ---"}</span>
                    <i className="fas fa-chevron-down app-custom-dropdown-arrow"></i>
                  </button>
                  <div className={`app-custom-dropdown-menu ${classDropdownOpen ? "show" : ""}`}>
                    <button type="button" className="app-custom-dropdown-item" onClick={() => { setFilters(p => ({ ...p, class_filter: "" })); setClassDropdownOpen(false); }}>--- 所有班级 ---</button>
                    {options?.class_name_choices.map((x) => (
                      <button key={x.value} type="button" className="app-custom-dropdown-item" onClick={() => { setFilters(p => ({ ...p, class_filter: x.value })); setClassDropdownOpen(false); }}>{x.label}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="col-md-2">
                <label className="form-label small fw-bold" style={{ color: '#5a6b63' }}>姓名</label>
                <input className="form-control" value={filters.student_name_filter} onChange={(e) => setFilters((p) => ({ ...p, student_name_filter: e.target.value }))} placeholder="支持模糊搜索" />
              </div>
              <div className="col-md-4">
                <label className="form-label small fw-bold" style={{ color: '#5a6b63' }}>科目</label>
                <div className={`app-custom-dropdown ${subjectMenuOpen ? "show" : ""}`}>
                  <button type="button" className={`app-custom-dropdown-toggle ${subjectMenuOpen ? "active" : ""}`} onClick={() => setSubjectMenuOpen((v) => !v)}>
                    <span>{selectedSubjectText}</span>
                    <i className="fas fa-chevron-down app-custom-dropdown-arrow"></i>
                  </button>
                  <div className={`app-custom-dropdown-menu ${subjectMenuOpen ? "show" : ""}`} style={{ padding: '0.5rem 0.75rem' }}>
                    <div style={{ padding: '0.25rem 0.125rem', borderBottom: '1px solid #f1f3f4', marginBottom: '0.5rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.88rem' }}>
                        <input type="checkbox" className="form-check-input" checked={allSubjectsSelected} onChange={toggleAllSubjects} />
                        <span>全选/取消全选</span>
                      </label>
                    </div>
                    {(options?.subjects || []).map((subject) => (
                      <label key={subject.value} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.25rem 0.125rem', fontSize: '0.88rem' }}>
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={filters.subject_filters.includes(subject.value)}
                          onChange={() => toggleSubject(subject.value)}
                        />
                        <span>{subject.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="col-md-2 d-flex align-items-end">
                <button type="button" className="app-btn-primary w-100" onClick={handleQuery}><i className="fas fa-search me-1"></i>查询</button>
              </div>
              <div className="col-md-2 d-flex align-items-end">
                <button type="button" className="app-btn-outline w-100" onClick={handleReset}><i className="fas fa-undo me-1"></i>重置条件</button>
              </div>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-5"><div className="spinner-border text-primary" role="status"></div></div>
        ) : rows.length ? (
          <>
            <div className="stats-summary">
              <div className="row align-items-center">
                <div className="col-auto">
                  <div className="stats-icon"><i className="fas fa-chart-bar"></i></div>
                </div>
                <div className="col">
                  <h5 className="mb-1">查询统计</h5>
                  <p className="mb-0">
                    共找到 <strong className="text-primary">{totalCount}</strong> 条记录
                    {numPages > 1 ? <>（当前显示第 <strong>{startIndex}</strong> - <strong>{endIndex}</strong> 条）</> : null}
                  </p>
                </div>
                <div className="col-auto">
                  <button type="button" className="app-btn-primary" onClick={handleExport}>
                    <i className="fas fa-file-excel me-1"></i>导出Excel
                  </button>
                </div>
              </div>
            </div>

            <div className="app-table-wrapper">
              <div className="app-table-scroll query-table-scroll">
                <table className="app-table frozen-table">
                  <thead>
                    <tr>
                      <th className="frozen-col col-name">姓名</th>
                      <th className="frozen-col col-grade">年级</th>
                      <th className="frozen-col col-class">班级</th>
                      <th className="frozen-col col-exam">考试</th>
                      {allSubjects.map((subject) => (
                        <th key={subject} className="score-cell sort-header">
                          {subject} {renderSortBtn(subject, "desc")}
                        </th>
                      ))}
                      <th className="sort-header">总分 {renderSortBtn("total_score", "desc")}</th>
                      <th className="sort-header">级排 {renderSortBtn("grade_rank", "asc")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.record_key}>
                        <td className="student-info frozen-col col-name">{row.student.name}</td>
                        <td className="frozen-col col-grade">{row.student.grade_level_display}</td>
                        <td className="frozen-col col-class">{row.class.class_name || "N/A"}</td>
                        <td className="frozen-col col-exam" title={`${row.exam.academic_year} ${row.exam.name}`}>
                          <span className="exam-text">{`${row.exam.academic_year} ${row.exam.name}`}</span>
                        </td>
                        {allSubjects.map((s) => (
                          <td key={`${row.record_key}_${s}`} className="score-cell">
                            {row.scores[s] !== undefined ? row.scores[s] : <span className="text-muted">-</span>}
                          </td>
                        ))}
                        <td className="total-score">{row.total_score ?? "-"}</td>
                        <td className="rank-cell">{row.grade_rank ?? <span className="text-muted">-</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {numPages > 1 && (
              <nav aria-label="成绩查询结果分页">
                <ul className="pagination">
                  <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
                    <button className="page-link" onClick={() => setCurrentPage(1)}><i className="fas fa-angle-double-left"></i> 首页</button>
                  </li>
                  <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
                    <button className="page-link" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}><i className="fas fa-angle-left"></i> 上一页</button>
                  </li>
                  <li className="page-item active">
                    <span className="page-link">第 {currentPage} 页，共 {numPages} 页</span>
                  </li>
                  <li className={`page-item ${currentPage >= numPages ? "disabled" : ""}`}>
                    <button className="page-link" onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}>下一页 <i className="fas fa-angle-right"></i></button>
                  </li>
                  <li className={`page-item ${currentPage >= numPages ? "disabled" : ""}`}>
                    <button className="page-link" onClick={() => setCurrentPage(numPages)}>末页 <i className="fas fa-angle-double-right"></i></button>
                  </li>
                </ul>
              </nav>
            )}
          </>
        ) : (
          <div className="empty-state">
            <i className="fas fa-search"></i>
            <h4 className="mt-3">暂无查询结果</h4>
            <p className="text-muted">请设置查询条件后点击查询按钮，或者调整查询条件重新搜索</p>
            <button type="button" className="app-btn-primary mt-3" onClick={handleQuery}>
              <i className="fas fa-search me-2"></i>开始查询
            </button>
          </div>
        )}

        <button
          type="button"
          className="app-btn-primary position-fixed bottom-0 end-0 m-4"
          style={{ zIndex: 1000 }}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
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
        .stats-summary {
          background: white;
          border-radius: 12px;
          padding: 1rem 1.25rem;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          margin-bottom: 1rem;
        }
        .stats-icon {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #e8f7f4;
          color: #01876c;
        }
        .query-table-scroll {
          scroll-behavior: smooth;
          overscroll-behavior-x: contain;
        }
        .frozen-table tbody tr:nth-child(odd) td {
          background-color: #f8fafa;
        }
        .frozen-table tbody tr:nth-child(even) td {
          background-color: #ffffff;
        }
        .frozen-table tbody tr:hover td {
          background-color: #e8f7f4 !important;
          transition: background-color 0.2s ease;
        }
        .frozen-table thead th {
          background: linear-gradient(135deg, #01876c 0%, #02a888 100%) !important;
          color: #ffffff;
          font-weight: 600;
          border-bottom: 1px solid #017a63;
        }
        .sort-header {
          white-space: nowrap;
        }
        .sort-btn {
          border: none;
          background: transparent;
          color: rgba(255,255,255,0.65);
          font-size: 0.82rem;
          margin-left: 0.25rem;
          padding: 0;
        }
        .sort-btn.active {
          color: #ffffff;
          font-weight: 700;
        }
        .frozen-col {
          position: sticky;
          left: 0;
          background: inherit;
          z-index: 2;
        }
        .frozen-table thead .frozen-col {
          background: linear-gradient(135deg, #01876c 0%, #02a888 100%) !important;
          z-index: 3;
        }
        .frozen-table tbody .frozen-col {
          background-color: #f8fafa;
        }
        .frozen-table tbody tr:nth-child(even) .frozen-col {
          background-color: #ffffff;
        }
        .frozen-table tbody tr:hover .frozen-col {
          background-color: #e8f7f4 !important;
        }
        .frozen-table .col-name {
          min-width: 96px;
          width: 96px;
          max-width: 96px;
          left: 0;
        }
        .frozen-table .col-grade {
          min-width: 72px;
          width: 72px;
          max-width: 72px;
          left: 96px;
        }
        .frozen-table .col-class {
          min-width: 72px;
          width: 72px;
          max-width: 72px;
          left: 168px;
        }
        .frozen-table .col-exam {
          min-width: 220px;
          width: 220px;
          max-width: 220px;
          left: 240px;
        }
        .frozen-table td.col-exam,
        .frozen-table th.col-exam {
          overflow: hidden;
        }
        .exam-text {
          display: block;
          width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .score-cell {
          text-align: center;
          font-size: 0.88rem;
          color: #1e2a25;
        }
        .frozen-table tbody td.total-score {
          font-weight: 700;
          color: #92400e;
          background-color: #fef3c7 !important;
        }
        .frozen-table tbody td.rank-cell {
          font-weight: 600;
          color: #0369a1;
          background-color: #d4e8fc !important;
        }
        .frozen-table tbody tr:hover td.total-score {
          background-color: #fde68a !important;
        }
        .frozen-table tbody tr:hover td.rank-cell {
          background-color: #b8d4f0 !important;
        }
        .empty-state {
          text-align: center;
          background: #fff;
          border-radius: 12px;
          padding: 3rem 1rem;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }
        .empty-state i {
          font-size: 2.25rem;
          color: #adb5bd;
        }
        .frozen-table tbody td {
          font-weight: 400;
        }
        .subject-dropdown {
          position: relative;
        }
        .subject-dropdown-items {
          padding: 0.5rem 0.75rem;
        }
        .subject-dropdown-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.35rem;
        }
      `}</style>
    </div>
  );
}

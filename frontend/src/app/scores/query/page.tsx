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
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Array<{ id: number; type: "success" | "danger" | "info"; text: string }>>([]);

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
      const res = await fetch(`${backendBaseUrl}/api/scores/options/`, { headers: { ...authHeader } });
      if (!res.ok) return;
      const data = await res.json();
      setOptions(data);
    };
    fetchOptions();
  }, [token, authHeader]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".subject-dropdown")) {
        setSubjectMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (!token) return;
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

        const res = await fetch(`${backendBaseUrl}/api/scores/?${params.toString()}`, { headers: { ...authHeader } });
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
  }, [token, authHeader, currentPage, appliedFilters, subjectSort, sortOrder]);

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
      const res = await fetch(`${backendBaseUrl}/api/scores/query-export/?${params.toString()}`, { headers: { ...authHeader } });
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

        <div className="card filter-card mb-4">
          <div className="card-header"><h5 className="mb-0"><i className="fas fa-filter me-2"></i>快速筛选与操作</h5></div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-2">
                <label className="form-label">学年</label>
                <select className="form-select" value={filters.academic_year_filter} onChange={(e) => setFilters((p) => ({ ...p, academic_year_filter: e.target.value }))}>
                  <option value="">--- 所有学年 ---</option>
                  {options?.academic_years.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label">年级</label>
                <select className="form-select" value={filters.grade_filter} onChange={(e) => setFilters((p) => ({ ...p, grade_filter: e.target.value }))}>
                  <option value="">--- 所有年级 ---</option>
                  {options?.grade_levels.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label">开始日期</label>
                <input type="date" className="form-control" value={filters.date_from_filter} onChange={(e) => setFilters((p) => ({ ...p, date_from_filter: e.target.value }))} />
              </div>
              <div className="col-md-2">
                <label className="form-label">结束日期</label>
                <input type="date" className="form-control" value={filters.date_to_filter} onChange={(e) => setFilters((p) => ({ ...p, date_to_filter: e.target.value }))} />
              </div>
              <div className="col-md-2">
                <label className="form-label">考试</label>
                <select className="form-select" value={filters.exam_filter} onChange={(e) => setFilters((p) => ({ ...p, exam_filter: e.target.value }))}>
                  <option value="">--- 所有考试 ---</option>
                  {options?.exams.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label">排序方式</label>
                <select
                  className="form-select"
                  value={filters.sort_by}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFilters((p) => ({ ...p, sort_by: value }));
                    if (value) {
                      setSubjectSort("");
                      setSortOrder("desc");
                    }
                  }}
                >
                  {(options?.sort_by_options || [{ value: "", label: "--- 默认排序 ---" }]).map((x) => (
                    <option key={x.value || "default"} value={x.value}>{x.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="row g-3 mt-2">
              <div className="col-md-2">
                <label className="form-label">班级</label>
                <select className="form-select" value={filters.class_filter} onChange={(e) => setFilters((p) => ({ ...p, class_filter: e.target.value }))}>
                  <option value="">--- 所有班级 ---</option>
                  {options?.class_name_choices.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label">姓名</label>
                <input className="form-control" value={filters.student_name_filter} onChange={(e) => setFilters((p) => ({ ...p, student_name_filter: e.target.value }))} placeholder="支持模糊搜索" />
              </div>
              <div className="col-md-4">
                <label className="form-label">科目</label>
                <div className="subject-dropdown">
                  <button type="button" className={`subject-dropdown-toggle ${subjectMenuOpen ? "active" : ""}`} onClick={() => setSubjectMenuOpen((v) => !v)}>
                    <span>{selectedSubjectText}</span>
                    <i className={`fas fa-chevron-${subjectMenuOpen ? "up" : "down"}`}></i>
                  </button>
                  {subjectMenuOpen && (
                    <div className="subject-dropdown-menu">
                      <div className="subject-dropdown-header">
                        <label className="form-check mb-0">
                          <input type="checkbox" className="form-check-input" checked={allSubjectsSelected} onChange={toggleAllSubjects} />
                          <span className="form-check-label">全选/取消全选</span>
                        </label>
                      </div>
                      <div className="subject-dropdown-items">
                        {(options?.subjects || []).map((subject) => (
                          <label key={subject.value} className="form-check subject-dropdown-item">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              checked={filters.subject_filters.includes(subject.value)}
                              onChange={() => toggleSubject(subject.value)}
                            />
                            <span className="form-check-label">{subject.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="col-md-2 d-flex align-items-end">
                <button type="button" className="btn btn-primary w-100" onClick={handleQuery}><i className="fas fa-search me-1"></i>查询</button>
              </div>
              <div className="col-md-2 d-flex align-items-end">
                <button type="button" className="btn btn-secondary w-100" onClick={handleReset}><i className="fas fa-undo me-1"></i>重置条件</button>
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
                  <button type="button" className="btn btn-success" onClick={handleExport}>
                    <i className="fas fa-file-excel me-1"></i>导出Excel
                  </button>
                </div>
              </div>
            </div>

            <div className="table-container-wrapper">
              <div className="table-responsive query-table-scroll">
                <table className="table table-hover frozen-table">
                  <thead>
                    <tr>
                      <th className="frozen-col col-name">姓名</th>
                      <th className="frozen-col col-grade">年级</th>
                      <th className="frozen-col col-class">班级</th>
                      <th className="frozen-border"></th>
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
                        <td className="frozen-border"></td>
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
            <button type="button" className="btn btn-primary mt-3" onClick={handleQuery}>
              <i className="fas fa-search me-2"></i>开始查询
            </button>
          </div>
        )}

        <button
          type="button"
          className="btn btn-primary position-fixed bottom-0 end-0 m-4"
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
        .filter-card {
          border: none;
          border-radius: 15px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          margin-bottom: 2rem;
        }
        .filter-card .card-header {
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          border-bottom: 1px solid #dee2e6;
          border-radius: 15px 15px 0 0;
          padding: 1rem 1.5rem;
        }
        .table-container {
          background: white;
          border-radius: 15px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          overflow: hidden;
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
          background: #e3f2fd;
          color: #1565c0;
        }
        .table-container-wrapper {
          background: linear-gradient(180deg, #f8fffd 0%, #ffffff 35%);
          border-radius: 12px;
          border: 1px solid rgba(1, 135, 108, 0.12);
          box-shadow: 0 6px 16px rgba(1, 135, 108, 0.08);
          overflow: hidden;
          position: relative;
        }
        .query-table-scroll {
          scroll-behavior: smooth;
          overscroll-behavior-x: contain;
          background: transparent;
        }
        .frozen-table tbody tr:nth-child(odd) {
          background-color: #f3f3f3;
        }
        .frozen-table tbody tr:nth-child(even) {
          background-color: #eeeeee;
        }
        .frozen-table tbody tr:hover {
          background-color: #e8e8e8;
          transition: background-color 0.2s ease;
        }
        .frozen-table thead th {
          background: #c2c2c2;
          color: #000;
          font-weight: 700;
          border-bottom: 1px solid #7a7a7a;
        }
        .sort-header {
          white-space: nowrap;
        }
        .sort-btn {
          border: none;
          background: transparent;
          color: #6c757d;
          font-size: 0.85rem;
          margin-left: 0.25rem;
          padding: 0;
        }
        .sort-btn.active {
          color: #0d6efd;
          font-weight: 700;
        }
        .frozen-col {
          position: sticky;
          left: 0;
          background: #eeeeee;
          z-index: 2;
          box-shadow: none;
        }
        .frozen-table thead .frozen-col {
          background: #c2c2c2;
          z-index: 3;
        }
        .frozen-table .col-name {
          min-width: 128px;
          width: 128px;
          max-width: 128px;
          left: 0;
        }
        .frozen-table .col-grade {
          min-width: 72px;
          width: 72px;
          max-width: 72px;
          left: 128px;
        }
        .frozen-table .col-class {
          min-width: 72px;
          width: 72px;
          max-width: 72px;
          left: 200px;
        }
        .frozen-border {
          position: sticky;
          left: 272px;
          z-index: 1;
          width: 1px;
          min-width: 1px;
          background: transparent;
          pointer-events: none;
        }
        .score-cell {
          text-align: center;
        }
        .frozen-table tbody td.total-score {
          font-weight: 700;
          color: #856404;
          background-color: #fff3cd !important;
        }
        .frozen-table tbody td.rank-cell {
          font-weight: 600;
          background-color: #d1ecf1 !important;
        }
        .frozen-table tbody tr:hover td.total-score {
          background-color: #ffe8a1 !important;
        }
        .frozen-table tbody tr:hover td.rank-cell {
          background-color: #bfe7f0 !important;
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
        .table th,
        .table td {
          text-align: center;
          white-space: nowrap;
          color: #000;
        }
        .frozen-table tbody td {
          font-weight: 400;
        }
        .subject-dropdown {
          position: relative;
        }
        .subject-dropdown-toggle {
          width: 100%;
          border: 1px solid #ced4da;
          background: #fff;
          padding: 0.375rem 0.75rem;
          border-radius: 0.375rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .subject-dropdown-menu {
          position: absolute;
          z-index: 20;
          width: 100%;
          max-height: 280px;
          overflow: auto;
          border: 1px solid #dee2e6;
          border-radius: 0.5rem;
          background: #fff;
          box-shadow: 0 8px 16px rgba(0,0,0,0.12);
          margin-top: 0.25rem;
        }
        .subject-dropdown-header {
          padding: 0.5rem 0.75rem;
          border-bottom: 1px solid #f1f3f4;
          background: #f8f9fa;
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

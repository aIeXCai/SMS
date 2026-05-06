"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { canWriteScores } from "@/lib/permissions";
import { EMPTY_FILTERS } from "./types";
import { useScoresData } from "./hooks/useScoresData";
import ScoreWorkbench from "./components/ScoreWorkbench";
import ScoreSearchBar from "./components/ScoreSearchBar";
import ScoreFilterBar from "./components/ScoreFilterBar";
import ScoreTable from "./components/ScoreTable";
import ScorePagination from "./components/ScorePagination";
import ScoreBatchBar from "./components/ScoreBatchBar";
import ScoreImportModal from "./components/ScoreImportModal";
import ScoreConfirmModal from "./components/ScoreConfirmModal";

export default function ScoresPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const canScoreWrite = canWriteScores(user);

  const effectiveToken = useMemo(() => {
    if (token) return token;
    if (typeof window !== "undefined") return localStorage.getItem("accessToken");
    return null;
  }, [token]);

  // Data fetching + state via custom hook
  const managedGrade = user?.role === "grade_manager" ? user?.managed_grade : undefined;
  const {
    options, gradeClasses, setGradeClasses, rows, allSubjects, totalCount, numPages,
    currentPage, setCurrentPage, pageSize, setPageSize, startIndex, endIndex,
    isLoading, isSelectingAll, filters, setFilters, setAppliedFilters,
    selected, setSelected, selectedKeys, allFilteredSelected, hasAnySelection,
    currentPageIndeterminate, showDataView, resultModal, showResultModal, closeResultModal,
    fetchOptions, fetchGradeClasses, fetchRows, fetchAllFilteredRecordKeys,
    deleteSelectedRecords, deleteFilteredRecords,
  } = useScoresData(effectiveToken, managedGrade);

  // UI-only state
  const [examDropdownOpen, setExamDropdownOpen] = useState(false);
  const [gradeDropdownOpen, setGradeDropdownOpen] = useState(false);
  const [classDropdownOpen, setClassDropdownOpen] = useState(false);
  const [filterCollapsed, setFilterCollapsed] = useState(true);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const isGradeManager = user?.role === "grade_manager";

  // Auth guards
  useEffect(() => { if (!loading && !effectiveToken) router.push("/login"); }, [loading, effectiveToken, router]);
  useEffect(() => { if (!loading && user?.role === "subject_teacher") router.replace("/"); }, [loading, user, router]);

  // Click-outside to close dropdowns
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".app-custom-dropdown")) {
        setExamDropdownOpen(false); setGradeDropdownOpen(false); setClassDropdownOpen(false);
      }
    };
    document.addEventListener("click", handle);
    return () => document.removeEventListener("click", handle);
  }, []);

  // Filter handlers
  const handleGradeSelect = (gradeValue: string) => {
    setFilters((p) => ({ ...p, grade_filter: gradeValue, exam_filter: "", class_filter: "" }));
    setGradeDropdownOpen(false);
    fetchOptions(gradeValue || undefined);
    if (gradeValue) { fetchGradeClasses(gradeValue); } else { setGradeClasses([]); }
  };
  const handleFilter = () => { setSelected({}); setAppliedFilters({ ...filters }); if (currentPage !== 1) setCurrentPage(1); };
  const handleReset = () => { setFilters(EMPTY_FILTERS); setSelected({}); setAppliedFilters(EMPTY_FILTERS); setCurrentPage(1); };

  // Selection handlers
  const toggleSelectAll = async () => {
    if (!totalCount || isSelectingAll) return;
    if (allFilteredSelected) { setSelected({}); return; }
    try {
      const allKeys = await fetchAllFilteredRecordKeys();
      setSelected(Object.fromEntries(allKeys.map((k) => [k, true])));
    } catch (e) { console.error("全选失败", e); showResultModal("error", "全选失败", "无法完成跨分页全选", "请稍后重试"); }
  };
  const toggleOne = (key: string) => setSelected((prev) => ({ ...prev, [key]: !prev[key] }));

  // Delete handlers
  const handleDeleteSelected = () => {
    if (!selectedKeys.length) { showResultModal("error", "操作提示", "未选择记录", "请先选择要删除的记录"); return; }
    setDeleteConfirmVisible(true);
  };
  const confirmDeleteSelected = async () => { const ok = await deleteSelectedRecords(selectedKeys); if (ok) { setDeleteConfirmVisible(false); fetchRows(); } };
  const handleDeleteFiltered = async () => { const ok = await deleteFilteredRecords(); if (ok) fetchRows(); };

  // Render
  if (loading) return <div className="p-4 text-center py-5">加载中...</div>;
  if (!user) return null;

  return (
    <div>
      {!showDataView && !isLoading && (
        <ScoreWorkbench canScoreWrite={canScoreWrite} isGradeManager={isGradeManager}
          onImportClick={() => setImportModalVisible(true)} />
      )}

      {showDataView && (
        <div>
          <div className="page-header">
            <div className="w-full px-4 mx-auto max-w-[1400px]">
              <div className="flex flex-wrap items-center">
                <div className="w-full md:w-2/3">
                  <h1><i className="fas fa-chart-line mr-3"></i>成绩管理</h1>
                  <p className="mb-0 opacity-75">管理学生考试成绩，支持手动录入和批量导入</p>
                </div>
                <div className="w-full md:w-1/3 text-right">
                  {canScoreWrite && (<>
                    <Link href="/scores/add" className="secondary-action mr-2"><i className="fas fa-plus mr-2"></i>手动新增成绩</Link>
                    <Link href="#" onClick={(e) => { e.preventDefault(); setImportModalVisible(true); }} className="secondary-action">
                      <i className="fas fa-file-import mr-2"></i>批量导入</Link>
                  </>)}
                </div>
              </div>
            </div>
          </div>

          <div className="w-full px-4 mx-auto max-w-[1400px]">
            <ScoreSearchBar studentIdFilter={filters.student_id_filter}
              studentNameFilter={filters.student_name_filter}
              onStudentIdChange={(v) => setFilters((p) => ({ ...p, student_id_filter: v }))}
              onStudentNameChange={(v) => setFilters((p) => ({ ...p, student_name_filter: v }))}
              onSearch={handleFilter} />

            <ScoreFilterBar filters={filters} options={options} gradeClasses={gradeClasses}
              collapsed={filterCollapsed} onToggleCollapse={() => setFilterCollapsed((v) => !v)}
              gradeDropdownOpen={gradeDropdownOpen} examDropdownOpen={examDropdownOpen} classDropdownOpen={classDropdownOpen}
              onGradeDropdownToggle={() => setGradeDropdownOpen((v) => !v)}
              onExamDropdownToggle={() => setExamDropdownOpen((v) => !v)}
              onClassDropdownToggle={() => setClassDropdownOpen((v) => !v)}
              onGradeSelect={handleGradeSelect}
              onExamSelect={(v) => { setFilters((p) => ({ ...p, exam_filter: v })); setExamDropdownOpen(false); }}
              onClassSelect={(v) => { setFilters((p) => ({ ...p, class_filter: v })); setClassDropdownOpen(false); }}
              onFilter={handleFilter} onReset={handleReset} />

            {hasAnySelection && (
              <ScoreBatchBar selectedCount={selectedKeys.length} totalCount={totalCount}
                canScoreWrite={canScoreWrite} onDeleteSelected={handleDeleteSelected}
                onDeleteFiltered={handleDeleteFiltered} />)}

            {isLoading ? (
              <div className="text-center py-5"><div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" role="status"></div></div>
            ) : rows.length > 0 ? (<>
              <ScoreTable rows={rows} allSubjects={allSubjects} selected={selected}
                allFilteredSelected={allFilteredSelected} currentPageIndeterminate={currentPageIndeterminate}
                isSelectingAll={isSelectingAll} totalCount={totalCount} canScoreWrite={canScoreWrite}
                onToggleSelectAll={toggleSelectAll} onToggleOne={toggleOne} />
              <ScorePagination currentPage={currentPage} numPages={numPages} pageSize={pageSize}
                totalCount={totalCount} startIndex={startIndex} endIndex={endIndex}
                pageSizeOptions={options?.per_page_options || [10, 20, 50, 100]}
                onPageChange={setCurrentPage} onPageSizeChange={setPageSize} />
            </>) : (
              <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded text-center py-5">
                <i className="fas fa-search mr-2"></i>当前筛选条件下没有找到成绩记录。
                <button type="button" className="text-blue-600 bg-transparent border-none text-sm underline cursor-pointer p-0" onClick={handleReset}>清除筛选条件</button>
              </div>
            )}
          </div>
        </div>
      )}

      <ScoreImportModal visible={importModalVisible} options={options}
        onClose={() => setImportModalVisible(false)}
        onImportSuccess={fetchRows} onShowResult={showResultModal} />
      <ScoreConfirmModal mode="delete" visible={canScoreWrite && deleteConfirmVisible}
        selectedCount={selectedKeys.length} onConfirmDelete={confirmDeleteSelected}
        onCancelDelete={() => setDeleteConfirmVisible(false)} />
      <ScoreConfirmModal mode="result" visible={resultModal.show}
        result={resultModal} onCloseResult={closeResultModal} />

      {/* kept because: page-header gradient + secondary-action button */}
      <style jsx global>{`
        .page-header {
          background: rgb(1, 135, 108);
          color: white;
          padding: 2rem 0;
          margin-bottom: 2rem;
          border-radius: 10px;
        }
        a.secondary-action,
        a.secondary-action:link,
        a.secondary-action:visited,
        a.secondary-action:hover,
        a.secondary-action:active {
          display: inline-flex; align-items: center; justify-content: center;
          min-height: 44px; min-width: 144px; padding: 0 16px; border-radius: 12px;
          background: rgba(255,255,255,0.72); color: #2f3a4b; font-size: 14px;
          text-decoration: none; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
          transition: all 0.2s ease; cursor: pointer;
        }
        a.secondary-action:hover { background: rgba(255,255,255,0.9); color: #1a2535; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        }
      `}</style>
    </div>
  );
}

"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import BatchImportModal from "./BatchImportModal";
import { canWriteStudents } from "@/lib/permissions";
import StudentStatsCards from "./components/StudentStatsCards";
import StudentFilterBar from "./components/StudentFilterBar";
import StudentBatchBar from "./components/StudentBatchBar";
import StudentTable from "./components/StudentTable";
import StudentsPageStyles from "./components/StudentsPageStyles";
import { useStudentList } from "./hooks/useStudentList";

export default function StudentsPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const canStudentWrite = canWriteStudents(user);

  const {
    students, stats, isLoading, error,
    search, setSearch,
    filterStatus, setFilterStatus,
    filterGrade, setFilterGrade,
    filterClass, setFilterClass,
    filterGradeDropdownOpen, setFilterGradeDropdownOpen,
    filterClassDropdownOpen, setFilterClassDropdownOpen,
    filterStatusDropdownOpen, setFilterStatusDropdownOpen,
    selected, selectedCount, allSelected,
    batchStatus, setBatchStatus, selectAllRef,
    fetchStats, fetchStudents,
    handleSelectAll, handleSelectOne, handleDelete, handleStatusChange,
    handleBatchDelete, handleBatchUpdateStatus, handleBatchGraduate,
  } = useStudentList(token ?? undefined);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Role-aware title & subtitle
  const { pageTitle, pageSubtitle } = useMemo(() => {
    if (user?.role === 'subject_teacher') {
      return { pageTitle: '任教学生', pageSubtitle: '查看您任教班级的学生信息' };
    }
    if (user?.role === 'grade_manager') {
      return { pageTitle: '年级学生', pageSubtitle: '管理您负责年级的学生信息' };
    }
    return { pageTitle: '学生管理', pageSubtitle: '管理学校所有学生信息，支持批量操作和数据导入' };
  }, [user?.role]);

  // Pre-fill filters for subject_teacher / grade_manager based on teaching_classes
  const prefilled = useRef(false);

  useEffect(() => {
    if (!user || !token || prefilled.current) return;
    if (
      (user.role === 'subject_teacher' || user.role === 'grade_manager') &&
      user.teaching_classes?.length
    ) {
      const cohorts = [...new Set(user.teaching_classes.map(tc => tc.cohort).filter(Boolean))];
      if (cohorts.length === 1 && cohorts[0]) {
        setFilterGrade(cohorts[0]);
      }
      if (user.teaching_classes.length === 1) {
        setFilterClass(user.teaching_classes[0].class_name);
      }
      prefilled.current = true;
    }
  }, [user, token, setFilterGrade, setFilterClass]);

  const handleBatchPromote = () => {
    if (!selectedCount) return alert("请先选择要升年级的学生");
    const selectedIds = Object.entries(selected).filter(([, v]) => v).map(([k]) => Number(k));
    localStorage.setItem("selectedStudentIdsForPromote", JSON.stringify(selectedIds));
    router.push("/students/batch-promote");
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex justify-center items-center" style={{ height: "100vh", backgroundColor: "#f8f9fa" }}>
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" role="status"></div>
          <p className="mt-2">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="w-full px-4 mx-auto max-w-[1400px]">
          <div className="flex flex-wrap items-center">
            <div className="w-full md:w-2/3">
              <h1><i className="fas fa-users mr-3"></i>{pageTitle}</h1>
              <p className="mb-0 opacity-75">{pageSubtitle}</p>
            </div>
            <div className="w-full md:w-1/3 text-right">
              {canStudentWrite && (
                <>
                  <Link href="/students/add" className="secondary-action mr-2">
                    <i className="fas fa-plus mr-2"></i>新增学生
                  </Link>
                  <Link href="#" onClick={(e) => { e.preventDefault(); setIsImportModalOpen(true); }} className="secondary-action">
                    <i className="fas fa-file-import mr-2"></i>批量导入
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-4 mx-auto max-w-[1400px]">
        <StudentStatsCards stats={stats} />

        <StudentFilterBar
          search={search} filterStatus={filterStatus}
          filterGrade={filterGrade} filterClass={filterClass}
          filterGradeDropdownOpen={filterGradeDropdownOpen}
          filterClassDropdownOpen={filterClassDropdownOpen}
          filterStatusDropdownOpen={filterStatusDropdownOpen}
          stats={stats}
          onSearchChange={setSearch}
          onFilterStatusChange={setFilterStatus}
          onFilterGradeChange={setFilterGrade}
          onFilterClassChange={setFilterClass}
          onFilterGradeDropdownToggle={() => setFilterGradeDropdownOpen(v => !v)}
          onFilterClassDropdownToggle={() => setFilterClassDropdownOpen(v => !v)}
          onFilterStatusDropdownToggle={() => setFilterStatusDropdownOpen(v => !v)}
          onReset={() => { setSearch(""); setFilterStatus(""); setFilterGrade(""); setFilterClass(""); }}
        />

        <StudentBatchBar
          selectedCount={selectedCount} allSelected={allSelected}
          batchStatus={batchStatus} stats={stats}
          canStudentWrite={canStudentWrite} error={error}
          selectAllRef={selectAllRef}
          onSelectAll={handleSelectAll}
          onBatchStatusChange={setBatchStatus}
          onBatchUpdateStatus={handleBatchUpdateStatus}
          onBatchDelete={handleBatchDelete}
          onBatchPromote={handleBatchPromote}
          onBatchGraduate={handleBatchGraduate}
        />

        <StudentTable
          students={students} stats={stats}
          selected={selected} allSelected={allSelected}
          canStudentWrite={canStudentWrite} isLoading={isLoading}
          onSelectAll={handleSelectAll}
          onSelectOne={handleSelectOne}
          onDelete={handleDelete}
          onStatusChange={handleStatusChange}
        />
      </div>

      <StudentsPageStyles />

      {canStudentWrite && (
        <BatchImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onSuccess={() => { fetchStudents(); fetchStats(); }}
        />
      )}

      {/* kept because: page-header gradient + secondary-action button style */}
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
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          min-width: 144px;
          padding: 0 16px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.72);
          color: #2f3a4b;
          font-size: 14px;
          text-decoration: none;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          transition: all 0.2s ease;
          cursor: pointer;
        }
        a.secondary-action:hover {
          background: rgba(255, 255, 255, 0.9);
          color: #1a2535;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
      `}</style>
    </div>
  );
}

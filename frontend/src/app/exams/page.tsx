"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { canWriteExams } from "@/lib/permissions";
import { gradeToCohort } from "@/lib/gradeMapping";
import ExamFilterBar from "./components/ExamFilterBar";
import ExamTable from "./components/ExamTable";
import DeleteExamModal from "./components/DeleteExamModal";
import ExamsPageStyles from "./components/ExamsPageStyles";

type Exam = {
  id: number;
  name: string;
  academic_year: string;
  grade_level: string;
  date: string;
  description: string;
};

type Option = { value: string; label: string };

type ExamOptions = {
  academic_years: Option[];
  grade_levels: Option[];
};

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

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Modals
  const [deleteData, setDeleteData] = useState<{ id: number; name: string } | null>(null);

  const fetchOptions = async () => {
    try {
      const data = await api.get<ExamOptions>('/exams/options/');
      setOptions(data);
    } catch (e) {
      console.error("Fetch options failed", e);
    }
  };

  const fetchExams = async (page = 1) => {
    setIsLoading(true);
    try {
      const params: Record<string, string> = {
        page: page.toString(),
        page_size: pageSize.toString(),
      };
      if (academicYear) params.academic_year = academicYear;
      if (gradeLevel) params.grade_level = gradeLevel;

      const data = await api.get<Exam[] | { results: Exam[]; count: number }>('/exams/', params);
      if ('results' in data) {
        setExams(data.results);
        setTotalCount(data.count);
      } else {
        setExams(data);
        setTotalCount(data.length);
      }
    } catch (e) {
      console.error("Fetch exams failed", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Block subject_teacher from accessing exam management
  useEffect(() => {
    if (!loading && user && user.role === "subject_teacher") {
      router.replace("/");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!token) return;
    fetchOptions();
  }, [token]);

  // Pre-fill grade filter for grade_manager using grade→cohort mapping
  const gradePreFilled = useRef(false);
  useEffect(() => {
    if (gradePreFilled.current || !user || !token) return;
    if (user.role === 'grade_manager' && user.managed_grade) {
      gradePreFilled.current = true;
      const cohort = gradeToCohort(user.managed_grade);
      if (cohort) setGradeLevel(cohort);
    }
  }, [user, token]);

  useEffect(() => {
    if (!token) return;
    fetchExams(currentPage);
  }, [token, currentPage, academicYear, gradeLevel]);

  // Close dropdowns on outside click
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
      fetchExams(1);
    } else {
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
      await api.delete(`/exams/${deleteData.id}/`);
      setDeleteData(null);
      fetchExams(currentPage);
    } catch (e) {
      alert("删除时发生错误");
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === exams.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(exams.map((e) => e.id)));
    }
  };

  const handleSelectOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBatchDelete = async () => {
    try {
      for (const id of selectedIds) {
        await api.delete(`/exams/${id}/`);
      }
      setSelectedIds(new Set());
      fetchExams(currentPage);
    } catch (e) {
      alert("批量删除时发生错误");
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  if (loading || !user) return <div className="p-4">加载中...</div>;
  if (!user) return null;

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div className="w-full px-4 mx-auto max-w-[1400px]">
          <div className="flex flex-wrap items-center">
            <div className="w-full md:w-2/3">
              <h1>
                <i className="fas fa-clipboard-list mr-3"></i>考试管理
              </h1>
              <p className="mb-0 opacity-75">管理学校的各类考试信息</p>
            </div>
            <div className="w-full md:w-1/3 text-right">
              {canExamWrite && (
                <Link href="/exams/create" className="secondary-action">
                  <i className="fas fa-plus mr-2"></i>创建考试
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-4 mx-auto max-w-[1400px]">
      {/* Filter module */}
      <ExamFilterBar
        academicYear={academicYear}
        gradeLevel={gradeLevel}
        academicYearDropdownOpen={academicYearDropdownOpen}
        gradeLevelDropdownOpen={gradeLevelDropdownOpen}
        options={options}
        onAcademicYearChange={setAcademicYear}
        onGradeLevelChange={setGradeLevel}
        onAcademicYearDropdownToggle={() => setAcademicYearDropdownOpen(v => !v)}
        onGradeLevelDropdownToggle={() => setGradeLevelDropdownOpen(v => !v)}
        onFilter={handleFilter}
        onReset={resetFilters}
      />

      {/* Exam table */}
      <ExamTable
        exams={exams}
        options={options}
        totalCount={totalCount}
        currentPage={currentPage}
        pageSize={pageSize}
        isLoading={isLoading}
        canExamWrite={canExamWrite}
        selectedIds={selectedIds}
        onSelectAll={handleSelectAll}
        onSelectOne={handleSelectOne}
        onBatchDelete={handleBatchDelete}
        onSetCurrentPage={setCurrentPage}
        onDeleteRequest={setDeleteData}
      />

      {/* Delete confirmation modal */}
      {canExamWrite && deleteData && (
        <DeleteExamModal
          examName={deleteData.name}
          onCancel={() => setDeleteData(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
      </div>

      <ExamsPageStyles />

      {/* kept because: page-header gradient + secondary-action button */}
      <style jsx global>{`
        .page-header { background: rgb(1, 135, 108); color: white; padding: 2rem 0; margin-bottom: 2rem; border-radius: 10px; }
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
      `}</style>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { Student, Stats } from "../components/types";

export function useStudentList(token: string | undefined) {
  const { user } = useAuth();
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

  const fetchStats = async () => {
    if (!token) return;
    try {
      const data = await api.get<Stats>('/students/stats/');
      setStats(data);
    } catch (e) {
      console.error(e);
      setError("无法获取统计信息，请稍后重试。");
    }
  };

  const fetchStudents = async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (filterStatus) params.status = filterStatus;
      if (filterGrade) params.current_class__cohort = filterGrade;
      if (filterClass) params.current_class__class_name = filterClass;
      const data = await api.get<Student[] | { results: Student[] }>('/students/', params);
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
      students.forEach((s) => { next[s.id] = true; });
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
      await api.delete(`/students/${student.id}/`);
      setStudents((prev) => prev.filter((s) => s.id !== student.id));
    } catch (e) {
      console.error(e);
      alert("删除失败，请稍后重试。");
    }
  };

  const patchStudentData = async (studentId: number, data: Partial<Student>) => {
    if (!token) return false;
    try {
      await api.put(`/students/${studentId}/`, data);
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
    if (!success) alert("状态更新失败，请稍后再试。");
  };

  const handleBatchDelete = async () => {
    if (!selectedIds.length) return alert("请先选择要删除的学生");
    if (!confirm(`确定要删除选中的 ${selectedIds.length} 个学生吗？此操作不可逆！`)) return;
    try {
      await api.post('/students/batch-delete/', { student_ids: selectedIds });
      alert(`已成功删除选中的 ${selectedIds.length} 个学生。`);
      setSelected({});
      fetchStats();
      fetchStudents();
    } catch (e: unknown) {
      console.error(e);
      const msg = e instanceof Error ? e.message : '未知错误';
      alert(`批量删除失败: ${msg}`);
    }
  };

  const handleBatchStatusLogic = async (newStatus: string, successMessage: string) => {
    try {
      await api.post('/students/batch-update-status/', { student_ids: selectedIds, status: newStatus });
      alert(successMessage);
      setSelected({});
      if (newStatus !== "毕业") setBatchStatus("");
      fetchStats();
      fetchStudents();
    } catch (e: unknown) {
      console.error(e);
      const msg = e instanceof Error ? e.message : '未知错误';
      alert(`状态更新失败: ${msg}`);
    }
  };

  const handleBatchUpdateStatus = async () => {
    if (!selectedIds.length) return alert("请先选择要修改状态的学生");
    if (!batchStatus) return alert("请选择要批量设置的状态");
    if (!confirm(`确定要将选中的 ${selectedIds.length} 个学生的状态修改为 "${batchStatus}" 吗？`)) return;
    await handleBatchStatusLogic(batchStatus, `已成功将 ${selectedIds.length} 个学生的状态更新为 "${batchStatus}"。`);
  };

  const handleBatchGraduate = async () => {
    if (!selectedIds.length) return alert("请先选择要标记毕业的学生");
    if (!confirm(`确定要将选中的 ${selectedIds.length} 个学生批量标记为毕业吗？\n该操作会自动将状态修改为"毕业"并记录毕业日期为今天。`)) return;
    await handleBatchStatusLogic("毕业", `已成功将 ${selectedIds.length} 个学生批量标记为毕业。`);
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

  // Default batch status to first available option
  useEffect(() => {
    if (!batchStatus && stats?.status_choices?.length) {
      setBatchStatus(stats.status_choices[0]);
    }
  }, [stats, batchStatus]);

  // Client-side role-based filtering
  const filteredStudents = useMemo(() => {
    if (!students.length) return students;
    if (!user) return students;

    if (user.role === 'grade_manager' && user.managed_grade) {
      return students.filter((s) => s.current_class?.grade_level === user.managed_grade);
    }
    if (user.role === 'subject_teacher' && user.teaching_classes?.length) {
      const allowed = new Set<string>();
      user.teaching_classes.forEach((tc) => {
        allowed.add(`${tc.grade_level}${tc.class_name}`);
      });
      return students.filter((s) => {
        if (!s.current_class) return false;
        return allowed.has(`${s.current_class.grade_level}${s.current_class.class_name}`);
      });
    }
    return students;
  }, [students, user]);

  useEffect(() => {
    if (!token) return;
    fetchStudents();
  }, [token, search, filterStatus, filterGrade, filterClass]);

  return {
    students: filteredStudents,
    stats,
    isLoading,
    error,
    search,
    setSearch,
    filterStatus,
    setFilterStatus,
    filterGrade,
    setFilterGrade,
    filterClass,
    setFilterClass,
    filterGradeDropdownOpen,
    setFilterGradeDropdownOpen,
    filterClassDropdownOpen,
    setFilterClassDropdownOpen,
    filterStatusDropdownOpen,
    setFilterStatusDropdownOpen,
    selected,
    selectedCount,
    allSelected,
    batchStatus,
    setBatchStatus,
    selectAllRef,
    fetchStats,
    fetchStudents,
    handleSelectAll,
    handleSelectOne,
    handleDelete,
    handleStatusChange,
    handleBatchDelete,
    handleBatchUpdateStatus,
    handleBatchGraduate,
  };
}

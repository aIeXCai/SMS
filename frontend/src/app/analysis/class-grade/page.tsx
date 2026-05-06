"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

type ChoiceOption = { value: string; label: string };

type ExamItem = {
  id: number;
  name: string;
  academic_year: string;
  grade_level: string;
};

type ClassItem = {
  id: number;
  grade_level: string;
  cohort: string;
  class_name: string;
};

export default function ClassGradeAnalysisEntryPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();

  const [academicYears, setAcademicYears] = useState<ChoiceOption[]>([]);
  const [gradeLevels, setGradeLevels] = useState<ChoiceOption[]>([]);
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [allClasses, setAllClasses] = useState<ClassItem[]>([]);

  const [selectedAcademicYear, setSelectedAcademicYear] = useState("");
  const [selectedAcademicYearLabel, setSelectedAcademicYearLabel] = useState("请选择学年");
  const [selectedExam, setSelectedExam] = useState("");
  const [selectedExamLabel, setSelectedExamLabel] = useState("请选择考试");
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedGradeLabel, setSelectedGradeLabel] = useState("请选择年级");
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);

  const [showAcademicYearDropdown, setShowAcademicYearDropdown] = useState(false);
  const [showExamDropdown, setShowExamDropdown] = useState(false);
  const [showGradeDropdown, setShowGradeDropdown] = useState(false);
  const [showClassDropdown, setShowClassDropdown] = useState(false);
  const [loadError, setLoadError] = useState("");

  const rootRef = useRef<HTMLDivElement | null>(null);

  const visibleExams = useMemo(() => {
    if (!selectedAcademicYear || !selectedGrade) return [];
    return exams.filter(
      (exam) => exam.academic_year === selectedAcademicYear && exam.grade_level === selectedGrade
    );
  }, [exams, selectedAcademicYear, selectedGrade]);

  const visibleClasses = useMemo(() => {
    if (!selectedGrade) return allClasses;
    return allClasses.filter((cls) => cls.cohort === selectedGrade);
  }, [allClasses, selectedGrade]);

  const allVisibleClassIds = useMemo(() => visibleClasses.map((cls) => String(cls.id)), [visibleClasses]);

  useEffect(() => {
    if (!loading && !token) router.push("/login");
  }, [loading, token, router]);

  useEffect(() => {
    if (!token) return;

    const fetchData = async () => {
      try {
        setLoadError("");
        const [examOptionsSettled, scoreOptionsSettled, examsSettled, classesSettled] = await Promise.allSettled([
          api.get<{ academic_years?: ChoiceOption[]; grade_levels?: ChoiceOption[] }>('/exams/options/'),
          api.get<{ academic_years?: ChoiceOption[]; grade_levels?: ChoiceOption[] }>('/scores/options/'),
          api.get<ExamItem[] | { results?: ExamItem[] }>('/exams/', { page_size: '2000' }),
          api.get<ClassItem[] | { results?: ClassItem[] }>('/classes/', { page_size: '2000' }),
        ]);

        type ParsedResult<T> = { ok: boolean; data: T | null };
        const parseSettled = <T,>(settled: PromiseSettledResult<T>): ParsedResult<T> => {
          if (settled.status !== "fulfilled") return { ok: false, data: null };
          return { ok: true, data: settled.value };
        };

        const examOptionsParsed = parseSettled(examOptionsSettled);
        const scoreOptionsParsed = parseSettled(scoreOptionsSettled);
        const examsParsed = parseSettled(examsSettled);
        const classesParsed = parseSettled(classesSettled);

        let yearOptions: ChoiceOption[] = [];
        let gradeOptions: ChoiceOption[] = [];

        if (examOptionsParsed.ok && examOptionsParsed.data) {
          const optionsData = examOptionsParsed.data;
          yearOptions = (optionsData.academic_years as ChoiceOption[]) || [];
          gradeOptions = (optionsData.grade_levels as ChoiceOption[]) || [];
        }

        if ((yearOptions.length === 0 || gradeOptions.length === 0) && scoreOptionsParsed.ok && scoreOptionsParsed.data) {
          const scoreOptionsData = scoreOptionsParsed.data;
          if (yearOptions.length === 0) yearOptions = (scoreOptionsData.academic_years as ChoiceOption[]) || [];
          if (gradeOptions.length === 0) gradeOptions = (scoreOptionsData.grade_levels as ChoiceOption[]) || [];
        }

        const isRestricted = user?.role === "subject_teacher" || user?.role === "grade_manager";
        const isSubjectTeacher = user?.role === "subject_teacher";
        const teachingClasses = user?.teaching_classes || [];
        const teachingClassIds = isSubjectTeacher && teachingClasses.length > 0
          ? new Set(teachingClasses.map((c) => c.id))
          : null;
        const managedGradeLevel = user?.managed_grade || "";
        const userGradeLevels = isSubjectTeacher && teachingClasses.length > 0
          ? [...new Set(teachingClasses.map((c) => c.grade_level))]
          : managedGradeLevel && isRestricted ? [managedGradeLevel] : [];

        setAcademicYears(yearOptions);

        let fetchedExamCount = 0;
        let fetchedClassCount = 0;

        if (examsParsed.ok && examsParsed.data) {
          const examsData = examsParsed.data;
          const examRows: ExamItem[] = Array.isArray(examsData) ? examsData : (examsData.results || []);
          fetchedExamCount = examRows.length;
          setExams(examRows);
        } else {
          setExams([]);
        }

        if (classesParsed.ok && classesParsed.data) {
          const classesData = classesParsed.data;
          const classRows: ClassItem[] = Array.isArray(classesData) ? classesData : (classesData.results || []);
          fetchedClassCount = classRows.length;

          const cohortToGradeLevel: Record<string, string> = {};
          for (const c of classRows) {
            if (c.grade_level && c.cohort) {
              cohortToGradeLevel[c.cohort] = c.grade_level;
            }
          }

          const filteredGradeOptions = userGradeLevels.length > 0
            ? gradeOptions.filter((g) => userGradeLevels.includes(cohortToGradeLevel[g.value] || ''))
            : gradeOptions;
          setGradeLevels(filteredGradeOptions);

          const sorted = [...classRows].sort((a, b) => {
            if (a.grade_level !== b.grade_level) return a.grade_level.localeCompare(b.grade_level, "zh-CN");
            const aNum = Number((a.class_name.match(/\d+/) || ["0"])[0]);
            const bNum = Number((b.class_name.match(/\d+/) || ["0"])[0]);
            return aNum - bNum;
          });
          const filteredSorted = teachingClassIds
            ? sorted.filter((c) => teachingClassIds.has(c.id))
            : sorted;
          setAllClasses(filteredSorted);

          if (userGradeLevels.length > 0) {
            const gradeLevelValue = userGradeLevels[0];
            const cohortValue = Object.entries(cohortToGradeLevel).find(([, gl]) => gl === gradeLevelValue)?.[0] || gradeLevelValue;
            setSelectedGrade(cohortValue);
            setSelectedGradeLabel(cohortValue);
          }
          if (teachingClassIds && filteredSorted.length > 0) {
            setSelectedClasses(filteredSorted.map((c) => String(c.id)));
          }
        } else {
          setAllClasses([]);
        }

        const allEmpty = yearOptions.length === 0 && gradeOptions.length === 0 && fetchedExamCount === 0 && fetchedClassCount === 0;

        if (allEmpty) {
          setLoadError("下拉数据加载失败：后端接口未返回可用数据，请检查 API 服务与数据。");
        }
      } catch (error) {
        console.error("加载分析入口数据失败", error);
        setLoadError("下拉数据加载失败，请稍后重试。");
      }
    };

    fetchData();
  }, [token, user]);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (!rootRef.current) return;
      const target = event.target as Node;
      if (!rootRef.current.contains(target)) {
        closeAllDropdowns();
      }
    };

    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, []);

  useEffect(() => {
    if (selectedGrade) {
      setSelectedClasses((prev) => {
        if (prev.includes("all")) return prev;
        return prev.filter((id) => allVisibleClassIds.includes(id));
      });
    }
  }, [selectedGrade, allVisibleClassIds]);

  const closeAllDropdowns = () => {
    setShowAcademicYearDropdown(false);
    setShowExamDropdown(false);
    setShowGradeDropdown(false);
    setShowClassDropdown(false);
  };

  const toggleAcademicYearDropdown = () => { const shouldOpen = !showAcademicYearDropdown; closeAllDropdowns(); setShowAcademicYearDropdown(shouldOpen); };
  const toggleExamDropdown = () => { const shouldOpen = !showExamDropdown; closeAllDropdowns(); setShowExamDropdown(shouldOpen); };
  const toggleGradeDropdown = () => { const shouldOpen = !showGradeDropdown; closeAllDropdowns(); setShowGradeDropdown(shouldOpen); };
  const toggleClassDropdown = () => { const shouldOpen = !showClassDropdown; closeAllDropdowns(); setShowClassDropdown(shouldOpen); };

  const handleSelectAcademicYear = (value: string, label: string) => {
    setSelectedAcademicYear(value); setSelectedAcademicYearLabel(label);
    if (selectedExam) { setSelectedExam(""); setSelectedExamLabel("请选择考试"); }
    closeAllDropdowns();
  };

  const handleSelectExam = (exam: ExamItem) => {
    setSelectedExam(String(exam.id)); setSelectedExamLabel(exam.name);
    closeAllDropdowns();
  };

  const handleSelectGrade = (value: string, label: string) => {
    setSelectedGrade(value); setSelectedGradeLabel(label);
    if (selectedExam) { setSelectedExam(""); setSelectedExamLabel("请选择考试"); }
    closeAllDropdowns();
  };

  const handleToggleAllClasses = (checked: boolean) => {
    if (checked) { setSelectedClasses(["all"]); } else { setSelectedClasses([]); }
  };

  const handleToggleClass = (classId: string, cohort: string, checked: boolean) => {
    if (selectedGrade && cohort !== selectedGrade) return;
    setSelectedClasses((prev) => {
      let next = prev.includes("all") ? [] : [...prev];
      if (checked) { if (!next.includes(classId)) next.push(classId); }
      else { next = next.filter((id) => id !== classId); }
      return next;
    });
  };

  const selectedClassCount = selectedClasses.includes("all") ? visibleClasses.length : selectedClasses.length;

  const classDropdownText = (() => {
    if (selectedClasses.includes("all")) return "所有班级";
    if (selectedClasses.length === 0) return "请选择班级";
    return `已选择 ${selectedClasses.length} 个班级`;
  })();

  const buttonEnabled = Boolean(selectedAcademicYear && selectedExam && selectedGrade);

  const validateForm = () => {
    if (!selectedAcademicYear || !selectedExam || !selectedGrade) {
      window.alert("请先选择学年、考试和年级！"); return false;
    }
    return true;
  };

  const goToClassAnalysis = () => {
    if (!validateForm()) return;
    if (selectedClasses.length === 0) { window.alert("请先选择要分析的班级！"); return; }

    const params = new URLSearchParams();
    params.set("academic_year", selectedAcademicYear);
    params.set("exam", selectedExam);
    params.set("grade_level", selectedGrade);

    if (selectedClasses.includes("all")) {
      params.set("class_name", "all");
      params.append("class_selection", "all");
      router.push(`/analysis/class-grade/grade?${params.toString()}`);
      return;
    }

    params.set("class_name", selectedClasses.join(","));
    selectedClasses.forEach((classId) => params.append("selected_classes", classId));
    if (selectedClasses.length === 1) {
      router.push(`/analysis/class-grade/class?${params.toString()}`);
      return;
    }
    router.push(`/analysis/class-grade/multi?${params.toString()}`);
  };

  if (loading) return <div className="p-4">加载中...</div>;
  if (!user && !token) return null;

  return (
    <div ref={rootRef}>
      <div className="page-header">
        <div className="w-full px-4 mx-auto max-w-[1400px]">
          <div className="flex flex-wrap items-center">
            <div className="w-full md:w-2/3">
              <h1><i className="fas fa-chart-line mr-3"></i>成绩分析</h1>
              <p className="mb-0 opacity-75">针对单班级、多班级以及年级的成绩分析</p>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-4 mx-auto max-w-[1400px]">
        {loadError && (
          <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded mb-4" role="alert">
            <i className="fas fa-exclamation-circle mr-2"></i>{loadError}
          </div>
        )}
        <div className="filter-card card">
          <div className="filter-card-header">
            <h5 className="mb-0"><i className="fas fa-filter mr-2"></i>筛选条件</h5>
          </div>
          <div className="p-4">
            <form id="analysisForm" onSubmit={(event) => event.preventDefault()}>
              <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-0">
                  <div className="form-group">
                    <label className="block text-sm font-semibold text-gray-700 mb-1"><i className="fas fa-calendar-alt mr-2 text-blue-600"></i>学年</label>
                    <div className="class-dropdown">
                      <button type="button" className={`class-dropdown-toggle ${showAcademicYearDropdown ? "active" : ""}`} onClick={toggleAcademicYearDropdown}>
                        <span>{selectedAcademicYearLabel}</span>
                        <i className="fas fa-chevron-down class-dropdown-arrow"></i>
                      </button>
                      <div className={`class-dropdown-menu ${showAcademicYearDropdown ? "show" : ""}`}>
                        {academicYears.filter((year) => year.value).map((year) => (
                          <button key={year.value} type="button" className="class-dropdown-item" onClick={() => handleSelectAcademicYear(year.value, year.label)}>
                            <i className="fas fa-calendar mr-2"></i>{year.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="form-group">
                    <label className="block text-sm font-semibold text-gray-700 mb-1"><i className="fas fa-layer-group mr-2 text-yellow-600"></i>年级</label>
                    <div className="class-dropdown">
                      <button type="button" className={`class-dropdown-toggle ${showGradeDropdown ? "active" : ""}`} onClick={toggleGradeDropdown}>
                        <span>{selectedGradeLabel}</span>
                        <i className="fas fa-chevron-down class-dropdown-arrow"></i>
                      </button>
                      <div className={`class-dropdown-menu ${showGradeDropdown ? "show" : ""}`}>
                        {gradeLevels.filter((grade) => grade.value).map((grade) => (
                          <button key={grade.value} type="button" className="class-dropdown-item" onClick={() => handleSelectGrade(grade.value, grade.label)}>
                            <i className="fas fa-graduation-cap mr-2"></i>{grade.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="form-group">
                    <label className="block text-sm font-semibold text-gray-700 mb-1"><i className="fas fa-clipboard-list mr-2 text-green-600"></i>考试</label>
                    <div className="class-dropdown">
                      <button type="button" className={`class-dropdown-toggle ${showExamDropdown ? "active" : ""}`} onClick={toggleExamDropdown}>
                        <span>{selectedExamLabel}</span>
                        <i className="fas fa-chevron-down class-dropdown-arrow"></i>
                      </button>
                      <div className={`class-dropdown-menu ${showExamDropdown ? "show" : ""}`}>
                        {!selectedAcademicYear || !selectedGrade ? (
                          <div className="class-dropdown-item text-gray-500">请先选择学年和年级</div>
                        ) : visibleExams.length === 0 ? (
                          <div className="class-dropdown-item text-gray-500">该学年和年级下暂无考试</div>
                        ) : (
                          visibleExams.map((exam) => (
                            <button key={exam.id} type="button" className="class-dropdown-item" onClick={() => handleSelectExam(exam)}>
                              <i className="fas fa-file-alt mr-2"></i>{exam.name}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="form-group">
                    <label className="block text-sm font-semibold text-gray-700 mb-1"><i className="fas fa-users mr-2 text-blue-600"></i>班级</label>
                    <div className="class-selection-container">
                      <div className="class-dropdown">
                        <button type="button" className={`class-dropdown-toggle ${showClassDropdown ? "active" : ""}`} onClick={toggleClassDropdown}>
                          <span>{classDropdownText}</span>
                          <i className="fas fa-chevron-down class-dropdown-arrow"></i>
                        </button>
                        <div className={`class-dropdown-menu ${showClassDropdown ? "show" : ""}`}>
                          <div className="class-dropdown-header">
                            <small className="text-gray-500"> (<span>{selectedClassCount}</span> 个已选择)</small>
                          </div>
                          {user?.role !== "subject_teacher" && (
                            <label className="class-dropdown-item">
                              <input type="checkbox" className="rounded border-gray-300 mr-2" checked={selectedClasses.includes("all")} onChange={(event) => handleToggleAllClasses(event.target.checked)} />
                              <span className="text-sm text-gray-700">所有班级</span>
                            </label>
                          )}
                          {allClasses.map((cls) => {
                            const isVisible = !selectedGrade || cls.cohort === selectedGrade;
                            if (!isVisible) return null;
                            const classId = String(cls.id);
                            const classText = `${cls.cohort}${cls.class_name}`;
                            return (
                              <label key={cls.id} className="class-dropdown-item">
                                <input type="checkbox" className="rounded border-gray-300 mr-2" checked={!selectedClasses.includes("all") && selectedClasses.includes(classId)} onChange={(event) => handleToggleClass(classId, cls.cohort, event.target.checked)} />
                                <span className="text-sm text-gray-700">{classText}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>

          <div className="flex flex-wrap mt-2">
            <div className="w-full">
              {/* kept because: gradient background */}
              <div className="tips-alert">
                <div className="flex items-center">
                  <i className="fas fa-info-circle fa-2x mr-3 text-green-600"></i>
                  <div>
                    <h6 className="mb-1 text-green-600"><i className="fas fa-lightbulb mr-1"></i>操作指南</h6>
                    <p className="mb-0 text-sm text-green-600">请按照以下步骤进行操作：<strong>1. 选择学年</strong> <strong>2. 选择年级</strong> <strong>3. 选择考试</strong> <strong>4. 选择班级</strong> <strong>5. 开始分析</strong></p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-center">
            <div className="w-full lg:w-full">
              <div className="analysis-card class-analysis reveal-card">
                <div className="analysis-card-body">
                  <div className="analysis-icon">
                    <i className="fas fa-users"></i>
                  </div>
                  <h5 className="analysis-card-title">班级/年级成绩分析</h5>
                  <p className="analysis-card-text">深入分析班级/年级整体成绩趋势、各科目对比、成绩分布情况，帮助了解班级整体学习状况</p>
                  <div className="mb-3">
                    <small className="text-gray-500">
                      <i className="fas fa-check-circle mr-1"></i>成绩趋势分析<br />
                      <i className="fas fa-check-circle mr-1"></i>科目对比图表<br />
                      <i className="fas fa-check-circle mr-1"></i>分数段分布
                    </small>
                  </div>
                  <button type="button" className={`bg-blue-600 text-white px-4 py-2 rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50`} disabled={!buttonEnabled} onClick={goToClassAnalysis}>
                    <i className="fas fa-chart-line mr-2"></i>进入班级/年级分析
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* kept because: page-header gradient, filter-card styles, analysis-card hover/transition, class-dropdown custom component, tips-alert gradient, reveal-card animation */}
      <style jsx global>{`
        .page-header { background: rgb(1, 135, 108); color: white; padding: 2rem 0; margin-bottom: 2rem; border-radius: 10px; }
        .filter-card { border: none; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); border-radius: 10px; margin-bottom: 2rem; background: white; overflow: hidden; }
        .filter-card-header { background: #f8f9fa; border-bottom: 1px solid #dee2e6; border-radius: 10px 10px 0 0; padding: 1rem 1.5rem; }
        .analysis-card { border: none; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); border-radius: 15px; transition: all 0.3s ease; height: 100%; overflow: hidden; background: white; }
        .analysis-card:hover { transform: translateY(-5px); box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15); }
        .analysis-card-body { padding: 2rem; text-align: center; }
        .analysis-card-title { font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem; color: #212529; }
        .analysis-card-text { color: #6c757d; margin-bottom: 1.5rem; line-height: 1.6; }
        .analysis-card.class-analysis { border-left: 4px solid #007bff; }
        .analysis-icon { font-size: 3rem; margin-bottom: 1rem; opacity: 0.8; color: #007bff; }
        .class-dropdown { position: relative; width: 100%; color: #495057; }
        .class-dropdown-toggle { width: 100%; padding: 0.75rem 1rem; border: 1px solid #ced4da; border-radius: 0.5rem; background-color: #fff; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: all 0.3s ease; }
        .class-dropdown-toggle:hover, .class-dropdown-toggle.active { border-color: #007bff; box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25); }
        .class-dropdown-arrow { transition: transform 0.3s ease; color: #6c757d; }
        .class-dropdown-toggle.active .class-dropdown-arrow { transform: rotate(180deg); }
        .class-dropdown-menu { position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid #ced4da; border-radius: 0.5rem; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); z-index: 1000; max-height: 250px; overflow-y: auto; display: none; margin-top: 2px; }
        .class-dropdown-menu.show { display: block; }
        .class-dropdown-header { padding: 0.75rem 1rem; border-bottom: 1px solid #e9ecef; background-color: #f8f9fa; }
        .class-dropdown-item { width: 100%; border: none; background: transparent; padding: 0.5rem 1rem; cursor: pointer; transition: background-color 0.2s ease; display: flex; align-items: center; text-align: left; font-size: inherit; color: inherit; margin: 0; }
        .class-dropdown-item:hover { background-color: #f8f9fa; }
        .tips-alert { background: linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%); border-radius: 12px; padding: 1rem; margin-bottom: 1.5rem; }
        .reveal-card { opacity: 0; transform: translateY(20px); animation: cardReveal 0.5s ease forwards; }
        @keyframes cardReveal { to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 768px) { .page-header { padding: 1rem 0; margin-bottom: 1rem; } .analysis-card-body { padding: 1.5rem; } .class-dropdown-menu { max-height: 200px; } }
      `}</style>
    </div>
  );
}

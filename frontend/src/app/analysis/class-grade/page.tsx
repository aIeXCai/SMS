"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

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

const backendBaseUrl = typeof window !== "undefined" ? `http://${window.location.hostname}:8000` : "http://localhost:8000";

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

  const effectiveToken = useMemo(() => {
    if (token) return token;
    if (typeof window !== "undefined") return localStorage.getItem("accessToken");
    return null;
  }, [token]);

  const authHeader = useMemo(() => {
    if (!effectiveToken) return undefined;
    return { Authorization: `Bearer ${effectiveToken}` };
  }, [effectiveToken]);

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
    if (!loading && !effectiveToken) router.push("/login");
  }, [loading, effectiveToken, router]);

  useEffect(() => {
    if (!effectiveToken) return;

    const fetchData = async () => {
      try {
        setLoadError("");
        const [examOptionsSettled, scoreOptionsSettled, examsSettled, classesSettled] = await Promise.allSettled([
          fetch(`${backendBaseUrl}/api/exams/options/`, { headers: { ...authHeader } }),
          fetch(`${backendBaseUrl}/api/scores/options/`, { headers: { ...authHeader } }),
          fetch(`${backendBaseUrl}/api/exams/?page_size=2000`, { headers: { ...authHeader } }),
          fetch(`${backendBaseUrl}/api/classes/?page_size=2000`, { headers: { ...authHeader } }),
        ]);

        const parseJsonSafe = async (settled: PromiseSettledResult<Response>) => {
          if (settled.status !== "fulfilled") return { ok: false, status: 0, data: null as any };
          const response = settled.value;
          if (!response.ok) return { ok: false, status: response.status, data: null as any };
          try {
            const data = await response.json();
            return { ok: true, status: response.status, data };
          } catch {
            return { ok: false, status: response.status, data: null as any };
          }
        };

        const examOptionsParsed = await parseJsonSafe(examOptionsSettled);
        const scoreOptionsParsed = await parseJsonSafe(scoreOptionsSettled);
        const examsParsed = await parseJsonSafe(examsSettled);
        const classesParsed = await parseJsonSafe(classesSettled);

        let yearOptions: ChoiceOption[] = [];
        let gradeOptions: ChoiceOption[] = [];

        if (examOptionsParsed.ok) {
          const optionsData = examOptionsParsed.data;
          yearOptions = optionsData.academic_years || [];
          gradeOptions = optionsData.grade_levels || [];
        }

        if ((yearOptions.length === 0 || gradeOptions.length === 0) && scoreOptionsParsed.ok) {
          const scoreOptionsData = scoreOptionsParsed.data;
          if (yearOptions.length === 0) yearOptions = scoreOptionsData.academic_years || [];
          if (gradeOptions.length === 0) gradeOptions = scoreOptionsData.grade_levels || [];
        }

        setAcademicYears(yearOptions);
        setGradeLevels(gradeOptions);

        let fetchedExamCount = 0;
        let fetchedClassCount = 0;

        if (examsParsed.ok) {
          const examsData = examsParsed.data;
          const examRows: ExamItem[] = Array.isArray(examsData) ? examsData : (examsData.results || []);
          fetchedExamCount = examRows.length;
          setExams(examRows);
        } else {
          setExams([]);
        }

        if (classesParsed.ok) {
          const classesData = classesParsed.data;
          const classRows: ClassItem[] = Array.isArray(classesData) ? classesData : (classesData.results || []);
          fetchedClassCount = classRows.length;
          const sorted = [...classRows].sort((a, b) => {
            if (a.grade_level !== b.grade_level) return a.grade_level.localeCompare(b.grade_level, "zh-CN");
            const aNum = Number((a.class_name.match(/\d+/) || ["0"])[0]);
            const bNum = Number((b.class_name.match(/\d+/) || ["0"])[0]);
            return aNum - bNum;
          });
          setAllClasses(sorted);
        } else {
          setAllClasses([]);
        }

        const allEmpty = yearOptions.length === 0 && gradeOptions.length === 0 && fetchedExamCount === 0 && fetchedClassCount === 0;
        const hasUnauthorized =
          examOptionsParsed.status === 401 ||
          scoreOptionsParsed.status === 401 ||
          examsParsed.status === 401 ||
          classesParsed.status === 401;

        if (hasUnauthorized) {
          setLoadError("下拉数据加载失败：登录状态已失效，请重新登录。");
        } else if (allEmpty) {
          setLoadError("下拉数据加载失败：后端接口未返回可用数据，请检查 API 服务与数据。");
        }
      } catch (error) {
        console.error("加载分析入口数据失败", error);
        setLoadError("下拉数据加载失败，请稍后重试。");
      }
    };

    fetchData();
  }, [effectiveToken, authHeader]);

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

  const toggleAcademicYearDropdown = () => {
    const shouldOpen = !showAcademicYearDropdown;
    closeAllDropdowns();
    setShowAcademicYearDropdown(shouldOpen);
  };

  const toggleExamDropdown = () => {
    const shouldOpen = !showExamDropdown;
    closeAllDropdowns();
    setShowExamDropdown(shouldOpen);
  };

  const toggleGradeDropdown = () => {
    const shouldOpen = !showGradeDropdown;
    closeAllDropdowns();
    setShowGradeDropdown(shouldOpen);
  };

  const toggleClassDropdown = () => {
    const shouldOpen = !showClassDropdown;
    closeAllDropdowns();
    setShowClassDropdown(shouldOpen);
  };

  const handleSelectAcademicYear = (value: string, label: string) => {
    setSelectedAcademicYear(value);
    setSelectedAcademicYearLabel(label);

    // 重置考试选择，因为学年改变了
    if (selectedExam) {
      setSelectedExam("");
      setSelectedExamLabel("请选择考试");
    }
    closeAllDropdowns();
  };

  const handleSelectExam = (exam: ExamItem) => {
    setSelectedExam(String(exam.id));
    setSelectedExamLabel(exam.name);
    closeAllDropdowns();
  };

  const handleSelectGrade = (value: string, label: string) => {
    setSelectedGrade(value);
    setSelectedGradeLabel(label);

    // 重置考试选择，因为年级改变了
    if (selectedExam) {
      setSelectedExam("");
      setSelectedExamLabel("请选择考试");
    }
    closeAllDropdowns();
  };

  const handleToggleAllClasses = (checked: boolean) => {
    if (checked) {
      setSelectedClasses(["all"]);
    } else {
      setSelectedClasses([]);
    }
  };

  const handleToggleClass = (classId: string, cohort: string, checked: boolean) => {
    if (selectedGrade && cohort !== selectedGrade) return;

    setSelectedClasses((prev) => {
      let next = prev.includes("all") ? [] : [...prev];
      if (checked) {
        if (!next.includes(classId)) next.push(classId);
      } else {
        next = next.filter((id) => id !== classId);
      }
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
      window.alert("请先选择学年、考试和年级！");
      return false;
    }
    return true;
  };

  const goToClassAnalysis = () => {
    if (!validateForm()) return;

    if (selectedClasses.length === 0) {
      window.alert("请先选择要分析的班级！");
      return;
    }

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
  if (!user && !effectiveToken) return null;

  return (
    <div ref={rootRef}>
      <div className="page-header">
        <div className="container-fluid">
          <div className="row align-items-center">
            <div className="col-md-8">
              <h1><i className="fas fa-chart-line me-3"></i>成绩分析</h1>
              <p className="mb-0 opacity-75">针对单班级、多班级以及年级的成绩分析</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container-fluid">
        {loadError && (
          <div className="alert alert-danger" role="alert">
            <i className="fas fa-exclamation-circle me-2"></i>{loadError}
          </div>
        )}
        <div className="filter-card card">
          <div className="card-header">
            <h5 className="mb-0"><i className="fas fa-filter me-2"></i>筛选条件</h5>
          </div>
          <div className="card-body">
            <form id="analysisForm" onSubmit={(event) => event.preventDefault()}>
              <div className="row g-3">
                <div className="col-lg-3 col-md-6">
                  <div className="form-group">
                    <label className="form-label fw-semibold"><i className="fas fa-calendar-alt me-2 text-primary"></i>学年</label>
                    <div className="class-dropdown">
                      <button type="button" className={`class-dropdown-toggle ${showAcademicYearDropdown ? "active" : ""}`} onClick={toggleAcademicYearDropdown}>
                        <span>{selectedAcademicYearLabel}</span>
                        <i className="fas fa-chevron-down class-dropdown-arrow"></i>
                      </button>
                      <div className={`class-dropdown-menu ${showAcademicYearDropdown ? "show" : ""}`}>
                        {academicYears
                          .filter((year) => year.value)
                          .map((year) => (
                            <button key={year.value} type="button" className="class-dropdown-item" onClick={() => handleSelectAcademicYear(year.value, year.label)}>
                              <i className="fas fa-calendar me-2"></i>{year.label}
                            </button>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-lg-3 col-md-6">
                  <div className="form-group">
                    <label className="form-label fw-semibold"><i className="fas fa-layer-group me-2 text-warning"></i>年级</label>
                    <div className="class-dropdown">
                      <button type="button" className={`class-dropdown-toggle ${showGradeDropdown ? "active" : ""}`} onClick={toggleGradeDropdown}>
                        <span>{selectedGradeLabel}</span>
                        <i className="fas fa-chevron-down class-dropdown-arrow"></i>
                      </button>
                      <div className={`class-dropdown-menu ${showGradeDropdown ? "show" : ""}`}>
                        {gradeLevels
                          .filter((grade) => grade.value)
                          .map((grade) => (
                            <button key={grade.value} type="button" className="class-dropdown-item" onClick={() => handleSelectGrade(grade.value, grade.label)}>
                              <i className="fas fa-graduation-cap me-2"></i>{grade.label}
                            </button>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-lg-3 col-md-6">
                  <div className="form-group">
                    <label className="form-label fw-semibold"><i className="fas fa-clipboard-list me-2 text-success"></i>考试</label>
                    <div className="class-dropdown">
                      <button type="button" className={`class-dropdown-toggle ${showExamDropdown ? "active" : ""}`} onClick={toggleExamDropdown}>
                        <span>{selectedExamLabel}</span>
                        <i className="fas fa-chevron-down class-dropdown-arrow"></i>
                      </button>
                      <div className={`class-dropdown-menu ${showExamDropdown ? "show" : ""}`}>
                        {!selectedAcademicYear || !selectedGrade ? (
                          <div className="class-dropdown-item exam-placeholder-item text-muted">请先选择学年和年级</div>
                        ) : visibleExams.length === 0 ? (
                          <div className="class-dropdown-item exam-placeholder-item text-muted">该学年和年级下暂无考试</div>
                        ) : (
                          visibleExams.map((exam) => (
                            <button key={exam.id} type="button" className="class-dropdown-item" onClick={() => handleSelectExam(exam)}>
                              <i className="fas fa-file-alt me-2"></i>
                              {exam.name}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-lg-3 col-md-6">
                  <div className="form-group">
                    <label className="form-label fw-semibold"><i className="fas fa-users me-2 text-info"></i>班级</label>
                    <div className="class-selection-container">
                      <div className="class-dropdown">
                        <button type="button" className={`class-dropdown-toggle ${showClassDropdown ? "active" : ""}`} onClick={toggleClassDropdown}>
                          <span>{classDropdownText}</span>
                          <i className="fas fa-chevron-down class-dropdown-arrow"></i>
                        </button>
                        <div className={`class-dropdown-menu ${showClassDropdown ? "show" : ""}`}>
                          <div className="class-dropdown-header">
                            <small className="text-muted"> (<span>{selectedClassCount}</span> 个已选择)</small>
                          </div>
                          <label className="class-dropdown-item">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              checked={selectedClasses.includes("all")}
                              onChange={(event) => handleToggleAllClasses(event.target.checked)}
                            />
                            <span className="form-check-label">所有班级</span>
                          </label>
                          {allClasses.map((cls) => {
                            const isVisible = !selectedGrade || cls.cohort === selectedGrade;
                            if (!isVisible) return null;
                            const classId = String(cls.id);
                            const classText = `${cls.cohort}${cls.class_name}`;
                            return (
                              <label key={cls.id} className="class-dropdown-item">
                                <input
                                  type="checkbox"
                                  className="form-check-input class-checkbox"
                                  checked={!selectedClasses.includes("all") && selectedClasses.includes(classId)}
                                  onChange={(event) => handleToggleClass(classId, cls.cohort, event.target.checked)}
                                />
                                <span className="form-check-label">{classText}</span>
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

          <div className="row mt-0">
            <div className="col-12">
              <div className="alert alert-info border-0 tips-alert">
                <div className="d-flex align-items-center">
                  <i className="fas fa-info-circle fa-2x me-3 text-success"></i>
                  <div>
                    <h6 className="alert-heading mb-1 text-success"><i className="fas fa-lightbulb me-1"></i>操作指南</h6>
                    <p className="mb-0 small text-success">请按照以下步骤进行操作：<strong>1. 选择学年</strong> → <strong>2. 选择年级</strong> → <strong>3. 选择考试</strong> → <strong>4. 选择班级</strong> → <strong>5. 开始分析</strong></p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="row justify-content-center">
            <div className="col-lg-12">
              <div className="analysis-card card class-analysis reveal-card">
                <div className="card-body">
                  <div className="analysis-icon">
                    <i className="fas fa-users"></i>
                  </div>
                  <h5 className="card-title">班级/年级成绩分析</h5>
                  <p className="card-text">深入分析班级/年级整体成绩趋势、各科目对比、成绩分布情况，帮助了解班级整体学习状况</p>
                  <div className="mb-3">
                    <small className="text-muted">
                      <i className="fas fa-check-circle me-1"></i>成绩趋势分析<br />
                      <i className="fas fa-check-circle me-1"></i>科目对比图表<br />
                      <i className="fas fa-check-circle me-1"></i>分数段分布
                    </small>
                  </div>
                  <button type="button" className={`btn btn-primary ${buttonEnabled ? "" : "disabled"}`} disabled={!buttonEnabled} onClick={goToClassAnalysis}>
                    <i className="fas fa-chart-line me-2"></i>进入班级/年级分析
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
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
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          border-radius: 10px;
          margin-bottom: 2rem;
        }
        .filter-card .card-header {
          background: #f8f9fa;
          border-bottom: 1px solid #dee2e6;
          border-radius: 10px 10px 0 0;
          padding: 1rem 1.5rem;
        }
        .analysis-card {
          border: none;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          border-radius: 15px;
          transition: all 0.3s ease;
          height: 100%;
          overflow: hidden;
        }
        .analysis-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
        }
        .analysis-card .card-body {
          padding: 2rem;
          text-align: center;
        }
        .analysis-card .card-title {
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: 1rem;
        }
        .analysis-card .card-text {
          color: #6c757d;
          margin-bottom: 1.5rem;
          line-height: 1.6;
        }
        .analysis-card .btn {
          border-radius: 25px;
          padding: 0.75rem 2rem;
          font-weight: 500;
          transition: all 0.3s ease;
        }
        .analysis-card.class-analysis {
          border-left: 4px solid #007bff;
        }
        .analysis-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
          opacity: 0.8;
          color: #007bff;
        }
        .class-selection-container {
          display: flex;
          align-items: flex-start;
          gap: 15px;
          flex-wrap: wrap;
        }
        .class-dropdown {
          position: relative;
          width: 100%;
          color: #495057;
        }
        .class-dropdown-toggle {
          width: 100%;
          padding: 0.75rem 1rem;
          border: 1px solid #ced4da;
          border-radius: 0.5rem;
          background-color: #fff;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: all 0.3s ease;
        }
        .class-dropdown-toggle:hover,
        .class-dropdown-toggle.active {
          border-color: #007bff;
          box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
        }
        .class-dropdown-arrow {
          transition: transform 0.3s ease;
          color: #6c757d;
        }
        .class-dropdown-toggle.active .class-dropdown-arrow {
          transform: rotate(180deg);
        }
        .class-dropdown-menu {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: white;
          border: 1px solid #ced4da;
          border-radius: 0.5rem;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          z-index: 1000;
          max-height: 250px;
          overflow-y: auto;
          display: none;
          margin-top: 2px;
        }
        .class-dropdown-menu.show {
          display: block;
        }
        .class-dropdown-header {
          padding: 0.75rem 1rem;
          border-bottom: 1px solid #e9ecef;
          background-color: #f8f9fa;
        }
        .class-dropdown-item {
          width: 100%;
          border: none;
          background: transparent;
          padding: 0.5rem 1rem;
          cursor: pointer;
          transition: background-color 0.2s ease;
          display: flex;
          align-items: center;
          text-align: left;
          font-size: inherit;
          color: inherit;
          margin: 0;
        }
        .class-dropdown-item:hover {
          background-color: #f8f9fa;
        }
        .class-dropdown-item .form-check-input {
          margin-right: 0.5rem;
        }
        .tips-alert {
          background: linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%);
          border-radius: 12px;
        }
        .reveal-card {
          opacity: 0;
          transform: translateY(20px);
          animation: cardReveal 0.5s ease forwards;
        }
        @keyframes cardReveal {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @media (max-width: 768px) {
          .page-header {
            padding: 1rem 0;
            margin-bottom: 1rem;
          }
          .analysis-card .card-body {
            padding: 1.5rem;
          }
          .analysis-card .btn {
            padding: 0.5rem 1.5rem;
          }
          .class-dropdown-menu {
            max-height: 200px;
          }
        }
      `}</style>
    </div>
  );
}

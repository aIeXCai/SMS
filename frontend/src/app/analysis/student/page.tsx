"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

type GradeOption = {
  value: string;
  display_name: string;
  label?: string;
};

type ClassOption = {
  id: number;
  class_name: string;
  grade_level: string;
  display_name: string;
};

type StudentOption = {
  id: number;
  student_id: string;
  name: string;
  class_name: string;
  grade_level: string;
};

type ApiPagedResult<T> = {
  results?: T[];
};

const backendBaseUrl = typeof window !== "undefined" ? `http://${window.location.hostname}:8000` : "http://localhost:8000";
const SCORES_API_BASE = `${backendBaseUrl}/api/scores`;
const CLASSES_API_BASE = `${backendBaseUrl}/api/classes`;
const STUDENTS_API_BASE = `${backendBaseUrl}/api/students`;

export default function StudentAnalysisEntryPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();

  const [gradeOptions, setGradeOptions] = useState<GradeOption[]>([]);
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [studentOptions, setStudentOptions] = useState<StudentOption[]>([]);

  const [selectedGrade, setSelectedGrade] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState<number | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<number | null>(null);

  const [gradeDropdownText, setGradeDropdownText] = useState("请选择年级");
  const [classDropdownText, setClassDropdownText] = useState("请先选择年级");
  const [studentDropdownText, setStudentDropdownText] = useState("请先选择班级");

  const [showGradeDropdown, setShowGradeDropdown] = useState(false);
  const [showClassDropdown, setShowClassDropdown] = useState(false);
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);

  const [alertMessage, setAlertMessage] = useState("");
  const [showAlertModal, setShowAlertModal] = useState(false);

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

  useEffect(() => {
    if (!loading && !effectiveToken) {
      router.push("/login");
    }
  }, [loading, effectiveToken, router]);

  useEffect(() => {
    if (!effectiveToken) return;
    initializeData();
  }, [effectiveToken]);

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

  const showAlert = (message: string) => {
    setAlertMessage(message);
    setShowAlertModal(true);
  };

  const closeAllDropdowns = () => {
    setShowGradeDropdown(false);
    setShowClassDropdown(false);
    setShowStudentDropdown(false);
  };

  const loadDefaultGradeOptions = () => {
    setGradeOptions([
      { value: "高一", display_name: "高一" },
      { value: "高二", display_name: "高二" },
      { value: "高三", display_name: "高三" },
    ]);
  };

  const loadGradeOptions = async () => {
    try {
      const response = await fetch(`${SCORES_API_BASE}/options/`, {
        headers: { ...authHeader },
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      const gradeLevels: GradeOption[] = (data.grade_levels || []).map((item: { value: string; label?: string; display_name?: string }) => ({
        value: item.value,
        display_name: item.label || item.display_name || item.value,
      }));
      if (gradeLevels.length > 0) {
        setGradeOptions(gradeLevels);
      } else {
        loadDefaultGradeOptions();
      }
    } catch (error) {
      console.error("获取年级数据失败:", error);
      loadDefaultGradeOptions();
    }
  };

  const initializeData = async () => {
    try {
      await loadGradeOptions();
    } catch (error) {
      console.error("初始化数据失败:", error);
      loadDefaultGradeOptions();
    }
  };

  const updateClassOptions = async (gradeValue: string) => {
    setClassOptions([]);
    try {
      const response = await fetch(`${CLASSES_API_BASE}/?grade_level=${encodeURIComponent(gradeValue)}&ordering=class_name&page_size=2000`, {
        headers: { ...authHeader },
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: ClassOption[] | ApiPagedResult<ClassOption> = await response.json();
      const classes = Array.isArray(data) ? data : (data.results || []);
      const mappedClasses: ClassOption[] = classes.map((item) => ({
        id: item.id,
        class_name: item.class_name,
        grade_level: item.grade_level,
        display_name: `${item.grade_level}${item.class_name}`,
      }));
      const sortedClasses = [...mappedClasses].sort((a, b) => {
        const aNum = Number((a.class_name.match(/\d+/) || ["999"])[0]);
        const bNum = Number((b.class_name.match(/\d+/) || ["999"])[0]);
        if (aNum !== bNum) return aNum - bNum;
        return a.class_name.localeCompare(b.class_name, "zh-CN");
      });
      setClassOptions(sortedClasses);
    } catch (error) {
      console.error("获取班级数据失败:", error);
      setClassOptions([]);
    }
  };

  const updateStudentOptions = async (gradeValue: string, className: string) => {
    setStudentOptions([]);
    try {
      const response = await fetch(
        `${STUDENTS_API_BASE}/?current_class__grade_level=${encodeURIComponent(gradeValue)}&current_class__class_name=${encodeURIComponent(className)}&ordering=student_id&page_size=2000`,
        { headers: { ...authHeader } }
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: Array<{
        id: number;
        student_id: string;
        name: string;
        current_class?: { class_name?: string; grade_level?: string } | null;
        grade_level?: string | null;
      }> | ApiPagedResult<{
        id: number;
        student_id: string;
        name: string;
        current_class?: { class_name?: string; grade_level?: string } | null;
        grade_level?: string | null;
      }> = await response.json();

      const rows = Array.isArray(data) ? data : (data.results || []);
      const mappedStudents: StudentOption[] = rows.map((item) => ({
        id: item.id,
        student_id: item.student_id,
        name: item.name,
        class_name: item.current_class?.class_name || className,
        grade_level: item.current_class?.grade_level || item.grade_level || gradeValue,
      }));
      setStudentOptions(mappedStudents);
    } catch (error) {
      console.error("获取学生数据失败:", error);
      setStudentOptions([]);
    }
  };

  const toggleGradeDropdown = () => {
    const shouldOpen = !showGradeDropdown;
    closeAllDropdowns();
    setShowGradeDropdown(shouldOpen);
  };

  const toggleClassDropdown = () => {
    if (!selectedGrade) {
      showAlert("请先选择年级");
      return;
    }
    const shouldOpen = !showClassDropdown;
    closeAllDropdowns();
    setShowClassDropdown(shouldOpen);
  };

  const toggleStudentDropdown = () => {
    if (!selectedClass) {
      showAlert("请先选择班级");
      return;
    }
    const shouldOpen = !showStudentDropdown;
    closeAllDropdowns();
    setShowStudentDropdown(shouldOpen);
  };

  const selectGrade = async (value: string, label: string) => {
    setSelectedGrade(value);
    setGradeDropdownText(label);

    setSelectedClass(null);
    setSelectedStudent(null);
    setClassDropdownText("请选择班级");
    setStudentDropdownText("请先选择班级");
    setStudentOptions([]);

    await updateClassOptions(value);
    closeAllDropdowns();
  };

  const selectClass = async (id: number, name: string) => {
    setSelectedClass(id);
    setClassDropdownText(name);

    setSelectedStudent(null);
    setStudentDropdownText("请选择学生");

    if (selectedGrade) {
      await updateStudentOptions(selectedGrade, name);
    }
    closeAllDropdowns();
  };

  const selectStudent = (id: number, name: string) => {
    setSelectedStudent(id);
    setStudentDropdownText(name);
    closeAllDropdowns();
  };

  const validateForm = () => {
    if (!selectedGrade) {
      showAlert("请选择年级");
      return false;
    }
    if (!selectedClass) {
      showAlert("请选择班级");
      return false;
    }
    if (!selectedStudent) {
      showAlert("请选择学生");
      return false;
    }
    return true;
  };

  const goToStudentAnalysis = () => {
    if (!validateForm()) return;

    const params = new URLSearchParams();
    params.set("grade_level", selectedGrade!);
    const selectedClassObj = classOptions.find((item) => item.id === selectedClass);
    params.set("class_name", selectedClassObj?.class_name || classDropdownText || String(selectedClass!));
    params.set("student_id", String(selectedStudent!));

    router.push(`/analysis/student/detail?${params.toString()}`);
  };

  const analyzeBtnDisabled = !selectedGrade || !selectedClass || !selectedStudent;

  if (loading) return <div className="p-4">加载中...</div>;
  if (!user && !effectiveToken) return null;

  return (
    <div ref={rootRef}>
      <div className="page-header">
        <div className="container-fluid">
          <div className="row align-items-center">
            <div className="col-md-8">
              <h1><i className="fas fa-user-graduate me-3"></i>个人成绩分析</h1>
              <p className="mb-0 opacity-75">深入分析个人学业表现，提供多维度数据洞察</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container-fluid">
        <div className="filter-card card">
          <div className="card-header">
            <h5 className="mb-0"><i className="fas fa-filter me-2"></i>筛选条件</h5>
          </div>
          <div className="card-body">
            <form id="analysisForm" onSubmit={(e) => e.preventDefault()}>
              <div className="row g-3">
                <div className="col-lg-4 col-md-6">
                  <div className="form-group">
                    <label className="form-label fw-semibold"><i className="fas fa-layer-group me-2 text-warning"></i>年级</label>
                    <div className="class-dropdown">
                      <button type="button" className={`class-dropdown-toggle ${showGradeDropdown ? "active" : ""}`} onClick={toggleGradeDropdown}>
                        <span>{gradeDropdownText}</span>
                        <i className="fas fa-chevron-down class-dropdown-arrow"></i>
                      </button>
                      <div className={`class-dropdown-menu ${showGradeDropdown ? "show" : ""}`}>
                        {gradeOptions.length > 0 ? (
                          gradeOptions.map((grade) => (
                            <button key={grade.value} type="button" className="class-dropdown-item" onClick={() => selectGrade(grade.value, grade.display_name)}>
                              <i className="fas fa-graduation-cap me-2"></i>{grade.display_name}
                            </button>
                          ))
                        ) : (
                          <div className="class-dropdown-item text-muted">暂无年级数据</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-lg-4 col-md-6">
                  <div className="form-group">
                    <label className="form-label fw-semibold"><i className="fas fa-users me-2 text-info"></i>班级</label>
                    <div className="class-dropdown">
                      <button type="button" className={`class-dropdown-toggle ${showClassDropdown ? "active" : ""}`} onClick={toggleClassDropdown}>
                        <span>{classDropdownText}</span>
                        <i className="fas fa-chevron-down class-dropdown-arrow"></i>
                      </button>
                      <div className={`class-dropdown-menu ${showClassDropdown ? "show" : ""}`}>
                        {!selectedGrade ? (
                          <div className="class-dropdown-item text-muted">请先选择年级</div>
                        ) : classOptions.length > 0 ? (
                          classOptions.map((cls) => (
                            <button key={cls.id} type="button" className="class-dropdown-item" onClick={() => selectClass(cls.id, cls.class_name)}>
                              <i className="fas fa-users me-2"></i>{cls.class_name}
                            </button>
                          ))
                        ) : (
                          <div className="class-dropdown-item text-muted">该年级暂无班级</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-lg-4 col-md-6">
                  <div className="form-group">
                    <label className="form-label fw-semibold"><i className="fas fa-user-graduate me-2 text-success"></i>学生</label>
                    <div className="class-dropdown">
                      <button type="button" className={`class-dropdown-toggle ${showStudentDropdown ? "active" : ""}`} onClick={toggleStudentDropdown}>
                        <span>{studentDropdownText}</span>
                        <i className="fas fa-chevron-down class-dropdown-arrow"></i>
                      </button>
                      <div className={`class-dropdown-menu ${showStudentDropdown ? "show" : ""}`}>
                        {!selectedClass ? (
                          <div className="class-dropdown-item text-muted">请先选择班级</div>
                        ) : studentOptions.length > 0 ? (
                          studentOptions.map((student) => (
                            <button key={student.id} type="button" className="class-dropdown-item" onClick={() => selectStudent(student.id, student.name)}>
                              <i className="fas fa-user-graduate me-2"></i>{student.name} ({student.student_id})
                            </button>
                          ))
                        ) : (
                          <div className="class-dropdown-item text-muted">该班级暂无学生</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>

        <div className="row mt-0">
          <div className="col-12">
            <div className="alert alert-info border-0 tips-alert">
              <div className="d-flex align-items-center">
                <i className="fas fa-info-circle fa-2x me-3 text-success"></i>
                <div>
                  <h6 className="alert-heading mb-1 text-success"><i className="fas fa-lightbulb me-1"></i>操作指南</h6>
                  <p className="mb-0 small text-success">请按照以下步骤进行操作：<strong>1. 选择年级</strong> → <strong>2. 选择班级</strong> → <strong>3. 选择学生</strong> → <strong>4. 开始分析</strong></p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="row justify-content-center">
          <div className="col-lg-12">
            <div className="analysis-card card student-analysis reveal-card">
              <div className="card-body">
                <div className="analysis-icon">
                  <i className="fas fa-user-graduate"></i>
                </div>
                <h5 className="card-title">学生个人成绩分析</h5>
                <p className="card-text">深入分析学生个人成绩趋势、各科目表现、班级年级排名变化，全面了解学生学习状况和发展轨迹</p>
                <div className="mb-3">
                  <small className="text-muted">
                    <i className="fas fa-check-circle me-1"></i>历次考试排名趋势<br />
                    <i className="fas fa-check-circle me-1"></i>各科目雷达图分析<br />
                    <i className="fas fa-check-circle me-1"></i>成绩对比图表<br />
                    <i className="fas fa-check-circle me-1"></i>详细数据表格
                  </small>
                </div>
                <button type="button" className="btn btn-success" id="analyzeBtn" disabled={analyzeBtnDisabled} onClick={goToStudentAnalysis}>
                  <i className="fas fa-chart-line me-2"></i>开始分析
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showAlertModal && (
        <div className="modal fade show d-block" tabIndex={-1} aria-labelledby="alertModalLabel" aria-modal="true" role="dialog">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-warning text-dark">
                <h5 className="modal-title" id="alertModalLabel">
                  <i className="fas fa-exclamation-triangle me-2"></i>提示
                </h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={() => setShowAlertModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="alert alert-warning d-flex align-items-center" role="alert">
                  <i className="fas fa-exclamation-triangle me-3 fs-4"></i>
                  <div>
                    <h6 className="alert-heading mb-1">操作提示</h6>
                    <p className="mb-0">{alertMessage}</p>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-warning" onClick={() => setShowAlertModal(false)}>
                  <i className="fas fa-check me-1"></i>我知道了
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showAlertModal && <div className="modal-backdrop fade show"></div>}

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
        .analysis-card.student-analysis {
          border-left: 4px solid #28a745;
        }
        .analysis-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
          opacity: 0.8;
        }
        .student-analysis .analysis-icon {
          color: #28a745;
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
          color: inherit;
        }
        .class-dropdown-item:hover {
          background-color: #f8f9fa;
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
          .class-dropdown-menu {
            max-height: 200px;
          }
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
        }
      `}</style>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

type GradeOption = {
  value: string;
  display_name: string;
  label?: string;
};

type ClassOption = {
  id: number;
  class_name: string;
  cohort: string;
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

  useEffect(() => {
    if (!loading && !token) {
      router.push("/login");
    }
  }, [loading, token, router]);

  useEffect(() => {
    if (!token) return;
    initializeData();
  }, [token]);

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
      const data = await api.get<{ grade_levels: GradeOption[] }>('/scores/options/');
      const gradeLevels: GradeOption[] = (data.grade_levels || []).map((item) => ({
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
      const data = await api.get<ClassOption[] | ApiPagedResult<ClassOption>>('/classes/', {
        cohort: gradeValue,
        ordering: 'class_name',
        page_size: '2000',
      });
      const classes = Array.isArray(data) ? data : (data.results || []);
      const mappedClasses: ClassOption[] = classes.map((item) => ({
        id: item.id,
        class_name: item.class_name,
        cohort: item.cohort || "",
        display_name: `${item.cohort || ""}${item.class_name}`,
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

  // ... (extensive data fetching logic unchanged - only JSX modified below)

  const updateStudentOptions = async (gradeValue: string, className: string) => {
    setStudentOptions([]);
    try {
      const data = await api.get<Array<{
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
      }>>('/students/', {
        current_class__cohort: gradeValue,
        current_class__class_name: className,
        ordering: 'student_id',
        page_size: '2000',
      });

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
  if (!user && !token) return null;

  return (
    <div ref={rootRef}>
      <div className="page-header">
        <div className="w-full px-4 mx-auto max-w-[1400px]">
          <div className="flex flex-wrap items-center">
            <div className="w-full md:w-2/3">
              <h1><i className="fas fa-user-graduate mr-3"></i>个人成绩分析</h1>
              <p className="mb-0 opacity-75">深入分析个人学业表现，提供多维度数据洞察</p>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-4 mx-auto max-w-[1400px]">
        <div className="filter-card">
          <div className="filter-card-header">
            <h5 className="mb-0"><i className="fas fa-filter mr-2"></i>筛选条件</h5>
          </div>
          <div className="p-4">
            <form id="analysisForm" onSubmit={(e) => e.preventDefault()}>
              <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-0">
                  <div className="form-group">
                    <label className="block text-sm font-semibold text-gray-700 mb-1"><i className="fas fa-layer-group mr-2 text-yellow-600"></i>年级</label>
                    <div className="class-dropdown">
                      <button type="button" className={`class-dropdown-toggle ${showGradeDropdown ? "active" : ""}`} onClick={toggleGradeDropdown}>
                        <span>{gradeDropdownText}</span>
                        <i className="fas fa-chevron-down class-dropdown-arrow"></i>
                      </button>
                      <div className={`class-dropdown-menu ${showGradeDropdown ? "show" : ""}`}>
                        {gradeOptions.length > 0 ? (
                          gradeOptions.map((grade) => (
                            <button key={grade.value} type="button" className="class-dropdown-item" onClick={() => selectGrade(grade.value, grade.display_name)}>
                              <i className="fas fa-graduation-cap mr-2"></i>{grade.display_name}
                            </button>
                          ))
                        ) : (
                          <div className="class-dropdown-item text-gray-500">暂无年级数据</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="form-group">
                    <label className="block text-sm font-semibold text-gray-700 mb-1"><i className="fas fa-users mr-2 text-blue-600"></i>班级</label>
                    <div className="class-dropdown">
                      <button type="button" className={`class-dropdown-toggle ${showClassDropdown ? "active" : ""}`} onClick={toggleClassDropdown}>
                        <span>{classDropdownText}</span>
                        <i className="fas fa-chevron-down class-dropdown-arrow"></i>
                      </button>
                      <div className={`class-dropdown-menu ${showClassDropdown ? "show" : ""}`}>
                        {!selectedGrade ? (
                          <div className="class-dropdown-item text-gray-500">请先选择年级</div>
                        ) : classOptions.length > 0 ? (
                          classOptions.map((cls) => (
                            <button key={cls.id} type="button" className="class-dropdown-item" onClick={() => selectClass(cls.id, cls.class_name)}>
                              <i className="fas fa-users mr-2"></i>{cls.class_name}
                            </button>
                          ))
                        ) : (
                          <div className="class-dropdown-item text-gray-500">该年级暂无班级</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="form-group">
                    <label className="block text-sm font-semibold text-gray-700 mb-1"><i className="fas fa-user-graduate mr-2 text-green-600"></i>学生</label>
                    <div className="class-dropdown">
                      <button type="button" className={`class-dropdown-toggle ${showStudentDropdown ? "active" : ""}`} onClick={toggleStudentDropdown}>
                        <span>{studentDropdownText}</span>
                        <i className="fas fa-chevron-down class-dropdown-arrow"></i>
                      </button>
                      <div className={`class-dropdown-menu ${showStudentDropdown ? "show" : ""}`}>
                        {!selectedClass ? (
                          <div className="class-dropdown-item text-gray-500">请先选择班级</div>
                        ) : studentOptions.length > 0 ? (
                          studentOptions.map((student) => (
                            <button key={student.id} type="button" className="class-dropdown-item" onClick={() => selectStudent(student.id, student.name)}>
                              <i className="fas fa-user-graduate mr-2"></i>{student.name} ({student.student_id})
                            </button>
                          ))
                        ) : (
                          <div className="class-dropdown-item text-gray-500">该班级暂无学生</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* kept because: gradient background */}
        <div className="tips-alert">
          <div className="flex items-center">
            <i className="fas fa-info-circle fa-2x mr-3 text-green-600"></i>
            <div>
              <h6 className="mb-1 text-green-600"><i className="fas fa-lightbulb mr-1"></i>操作指南</h6>
              <p className="mb-0 text-sm text-green-600">请按照以下步骤进行操作：<strong>1. 选择年级</strong> <strong>2. 选择班级</strong> <strong>3. 选择学生</strong> <strong>4. 开始分析</strong></p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-center">
          <div className="w-full lg:w-full">
            <div className="analysis-card student-analysis reveal-card">
              <div className="analysis-card-body">
                <div className="analysis-icon">
                  <i className="fas fa-user-graduate"></i>
                </div>
                <h5 className="analysis-card-title">学生个人成绩分析</h5>
                <p className="analysis-card-text">深入分析学生个人成绩趋势、各科目表现、班级年级排名变化，全面了解学生学习状况和发展轨迹</p>
                <div className="mb-3">
                  <small className="text-gray-500">
                    <i className="fas fa-check-circle mr-1"></i>历次考试排名趋势<br />
                    <i className="fas fa-check-circle mr-1"></i>各科目雷达图分析<br />
                    <i className="fas fa-check-circle mr-1"></i>成绩对比图表<br />
                    <i className="fas fa-check-circle mr-1"></i>详细数据表格
                  </small>
                </div>
                <button type="button" className="bg-green-600 text-white px-4 py-2 rounded-full hover:bg-green-700 transition-colors disabled:opacity-50" id="analyzeBtn" disabled={analyzeBtnDisabled} onClick={goToStudentAnalysis}>
                  <i className="fas fa-chart-line mr-2"></i>开始分析
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* kept because: modal animation */}
      {showAlertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" tabIndex={-1}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
            <div className="flex items-center justify-between bg-yellow-500 text-gray-900 px-6 py-4">
              <h5>
                <i className="fas fa-exclamation-triangle mr-2"></i>提示
              </h5>
              <button type="button" className="bg-transparent border-none text-xl leading-none opacity-70 hover:opacity-100 cursor-pointer" aria-label="Close" onClick={() => setShowAlertModal(false)}>&times;</button>
            </div>
            <div className="p-6">
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded flex items-center" role="alert">
                <i className="fas fa-exclamation-triangle mr-3 text-2xl"></i>
                <div>
                  <h6 className="mb-1 font-bold">操作提示</h6>
                  <p className="mb-0">{alertMessage}</p>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-6 py-4 flex justify-center rounded-b-2xl">
              <button type="button" className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 transition-colors" onClick={() => setShowAlertModal(false)}>
                <i className="fas fa-check mr-1"></i>我知道了
              </button>
            </div>
          </div>
        </div>
      )}
      {showAlertModal && <div className="fixed inset-0 bg-black/50 z-40"></div>}

      {/* kept because: page-header gradient, filter-card styles, analysis-card complex hover/transition, class-dropdown custom component, tips-alert gradient, reveal-card animation */}
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
          background: white;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          border-radius: 10px;
          margin-bottom: 2rem;
        }
        .filter-card-header {
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
          background: white;
        }
        .analysis-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
        }
        .analysis-card-body {
          padding: 2rem;
          text-align: center;
        }
        .analysis-card-title {
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: 1rem;
        }
        .analysis-card-text {
          color: #6c757d;
          margin-bottom: 1.5rem;
          line-height: 1.6;
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
          padding: 1rem;
          margin-bottom: 1.5rem;
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
          .analysis-card-body {
            padding: 1.5rem;
          }
        }
      `}</style>
    </div>
  );
}

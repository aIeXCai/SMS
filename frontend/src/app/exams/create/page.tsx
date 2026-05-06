"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { canWriteExams } from "@/lib/permissions";
import ExamStepIndicator from "../components/ExamStepIndicator";
import ExamBasicInfoForm from "../components/ExamBasicInfoForm";
import ExamSubjectsForm from "../components/ExamSubjectsForm";

type Option = { value: string; label: string };
type ExamOptions = { academic_years: Option[]; grade_levels: Option[] };
type SubjectRow = { subject_code: string; max_score: number | "" };

export default function CreateExamPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const canExamWrite = canWriteExams(user);

  const [step, setStep] = useState(1);
  const [options, setOptions] = useState<ExamOptions | null>(null);
  const [allSubjects, setAllSubjects] = useState<Option[]>([]);

  // Step 1 fields
  const [academicYear, setAcademicYear] = useState("");
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [description, setDescription] = useState("");

  // Step 2 fields
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!loading && !token) router.push("/login");
  }, [loading, token, router]);

  useEffect(() => {
    if (!token) return;
    api.get<ExamOptions>('/exams/options/')
      .then((data) => setOptions(data))
      .catch(console.error);
  }, [token]);

  useEffect(() => {
    if (!loading && user) {
      if (user.role === "subject_teacher") {
        router.replace("/");
      } else if (!canExamWrite) {
        router.replace("/exams");
      }
    }
  }, [loading, user, canExamWrite, router]);

  // Pre-select managed grade for grade_manager
  useEffect(() => {
    if (user?.role === "grade_manager" && user.managed_grade) {
      setGradeLevel(user.managed_grade);
    }
  }, [user?.role, user?.managed_grade]);

  const loadDefaultSubjects = async (grade: string, year: string) => {
    if (!grade || !year) return;
    setLoadingSubjects(true);
    try {
      const data = await api.get<{ all_subjects: Option[]; subjects: { subject_code: string; max_score: number }[] }>(
        '/exams/default-subjects/',
        { grade_level: grade, academic_year: year }
      );
      setAllSubjects(data.all_subjects || []);
      setSubjects(
        (data.subjects || []).map((s) => ({
          subject_code: s.subject_code, max_score: s.max_score,
        }))
      );
    } catch (e) { console.error(e); }
    finally { setLoadingSubjects(false); }
  };

  const handleGradeLevelChange = (grade: string) => setGradeLevel(grade);

  const validateStep1 = () => {
    const errs: Record<string, string> = {};
    if (!academicYear) errs.academicYear = "请选择学年";
    if (!name.trim()) errs.name = "请填写考试名称";
    if (!date) errs.date = "请选择考试日期";
    if (!gradeLevel) errs.gradeLevel = "请选择适用年级";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNextStep = async () => {
    if (!validateStep1()) return;
    await loadDefaultSubjects(gradeLevel, academicYear);
    setStep(2);
  };

  const handleSubjectChange = (idx: number, field: "subject_code" | "max_score", value: string) => {
    const updated = [...subjects];
    if (field === "subject_code") {
      if (subjects.some((s, i) => i !== idx && s.subject_code === value)) {
        alert(`科目"${value}"已存在，请选择其他科目！`); return;
      }
      updated[idx] = { ...updated[idx], subject_code: value };
    } else {
      updated[idx] = { ...updated[idx], max_score: value === "" ? "" : Number(value) };
    }
    setSubjects(updated);
  };

  const handleAddSubject = () => setSubjects([...subjects, { subject_code: "", max_score: "" }]);
  const handleRemoveSubject = (idx: number) => setSubjects(subjects.filter((_, i) => i !== idx));

  const validateStep2 = () => {
    const validSubjects = subjects.filter((s) => s.subject_code && s.max_score !== "");
    if (validSubjects.length === 0) { alert("至少需要配置一个有效科目！"); return false; }
    const codes = validSubjects.map((s) => s.subject_code);
    if (new Set(codes).size !== codes.length) { alert("存在重复的科目，请检查配置！"); return false; }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateStep2()) return;
    setSubmitting(true);
    try {
      const payload = {
        academic_year: academicYear, name: name.trim(), date,
        grade_level: gradeLevel, description: description.trim(),
        subjects: subjects
          .filter((s) => s.subject_code && s.max_score !== "")
          .map((s) => ({ subject_code: s.subject_code, max_score: Number(s.max_score) })),
      };
      await api.post('/exams/', payload);
      router.push("/exams");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "创建时发生错误，请重试";
      alert(`创建失败：${msg}`);
    }
    finally { setSubmitting(false); }
  };

  const gradeLevelLabel = options?.grade_levels.find((g) => g.value === gradeLevel)?.label || gradeLevel;

  if (loading) return <div className="p-4">加载中...</div>;
  if (!user) return null;
  if (!canExamWrite) return null;

  return (
    <div>
      <div className="page-header">
        <div className="w-full px-4 mx-auto max-w-[1400px]">
          <div className="flex flex-wrap items-center">
            <div className="w-full md:w-2/3">
              <h1><i className="fas fa-plus-circle mr-3"></i>创建考试</h1>
              <p className="mb-0 opacity-75">创建新的考试并配置科目信息</p>
            </div>
            <div className="w-full md:w-1/3 text-right">
              <Link href="/exams" className="bg-white border border-gray-300 px-4 py-2 rounded hover:bg-gray-50 transition-colors">
                <i className="fas fa-arrow-left mr-2"></i>返回列表
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-4 mx-auto" style={{ maxWidth: 760 }}>
        <ExamStepIndicator step={step} />

        {step === 1 && (
          <ExamBasicInfoForm
            academicYear={academicYear}
            name={name}
            date={date}
            gradeLevel={gradeLevel}
            description={description}
            options={options}
            errors={errors}
            onAcademicYearChange={setAcademicYear}
            onNameChange={setName}
            onDateChange={setDate}
            onGradeLevelChange={handleGradeLevelChange}
            onDescriptionChange={setDescription}
            onNextStep={handleNextStep}
            onCancel={() => router.push("/exams")}
          />
        )}

        {step === 2 && (
          <ExamSubjectsForm
            academicYear={academicYear}
            name={name}
            date={date}
            gradeLevelLabel={gradeLevelLabel}
            description={description}
            subjects={subjects}
            allSubjects={allSubjects}
            loadingSubjects={loadingSubjects}
            submitting={submitting}
            onSubjectChange={handleSubjectChange}
            onAddSubject={handleAddSubject}
            onRemoveSubject={handleRemoveSubject}
            onSubmit={handleSubmit}
            onPrevStep={() => setStep(1)}
            onCancel={() => router.push("/exams")}
            submitLabel="创建考试"
          />
        )}
      </div>

      {/* kept because: page-header gradient */}
      <style jsx global>{`
        .page-header { background: rgb(1, 135, 108); color: white; padding: 2rem 0; margin-bottom: 2rem; border-radius: 10px; }
        .page-header h1 { margin: 0; font-weight: 600; }
        @media (max-width: 768px) { .page-header { padding: 1rem 0; margin-bottom: 1rem; } }
      `}</style>
    </div>
  );
}

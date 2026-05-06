"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { canWriteStudents } from "@/lib/permissions";
import StudentFormFields from "../../components/StudentFormFields";

type StudentDetail = {
  student_id: string;
  name: string;
  gender: string;
  date_of_birth: string;
  status: string;
  id_card_number: string;
  student_enrollment_number: string;
  home_address: string;
  guardian_name: string;
  guardian_contact_phone: string;
  entry_date: string;
  graduation_date: string;
  cohort?: string;
  current_class?: { grade_level: string; class_name: string; cohort?: string };
};

type StatsData = {
  status_choices: string[];
  grade_level_choices: string[];
  cohort_choices: string[];
  class_name_choices: string[];
};

export default function StudentEditPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const canStudentWrite = canWriteStudents(user);
  const params = useParams();
  const studentId = params.id as string;

  const [statsChoices, setStatsChoices] = useState({
    status_choices: ['在读', '转学', '休学', '复学', '毕业'],
    grade_level_choices: [] as string[],
    cohort_choices: [] as string[],
    class_name_choices: [] as string[]
  });

  const [formData, setFormData] = useState<Record<string, string>>({
    student_id: "",
    name: "",
    gender: "",
    date_of_birth: "",
    status: "在读",
    id_card_number: "",
    student_enrollment_number: "",
    home_address: "",
    guardian_name: "",
    guardian_contact_phone: "",
    entry_date: "",
    graduation_date: "",
    section: "",
    cohort_year: "",
    cohort: "",
    grade_level: "",
    class_name: "",
  });

  const [isInitializing, setIsInitializing] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!token || !studentId) return;
    const initData = async () => {
      setIsInitializing(true);
      setErrorMsg("");
      try {
        const statsData = await api.get<StatsData>('/students/stats/');
        setStatsChoices({
          status_choices: statsData.status_choices || ['在读', '转学', '休学', '复学', '毕业'],
          grade_level_choices: statsData.grade_level_choices || [],
          cohort_choices: statsData.cohort_choices || [],
          class_name_choices: statsData.class_name_choices || [],
        });

        const data = await api.get<StudentDetail>(`/students/${studentId}/`);
        const cohortStr = data.cohort || data.current_class?.cohort || "";
        let section = "";
        let cohortYear = "";
        if (cohortStr) {
          if (cohortStr.startsWith("初中")) { section = "初中"; cohortYear = cohortStr.replace("初中", "").replace("级", ""); }
          else if (cohortStr.startsWith("高中")) { section = "高中"; cohortYear = cohortStr.replace("高中", "").replace("级", ""); }
        }
        setFormData({
          student_id: data.student_id || "",
          name: data.name || "",
          gender: data.gender || "",
          date_of_birth: data.date_of_birth || "",
          status: data.status || "在读",
          id_card_number: data.id_card_number || "",
          student_enrollment_number: data.student_enrollment_number || "",
          home_address: data.home_address || "",
          guardian_name: data.guardian_name || "",
          guardian_contact_phone: data.guardian_contact_phone || "",
          entry_date: data.entry_date || "",
          graduation_date: data.graduation_date || "",
          section,
          cohort_year: cohortYear,
          cohort: cohortStr,
          grade_level: data.current_class?.grade_level || "",
          class_name: data.current_class?.class_name || "",
        });
      } catch (err: unknown) {
        console.error(err);
        setErrorMsg("网络异常或服务器错误，或该学生可能不存在。");
      } finally {
        setIsInitializing(false);
      }
    };
    initData();
  }, [token, studentId]);

  useEffect(() => {
    if (!loading && user && !canStudentWrite) {
      router.replace("/students");
    }
  }, [loading, user, canStudentWrite, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const newData = { ...prev, [name]: value };
      if (name === 'section' || name === 'cohort_year') {
        const section = name === 'section' ? value : prev.section;
        const cohortYr = name === 'cohort_year' ? value : prev.cohort_year;
        if (section && cohortYr) { newData.cohort = `${section}${cohortYr}级`; }
      }
      return newData;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !studentId) return;
    setIsSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");
    setFieldErrors({});

    try {
      const payload = { ...formData } as Record<string, unknown>;
      ['date_of_birth', 'entry_date', 'graduation_date'].forEach(f => { if (!payload[f]) payload[f] = null; });
      ['id_card_number', 'student_enrollment_number'].forEach(f => { if (!payload[f]) payload[f] = null; });

      if (payload.grade_level && payload.class_name) {
        payload.current_class = { cohort: payload.cohort, grade_level: payload.grade_level, class_name: payload.class_name };
      }
      delete payload.section;
      delete payload.cohort_year;
      delete payload.class_name;

      await api.put(`/students/${studentId}/`, payload);
      setSuccessMsg("学生信息更新成功！");
      setTimeout(() => { router.push("/students"); }, 1500);
    } catch (err: unknown) {
      console.error(err);
      if (err && typeof err === 'object' && 'fieldErrors' in err) {
        setFieldErrors((err as { fieldErrors: Record<string, string[]> }).fieldErrors);
      }
      const msg = err instanceof Error ? err.message : "网络异常或服务器错误";
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || isInitializing) return <div className="text-center py-5">加载中...</div>;
  if (!user) { router.push("/login"); return null; }
  if (!canStudentWrite) return null;

  return (
    <div>
      <div className="page-header">
        <div className="w-full px-4 mx-auto max-w-[1400px]">
          <div className="flex flex-wrap items-center">
            <div className="w-full md:w-2/3">
              <h1><i className="fas fa-user-edit mr-3"></i>编辑学生信息</h1>
              <p className="mb-0 opacity-75">修改学生基本信息，带 * 号的字段为必填项</p>
            </div>
            <div className="w-full md:w-1/3 text-right">
              <Link href="/students" className="border border-white text-white px-4 py-2 rounded hover:bg-white/10 transition-colors">
                <i className="fas fa-arrow-left mr-1"></i>返回列表
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-4 mx-auto max-w-[1400px]">
        {successMsg && (
          <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded mb-3" role="alert">
            <i className="fas fa-info-circle mr-2"></i>{successMsg}
            <button type="button" className="float-right bg-transparent border-none text-current opacity-50 hover:opacity-100 cursor-pointer text-lg leading-none" onClick={() => setSuccessMsg("")}>&times;</button>
          </div>
        )}
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded mb-3" role="alert">
            <i className="fas fa-info-circle mr-2"></i>{errorMsg}
            <button type="button" className="float-right bg-transparent border-none text-current opacity-50 hover:opacity-100 cursor-pointer text-lg leading-none" onClick={() => setErrorMsg("")}>&times;</button>
          </div>
        )}

        <div className="flex flex-wrap justify-center">
          <div className="w-full lg:w-2/3">
            <div className="form-card mb-5">
              <div className="form-card-header">
                <h5 className="mb-0"><i className="fas fa-user-edit mr-2"></i>学生信息</h5>
              </div>
              <div className="form-card-body">
                <form onSubmit={handleSubmit}>
                  <StudentFormFields
                    formData={formData}
                    fieldErrors={fieldErrors}
                    statsChoices={statsChoices}
                    onChange={handleChange}
                  />

                  <div className="flex justify-center mt-4">
                    <div className="btn-group-custom flex">
                      <Link href="/students" className="btn-outline-secondary btn-custom mr-3">
                        <i className="fas fa-times mr-2"></i>取消
                      </Link>
                      <button type="submit" className="btn-primary btn-custom" disabled={isSubmitting}>
                        <i className="fas fa-save mr-2"></i>
                        {isSubmitting ? "保存中..." : "保存修改"}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* kept because: page-header gradient, form-card gradient header, pseudo-elements (::after), media queries */}
      <style jsx global>{`
        .page-header { background: rgb(1,135,108); color: white; padding: 2rem 0; margin-bottom: 2rem; border-radius: 10px; }
        .page-header h1 { margin: 0; font-weight: 600; }
        .form-card { border: none; border-radius: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; background: white; }
        .form-card-header { background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-bottom: 1px solid #dee2e6; padding: 1.5rem; }
        .form-card-body { padding: 2rem; }
        .form-floating { margin-bottom: 1.5rem; }
        .form-floating > .form-control, .form-floating > .form-select { height: calc(3.5rem + 2px); line-height: 1.25; width: 100%; border: 1px solid #ced4da; border-radius: 0.375rem; padding: 1rem 0.75rem; }
        .form-floating > label { padding: 1rem 0.75rem; }
        .invalid-feedback { display: block; width: 100%; margin-top: 0.25rem; font-size: 0.875rem; color: #dc3545; }
        .btn-group-custom { gap: 1rem; }
        .btn-custom { padding: 0.75rem 2rem; font-weight: 500; border-radius: 25px; transition: all 0.3s ease; }
        .btn-custom:hover { transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.2); }
        .btn-primary.btn-custom { background: linear-gradient(135deg, #007bff, #0056b3); border: none; color: white; }
        .btn-outline-secondary.btn-custom { background: transparent; border: 1px solid #6c757d; color: #6c757d; }
        .required-field::after { content: ' *'; color: #dc3545; }
        @media (max-width: 768px) {
          .page-header { padding: 1rem 0; margin-bottom: 1rem; }
          .form-card-body { padding: 1rem; }
          .btn-group-custom { flex-direction: column; }
          .btn-custom { width: 100%; margin-bottom: 0.5rem; }
        }
      `}</style>
    </div>
  );
}

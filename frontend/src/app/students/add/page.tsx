"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { canWriteStudents } from "@/lib/permissions";
import StudentFormFields from "../components/StudentFormFields";

type StatsData = {
  status_choices: string[];
  grade_level_choices: string[];
  cohort_choices: string[];
  class_name_choices: string[];
};

export default function StudentAddPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const canStudentWrite = canWriteStudents(user);

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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!token) return;
    const fetchStats = async () => {
      try {
        const data = await api.get<StatsData>('/students/stats/');
        setStatsChoices({
          status_choices: data.status_choices || ['在读', '转学', '休学', '复学', '毕业'],
          grade_level_choices: data.grade_level_choices || [],
          cohort_choices: data.cohort_choices || [],
          class_name_choices: data.class_name_choices || [],
        });
      } catch (err) {
        console.error("无法获取配置选项", err);
      }
    };
    fetchStats();
  }, [token]);

  useEffect(() => {
    if (!loading && user && !canStudentWrite) {
      router.replace("/students");
    }
  }, [loading, user, canStudentWrite, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      if (name === 'section' || name === 'cohort_year') {
        const section = name === 'section' ? value : prev.section;
        const cohortYear = name === 'cohort_year' ? value : prev.cohort_year;
        if (section && cohortYear) {
          newData.cohort = `${section}${cohortYear}级`;
        }
      }
      return newData;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setIsSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");
    setFieldErrors({});

    try {
      const payload = { ...formData } as Record<string, unknown>;
      const dateFields = ['date_of_birth', 'entry_date', 'graduation_date'];
      dateFields.forEach(f => { if (!payload[f]) payload[f] = null; });
      const uniqueFields = ['id_card_number', 'student_enrollment_number'];
      uniqueFields.forEach(f => { if (!payload[f]) payload[f] = null; });

      if (payload.grade_level && payload.class_name && payload.cohort) {
        payload.current_class = {
          cohort: payload.cohort,
          grade_level: payload.grade_level,
          class_name: payload.class_name
        };
      }
      delete payload.section;
      delete payload.cohort_year;
      delete payload.class_name;

      await api.post('/students/', payload);
      setSuccessMsg("学生添加成功！");
      setTimeout(() => { router.push("/students"); }, 1500);
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "网络异常或服务器错误";
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="text-center py-5">加载中...</div>;
  if (!user) { router.push("/login"); return null; }
  if (!canStudentWrite) return null;

  return (
    <div>
      <div className="page-header">
        <div className="w-full px-4 mx-auto max-w-[1400px]">
          <div className="flex flex-wrap items-center">
            <div className="w-full md:w-2/3">
              <h1><i className="fas fa-user-edit mr-3"></i>新增学生</h1>
              <p className="mb-0 opacity-75">填写学生基本信息，带 * 号的字段为必填项</p>
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
                <h5 className="mb-0"><i className="fas fa-user-plus mr-2"></i>学生信息</h5>
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
                        {isSubmitting ? "保存中..." : "保存记录"}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* kept because: page-header gradient, form-card gradient header, pseudo-elements (::after), transitions, media queries */}
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

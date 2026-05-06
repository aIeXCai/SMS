"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { canWriteStudents } from "@/lib/permissions";
import BatchPromoteForm from "../components/BatchPromoteForm";

export default function BatchPromotePage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const canStudentWrite = canWriteStudents(user);

  const [studentIds, setStudentIds] = useState<number[]>([]);
  const [statsChoices, setStatsChoices] = useState({ grade_level_choices: [] as string[] });

  const [formData, setFormData] = useState({
    target_grade_level: "",
    current_grade_level: "",
    auto_create_classes: false,
  });

  const [isInitializing, setIsInitializing] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (!token) return;
    const storedIds = localStorage.getItem("selectedStudentIdsForPromote");
    if (storedIds) {
      try { setStudentIds(JSON.parse(storedIds)); }
      catch (e) { console.error("无法解析选中的学生 ID", e); }
    }
    const fetchStats = async () => {
      try {
        const data = await api.get<{ grade_level_choices: string[] }>('/students/stats/');
        setStatsChoices({ grade_level_choices: data.grade_level_choices || [] });
      } catch (err) { console.error(err); }
      finally { setIsInitializing(false); }
    };
    fetchStats();
  }, [token]);

  useEffect(() => {
    if (!loading && user && !canStudentWrite) {
      router.replace("/students");
    }
  }, [loading, user, canStudentWrite, router]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      setFormData((prev) => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !studentIds.length) return;
    setIsSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const data = await api.post<{ success: boolean; message?: string; errors?: string[] }>('/students/batch-promote/', {
        student_ids: studentIds,
        target_grade_level: formData.target_grade_level,
        current_grade_level: formData.current_grade_level || undefined,
        auto_create_classes: formData.auto_create_classes,
      });
      if (data.success) {
        setSuccessMsg(data.message || `成功升年级！`);
        if (data.errors && data.errors.length) {
          setErrorMsg("部分学生升年级失败:\n" + data.errors.join("\n"));
        } else {
          localStorage.removeItem("selectedStudentIdsForPromote");
          setTimeout(() => { router.push("/students"); }, 1500);
        }
      } else {
        setErrorMsg(data.message || "请求失败，请检查填写内容。");
      }
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg("网络异常或服务器错误");
    } finally { setIsSubmitting(false); }
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
              <h1><i className="fas fa-level-up-alt mr-3"></i>批量升年级</h1>
              <p className="mb-0 opacity-75">批量升级学生年级，自动调整班级信息</p>
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
          <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded mb-3" role="alert" style={{ whiteSpace: "pre-wrap" }}>
            <i className="fas fa-exclamation-triangle mr-2"></i>{errorMsg}
            <button type="button" className="float-right bg-transparent border-none text-current opacity-50 hover:opacity-100 cursor-pointer text-lg leading-none" onClick={() => setErrorMsg("")}>&times;</button>
          </div>
        )}

        <div className="flex flex-wrap justify-center">
          <div className="w-full lg:w-2/3">
            <BatchPromoteForm
              studentCount={studentIds.length}
              gradeLevelChoices={statsChoices.grade_level_choices}
              targetGradeLevel={formData.target_grade_level}
              currentGradeLevel={formData.current_grade_level}
              autoCreateClasses={formData.auto_create_classes}
              isSubmitting={isSubmitting}
              onChange={handleChange}
              onSubmit={handleSubmit}
              onCancel={() => router.push("/students")}
            />
          </div>
        </div>
      </div>

      {/* kept because: page-header gradient, gradient boxes, form styles, custom component styles, media queries */}
      <style jsx global>{`
        .page-header { background: rgb(1,135,108); color: white; padding: 2rem 0; margin-bottom: 2rem; border-radius: 10px; }
        .page-header h1 { margin: 0; font-weight: 600; }
        .promote-card { border: none; border-radius: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; border-left: 4px solid #17a2b8; background: white; }
        .promote-card .card-header { background: linear-gradient(135deg, #d1ecf1 0%, #bee5eb 100%); border-bottom: 1px solid #bee5eb; padding: 1.5rem; }
        .promote-card .card-body { padding: 2rem; }
        .info-box { background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%); border: 1px solid #c3e6cb; border-radius: 10px; padding: 1.5rem; margin-bottom: 2rem; text-align: center; }
        .info-box .info-icon { font-size: 2.5rem; color: #155724; margin-bottom: 1rem; }
        .warning-box { background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%); border: 1px solid #ffeaa7; border-radius: 10px; padding: 1.5rem; margin-bottom: 2rem; }
        .warning-box .warning-icon { font-size: 2rem; color: #856404; margin-bottom: 1rem; }
        .form-group-custom { margin-bottom: 1.5rem; }
        .form-group-custom label.form-label { display: block; margin-bottom: 0.5rem; font-weight: 500; color: #495057; font-size: 0.95rem; }
        .form-group-custom .form-select { height: calc(3.5rem + 2px); padding: 1rem 0.75rem; border-radius: 10px; border: 2px solid #e9ecef; transition: all 0.3s ease; background-color: #fff; font-size: 1rem; width: 100%; }
        .form-group-custom .form-select:focus { border-color: #17a2b8; box-shadow: 0 0 0 0.2rem rgba(23,162,184,0.25); outline: 0; }
        .form-group-custom .form-text { margin-top: 0.25rem; font-size: 0.875rem; color: #6c757d; }
        .form-switch .form-check-input { width: 3em; height: 1.5em; cursor: pointer; }
        .form-switch .form-check-input:checked { background-color: #17a2b8; border-color: #17a2b8; }
        .btn-group-custom { gap: 1rem; }
        .btn-custom { padding: 0.75rem 2rem; font-weight: 500; border-radius: 25px; transition: all 0.3s ease; min-width: 150px; }
        .btn-custom:hover { transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.2); }
        .btn-info-custom { background: linear-gradient(135deg, #17a2b8 0%, #138496 100%); border: none; color: white; }
        .btn-info-custom:hover { background: linear-gradient(135deg, #138496 0%, #117a8b 100%); color: white; }
        .selected-students-preview { background: #f8f9fa; border-radius: 10px; padding: 1.5rem; margin-bottom: 2rem; border-left: 4px solid #007bff; }
        .student-count { font-size: 2rem; font-weight: bold; color: #007bff; }
        @media (max-width: 768px) {
          .page-header { padding: 1rem 0; margin-bottom: 1rem; }
          .promote-card .card-body { padding: 1rem; }
          .btn-group-custom { flex-direction: column; }
          .btn-custom { width: 100%; margin-bottom: 0.5rem; }
        }
      `}</style>
    </div>
  );
}

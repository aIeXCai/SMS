"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { canWriteStudents } from "@/lib/permissions";

const backendBaseUrl = typeof window !== "undefined" ? `http://${window.location.hostname}:8000` : "http://localhost:8000";

export default function StudentEditPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const canStudentWrite = canWriteStudents(user);
  const params = useParams();
  
  // 从路由提取 id
  const studentId = params.id as string;

  const [statsChoices, setStatsChoices] = useState({
    status_choices: ['在读', '转学', '休学', '复学', '毕业'],
    grade_level_choices: [] as string[],
    class_name_choices: [] as string[]
  });
  
  const [formData, setFormData] = useState({
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
    grade_level: "",
    class_name: "",
  });

  const [isInitializing, setIsInitializing] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const authHeader = useMemo(() => {
    if (!token) return undefined;
    return {
      Authorization: `Bearer ${token}`,
    };
  }, [token]);

  useEffect(() => {
    if (!token || !studentId) return;

    const initData = async () => {
      setIsInitializing(true);
      setErrorMsg("");

      try {
        // 请求状态枚举
        const statsRes = await fetch(`${backendBaseUrl}/api/students/stats/`, {
          headers: { ...authHeader }
        });
        if (statsRes.ok) {
          const data = await statsRes.json();
          setStatsChoices({
            status_choices: data.status_choices || ['在读', '转学', '休学', '复学', '毕业'],
            grade_level_choices: data.grade_level_choices || [],
            class_name_choices: data.class_name_choices || [],
          });
        }

        // 请求该学生的原有数据
        const studentRes = await fetch(`${backendBaseUrl}/api/students/${studentId}/`, {
          headers: { ...authHeader }
        });
        if (studentRes.ok) {
          const data = await studentRes.json();
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
            // 如果后端返回了 nested current_class，提取年级和班级姓名
            grade_level: data.current_class?.grade_level || "",
            class_name: data.current_class?.class_name || "",
          });
        } else {
          const errData = await studentRes.text();
          console.error(errData);
          setErrorMsg("无法获取学生信息，该学生可能不存在。");
        }
      } catch (err: any) {
        console.error(err);
        setErrorMsg("网络异常或服务器错误");
      } finally {
        setIsInitializing(false);
      }
    };

    initData();
  }, [token, authHeader, studentId]);

  useEffect(() => {
    if (!loading && user && !canStudentWrite) {
      router.replace("/students");
    }
  }, [loading, user, canStudentWrite, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !studentId) return;

    setIsSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");
    setFieldErrors({});

    try {
      const payload: any = { ...formData };

      const dateFields = ['date_of_birth', 'entry_date', 'graduation_date'];
      dateFields.forEach(f => {
        if (!payload[f]) payload[f] = null;
      });

      const uniqueFields = ['id_card_number', 'student_enrollment_number'];
      uniqueFields.forEach(f => {
        if (!payload[f]) payload[f] = null;
      });

      if (payload.grade_level && payload.class_name) {
        payload.current_class = {
          grade_level: payload.grade_level,
          class_name: payload.class_name
        };
      }
      delete payload.grade_level;
      delete payload.class_name;

      const res = await fetch(`${backendBaseUrl}/api/students/${studentId}/`, {
        method: "PUT",  // 使用 PUT 更新
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setSuccessMsg("学生信息更新成功！");
        setTimeout(() => {
          router.push("/students");
        }, 1500);
      } else {
        const errData = await res.json();
        setFieldErrors(errData);
        setErrorMsg("保存失败，请检查上面填写的表单信息是否有误。");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("网络异常或服务器错误");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || isInitializing) return <div className="text-center py-5">加载中...</div>;
  if (!user) {
    router.push("/login");
    return null;
  }
  if (!canStudentWrite) return null;

  const renderInput = (id: string, label: string, type = "text", required = false, placeholder = " ") => (
    <div className="col-md-6 mb-3">
      <div className="form-floating">
        <input
          type={type}
          className={`form-control ${fieldErrors[id] ? "is-invalid" : ""}`}
          id={id}
          name={id}
          value={(formData as any)[id] || ""}
          onChange={handleChange}
          required={required}
          placeholder={placeholder}
        />
        <label htmlFor={id} className={required ? "required-field" : ""}>
          {label}
        </label>
        {fieldErrors[id] && (
          <div className="invalid-feedback">
            {fieldErrors[id].map((err, i) => <div key={i}>{err}</div>)}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div className="container-fluid">
          <div className="row align-items-center">
            <div className="col-md-8">
              <h1>
                <i className="fas fa-user-edit me-3"></i>编辑学生信息
              </h1>
              <p className="mb-0 opacity-75">修改学生基本信息，带 * 号的字段为必填项</p>
            </div>
            <div className="col-md-4 text-end">
              <Link href="/students" className="btn btn-outline-light">
                <i className="fas fa-arrow-left me-1"></i>返回列表
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="container-fluid">
        {successMsg && (
          <div className="alert alert-success alert-dismissible fade show" role="alert">
            <i className="fas fa-info-circle me-2"></i>
            {successMsg}
            <button type="button" className="btn-close" onClick={() => setSuccessMsg("")}></button>
          </div>
        )}
        
        {errorMsg && (
          <div className="alert alert-danger alert-dismissible fade show" role="alert">
            <i className="fas fa-info-circle me-2"></i>
            {errorMsg}
            <button type="button" className="btn-close" onClick={() => setErrorMsg("")}></button>
          </div>
        )}

        <div className="row justify-content-center">
          <div className="col-lg-8">
            <div className="card form-card mb-5">
              <div className="card-header">
                <h5 className="mb-0">
                  <i className="fas fa-user-edit me-2"></i>学生信息
                </h5>
              </div>
              <div className="card-body">
                <form onSubmit={handleSubmit}>
                  <div className="row">
                    
                    {renderInput("student_id", "学号", "text", true)}
                    {renderInput("name", "姓名", "text", true)}

                    <div className="col-md-6 mb-3">
                      <div className="form-floating">
                        <select
                          className={`form-select ${fieldErrors.gender ? "is-invalid" : ""}`}
                          id="gender"
                          name="gender"
                          value={formData.gender}
                          onChange={handleChange}
                        >
                          <option value="">---------</option>
                          <option value="男">男</option>
                          <option value="女">女</option>
                        </select>
                        <label htmlFor="gender">性别</label>
                        {fieldErrors.gender && (
                          <div className="invalid-feedback">
                            {fieldErrors.gender.map((err, i) => <div key={i}>{err}</div>)}
                          </div>
                        )}
                      </div>
                    </div>

                    {renderInput("date_of_birth", "出生日期", "date")}

                    <div className="col-md-6 mb-3">
                      <div className="form-floating">
                        <select
                          className={`form-select ${fieldErrors.status ? "is-invalid" : ""}`}
                          id="status"
                          name="status"
                          value={formData.status}
                          onChange={handleChange}
                        >
                          {statsChoices.status_choices.map(st => (
                            <option key={st} value={st}>{st}</option>
                          ))}
                        </select>
                        <label htmlFor="status">在校状态</label>
                        {fieldErrors.status && (
                          <div className="invalid-feedback">
                            {fieldErrors.status.map((err, i) => <div key={i}>{err}</div>)}
                          </div>
                        )}
                      </div>
                    </div>

                    {renderInput("id_card_number", "身份证号码")}
                    {renderInput("student_enrollment_number", "学籍号")}

                    <div className="col-md-6 mb-3">
                      <div className="form-floating">
                        <textarea
                          className={`form-control ${fieldErrors.home_address ? "is-invalid" : ""}`}
                          id="home_address"
                          name="home_address"
                          value={formData.home_address}
                          onChange={handleChange}
                          placeholder=" "
                          style={{ height: "calc(3.5rem + 2px)" }}
                        ></textarea>
                        <label htmlFor="home_address">家庭地址</label>
                        {fieldErrors.home_address && (
                          <div className="invalid-feedback">
                            {fieldErrors.home_address.map((err, i) => <div key={i}>{err}</div>)}
                          </div>
                        )}
                      </div>
                    </div>

                    {renderInput("guardian_name", "监护人姓名")}
                    {renderInput("guardian_contact_phone", "监护人联系电话")}
                    {renderInput("entry_date", "入学日期", "date")}
                    {renderInput("graduation_date", "毕业日期", "date")}

                    <div className="col-md-6 mb-3">
                      <div className="form-floating">
                        <select
                          className={`form-select ${fieldErrors.grade_level ? "is-invalid" : ""}`}
                          id="grade_level"
                          name="grade_level"
                          value={formData.grade_level}
                          onChange={handleChange}
                          required
                        >
                          <option value="">请选择年级</option>
                          {statsChoices.grade_level_choices.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                        <label htmlFor="grade_level" className="required-field">
                          <i className="fas fa-layer-group me-1"></i>年级
                        </label>
                        {fieldErrors.grade_level && (
                          <div className="invalid-feedback">
                            {fieldErrors.grade_level.map((err, i) => <div key={i}>{err}</div>)}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="col-md-6 mb-3">
                      <div className="form-floating">
                        <select
                          className={`form-select ${fieldErrors.class_name ? "is-invalid" : ""}`}
                          id="class_name"
                          name="class_name"
                          value={formData.class_name}
                          onChange={handleChange}
                          required
                        >
                          <option value="">请选择班级</option>
                          {statsChoices.class_name_choices.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                        <label htmlFor="class_name" className="required-field">
                          <i className="fas fa-users me-1"></i>班级名称
                        </label>
                        {fieldErrors.class_name && (
                          <div className="invalid-feedback">
                            {fieldErrors.class_name.map((err, i) => <div key={i}>{err}</div>)}
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                  
                  <div className="d-flex justify-content-center mt-4">
                    <div className="btn-group-custom d-flex">
                      <Link href="/students" className="btn btn-outline-secondary btn-custom me-3">
                        <i className="fas fa-times me-2"></i>取消
                      </Link>
                      <button type="submit" className="btn btn-primary btn-custom" disabled={isSubmitting}>
                        <i className="fas fa-save me-2"></i>
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

      <style jsx global>{`
        .page-header {
          background: rgb(1,135, 108);
          color: white;
          padding: 2rem 0;
          margin-bottom: 2rem;
          border-radius: 10px;
        }

        .page-header h1 {
          margin: 0;
          font-weight: 600;
        }

        .form-card {
          border: none;
          border-radius: 15px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }

        .form-card .card-header {
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          border-bottom: 1px solid #dee2e6;
          padding: 1.5rem;
        }

        .form-card .card-body {
          padding: 2rem;
        }

        .form-floating {
          margin-bottom: 1.5rem;
        }

        .form-floating > .form-control,
        .form-floating > .form-select {
          height: calc(3.5rem + 2px);
          line-height: 1.25;
        }

        .form-floating > label {
          padding: 1rem 0.75rem;
        }

        .invalid-feedback {
          display: block;
          width: 100%;
          margin-top: 0.25rem;
          font-size: 0.875rem;
          color: #dc3545;
        }

        .btn-group-custom {
          gap: 1rem;
        }

        .btn-custom {
          padding: 0.75rem 2rem;
          font-weight: 500;
          border-radius: 25px;
          transition: all 0.3s ease;
        }

        .btn-custom:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }

        .required-field::after {
          content: ' *';
          color: #dc3545;
        }

        @media (max-width: 768px) {
          .page-header {
            padding: 1rem 0;
            margin-bottom: 1rem;
          }
          
          .form-card .card-body {
            padding: 1rem;
          }
          
          .btn-group-custom {
            flex-direction: column;
          }
          
          .btn-custom {
            width: 100%;
            margin-bottom: 0.5rem;
          }
        }
      `}</style>
    </div>
  );
}
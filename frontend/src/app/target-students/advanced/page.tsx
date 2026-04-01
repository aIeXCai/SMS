"use client";

import { useEffect, useMemo, useState } from "react";
import FilterBuilder, { FilterCondition, FilterLogic } from "./components/FilterBuilder";
import { useAuth } from "@/contexts/AuthContext";

type Option = { value: string; label: string };

const backendBaseUrl =
  typeof window !== "undefined"
    ? `http://${window.location.hostname}:8000`
    : "http://localhost:8000";
const SCORES_API_BASE = `${backendBaseUrl}/api/scores`;

export default function AdvancedTargetStudentsPage() {
  const { token } = useAuth();
  const [logic, setLogic] = useState<FilterLogic>("AND");
  const [conditions, setConditions] = useState<FilterCondition[]>([]);
  const [gradeLevel, setGradeLevel] = useState("");
  const [examId, setExamId] = useState("");
  const [gradeOptions, setGradeOptions] = useState<Option[]>([]);
  const [examOptions, setExamOptions] = useState<Option[]>([]);

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
    if (!effectiveToken) return;

    const fetchGradeOptions = async () => {
      try {
        const res = await fetch(`${SCORES_API_BASE}/options/`, {
          headers: { ...authHeader },
        });
        if (!res.ok) return;
        const data = await res.json();
        setGradeOptions(data.grade_levels || []);
      } catch (error) {
        console.error("Failed to fetch grade options:", error);
      }
    };

    fetchGradeOptions();
  }, [effectiveToken, authHeader]);

  useEffect(() => {
    if (!effectiveToken || !gradeLevel) {
      setExamOptions([]);
      return;
    }

    const fetchExamOptions = async () => {
      try {
        const params = new URLSearchParams({ grade_level: gradeLevel });
        const res = await fetch(`${SCORES_API_BASE}/options/?${params.toString()}`, {
          headers: { ...authHeader },
        });
        if (!res.ok) return;
        const data = await res.json();
        setExamOptions(data.exams || []);
      } catch (error) {
        console.error("Failed to fetch exam options:", error);
      }
    };

    fetchExamOptions();
  }, [effectiveToken, gradeLevel, authHeader]);

  const handleGradeChange = (value: string) => {
    setGradeLevel(value);
    setExamId("");
  };

  return (
    <div>
      <div className="page-header">
        <div className="container-fluid">
          <div className="row align-items-center">
            <div className="col-md-8">
              <h1>
                <i className="fas fa-layer-group me-3"></i>目标生高级筛选
              </h1>
              <p className="mb-0 opacity-75">支持多条件组合、规则复用与实时预览（第二期）</p>
            </div>
            <div className="col-md-4 text-end mt-3 mt-md-0">
            </div>
          </div>
        </div>
      </div>

      <div className="container-fluid">
        <div className="row g-3 g-md-4">
          <div className="col-12 col-xl-8">
            <div className="card filter-card h-100">
              <div className="card-header">
                <h5 className="mb-0">
                  <i className="fas fa-sliders-h me-2"></i>条件配置区
                </h5>
              </div>
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label">选择年级</label>
                    <select
                      className="form-select"
                      value={gradeLevel}
                      onChange={(e) => handleGradeChange(e.target.value)}
                    >
                      <option value="">请先选择年级</option>
                      {gradeOptions.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">选择考试</label>
                    <select
                      className="form-select"
                      value={examId}
                      disabled={!gradeLevel}
                      onChange={(e) => setExamId(e.target.value)}
                    >
                      <option value="">
                        {gradeLevel ? "请选择考试" : "请先选择年级"}
                      </option>
                      {examOptions.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">逻辑关系</label>
                    <input
                      className="form-control"
                      value={logic === "AND" ? "AND（同时满足）" : "OR（满足其一）"}
                      disabled
                    />
                  </div>
                  <div className="col-12">
                    <FilterBuilder
                      onChange={(payload) => {
                        setLogic(payload.logic);
                        setConditions(payload.conditions);
                      }}
                      canStart={Boolean(gradeLevel && examId)}
                      onStartFilter={() => {
                        if (!gradeLevel) {
                          window.alert("请先选择年级");
                          return;
                        }
                        if (!examId) {
                          window.alert("请选择考试后再开始筛选");
                          return;
                        }
                        // 4.3 将在这里接入跳转到独立结果页与参数透传
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-12 col-xl-4">
            <div className="card filter-card h-100">
              <div className="card-header">
                <h5 className="mb-0">
                  <i className="fas fa-bookmark me-2"></i>规则快捷区
                </h5>
              </div>
              <div className="card-body">
                <p className="text-secondary mb-3">4.4 将在此接入规则选择器，快速套用历史规则。</p>
                <button type="button" className="btn btn-outline-success w-100" disabled>
                  载入已保存规则
                </button>

                <hr className="my-3" />

                <h6 className="fw-semibold">结果展示方式</h6>
                <p className="text-secondary mb-2">和简单筛选一致，点击“开始筛选”后进入独立结果页展示名单与统计。</p>
                <div className="border rounded-3 p-2 bg-light-subtle text-secondary small">
                  预计结果页路由：/target-students/advanced/result
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="row mt-3">
          <div className="col-12">
            <div className="alert alert-info border-0 tips-alert">
              <div className="d-flex align-items-center">
                <i className="fas fa-lightbulb fa-2x me-3 text-success"></i>
                <div>
                  <h6 className="alert-heading mb-1 text-success">使用建议</h6>
                  <p className="mb-0 small text-success">
                    先配置 2~3 个核心条件（例如“总分前50 且 数学前30”），再开始筛选并在结果页查看详情、导出和保存快照。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="row g-4 mt-2">
          <div className="col-lg-6">
            <div className="intro-card h-100">
              <div className="intro-card-header">
                <div className="intro-icon-wrapper">
                  <i className="fas fa-list-check"></i>
                </div>
                <h5 className="mb-0">推荐配置流程</h5>
              </div>
              <div className="intro-card-body">
                <div className="feature-item">
                  <div className="feature-icon">
                    <i className="fas fa-1"></i>
                  </div>
                  <div className="feature-content">
                    <h6>选考试与逻辑</h6>
                    <p>先明确考试范围，再确定 AND 或 OR 关系。</p>
                  </div>
                </div>
                <div className="feature-item">
                  <div className="feature-icon">
                    <i className="fas fa-2"></i>
                  </div>
                  <div className="feature-content">
                    <h6>添加关键条件</h6>
                    <p>优先添加总分条件，再补单科条件控制精度。</p>
                  </div>
                </div>
                <div className="feature-item">
                  <div className="feature-icon">
                    <i className="fas fa-3"></i>
                  </div>
                  <div className="feature-content">
                    <h6>进入结果页复核</h6>
                    <p>在独立结果页查看名单后再保存规则或快照。</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-lg-6">
            <div className="intro-card h-100">
              <div className="intro-card-header">
                <div className="intro-icon-wrapper">
                  <i className="fas fa-circle-info"></i>
                </div>
                <h5 className="mb-0">条件设计提示</h5>
              </div>
              <div className="intro-card-body">
                <div className="indicator-item">
                  <div className="indicator-tag">AND 逻辑</div>
                  <p>适合找“均衡优生”，条件越多结果越少但越精准。</p>
                </div>
                <div className="indicator-item">
                  <div className="indicator-tag">OR 逻辑</div>
                  <p>适合找“潜力生集合”，覆盖范围更大，便于二次筛选。</p>
                </div>
                <div className="indicator-item">
                  <div className="indicator-tag warning">阈值建议</div>
                  <p>建议先用较宽阈值（如前80）观察分布，再逐步收紧。</p>
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
          border-radius: 15px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          overflow: visible !important;
        }
        .filter-card .card-header {
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          border-bottom: 1px solid #dee2e6;
          border-radius: 15px 15px 0 0;
          padding: 1rem 1.5rem;
        }
        .tips-alert {
          background: linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%);
          border-radius: 12px;
        }
        .filter-action-btn {
          height: 38px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          white-space: nowrap;
        }
        .intro-card {
          background: #fff;
          border: none;
          border-radius: 16px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          overflow: hidden;
        }
        .intro-card-header {
          background: linear-gradient(135deg, #2e7d32 0%, #43a047 100%);
          color: white;
          padding: 1.25rem 1.5rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .intro-icon-wrapper {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .intro-card-body {
          padding: 1.5rem;
        }
        .feature-item {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          margin-bottom: 1rem;
        }
        .feature-item:last-child {
          margin-bottom: 0;
        }
        .feature-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: #2e7d32;
          font-weight: 700;
        }
        .feature-content h6 {
          font-size: 0.95rem;
          font-weight: 600;
          margin-bottom: 0.25rem;
        }
        .feature-content p {
          font-size: 0.85rem;
          color: #6c757d;
          margin: 0;
        }
        .indicator-item {
          margin-bottom: 1rem;
        }
        .indicator-item:last-child {
          margin-bottom: 0;
        }
        .indicator-tag {
          display: inline-block;
          background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
          color: #1565c0;
          font-size: 0.8rem;
          font-weight: 600;
          padding: 0.25rem 0.75rem;
          border-radius: 6px;
          margin-bottom: 0.5rem;
        }
        .indicator-tag.warning {
          background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
          color: #e65100;
        }
        .indicator-item p {
          font-size: 0.85rem;
          color: #495057;
          margin: 0;
        }
      `}</style>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import RuleList from "./components/RuleList";
import RuleEditor from "./components/RuleEditor";

type SavedRule = {
  id: number;
  name: string;
  rule_type: "simple" | "advanced";
  rule_config: {
    logic?: "AND" | "OR";
    conditions?: Array<{
      subject: string;
      dimension: "grade" | "class";
      operator: "top_n" | "bottom_n" | "range";
      value: number | [number, number];
    }>;
  };
  usage_count: number;
  last_used_at: string | null;
  updated_at: string;
};

const backendBaseUrl =
  typeof window !== "undefined"
    ? `http://${window.location.hostname}:8000`
    : "http://localhost:8000";
const FILTER_RULE_API = `${backendBaseUrl}/api/filter-rules/`;

type EditorState =
  | { mode: "create" }
  | {
      mode: "edit";
      rule: {
        id: number;
        name: string;
        logic: "AND" | "OR";
        conditions: Array<{
          subject: string;
          dimension: "grade" | "class";
          operator: "top_n" | "bottom_n" | "range";
          value: number | [number, number];
        }>;
      };
    }
  | null;

export default function TargetStudentRulesPage() {
  const { token, loading } = useAuth();
  const router = useRouter();
  const [rules, setRules] = useState<SavedRule[]>([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<number | null>(null);
  const [savingRule, setSavingRule] = useState(false);
  const [editorState, setEditorState] = useState<EditorState>(null);

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

  const fetchRules = async () => {
    if (!effectiveToken) return;
    setLoadingRules(true);
    setError(null);

    try {
      const res = await fetch(FILTER_RULE_API, {
        headers: { ...authHeader },
      });

      if (!res.ok) {
        setError("规则列表加载失败，请稍后重试");
        return;
      }

      const data = (await res.json()) as SavedRule[];
      const advancedRules = data.filter((item) => item.rule_type === "advanced");
      setRules(advancedRules);
    } catch (err) {
      console.error("Failed to fetch rules:", err);
      setError("规则列表加载失败，请检查网络后重试");
    } finally {
      setLoadingRules(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, [effectiveToken, authHeader]);

  const handleEditRule = (ruleId: number) => {
    const target = rules.find((item) => item.id === ruleId);
    if (!target) return;

    const rawLogic = (target.rule_config?.logic || "AND").toUpperCase();
    const nextLogic = rawLogic === "OR" ? "OR" : "AND";

    const rawConditions = target.rule_config?.conditions || [];
    if (rawConditions.length === 0) {
      window.alert("该规则缺少条件，无法编辑");
      return;
    }

    setEditorState({
      mode: "edit",
      rule: {
        id: target.id,
        name: target.name,
        logic: nextLogic,
        conditions: rawConditions,
      },
    });
  };

  const handleDeleteRule = async (ruleId: number) => {
    const target = rules.find((item) => item.id === ruleId);
    if (!target) return;

    if (!window.confirm(`确认删除规则「${target.name}」吗？`)) {
      return;
    }

    setDeletingRuleId(ruleId);
    try {
      const res = await fetch(`${FILTER_RULE_API}${ruleId}/`, {
        method: "DELETE",
        headers: { ...authHeader },
      });

      if (!res.ok) {
        window.alert("删除失败，请稍后重试");
        return;
      }

      await fetchRules();
      if (editorState?.mode === "edit" && editorState.rule.id === ruleId) {
        setEditorState(null);
      }
    } catch (err) {
      console.error("Failed to delete rule:", err);
      window.alert("删除失败，请检查网络后重试");
    } finally {
      setDeletingRuleId(null);
    }
  };

  const handleSubmitRule = async (payload: {
    id?: number;
    name: string;
    logic: "AND" | "OR";
    conditions: Array<{
      subject: string;
      dimension: "grade" | "class";
      operator: "top_n" | "bottom_n" | "range";
      value: number | [number, number];
    }>;
  }) => {
    setSavingRule(true);

    const isEdit = Boolean(payload.id);
    const url = isEdit ? `${FILTER_RULE_API}${payload.id}/` : FILTER_RULE_API;
    const method = isEdit ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify({
          name: payload.name,
          rule_type: "advanced",
          rule_config: {
            logic: payload.logic,
            conditions: payload.conditions,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(data?.detail || data?.message || "保存失败，请检查输入后重试");
        return;
      }

      await fetchRules();
      setEditorState(null);
      window.alert(isEdit ? "规则更新成功" : "规则创建成功，已与高级筛选规则联动");
    } catch (err) {
      console.error("Failed to save rule:", err);
      window.alert("保存失败，请检查网络后重试");
    } finally {
      setSavingRule(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="container-fluid">
          <div className="row align-items-center">
            <div className="col-md-8">
              <h1>
                <i className="fas fa-bookmark me-3"></i>我的规则
              </h1>
              <p className="mb-0 opacity-75">集中管理高级筛选规则，支持新建、编辑、删除与复用</p>
            </div>
            <div className="col-md-4 text-end mt-3 mt-md-0">
              <button
                type="button"
                className="btn btn-light"
                onClick={() => router.push("/target-students/advanced")}
              >
                <i className="fas fa-arrow-left me-1"></i>返回高级筛选
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container-fluid">
        <div className="row g-3 g-md-4">
          <div className="col-12 col-xl-7">
            <div className="card filter-card h-100">
              <div className="card-header d-flex justify-content-between align-items-center">
                <h5 className="mb-0">
                  <i className="fas fa-list me-2"></i>规则列表
                </h5>
                <button
                  type="button"
                  className="btn btn-success btn-sm"
                  onClick={() => setEditorState({ mode: "create" })}
                >
                  <i className="fas fa-plus me-1"></i>新建规则
                </button>
              </div>
              <div className="card-body">
                <RuleList
                  rules={rules}
                  loading={loadingRules}
                  error={error}
                  deletingRuleId={deletingRuleId}
                  onEdit={handleEditRule}
                  onDelete={handleDeleteRule}
                />
              </div>
            </div>
          </div>

          <div className="col-12 col-xl-5">
            <div className="card filter-card h-100">
              <div className="card-header">
                <h5 className="mb-0">
                  <i className="fas fa-pen-to-square me-2"></i>规则编辑区
                </h5>
              </div>
              <div className="card-body">
                {editorState ? (
                  <RuleEditor
                    initialRule={
                      editorState.mode === "create"
                        ? {
                            name: "",
                            logic: "AND",
                            conditions: [],
                          }
                        : {
                            id: editorState.rule.id,
                            name: editorState.rule.name,
                            logic: editorState.rule.logic,
                            conditions: editorState.rule.conditions,
                          }
                    }
                    saving={savingRule}
                    onCancel={() => setEditorState(null)}
                    onSubmit={handleSubmitRule}
                  />
                ) : (
                  <>
                    <p className="text-secondary mb-3">可新建规则，或在左侧规则列表中点击“编辑”进入回填编辑。</p>
                    <div className="d-grid gap-2">
                      <button
                        type="button"
                        className="btn btn-outline-success"
                        onClick={() => setEditorState({ mode: "create" })}
                      >
                        新建高级规则
                      </button>
                    </div>
                  </>
                )}

                <hr className="my-3" />

                <div className="small text-secondary">
                  快捷入口：
                  <Link href="/target-students/advanced" className="ms-1 text-decoration-none">
                    返回高级筛选继续配置
                  </Link>
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
                  <h6 className="alert-heading mb-1 text-success">使用指引</h6>
                  <p className="mb-0 small text-success">
                    建议先在高级筛选页验证条件效果，再回到本页保存为规则，后续可一键复用并持续迭代。
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
                <h5 className="mb-0">推荐使用流程</h5>
              </div>
              <div className="intro-card-body">
                <div className="feature-item">
                  <div className="feature-icon">
                    <i className="fas fa-1"></i>
                  </div>
                  <div className="feature-content">
                    <h6>从高级筛选沉淀规则</h6>
                    <p>先确认筛选结果质量，再将条件组合保存成规则模板。</p>
                  </div>
                </div>
                <div className="feature-item">
                  <div className="feature-icon">
                    <i className="fas fa-2"></i>
                  </div>
                  <div className="feature-content">
                    <h6>按业务场景命名</h6>
                    <p>规则命名建议包含目标和阈值，例如“总分前50+数学前100”。</p>
                  </div>
                </div>
                <div className="feature-item">
                  <div className="feature-icon">
                    <i className="fas fa-3"></i>
                  </div>
                  <div className="feature-content">
                    <h6>定期复盘并更新</h6>
                    <p>根据阶段考试分布变化，调整规则条件并保留稳定版本。</p>
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
                <h5 className="mb-0">规则维护建议</h5>
              </div>
              <div className="intro-card-body">
                <div className="indicator-item">
                  <div className="indicator-tag">高频规则</div>
                  <p>优先保留在年级组高频复用的规则，减少重复配置成本。</p>
                </div>
                <div className="indicator-item">
                  <div className="indicator-tag">低频规则</div>
                  <p>建议标注适用场景并定期清理，保持规则库简洁可读。</p>
                </div>
                <div className="indicator-item">
                  <div className="indicator-tag warning">变更提醒</div>
                  <p>编辑规则会影响后续加载结果，建议先新建副本再替换旧版本。</p>
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
        .rule-table {
          border-collapse: separate;
          border-spacing: 0;
          border-radius: 8px;
          overflow: hidden;
        }
        .rule-table thead th {
          background: linear-gradient(135deg, #2e7d32 0%, #43a047 100%);
          color: white;
          font-weight: 600;
          border: none;
          padding: 12px 16px;
          vertical-align: middle;
        }
        .rule-table tbody tr {
          transition: all 0.2s ease;
        }
        .rule-table tbody tr:hover {
          background-color: #f5f9f5;
          transform: scale(1.005);
        }
        .rule-table tbody td {
          border-color: #e8f5e9;
          padding: 12px 16px;
          vertical-align: middle;
        }
      `}</style>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import RuleList from "./components/RuleList";
import RuleEditor from "./components/RuleEditor";
import UnifiedModal from "../components/UnifiedModal";

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
  const [modalState, setModalState] = useState<{
    open: boolean;
    variant: "success" | "error" | "warning" | "info";
    title: string;
    message: string;
    showCancel: boolean;
    confirmText: string;
    cancelText: string;
    onConfirmAction: (() => void) | null;
  }>({
    open: false,
    variant: "info",
    title: "提示",
    message: "",
    showCancel: false,
    confirmText: "确定",
    cancelText: "取消",
    onConfirmAction: null,
  });

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

  const showInfoModal = (
    message: string,
    title = "操作提示",
    variant: "success" | "error" | "warning" | "info" = "info"
  ) => {
    setModalState({
      open: true,
      variant,
      title,
      message,
      showCancel: false,
      confirmText: "确定",
      cancelText: "取消",
      onConfirmAction: null,
    });
  };

  const showConfirmModal = (message: string, onConfirm: () => void, title = "请确认") => {
    setModalState({
      open: true,
      variant: "warning",
      title,
      message,
      showCancel: true,
      confirmText: "确认",
      cancelText: "取消",
      onConfirmAction: onConfirm,
    });
  };

  const handleEditRule = (ruleId: number) => {
    const target = rules.find((item) => item.id === ruleId);
    if (!target) return;

    const rawLogic = (target.rule_config?.logic || "AND").toUpperCase();
    const nextLogic = rawLogic === "OR" ? "OR" : "AND";

    const rawConditions = target.rule_config?.conditions || [];
    if (rawConditions.length === 0) {
      showInfoModal("该规则缺少条件，无法编辑", "规则编辑", "warning");
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

    showConfirmModal(`确认删除规则「${target.name}」吗？`, async () => {
      setDeletingRuleId(ruleId);
      try {
        const res = await fetch(`${FILTER_RULE_API}${ruleId}/`, {
          method: "DELETE",
          headers: { ...authHeader },
        });

        if (!res.ok) {
          showInfoModal("删除失败，请稍后重试", "规则删除", "error");
          return;
        }

        await fetchRules();
        if (editorState?.mode === "edit" && editorState.rule.id === ruleId) {
          setEditorState(null);
        }
        showInfoModal("规则删除成功", "规则删除", "success");
      } catch (err) {
        console.error("Failed to delete rule:", err);
        showInfoModal("删除失败，请检查网络后重试", "规则删除", "error");
      } finally {
        setDeletingRuleId(null);
      }
    }, "确认删除规则");
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
        showInfoModal(data?.detail || data?.message || "保存失败，请检查输入后重试", "规则保存", "error");
        return;
      }

      await fetchRules();
      setEditorState(null);
      showInfoModal(isEdit ? "规则更新成功" : "规则创建成功，已与高级筛选规则联动", "规则保存", "success");
    } catch (err) {
      console.error("Failed to save rule:", err);
      showInfoModal("保存失败，请检查网络后重试", "规则保存", "error");
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

      <UnifiedModal
        open={modalState.open}
        variant={modalState.variant}
        title={modalState.title}
        message={modalState.message}
        showCancel={modalState.showCancel}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
        onConfirm={() => {
          const action = modalState.onConfirmAction;
          setModalState((prev) => ({ ...prev, open: false, onConfirmAction: null }));
          if (action) {
            action();
          }
        }}
        onClose={() => setModalState((prev) => ({ ...prev, open: false, onConfirmAction: null }))}
      />
    </div>
  );
}

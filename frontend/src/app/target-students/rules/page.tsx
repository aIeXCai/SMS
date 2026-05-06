"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
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

  useEffect(() => {
    if (!loading && !token) {
      router.push("/login");
    }
  }, [loading, token, router]);

  const fetchRules = async () => {
    if (!token) return;
    setLoadingRules(true);
    setError(null);

    try {
      const data = await api.get<SavedRule[]>('/filter-rules/');
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
  }, [token]);

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
        await api.delete(`/filter-rules/${ruleId}/`);

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
    const body = {
      name: payload.name,
      rule_type: "advanced" as const,
      rule_config: {
        logic: payload.logic,
        conditions: payload.conditions,
      },
    };

    try {
      if (isEdit) {
        await api.put(`/filter-rules/${payload.id}/`, body);
      } else {
        await api.post('/filter-rules/', body);
      }

      await fetchRules();
      setEditorState(null);
      showInfoModal(isEdit ? "规则更新成功" : "规则创建成功，已与高级筛选规则联动", "规则保存", "success");
    } catch (err) {
      console.error("Failed to save rule:", err);
      const msg = err instanceof Error ? err.message : "保存失败，请检查网络后重试";
      showInfoModal(msg, "规则保存", "error");
    } finally {
      setSavingRule(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="w-full px-4 mx-auto max-w-[1400px]">
          <div className="flex flex-wrap items-center">
            <div className="flex-1">
              <h1>
                <i className="fas fa-bookmark mr-3"></i>我的规则
              </h1>
              <p className="mb-0 opacity-75">集中管理高级筛选规则，支持新建、编辑、删除与复用</p>
            </div>
            <div className="flex-shrink-0 text-right">
              <Link href="/target-students/advanced" className="secondary-action">
                <i className="fas fa-arrow-left mr-2"></i>返回高级筛选
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-4 mx-auto max-w-[1400px]">
        <div className="flex flex-wrap">
          <div className="w-full xl:w-3/5 xl:pr-2">
            <div className="bg-white rounded-lg shadow filter-card h-100">
              <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                <h5 className="mb-0">
                  <i className="fas fa-list mr-2"></i>规则列表
                </h5>
                <button
                  type="button"
                  className="bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 transition-colors text-sm"
                  onClick={() => setEditorState({ mode: "create" })}
                >
                  <i className="fas fa-plus mr-1"></i>新建规则
                </button>
              </div>
              <div className="p-4">
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

          <div className="w-full xl:w-2/5 xl:pl-2">
            <div className="bg-white rounded-lg shadow filter-card h-100">
              <div className="px-4 py-3 border-b border-gray-200">
                <h5 className="mb-0">
                  <i className="fas fa-pen-to-square mr-2"></i>规则编辑区
                </h5>
              </div>
              <div className="p-4">
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
                    <p className="text-gray-500 mb-3">可新建规则，或在左侧规则列表中点击"编辑"进入回填编辑。</p>
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        className="border border-green-300 text-green-600 px-4 py-2 rounded hover:bg-green-50 transition-colors"
                        onClick={() => setEditorState({ mode: "create" })}
                      >
                        新建高级规则
                      </button>
                    </div>
                  </>
                )}

                <hr className="my-3" />

                <div className="text-sm text-gray-500">
                  快捷入口：
                  <Link href="/target-students/advanced" className="ml-1">
                    返回高级筛选继续配置
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap mt-3">
          <div className="w-full">
            <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded border-0 tips-alert">
              <div className="flex items-center">
                <i className="fas fa-lightbulb fa-2x mr-3 text-green-600"></i>
                <div>
                  <h6 className="alert-heading mb-1 text-green-600">使用指引</h6>
                  <p className="mb-0 text-sm text-green-600">
                    建议先在高级筛选页验证条件效果，再回到本页保存为规则，后续可一键复用并持续迭代。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mt-2">
          <div className="flex-1 min-w-0">
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
                    <p>规则命名建议包含目标和阈值，例如"总分前50+数学前100"。</p>
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

          <div className="flex-1 min-w-0">
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
        a.secondary-action,
        a.secondary-action:link,
        a.secondary-action:visited,
        a.secondary-action:hover,
        a.secondary-action:active {
          display: inline-flex; align-items: center; justify-content: center;
          min-height: 44px; min-width: 144px; padding: 0 16px; border-radius: 12px;
          background: rgba(255,255,255,0.72); color: #2f3a4b; font-size: 14px;
          text-decoration: none; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
          transition: all 0.2s ease; cursor: pointer;
        }
        a.secondary-action:hover { background: rgba(255,255,255,0.9); color: #1a2535; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
      `}</style>

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

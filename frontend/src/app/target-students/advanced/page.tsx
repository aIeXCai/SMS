"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import FilterBuilder, { FilterCondition, FilterLogic } from "./components/FilterBuilder";
import RuleSelector from "./components/RuleSelector";
import UnifiedModal from "../components/UnifiedModal";
import { useAuth } from "@/contexts/AuthContext";

type Option = { value: string; label: string };

const backendBaseUrl =
  typeof window !== "undefined"
    ? `http://${window.location.hostname}:8000`
    : "http://localhost:8000";
const SCORES_API_BASE = `${backendBaseUrl}/api/scores`;
const FILTER_RULE_API = `${backendBaseUrl}/api/filter-rules/`;

type SavedRule = {
  id: number;
  name: string;
  rule_type: "simple" | "advanced";
  rule_config: {
    logic?: string;
    conditions?: Array<{
      subject: string;
      dimension: "grade" | "class";
      operator: "top_n" | "bottom_n" | "range";
      value: number | [number, number];
    }>;
    grade_level?: string;
    exam_id?: number | string;
  };
};

function isValidCondition(condition: unknown): condition is FilterCondition {
  if (!condition || typeof condition !== "object") return false;
  const item = condition as FilterCondition;

  const validSubjects = new Set([
    "total",
    "chinese",
    "math",
    "english",
    "physics",
    "chemistry",
    "biology",
    "history",
    "geography",
    "politics",
  ]);

  if (!validSubjects.has(item.subject)) return false;
  if (item.dimension !== "grade" && item.dimension !== "class") return false;
  if (item.operator !== "top_n" && item.operator !== "bottom_n" && item.operator !== "range") return false;

  if (item.operator === "range") {
    if (!Array.isArray(item.value) || item.value.length !== 2) return false;
    const [start, end] = item.value;
    return Number.isInteger(start) && Number.isInteger(end) && start > 0 && end > 0 && start <= end;
  }

  return typeof item.value === "number" && Number.isInteger(item.value) && item.value > 0;
}

function formatExamLabel(label: string, gradeLevel: string): string {
  const raw = String(label || "").trim();
  if (!raw) return raw;

  let next = raw;

  if (gradeLevel) {
    const escaped = gradeLevel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    next = next.replace(new RegExp(escaped, "g"), " ");
  }

  // 兜底移除任意位置的届别文本（如：初中2024级 / 高中2026级）
  next = next.replace(/(?:初中|高中)\s*\d{4}\s*级/g, " ");

  // 去掉因文本替换导致的空括号残留
  next = next
    .replace(/\(\s*\)/g, " ")
    .replace(/（\s*）/g, " ")
    .replace(/\[\s*\]/g, " ")
    .replace(/【\s*】/g, " ");

  // 清理多余分隔符和空白，保证展示简洁
  next = next
    .replace(/[\s\-_/|｜·,，:：]{2,}/g, " ")
    .replace(/^[\s\-_/|｜·,，:：]+/, "")
    .replace(/[\s\-_/|｜·,，:：]+$/, "")
    .trim();

  return next || raw;
}

export default function AdvancedTargetStudentsPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [logic, setLogic] = useState<FilterLogic>("AND");
  const [conditions, setConditions] = useState<FilterCondition[]>([]);
  const [gradeLevel, setGradeLevel] = useState("");
  const [examId, setExamId] = useState("");
  const [gradeOptions, setGradeOptions] = useState<Option[]>([]);
  const [examOptions, setExamOptions] = useState<Option[]>([]);
  const [gradeDropdownOpen, setGradeDropdownOpen] = useState(false);
  const [examDropdownOpen, setExamDropdownOpen] = useState(false);
  const [savedRules, setSavedRules] = useState<SavedRule[]>([]);
  const [selectedRuleId, setSelectedRuleId] = useState("");
  const [loadingRules, setLoadingRules] = useState(false);
  const [builderPresetKey, setBuilderPresetKey] = useState(0);
  const [builderPresetLogic, setBuilderPresetLogic] = useState<FilterLogic>("AND");
  const [builderPresetConditions, setBuilderPresetConditions] = useState<FilterCondition[]>([]);
  const [modalState, setModalState] = useState<{
    open: boolean;
    title: string;
    message: string;
    variant: "info" | "warning" | "error" | "success";
  }>({
    open: false,
    title: "提示",
    message: "",
    variant: "info",
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

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".custom-dropdown")) {
        setGradeDropdownOpen(false);
        setExamDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (!effectiveToken) return;

    const fetchRules = async () => {
      setLoadingRules(true);
      try {
        const res = await fetch(FILTER_RULE_API, {
          headers: { ...authHeader },
        });
        if (!res.ok) return;
        const data = (await res.json()) as SavedRule[];
        const advancedRules = data.filter((item) => item.rule_type === "advanced");
        setSavedRules(advancedRules);
      } catch (error) {
        console.error("Failed to fetch filter rules:", error);
      } finally {
        setLoadingRules(false);
      }
    };

    fetchRules();
  }, [effectiveToken, authHeader]);

  const handleGradeChange = (value: string) => {
    setGradeLevel(value);
    setExamId("");
  };

  const openModal = (
    message: string,
    title = "操作提示",
    variant: "info" | "warning" | "error" | "success" = "warning"
  ) => {
    setModalState({
      open: true,
      title,
      message,
      variant,
    });
  };

  const handleLoadSelectedRule = () => {
    if (!selectedRuleId) {
      openModal("请先选择规则", "加载规则", "warning");
      return;
    }

    const selected = savedRules.find((item) => String(item.id) === selectedRuleId);
    if (!selected) {
      openModal("未找到对应规则", "加载规则", "error");
      return;
    }

    const rawLogic = (selected.rule_config?.logic || "AND").toUpperCase();
    const nextLogic: FilterLogic = rawLogic === "OR" ? "OR" : "AND";

    const rawConditions = selected.rule_config?.conditions || [];
    const nextConditions = rawConditions
      .filter(isValidCondition)
      .map((condition, index) => ({
        ...condition,
        id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
      }));

    if (nextConditions.length === 0) {
      openModal("该规则没有可用条件，无法加载", "加载规则", "warning");
      return;
    }

    const nextGradeLevel = selected.rule_config?.grade_level;
    if (typeof nextGradeLevel === "string" && nextGradeLevel.trim()) {
      setGradeLevel(nextGradeLevel);
    }

    const nextExamId = selected.rule_config?.exam_id;
    if (typeof nextExamId === "string" || typeof nextExamId === "number") {
      setExamId(String(nextExamId));
    }

    setBuilderPresetLogic(nextLogic);
    setBuilderPresetConditions(nextConditions);
    setBuilderPresetKey((prev) => prev + 1);
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
                    <div className="custom-dropdown">
                      <button
                        type="button"
                        className={`custom-dropdown-toggle ${gradeDropdownOpen ? "active" : ""}`}
                        onClick={() => setGradeDropdownOpen((open) => !open)}
                      >
                        <span>
                          {gradeOptions.find((item) => item.value === gradeLevel)?.label || "请先选择年级"}
                        </span>
                        <i className="fas fa-chevron-down custom-dropdown-arrow"></i>
                      </button>
                      <div className={`custom-dropdown-menu ${gradeDropdownOpen ? "show" : ""}`}>
                        {gradeOptions.length === 0 ? (
                          <div className="custom-dropdown-empty">暂无可选年级</div>
                        ) : (
                          gradeOptions.map((item) => (
                            <button
                              key={item.value}
                              type="button"
                              className="custom-dropdown-item"
                              onClick={() => {
                                handleGradeChange(item.value);
                                setGradeDropdownOpen(false);
                              }}
                            >
                              {item.label}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">选择考试</label>
                    <div className="custom-dropdown">
                      <button
                        type="button"
                        className={`custom-dropdown-toggle ${examDropdownOpen ? "active" : ""}`}
                        onClick={() => {
                          if (!gradeLevel) return;
                          setExamDropdownOpen((open) => !open);
                        }}
                        disabled={!gradeLevel}
                      >
                        <span>
                          {(() => {
                            const selected = examOptions.find((item) => item.value === examId);
                            if (!selected) return gradeLevel ? "请选择考试" : "请先选择年级";
                            return formatExamLabel(selected.label, gradeLevel);
                          })()}
                        </span>
                        <i className="fas fa-chevron-down custom-dropdown-arrow"></i>
                      </button>
                      <div className={`custom-dropdown-menu ${examDropdownOpen ? "show" : ""}`}>
                        {examOptions.length === 0 ? (
                          <div className="custom-dropdown-empty">{gradeLevel ? "该年级暂无考试" : "请先选择年级"}</div>
                        ) : (
                          examOptions.map((item) => (
                            <button
                              key={item.value}
                              type="button"
                              className="custom-dropdown-item"
                              onClick={() => {
                                setExamId(item.value);
                                setExamDropdownOpen(false);
                              }}
                            >
                              {formatExamLabel(item.label, gradeLevel)}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
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
                      presetKey={builderPresetKey}
                      presetLogic={builderPresetLogic}
                      presetConditions={builderPresetConditions}
                      onChange={(payload) => {
                        setLogic(payload.logic);
                        setConditions(payload.conditions);
                      }}
                      canStart={Boolean(gradeLevel && examId)}
                      onStartFilter={(payload) => {
                        if (!gradeLevel) {
                          openModal("请先选择年级", "开始筛选", "warning");
                          return;
                        }
                        if (!examId) {
                          openModal("请选择考试后再开始筛选", "开始筛选", "warning");
                          return;
                        }

                        const params = new URLSearchParams();
                        params.set("exam_id", examId);
                        params.set("grade_level", gradeLevel);
                        params.set("logic", payload.logic);
                        params.set("conditions", JSON.stringify(payload.conditions));
                        router.push(`/target-students/advanced/result?${params.toString()}`);
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
                <p className="text-secondary mb-3">选择已保存的高级规则，可一键回填条件组合。</p>
                <RuleSelector
                  rules={savedRules.map((item) => ({ id: item.id, name: item.name }))}
                  selectedRuleId={selectedRuleId}
                  onSelect={setSelectedRuleId}
                  onLoad={handleLoadSelectedRule}
                  loading={loadingRules}
                />

                {savedRules.length === 0 && !loadingRules && (
                  <div className="small text-secondary mt-2">暂无可用高级规则，可在规则页创建后返回加载。</div>
                )}

                <div className="border rounded-3 p-2 bg-light-subtle text-secondary small mt-3">
                  规则管理：
                  <button
                    type="button"
                    className="btn btn-link btn-sm p-0 ms-1 align-baseline"
                    onClick={() => router.push("/target-students/rules")}
                  >
                    前往我的规则
                  </button>
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

      <UnifiedModal
        open={modalState.open}
        variant={modalState.variant}
        title={modalState.title}
        message={modalState.message}
        onConfirm={() => setModalState((prev) => ({ ...prev, open: false }))}
        onClose={() => setModalState((prev) => ({ ...prev, open: false }))}
      />

      <style jsx global>{`
        .filter-action-btn {
          height: 38px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}

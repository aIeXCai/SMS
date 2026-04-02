"use client";

import { useEffect, useMemo, useState } from "react";

export type FilterLogic = "AND" | "OR";
export type FilterOperator = "top_n" | "bottom_n" | "range";

export type FilterCondition = {
  id: string;
  subject: string;
  dimension: "grade" | "class";
  operator: FilterOperator;
  value: number | [number, number];
};

type BuilderCondition = {
  id: string;
  subject: string;
  dimension: "grade" | "class";
  operator: FilterOperator;
  valueA: string;
  valueB: string;
};

type FilterBuilderProps = {
  onChange?: (payload: { logic: FilterLogic; conditions: FilterCondition[] }) => void;
  onStartFilter?: (payload: { logic: FilterLogic; conditions: FilterCondition[] }) => void;
  canStart?: boolean;
  presetLogic?: FilterLogic;
  presetConditions?: FilterCondition[];
  presetKey?: number;
};

const SUBJECT_OPTIONS = [
  { value: "total", label: "总分" },
  { value: "chinese", label: "语文" },
  { value: "math", label: "数学" },
  { value: "english", label: "英语" },
  { value: "physics", label: "物理" },
  { value: "chemistry", label: "化学" },
  { value: "biology", label: "生物" },
  { value: "history", label: "历史" },
  { value: "geography", label: "地理" },
  { value: "politics", label: "政治" },
];

function buildDefaultCondition(): BuilderCondition {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    subject: "total",
    dimension: "grade",
    operator: "top_n",
    valueA: "50",
    valueB: "100",
  };
}

function toPositiveInt(raw: string): number | null {
  if (!/^\d+$/.test(raw)) {
    return null;
  }
  const n = Number(raw);
  return n > 0 ? n : null;
}

function normalizeConditions(conditions: BuilderCondition[]): FilterCondition[] {
  const result: FilterCondition[] = [];

  for (const item of conditions) {
    const valueA = toPositiveInt(item.valueA);

    if (item.operator === "range") {
      const valueB = toPositiveInt(item.valueB);
      if (!valueA || !valueB || valueA > valueB) {
        continue;
      }
      result.push({
        id: item.id,
        subject: item.subject,
        dimension: item.dimension,
        operator: item.operator,
        value: [valueA, valueB],
      });
      continue;
    }

    if (!valueA) {
      continue;
    }

    result.push({
      id: item.id,
      subject: item.subject,
      dimension: item.dimension,
      operator: item.operator,
      value: valueA,
    });
  }

  return result;
}

function toBuilderCondition(item: FilterCondition): BuilderCondition {
  if (item.operator === "range" && Array.isArray(item.value)) {
    return {
      id: item.id || `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      subject: item.subject,
      dimension: item.dimension,
      operator: item.operator,
      valueA: String(item.value[0]),
      valueB: String(item.value[1]),
    };
  }

  return {
    id: item.id || `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    subject: item.subject,
    dimension: item.dimension,
    operator: item.operator,
    valueA: String(item.value),
    valueB: "",
  };
}

export default function FilterBuilder({
  onChange,
  onStartFilter,
  canStart = true,
  presetLogic,
  presetConditions,
  presetKey,
}: FilterBuilderProps) {
  const [logic, setLogic] = useState<FilterLogic>("AND");
  const [conditions, setConditions] = useState<BuilderCondition[]>([buildDefaultCondition()]);

  const normalized = useMemo(() => normalizeConditions(conditions), [conditions]);

  useEffect(() => {
    onChange?.({ logic, conditions: normalized });
  }, [logic, normalized, onChange]);

  useEffect(() => {
    if (!presetKey) {
      return;
    }

    setLogic(presetLogic || "AND");

    if (!presetConditions || presetConditions.length === 0) {
      setConditions([buildDefaultCondition()]);
      return;
    }

    setConditions(presetConditions.map(toBuilderCondition));
  }, [presetKey, presetLogic, presetConditions]);

  const updateCondition = (id: string, patch: Partial<BuilderCondition>) => {
    setConditions((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const removeCondition = (id: string) => {
    setConditions((prev) => {
      const next = prev.filter((item) => item.id !== id);
      return next.length > 0 ? next : [buildDefaultCondition()];
    });
  };

  const addCondition = () => {
    setConditions((prev) => [...prev, buildDefaultCondition()]);
  };

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <label className="form-label mb-0 fw-semibold">筛选条件</label>
        <button type="button" className="btn btn-sm btn-outline-primary" onClick={addCondition}>
          <i className="fas fa-plus me-1"></i>添加条件
        </button>
      </div>

      <div className="d-flex flex-column gap-2">
        {conditions.map((condition, index) => (
          <div key={condition.id} className="border rounded-3 p-2 p-md-3 bg-light-subtle">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="small text-secondary">条件 {index + 1}</span>
              <button
                type="button"
                className="btn btn-sm btn-outline-danger"
                onClick={() => removeCondition(condition.id)}
              >
                <i className="fas fa-trash me-1"></i>删除
              </button>
            </div>

            <div className="row g-2">
              <div className="col-md-3">
                <label className="form-label small mb-1">科目</label>
                <select
                  className="form-select form-select-sm"
                  value={condition.subject}
                  onChange={(e) => updateCondition(condition.id, { subject: e.target.value })}
                >
                  {SUBJECT_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-3">
                <label className="form-label small mb-1">维度</label>
                <select
                  className="form-select form-select-sm"
                  value={condition.dimension}
                  onChange={(e) => updateCondition(condition.id, { dimension: e.target.value as "grade" | "class" })}
                >
                  <option value="grade">年级排名</option>
                  <option value="class">班级排名</option>
                </select>
              </div>

              <div className="col-md-3">
                <label className="form-label small mb-1">条件</label>
                <select
                  className="form-select form-select-sm"
                  value={condition.operator}
                  onChange={(e) => updateCondition(condition.id, { operator: e.target.value as FilterOperator })}
                >
                  <option value="top_n">前 N 名</option>
                  <option value="bottom_n">后 N 名</option>
                  <option value="range">区间 N-M</option>
                </select>
              </div>

              <div className="col-md-3">
                <label className="form-label small mb-1">数值</label>
                {condition.operator === "range" ? (
                  <div className="d-flex align-items-center gap-1">
                    <input
                      className="form-control form-control-sm"
                      value={condition.valueA}
                      onChange={(e) => updateCondition(condition.id, { valueA: e.target.value.replace(/\D/g, "") })}
                      placeholder="N"
                    />
                    <span className="small text-secondary">-</span>
                    <input
                      className="form-control form-control-sm"
                      value={condition.valueB}
                      onChange={(e) => updateCondition(condition.id, { valueB: e.target.value.replace(/\D/g, "") })}
                      placeholder="M"
                    />
                  </div>
                ) : (
                  <input
                    className="form-control form-control-sm"
                    value={condition.valueA}
                    onChange={(e) => updateCondition(condition.id, { valueA: e.target.value.replace(/\D/g, "") })}
                    placeholder="如 50"
                  />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <label className="form-label fw-semibold">逻辑关系</label>
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
          <div className="d-flex gap-2">
            <button
              type="button"
              className={`btn btn-sm ${logic === "AND" ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => setLogic("AND")}
            >
              AND（同时满足）
            </button>
            <button
              type="button"
              className={`btn btn-sm ${logic === "OR" ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => setLogic("OR")}
            >
              OR（满足其一）
            </button>
          </div>

          <button
            type="button"
            className="btn btn-primary filter-action-btn"
            disabled={normalized.length === 0 || !canStart}
            onClick={() => onStartFilter?.({ logic, conditions: normalized })}
          >
            <i className="fas fa-play me-1"></i>开始筛选
          </button>
        </div>
      </div>

      <div className="small text-secondary mt-2">
        当前有效条件：{normalized.length} 条
      </div>
    </div>
  );
}

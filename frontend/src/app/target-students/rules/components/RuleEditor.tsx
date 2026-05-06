"use client";

import { useEffect, useMemo, useState } from "react";

type FilterLogic = "AND" | "OR";
type FilterOperator = "top_n" | "bottom_n" | "range";

type RuleCondition = {
  id: string;
  subject: string;
  dimension: "grade" | "class";
  operator: FilterOperator;
  valueA: string;
  valueB: string;
};

type SubmitPayload = {
  id?: number;
  name: string;
  logic: FilterLogic;
  conditions: Array<{
    subject: string;
    dimension: "grade" | "class";
    operator: FilterOperator;
    value: number | [number, number];
  }>;
};

type RuleEditorProps = {
  initialRule: {
    id?: number;
    name: string;
    logic: FilterLogic;
    conditions: Array<{
      subject: string;
      dimension: "grade" | "class";
      operator: FilterOperator;
      value: number | [number, number];
    }>;
  } | null;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (payload: SubmitPayload) => void;
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

function buildDefaultCondition(): RuleCondition {
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
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n > 0 ? n : null;
}

function normalizeConditions(conditions: RuleCondition[]) {
  const result: Array<{
    subject: string;
    dimension: "grade" | "class";
    operator: FilterOperator;
    value: number | [number, number];
  }> = [];

  for (const item of conditions) {
    const valueA = toPositiveInt(item.valueA);

    if (item.operator === "range") {
      const valueB = toPositiveInt(item.valueB);
      if (!valueA || !valueB || valueA > valueB) continue;
      result.push({
        subject: item.subject,
        dimension: item.dimension,
        operator: item.operator,
        value: [valueA, valueB],
      });
      continue;
    }

    if (!valueA) continue;
    result.push({
      subject: item.subject,
      dimension: item.dimension,
      operator: item.operator,
      value: valueA,
    });
  }

  return result;
}

function fromCondition(condition: {
  subject: string;
  dimension: "grade" | "class";
  operator: FilterOperator;
  value: number | [number, number];
}): RuleCondition {
  if (condition.operator === "range" && Array.isArray(condition.value)) {
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      subject: condition.subject,
      dimension: condition.dimension,
      operator: condition.operator,
      valueA: String(condition.value[0]),
      valueB: String(condition.value[1]),
    };
  }

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    subject: condition.subject,
    dimension: condition.dimension,
    operator: condition.operator,
    valueA: String(condition.value),
    valueB: "",
  };
}

export default function RuleEditor({ initialRule, saving, onCancel, onSubmit }: RuleEditorProps) {
  const [name, setName] = useState("");
  const [logic, setLogic] = useState<FilterLogic>("AND");
  const [conditions, setConditions] = useState<RuleCondition[]>([buildDefaultCondition()]);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    if (!initialRule) {
      setName("");
      setLogic("AND");
      setConditions([buildDefaultCondition()]);
      setErrorText("");
      return;
    }

    setName(initialRule.name || "");
    setLogic(initialRule.logic || "AND");
    if (!initialRule.conditions || initialRule.conditions.length === 0) {
      setConditions([buildDefaultCondition()]);
    } else {
      setConditions(initialRule.conditions.map(fromCondition));
    }
    setErrorText("");
  }, [initialRule]);

  const validConditions = useMemo(() => normalizeConditions(conditions), [conditions]);

  const updateCondition = (id: string, patch: Partial<RuleCondition>) => {
    setConditions((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const addCondition = () => setConditions((prev) => [...prev, buildDefaultCondition()]);

  const removeCondition = (id: string) => {
    setConditions((prev) => {
      const next = prev.filter((item) => item.id !== id);
      return next.length > 0 ? next : [buildDefaultCondition()];
    });
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      setErrorText("规则名称不能为空");
      return;
    }

    if (validConditions.length === 0) {
      setErrorText("请至少配置 1 条有效条件");
      return;
    }

    setErrorText("");
    onSubmit({
      id: initialRule?.id,
      name: name.trim(),
      logic,
      conditions: validConditions,
    });
  };

  return (
    <div>
      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-700 mb-1">规则名称</label>
        <input
          className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如：总分前50且数学前100"
        />
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-700 mb-1">逻辑关系</label>
        <div className="flex gap-2">
          <button
            type="button"
            className={`text-sm px-2 py-1 rounded transition-colors ${logic === "AND" ? "bg-blue-600 text-white hover:bg-blue-700" : "border border-blue-300 text-blue-600 hover:bg-blue-50"}`}
            onClick={() => setLogic("AND")}
          >
            AND（同时满足）
          </button>
          <button
            type="button"
            className={`text-sm px-2 py-1 rounded transition-colors ${logic === "OR" ? "bg-blue-600 text-white hover:bg-blue-700" : "border border-blue-300 text-blue-600 hover:bg-blue-50"}`}
            onClick={() => setLogic("OR")}
          >
            OR（满足其一）
          </button>
        </div>
      </div>

      <div className="flex justify-between items-center mb-2">
        <label className="block text-sm font-medium text-gray-700 mb-0">筛选条件</label>
        <button type="button" className="border border-blue-300 text-blue-600 px-2 py-1 rounded hover:bg-blue-50 transition-colors text-sm" onClick={addCondition}>
          <i className="fas fa-plus mr-1"></i>添加
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {conditions.map((condition, index) => (
          <div key={condition.id} className="border rounded-lg p-2 bg-gray-50">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-500">条件 {index + 1}</span>
              <button type="button" className="border border-red-300 text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors text-sm" onClick={() => removeCondition(condition.id)}>
                删除
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="w-full md:w-1/3">
                <label className="block text-xs font-medium text-gray-700 mb-1">科目</label>
                <select
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500"
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

              <div className="w-full md:w-1/3">
                <label className="block text-xs font-medium text-gray-700 mb-1">维度</label>
                <select
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500"
                  value={condition.dimension}
                  onChange={(e) => updateCondition(condition.id, { dimension: e.target.value as "grade" | "class" })}
                >
                  <option value="grade">年级</option>
                  <option value="class">班级</option>
                </select>
              </div>

              <div className="w-full md:w-1/3">
                <label className="block text-xs font-medium text-gray-700 mb-1">条件</label>
                <select
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500"
                  value={condition.operator}
                  onChange={(e) => updateCondition(condition.id, { operator: e.target.value as FilterOperator })}
                >
                  <option value="top_n">前 N 名</option>
                  <option value="bottom_n">后 N 名</option>
                  <option value="range">区间 N-M</option>
                </select>
              </div>

              <div className="w-full md:w-1/3">
                <label className="block text-xs font-medium text-gray-700 mb-1">数值</label>
                {condition.operator === "range" ? (
                  <div className="flex items-center gap-1">
                    <input
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={condition.valueA}
                      onChange={(e) => updateCondition(condition.id, { valueA: e.target.value.replace(/\D/g, "") })}
                      placeholder="N"
                    />
                    <span className="text-sm text-gray-500">-</span>
                    <input
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={condition.valueB}
                      onChange={(e) => updateCondition(condition.id, { valueB: e.target.value.replace(/\D/g, "") })}
                      placeholder="M"
                    />
                  </div>
                ) : (
                  <input
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

      <div className="text-sm text-gray-500 mt-2">当前有效条件：{validConditions.length} 条</div>

      {errorText && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 py-2 px-3 rounded mt-3 mb-0" role="alert">
          <i className="fas fa-triangle-exclamation mr-2"></i>
          {errorText}
        </div>
      )}

      <div className="flex gap-2 mt-3">
        <button type="button" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors" disabled={saving} onClick={handleSubmit}>
          {saving ? (
            <>
              <span className="animate-spin h-3 w-3 border-2 border-blue-600 border-t-transparent rounded-full mr-2 inline-block align-[-0.125em]"></span>
              保存中...
            </>
          ) : (
            <>
              <i className="fas fa-floppy-disk mr-1"></i>
              {initialRule?.id ? "保存修改" : "保存规则"}
            </>
          )}
        </button>
        <button type="button" className="border border-gray-300 px-4 py-2 rounded hover:bg-gray-50 transition-colors" disabled={saving} onClick={onCancel}>
          取消
        </button>
      </div>
    </div>
  );
}

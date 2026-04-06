"use client";

import { useMemo, useState } from "react";

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

type RuleListProps = {
  rules: SavedRule[];
  loading: boolean;
  error: string | null;
  deletingRuleId?: number | null;
  onEdit?: (ruleId: number) => void;
  onDelete?: (ruleId: number) => void;
};

const PAGE_SIZE = 10;

export default function RuleList({
  rules,
  loading,
  error,
  deletingRuleId = null,
  onEdit,
  onDelete,
}: RuleListProps) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(rules.length / PAGE_SIZE));
  const pagedRules = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return rules.slice(start, start + PAGE_SIZE);
  }, [rules, page]);

  if (loading) {
    return (
      <div className="text-center py-5 text-secondary">
        <span className="spinner-border spinner-border-sm me-2"></span>
        正在加载规则列表...
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger mb-0" role="alert">
        <i className="fas fa-triangle-exclamation me-2"></i>
        {error}
      </div>
    );
  }

  if (rules.length === 0) {
    return (
      <div className="text-center py-5 text-secondary">
        <i className="fas fa-folder-open fa-2x mb-3 text-muted"></i>
        <p className="mb-1">当前暂无高级规则。</p>
        <p className="small mb-0">可先在高级筛选页配置条件并保存为规则。</p>
      </div>
    );
  }

  return (
    <>
      <div className="table-responsive">
        <table className="table table-hover table-bordered align-middle rule-table mb-0">
          <thead>
            <tr>
              <th className="text-center" style={{ width: "70px" }}>序号</th>
              <th className="text-center">规则名称</th>
              <th className="text-center" style={{ width: "120px" }}>条件数</th>
              <th className="text-center" style={{ width: "180px" }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {pagedRules.map((rule, index) => (
              <tr key={rule.id}>
                <td className="text-center text-muted">{(page - 1) * PAGE_SIZE + index + 1}</td>
                <td className="text-center fw-medium">{rule.name}</td>
                <td className="text-center">
                  {rule.rule_config?.conditions?.length ?? 0}
                </td>
                <td className="text-center">
                  <div className="d-flex justify-content-center gap-2">
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => onEdit?.(rule.id)}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm"
                      disabled={deletingRuleId === rule.id}
                      onClick={() => onDelete?.(rule.id)}
                    >
                      {deletingRuleId === rule.id ? "删除中..." : "删除"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <nav className="d-flex justify-content-center mt-3">
          <ul className="pagination mb-0">
            <li className={`page-item ${page === 1 ? "disabled" : ""}`}>
              <button className="page-link" onClick={() => setPage(1)}>首页</button>
            </li>
            <li className={`page-item ${page === 1 ? "disabled" : ""}`}>
              <button className="page-link" onClick={() => setPage((p) => Math.max(1, p - 1))}>上一页</button>
            </li>
            <li className="page-item active">
              <span className="page-link">第 {page} / {totalPages} 页</span>
            </li>
            <li className={`page-item ${page === totalPages ? "disabled" : ""}`}>
              <button className="page-link" onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>下一页</button>
            </li>
            <li className={`page-item ${page === totalPages ? "disabled" : ""}`}>
              <button className="page-link" onClick={() => setPage(totalPages)}>末页</button>
            </li>
          </ul>
        </nav>
      )}
    </>
  );
}

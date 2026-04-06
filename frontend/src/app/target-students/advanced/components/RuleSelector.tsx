import { useEffect, useState } from "react";

type SavedRule = {
  id: number;
  name: string;
};

type RuleSelectorProps = {
  rules: SavedRule[];
  selectedRuleId: string;
  onSelect: (ruleId: string) => void;
  onLoad: () => void;
  loading: boolean;
};

export default function RuleSelector({
  rules,
  selectedRuleId,
  onSelect,
  onLoad,
  loading,
}: RuleSelectorProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".rule-selector-dropdown")) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const selectedRuleName = rules.find((rule) => String(rule.id) === selectedRuleId)?.name;

  return (
    <div>
      <label className="form-label">加载规则</label>
      <div className="custom-dropdown rule-selector-dropdown mb-2">
        <button
          type="button"
          className={`custom-dropdown-toggle ${dropdownOpen ? "active" : ""}`}
          onClick={() => !loading && setDropdownOpen((open) => !open)}
          disabled={loading}
        >
          <span>{selectedRuleName || "请选择已保存规则"}</span>
          <i className="fas fa-chevron-down custom-dropdown-arrow"></i>
        </button>
        <div className={`custom-dropdown-menu ${dropdownOpen ? "show" : ""}`}>
          {rules.length === 0 ? (
            <div className="custom-dropdown-empty">暂无可加载规则</div>
          ) : (
            rules.map((rule) => (
              <button
                key={rule.id}
                type="button"
                className="custom-dropdown-item"
                onClick={() => {
                  onSelect(String(rule.id));
                  setDropdownOpen(false);
                }}
              >
                {rule.name}
              </button>
            ))
          )}
        </div>
      </div>

      <button
        type="button"
        className="btn btn-outline-success w-100"
        disabled={loading || !selectedRuleId}
        onClick={onLoad}
      >
        {loading ? (
          <>
            <span className="spinner-border spinner-border-sm me-2"></span>
            规则加载中...
          </>
        ) : (
          <>
            <i className="fas fa-book-open me-1"></i>加载规则
          </>
        )}
      </button>
    </div>
  );
}

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
      <label className="block text-sm font-medium text-gray-700 mb-1">加载规则</label>
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
        className="border border-green-300 text-green-600 px-4 py-2 rounded hover:bg-green-50 transition-colors w-full"
        disabled={loading || !selectedRuleId}
        onClick={onLoad}
      >
        {loading ? (
          <>
            <span className="animate-spin h-3 w-3 border-2 border-blue-600 border-t-transparent rounded-full mr-2 inline-block align-[-0.125em]"></span>
            规则加载中...
          </>
        ) : (
          <>
            <i className="fas fa-book-open mr-1"></i>加载规则
          </>
        )}
      </button>
    </div>
  );
}

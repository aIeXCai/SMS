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
  return (
    <div>
      <label className="form-label">加载规则</label>
      <select
        className="form-select mb-2"
        value={selectedRuleId}
        onChange={(e) => onSelect(e.target.value)}
        disabled={loading}
      >
        <option value="">请选择已保存规则</option>
        {rules.map((rule) => (
          <option key={rule.id} value={String(rule.id)}>
            {rule.name}
          </option>
        ))}
      </select>

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

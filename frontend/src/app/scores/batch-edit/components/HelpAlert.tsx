export default function HelpAlert() {
  return (
    <div className="help-alert" role="alert">
      <i className="fas fa-lightbulb mr-2"></i>
      <strong>操作提示：</strong>输入分数后点击保存，留空表示删除该科目成绩。
      <style jsx global>{`
        .help-alert {
          background: linear-gradient(135deg, #d1ecf1 0%, #bee5eb 100%);
          border: none;
          border-radius: 12px;
          border-left: 4px solid #17a2b8;
          margin-bottom: 2rem;
          padding: 1rem;
        }
      `}</style>
    </div>
  );
}

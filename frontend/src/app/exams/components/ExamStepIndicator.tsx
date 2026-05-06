"use client";

interface Props {
  step: number;
}

export default function ExamStepIndicator({ step }: Props) {
  return (
    <div className="flex items-center justify-center mb-4 gap-0">
      {/* Step 1 */}
      <div className="flex flex-col items-center" style={{ minWidth: 100 }}>
        <div
          className="flex items-center justify-center rounded-full font-bold"
          style={{
            width: 44, height: 44, fontSize: "1.1rem",
            background: step >= 1 ? "rgb(1,135,108)" : "#e9ecef",
            color: step >= 1 ? "white" : "#6c757d",
            border: `2px solid ${step >= 1 ? "rgb(1,135,108)" : "#dee2e6"}`,
          }}
        >
          {step > 1 ? <i className="fas fa-check" /> : "1"}
        </div>
        <small className={`mt-1 font-bold ${step >= 1 ? "text-green-600" : "text-gray-500"}`}>基本信息</small>
      </div>

      {/* Connector */}
      <div style={{ height: 3, width: 120, background: step >= 2 ? "rgb(1,135,108)" : "#dee2e6", marginBottom: 20 }} />

      {/* Step 2 */}
      <div className="flex flex-col items-center" style={{ minWidth: 100 }}>
        <div
          className="flex items-center justify-center rounded-full font-bold"
          style={{
            width: 44, height: 44, fontSize: "1.1rem",
            background: step >= 2 ? "rgb(1,135,108)" : "#e9ecef",
            color: step >= 2 ? "white" : "#6c757d",
            border: `2px solid ${step >= 2 ? "rgb(1,135,108)" : "#dee2e6"}`,
          }}
        >
          2
        </div>
        <small className={`mt-1 font-bold ${step >= 2 ? "text-green-600" : "text-gray-500"}`}>科目配置</small>
      </div>
    </div>
  );
}

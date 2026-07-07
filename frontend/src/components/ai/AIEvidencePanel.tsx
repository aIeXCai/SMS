"use client";

import { useState } from "react";
import type { AIEvidence } from "./types";

interface AIEvidencePanelProps {
  evidence: AIEvidence;
}

export function AIEvidencePanel({ evidence }: AIEvidencePanelProps) {
  const [open, setOpen] = useState(!evidence.collapsed_by_default);

  return (
    <div className="mt-3 border-t border-gray-200 pt-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="text-xs text-gray-500 transition-colors hover:text-gray-700"
      >
        {open ? "收起计算依据" : "展开计算依据"} · 结果可核验
      </button>
      {open && (
        <ul className="mt-2 space-y-1 text-xs text-gray-600">
          {evidence.items.map((item, index) => (
            <li key={index}>- {item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}


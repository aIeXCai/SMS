"use client";

import { AIEvidencePanel } from "./AIEvidencePanel";
import { AIResultTable } from "./AIResultTable";
import type { AIEvidence, AIResultTableData } from "./types";

interface AIResultBlockProps {
  summary?: string;
  tables?: AIResultTableData[];
  evidence?: AIEvidence;
}

function renderSummary(text: string): string {
  // Lightweight markdown: **bold**, *italic*, line breaks
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, "<em>$1</em>")
    .replace(/\n/g, "<br>");
}

export function AIResultBlock({ summary, tables = [], evidence }: AIResultBlockProps) {
  return (
    <div>
      {summary && (
        <div
          className="text-sm text-gray-800 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: renderSummary(summary) }}
        />
      )}
      {tables.map((table, index) => (
        <AIResultTable key={`${table.title}-${index}`} table={table} />
      ))}
      {evidence?.items?.length ? <AIEvidencePanel evidence={evidence} /> : null}
      <div className="mt-2 text-[10px] text-gray-400">结果基于系统成绩记录计算</div>
    </div>
  );
}


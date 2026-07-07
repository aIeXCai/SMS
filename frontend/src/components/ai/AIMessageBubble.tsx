"use client";

import { useState } from "react";
import { AIDisambiguationCard, type CandidateExam } from "./AIDisambiguationCard";
import { AIRawDataTable } from "./AIRawDataTable";
import { AIResultBlock } from "./AIResultBlock";
import { AIClarificationCard } from "./AIClarificationCard";
import type {
  AIEvidence,
  AIResultTableData,
  AIClarificationOption,
  AIClarificationReply,
  AIAction,
  AIFallback,
} from "./types";

// --- SVG Icon Components ---

function RedAlertIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function OrangeShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><line x1="9" y1="12" x2="15" y2="12" />
    </svg>
  );
}

function YellowInfoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ca8a04" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function BlueChartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function GrayInfoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

// --- Types (extended for V3) ---

export interface AIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isLoading?: boolean;
  // V3 fields
  type?: "answer" | "clarification" | "error" | "empty" | "cancelled" | "unsupported" | "explanation";
  status?: string;
  summary?: string;
  tables?: AIResultTableData[];
  evidence?: AIEvidence;
  questionId?: string;
  clarificationType?: string;
  options?: AIClarificationOption[];
  details?: { common_subjects?: string[]; only_exam_a?: string[]; only_exam_b?: string[] };
  context?: Record<string, unknown>;
  actions?: AIAction[];
  fallback?: AIFallback;
  // Old system compat
  data?: Record<string, unknown> | null;
  candidates?: Array<{ exam_id: number; name: string; date: string; academic_year: string }>;
  answer?: string; // old format
}

interface AIMessageBubbleProps {
  message: AIMessage;
  onDisambiguationSelect?: (examId: number) => void;
  onSubjectTagClick?: (subject: string) => void;
  onClarificationSelect?: (reply: AIClarificationReply) => void;
}

// --- Status styling maps (old system fallback) ---

interface StatusStyle {
  wrapper: string;
  badge: string;
  badgeText: string;
  icon: React.ReactNode;
}

const STATUS_STYLES: Record<string, StatusStyle> = {
  student_not_found: {
    wrapper: "border-red-400 bg-red-50", badge: "bg-red-100 text-red-700", badgeText: "未找到学生", icon: <RedAlertIcon />,
  },
  permission_denied: {
    wrapper: "border-amber-400 bg-amber-50", badge: "bg-amber-100 text-amber-700", badgeText: "权限不足", icon: <OrangeShieldIcon />,
  },
  subject_not_found: {
    wrapper: "border-yellow-400 bg-yellow-50", badge: "bg-yellow-100 text-yellow-700", badgeText: "未找到科目", icon: <YellowInfoIcon />,
  },
  insufficient_data: {
    wrapper: "border-blue-400 bg-blue-50", badge: "bg-blue-100 text-blue-700", badgeText: "数据不足", icon: <BlueChartIcon />,
  },
  ambiguous: {
    wrapper: "border-gray-300 bg-gray-50", badge: "bg-amber-100 text-amber-700", badgeText: "需要进一步明确", icon: <GrayInfoIcon />,
  },
  irrelevant: {
    wrapper: "border-gray-300 bg-gray-50", badge: "bg-gray-200 text-gray-600", badgeText: "无法回答", icon: <GrayInfoIcon />,
  },
  plan_error: {
    wrapper: "border-red-300 bg-red-50", badge: "bg-red-100 text-red-700", badgeText: "查询规划失败", icon: <RedAlertIcon />,
  },
};

// --- Component ---

export function AIMessageBubble({
  message,
  onDisambiguationSelect,
  onSubjectTagClick,
  onClarificationSelect,
}: AIMessageBubbleProps) {
  const [expanded, setExpanded] = useState(false);
  const isUser = message.role === "user";

  // Loading placeholder bubble
  if (message.isLoading) {
    return (
      <div className="flex w-full mb-4 justify-start">
        <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-bl-md bg-gray-100 text-gray-400 text-sm">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#01876c] animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-[#01876c] animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-[#01876c] animate-bounce" style={{ animationDelay: "300ms" }} />
          </span>
          <span className="ml-2">正在查询中...</span>
        </div>
      </div>
    );
  }

  // User message — simple right-aligned green bubble
  if (isUser) {
    return (
      <div className="flex w-full mb-4 justify-end">
        <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-br-md text-sm leading-relaxed break-words text-white"
             style={{ backgroundColor: "#01876c" }}>
          <div className="whitespace-pre-wrap">{message.content}</div>
        </div>
      </div>
    );
  }

  // ========================================================
  // V3 rendering path — based on ScoreAgentResponse.type
  // ========================================================

  // V3: Clarification (追问)
  if (message.type === "clarification" && message.questionId && message.options && message.options.length > 0) {
    return (
      <div className="flex w-full mb-4 justify-start">
        <div className="max-w-[80%]">
          <AIClarificationCard
            message={message.content}
            questionId={message.questionId}
            options={message.options}
            details={message.details}
            onSelect={(reply) => onClarificationSelect?.(reply)}
            onCancel={() => onClarificationSelect?.({ question_id: message.questionId!, value: "取消" })}
          />
        </div>
      </div>
    );
  }

  // V3: Answer (with tables/evidence)
  if (message.type === "answer") {
    return (
      <div className="flex w-full mb-4 justify-start">
        <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-bl-md text-sm leading-relaxed break-words bg-gray-100 text-gray-800">
          <AIResultBlock summary={message.summary || message.content} tables={message.tables || []} evidence={message.evidence} />
        </div>
      </div>
    );
  }

  // V3: Error / Empty
  if (message.type === "error" || message.type === "empty") {
    return (
      <div className="flex w-full mb-4 justify-start">
        <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-bl-md text-sm leading-relaxed break-words border border-red-400 bg-red-50">
          <div className="flex items-center gap-2 mb-2">
            <RedAlertIcon />
            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">查询出错</span>
          </div>
          <div className="whitespace-pre-wrap">{message.content}</div>
        </div>
      </div>
    );
  }

  // V3: Unsupported / Cancelled
  if (message.type === "unsupported" || message.type === "cancelled") {
    return (
      <div className="flex w-full mb-4 justify-start">
        <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-bl-md text-sm leading-relaxed break-words border border-gray-300 bg-gray-50">
          <div className="whitespace-pre-wrap">{message.content}</div>
        </div>
      </div>
    );
  }

  // V3: Explanation
  if (message.type === "explanation") {
    return (
      <div className="flex w-full mb-4 justify-start">
        <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-bl-md text-sm leading-relaxed break-words bg-gray-100 text-gray-800">
          <div className="whitespace-pre-wrap">{message.content}</div>
        </div>
      </div>
    );
  }

  // ========================================================
  // Old system fallback (status-based rendering)
  // ========================================================

  const hasCandidates = message.candidates && message.candidates.length > 0;
  const isAmbiguousWithCandidates = hasCandidates && (message.status === "ambiguous" || message.status === undefined);
  const showDisambiguationCard = isAmbiguousWithCandidates;

  const isSpecialStatus = message.status && message.status !== "success" && !showDisambiguationCard;
  const style = message.status ? STATUS_STYLES[message.status] : undefined;
  const showRawDataToggle = message.status === "success" && message.data != null;
  const hasInsufficientData = message.status === "insufficient_data" && message.data != null;
  const availableSubjects = message.data?.available_subjects as Array<{ subject: string; count: number }> | undefined;

  return (
    <div className="flex w-full mb-4 justify-start">
      <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl rounded-bl-md text-sm leading-relaxed break-words
        ${isSpecialStatus && style ? `${style.wrapper} border` : "bg-gray-100 text-gray-800"}`}>
        {/* Header: icon + badge */}
        {isSpecialStatus && style && (
          <div className="flex items-center gap-2 mb-2">
            {style.icon}
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${style.badge}`}>{style.badgeText}</span>
          </div>
        )}

        {/* Content */}
        {message.content && <div className="whitespace-pre-wrap">{message.content}</div>}

        {/* Disambiguation cards (old system) */}
        {showDisambiguationCard && (
          <AIDisambiguationCard candidates={message.candidates as CandidateExam[]} onSelect={(examId) => onDisambiguationSelect?.(examId)} />
        )}

        {/* Subject tag chips */}
        {availableSubjects && availableSubjects.length > 0 && onSubjectTagClick && (
          <div className="mt-2 pt-2 border-t border-yellow-200">
            <p className="text-xs text-yellow-700 mb-1.5">该学生有以下科目记录：</p>
            <div className="flex flex-wrap gap-1.5">
              {availableSubjects.map((s) => (
                <button key={s.subject} type="button" onClick={() => onSubjectTagClick(s.subject)}
                  className="inline-flex items-center px-2 py-0.5 text-xs bg-white border border-yellow-300 rounded-full text-yellow-800 hover:bg-yellow-100 hover:border-yellow-400 transition-colors">
                  {s.subject}<span className="ml-1 text-yellow-500">({s.count}次)</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {hasInsufficientData && <div className="mt-2 text-xs text-blue-600">无法对比 — 数据记录不足</div>}

        {showRawDataToggle && (
          <div className="mt-2 pt-2 border-t border-gray-200">
            <button type="button" onClick={() => setExpanded((v) => !v)} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors">
              {expanded ? "收起原始记录" : "查看原始记录"}{expanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
            </button>
            {expanded && <AIRawDataTable data={message.data ?? null} />}
          </div>
        )}

        {message.status === "success" && <div className="mt-2 text-[10px] text-gray-400">数据均来自系统真实记录</div>}
      </div>
    </div>
  );
}

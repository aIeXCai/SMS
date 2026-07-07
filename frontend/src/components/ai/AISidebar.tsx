"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { AIMessageBubble, type AIMessage } from "./AIMessageBubble";
import { AIInputBar } from "./AIInputBar";
import { ConfirmModal } from "./ConfirmModal";
import type { AIClarificationReply } from "./types";
import type { Conversation } from "./useAIChat";

const MAX_CONVERSATIONS = 10;

interface AISidebarProps {
  isOpen: boolean;
  onClose: () => void;
  messages: AIMessage[];
  isLoading: boolean;
  onSendMessage: (text: string) => void;
  conversations: Conversation[];
  activeConversationId: string;
  onCreateConversation: () => void;
  onSwitchConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onClearAll: () => void;
  onDisambiguationSelect?: (examId: number) => void;
  onSubjectTagClick?: (subject: string) => void;
  onClarificationSelect?: (reply: AIClarificationReply) => void;
  welcomeQuestions?: string[];
  title?: string;
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AISidebar({
  isOpen,
  onClose,
  messages,
  isLoading,
  onSendMessage,
  conversations,
  activeConversationId,
  onCreateConversation,
  onSwitchConversation,
  onDeleteConversation,
  onClearAll,
  onDisambiguationSelect,
  onSubjectTagClick,
  onClarificationSelect,
  welcomeQuestions,
  title = "AI 成绩助手",
}: AISidebarProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [fillText, setFillText] = useState("");
  const [fillKey, setFillKey] = useState(0);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [deleteHoverId, setDeleteHoverId] = useState<string | null>(null);

  // Auto-scroll
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  const showWelcome = messages.length === 0 && !isLoading;

  const atLimit = conversations.length >= MAX_CONVERSATIONS;

  const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div
      className="fixed top-0 shadow-2xl bg-white flex flex-col transition-all duration-300 ease-out z-[1000]"
      style={{
        right: isOpen ? 0 : -420,
        width: 420,
        height: "100vh",
        pointerEvents: isOpen ? "auto" : "none",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between flex-shrink-0 px-4 h-14"
        style={{ backgroundColor: "#01876c" }}
      >
        <span className="text-base font-semibold text-white">{title}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCreateConversation}
            disabled={atLimit}
            title={atLimit ? "对话数量已达上限（10 条）" : "新建对话"}
            className={`w-7 h-7 flex items-center justify-center rounded-full text-white/80 transition-colors
              ${atLimit ? "opacity-30 cursor-not-allowed" : "hover:text-white hover:bg-white/15"}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            className="w-7 h-7 flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/15 transition-colors"
            title="清空全部对话"
          >
            <svg width="14" height="16" viewBox="0 0 448 512" fill="currentColor">
              <path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-shrink-0 border-b border-gray-200 overflow-y-auto" style={{ maxHeight: "35%" }}>
        {sorted.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-gray-400">暂无对话，点击 + 新建</div>
        ) : (
          sorted.map((conv) => {
            const isActive = conv.id === activeConversationId;
            return (
              <div
                key={conv.id}
                onClick={() => onSwitchConversation(conv.id)}
                onMouseEnter={() => setDeleteHoverId(conv.id)}
                onMouseLeave={() => setDeleteHoverId(null)}
                className={`flex items-center justify-between px-4 py-2.5 cursor-pointer transition-colors text-sm
                  ${isActive ? "bg-[#e8f7f4] border-l-[3px] border-l-[#01876c]" : "border-l-[3px] border-l-transparent hover:bg-gray-50"}`}
              >
                <div className="flex-1 min-w-0">
                  <div className={`truncate font-medium ${isActive ? "text-[#01876c]" : "text-gray-800"}`}>
                    {conv.title || "新对话"}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">{formatTime(conv.updatedAt)}</div>
                </div>
                {deleteHoverId === conv.id && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteConversation(conv.id);
                    }}
                    className="ml-2 w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                    title="删除对话"
                  >
                    <svg width="10" height="10" viewBox="0 0 384 512" fill="currentColor">
                      <path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })
        )}
        {sorted.length > 0 && (
          <div className="px-4 py-1.5 text-[11px] text-gray-400 text-right">
            共 {sorted.length}/{MAX_CONVERSATIONS} 条对话
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {showWelcome ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-14 h-14 rounded-full bg-[#e8f7f4] flex items-center justify-center mb-3">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#01876c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className="text-sm text-gray-500 mb-4">你好，我是 AI 成绩助手</p>
            {welcomeQuestions && welcomeQuestions.length > 0 && (
              <div className="space-y-2 w-full max-w-xs">
                {welcomeQuestions.map((q, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onSendMessage(q)}
                    className="w-full text-left px-3 py-2 text-xs text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <AIMessageBubble
                key={msg.id}
                message={msg}
                onDisambiguationSelect={onDisambiguationSelect}
                onSubjectTagClick={(subject) => {
                  onSubjectTagClick?.(subject);
                  setFillText(`查询${subject}成绩`);
                  setFillKey((k) => k + 1);
                }}
                onClarificationSelect={onClarificationSelect}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input bar */}
      <div className="flex-shrink-0 border-t border-gray-200" style={{ minHeight: 64 }}>
        <AIInputBar
          key={fillKey}
          onSend={onSendMessage}
          disabled={isLoading}
          fillText={fillText}
          fillKey={fillKey}
        />
      </div>

      {/* Clear all confirm */}
      {showClearConfirm && (
        <ConfirmModal
          title="清空全部对话"
          message="确定清空全部对话？此操作不可恢复。"
          confirmLabel="确定清空"
          confirmVariant="danger"
          onConfirm={() => {
            onClearAll();
            setShowClearConfirm(false);
          }}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}
    </div>
  );
}

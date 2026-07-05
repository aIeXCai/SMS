"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { AIMessageBubble, type AIMessage } from "./AIMessageBubble";
import { AIInputBar } from "./AIInputBar";

interface AIChatWindowProps {
  isOpen: boolean;
  onClose: () => void;
  messages: AIMessage[];
  isLoading: boolean;
  onSendMessage: (content: string) => void;
  welcomeQuestions?: string[];
  title?: string;
  /** Called when user selects an exam from disambiguation cards */
  onDisambiguationSelect?: (examId: number) => void;
  /** Called when user clicks a subject tag in subject_not_found response */
  onSubjectTagClick?: (subject: string) => void;
}

export function AIChatWindow({
  isOpen,
  onClose,
  messages,
  isLoading,
  onSendMessage,
  welcomeQuestions,
  title = "AI 助手",
  onDisambiguationSelect,
  onSubjectTagClick,
}: AIChatWindowProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [fillText, setFillText] = useState("");
  const [fillKey, setFillKey] = useState(0);

  // Auto-scroll to bottom when messages change or loading starts
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  const showWelcome = messages.length === 0 && !isLoading;

  const handleWelcomeClick = (question: string) => {
    onSendMessage(question);
  };

  const handleSubjectTagClick = useCallback(
    (subject: string) => {
      if (onSubjectTagClick) {
        onSubjectTagClick(subject);
      }
      // Also fill the input bar locally
      setFillText(`查询${subject}成绩`);
      setFillKey((k) => k + 1);
    },
    [onSubjectTagClick]
  );

  return (
    <div
      className="fixed z-[998] flex flex-col bg-white shadow-2xl
                 transition-all duration-300 ease-out"
      style={{
        right: isOpen ? "24px" : "-440px",
        bottom: "96px",
        width: "400px",
        height: "520px",
        borderRadius: "16px",
        opacity: isOpen ? 1 : 0,
        pointerEvents: isOpen ? "auto" : "none",
      }}
    >
      {/* Header — 52px */}
      <div
        className="flex items-center justify-between flex-shrink-0 px-4
                   rounded-t-2xl"
        style={{
          height: "52px",
          minHeight: "52px",
          backgroundColor: "#01876c",
        }}
      >
        <div className="flex items-center gap-2">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span className="text-white font-semibold text-sm">{title}</span>
        </div>
        <div className="flex items-center gap-1">
          {/* Minimize button */}
          <button
            onClick={onClose}
            aria-label="Minimize chat"
            type="button"
            className="w-7 h-7 flex items-center justify-center rounded-full
                       text-white/80 hover:text-white hover:bg-white/15
                       transition-colors"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          {/* Close button */}
          <button
            onClick={onClose}
            aria-label="Close chat"
            type="button"
            className="w-7 h-7 flex items-center justify-center rounded-full
                       text-white/80 hover:text-white hover:bg-white/15
                       transition-colors"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Message area — scrollable */}
      <div
        className="flex-1 overflow-y-auto px-4 py-3"
        style={{ scrollBehavior: "smooth" }}
      >
        {showWelcome && welcomeQuestions && welcomeQuestions.length > 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-2">
            <div className="text-center mb-2">
              <div
                className="w-14 h-14 mx-auto mb-3 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "#e8f7f4" }}
              >
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#01876c"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p className="text-gray-500 text-sm">您好，我是 AI 助手</p>
              <p className="text-gray-400 text-xs mt-1">可以问我关于学生成绩、考试数据等问题</p>
            </div>
            <div className="w-full space-y-2">
              {welcomeQuestions.map((question, index) => (
                <button
                  key={index}
                  onClick={() => handleWelcomeClick(question)}
                  type="button"
                  className="w-full text-left px-3 py-2.5 rounded-xl border border-gray-200
                             text-sm text-gray-600 hover:border-[#01876c] hover:text-[#01876c]
                             hover:bg-[#e8f7f4] transition-all duration-200"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg) => (
          <AIMessageBubble
            key={msg.id}
            message={msg}
            onDisambiguationSelect={onDisambiguationSelect}
            onSubjectTagClick={handleSubjectTagClick}
          />
        ))}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <AIInputBar
        onSend={onSendMessage}
        disabled={isLoading}
        fillText={fillText}
        fillKey={fillKey}
      />
    </div>
  );
}

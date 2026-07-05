"use client";

import { useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/contexts/AuthContext";
import {
  FloatingAIButton,
  AIChatWindow,
  useAIChat,
} from "@/components/ai";

const WELCOME_QUESTIONS = [
  "张三的数学成绩最近有什么变化？",
  "初三年级本次考试的平均分是多少？",
  "帮我对比一班和二班的英语成绩",
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const pathname = usePathname();
  const { user, loading } = useAuth();

  const {
    messages,
    isLoading,
    unreadCount,
    sendMessage,
    markAsRead,
  } = useAIChat(aiOpen);

  const handleToggleAI = () => {
    setAiOpen((prev) => {
      const next = !prev;
      if (next) {
        markAsRead();
      }
      return next;
    });
  };

  // When user selects an exam from disambiguation cards, re-query with exam_id
  const handleDisambiguationSelect = useCallback(
    (examId: number) => {
      // Find the last user message to re-use the original question text
      const lastUserMsg = [...messages]
        .reverse()
        .find((m) => m.role === "user");
      if (lastUserMsg) {
        sendMessage(lastUserMsg.content, examId);
      }
    },
    [messages, sendMessage]
  );

  if (pathname === "/login") {
    return <>{children}</>;
  }

  const showAI = !loading;

  return (
    <>
      <button
        className="mobile-toggle bg-white border border-gray-300 px-4 py-2 rounded hover:bg-gray-50 transition-colors"
        onClick={() => setSidebarOpen((prev) => !prev)}
        type="button"
      >
        <i className="fas fa-bars"></i>
      </button>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-wrapper">
        <div className="main-content">{children}</div>
      </div>

      {showAI && (
        <>
          <FloatingAIButton
            onClick={handleToggleAI}
            isOpen={aiOpen}
            hasUnread={unreadCount > 0}
          />
          <AIChatWindow
            isOpen={aiOpen}
            onClose={() => setAiOpen(false)}
            messages={messages}
            isLoading={isLoading}
            onSendMessage={sendMessage}
            welcomeQuestions={WELCOME_QUESTIONS}
            onDisambiguationSelect={handleDisambiguationSelect}
          />
        </>
      )}
    </>
  );
}

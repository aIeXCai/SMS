"use client";

import { useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/contexts/AuthContext";
import {
  FloatingAIButton,
  AISidebar,
  useAIChat,
} from "@/components/ai";
import type { AIClarificationReply } from "@/components/ai/types";

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
    conversations,
    activeConversationId,
    createConversation,
    switchConversation,
    deleteConversation,
    clearAllConversations,
    clearMessages,
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
      const lastUserMsg = [...messages]
        .reverse()
        .find((m) => m.role === "user");
      if (lastUserMsg) {
        sendMessage(lastUserMsg.content, examId);
      }
    },
    [messages, sendMessage]
  );

  // V3: When user selects a clarification option, pass AIClarificationReply to sendMessage
  const handleClarificationSelect = useCallback(
    (reply: AIClarificationReply) => {
      if (reply.value === "取消") {
        sendMessage("取消");
      } else {
        sendMessage("", undefined, reply);
      }
    },
    [sendMessage]
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
      <div className="main-wrapper" style={{ marginRight: aiOpen ? 420 : 0 }}>
        <div className="main-content">{children}</div>
      </div>

      {showAI && (
        <>
          <FloatingAIButton
            onClick={handleToggleAI}
            isOpen={aiOpen}
            hasUnread={unreadCount > 0}
          />
          <AISidebar
            isOpen={aiOpen}
            onClose={() => setAiOpen(false)}
            messages={messages}
            isLoading={isLoading}
            onSendMessage={sendMessage}
            conversations={conversations}
            activeConversationId={activeConversationId}
            onCreateConversation={createConversation}
            onSwitchConversation={switchConversation}
            onDeleteConversation={deleteConversation}
            onClearAll={clearAllConversations}
            welcomeQuestions={WELCOME_QUESTIONS}
            onDisambiguationSelect={handleDisambiguationSelect}
            onClarificationSelect={handleClarificationSelect}
          />
        </>
      )}
    </>
  );
}

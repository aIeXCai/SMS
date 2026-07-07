"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import type { ScoreAgentResponse, AIClarificationReply } from "./types";
import type { AIMessage } from "./AIMessageBubble";

// --- Conversation type ---

export interface Conversation {
  id: string;
  title: string;
  messages: AIMessage[];
  createdAt: number;
  updatedAt: number;
  agentContext?: Record<string, unknown>;
  conversationId?: string;
}

// --- Storage keys ---

const STORAGE_KEY_CONVERSATIONS = "ai-conversations";
const STORAGE_KEY_ACTIVE = "ai-active-conversation";
const STORAGE_KEY_OLD = "ai-chat-history";
const STORAGE_KEY_TIMESTAMPS = "ai-request-timestamps";
const STORAGE_KEY_DAILY = "ai-daily-usage";

const RATE_LIMIT_PER_MINUTE = 3;
const RATE_LIMIT_PER_DAY = 50;
const MAX_CONVERSATIONS = 10;

// --- Helpers ---

function generateId(): string {
  return crypto.randomUUID();
}

function makeConversation(): Conversation {
  const id = generateId();
  return {
    id,
    title: "",
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    agentContext: {},
    conversationId: generateId(),
  };
}

// --- Rate limiting ---

function checkRateLimit(): string | null {
  const now = Date.now();
  const timestampsRaw = localStorage.getItem(STORAGE_KEY_TIMESTAMPS);
  let timestamps: number[] = timestampsRaw ? JSON.parse(timestampsRaw) : [];
  timestamps = timestamps.filter((t) => now - t < 60_000);
  if (timestamps.length >= RATE_LIMIT_PER_MINUTE) return "查询太频繁，请稍后再试";
  const today = new Date().toDateString();
  const dailyRaw = localStorage.getItem(STORAGE_KEY_DAILY);
  let daily: { date: string; count: number } = dailyRaw
    ? JSON.parse(dailyRaw)
    : { date: today, count: 0 };
  if (daily.date !== today) daily = { date: today, count: 0 };
  if (daily.count >= RATE_LIMIT_PER_DAY) return "今日查询次数已达上限";
  return null;
}

function recordRequest(): void {
  const now = Date.now();
  const timestampsRaw = localStorage.getItem(STORAGE_KEY_TIMESTAMPS);
  let timestamps: number[] = timestampsRaw ? JSON.parse(timestampsRaw) : [];
  timestamps = timestamps.filter((t) => now - t < 60_000);
  timestamps.push(now);
  localStorage.setItem(STORAGE_KEY_TIMESTAMPS, JSON.stringify(timestamps));
  const today = new Date().toDateString();
  const dailyRaw = localStorage.getItem(STORAGE_KEY_DAILY);
  let daily: { date: string; count: number } = dailyRaw
    ? JSON.parse(dailyRaw)
    : { date: today, count: 0 };
  if (daily.date !== today) daily = { date: today, count: 0 };
  daily.count += 1;
  localStorage.setItem(STORAGE_KEY_DAILY, JSON.stringify(daily));
}

// --- Persistence ---

function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONVERSATIONS);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  try {
    const oldRaw = localStorage.getItem(STORAGE_KEY_OLD);
    if (oldRaw) {
      const oldMessages: AIMessage[] = JSON.parse(oldRaw).filter((m: AIMessage) => !m.isLoading);
      if (oldMessages.length > 0) {
        const conv = makeConversation();
        conv.messages = oldMessages;
        conv.title = oldMessages.find((m) => m.role === "user")?.content.slice(0, 20) || "";
        localStorage.setItem(STORAGE_KEY_CONVERSATIONS, JSON.stringify([conv]));
        localStorage.removeItem(STORAGE_KEY_OLD);
        return [conv];
      }
    }
  } catch { /* ignore */ }
  return [];
}

function persistConversations(conversations: Conversation[]): void {
  const clean = conversations.map((c) => ({
    ...c,
    messages: c.messages.filter((m) => !m.isLoading),
  }));
  localStorage.setItem(STORAGE_KEY_CONVERSATIONS, JSON.stringify(clean));
}

// --- Hook return type ---

export interface UseAIChatReturn {
  messages: AIMessage[];
  isLoading: boolean;
  error: string | null;
  unreadCount: number;
  sendMessage: (text: string, examId?: number, clarificationReply?: AIClarificationReply) => Promise<void>;
  clearError: () => void;
  markAsRead: () => void;
  conversations: Conversation[];
  activeConversationId: string;
  createConversation: () => void;
  switchConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  clearAllConversations: () => void;
  clearMessages: () => void;
}

export function useAIChat(isWindowOpen: boolean): UseAIChatReturn {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const isWindowOpenRef = useRef(isWindowOpen);
  isWindowOpenRef.current = isWindowOpen;
  const initializedRef = useRef(false);

  const agentContextRef = useRef<Record<string, unknown>>({});
  const conversationIdRef = useRef("");

  const activeConv = conversations.find((c) => c.id === activeConversationId);
  const messages = activeConv?.messages ?? [];

  // --- Sync & persist helper ---

  const syncAndPersist = useCallback(
    (updated: Conversation[]) => {
      // Sync agentContext into active conv
      const synced = updated.map((c) =>
        c.id === activeConversationId
          ? { ...c, agentContext: agentContextRef.current, conversationId: conversationIdRef.current }
          : c
      );
      persistConversations(synced);
      return synced;
    },
    [activeConversationId]
  );

  // --- Init ---

  useEffect(() => {
    const loaded = loadConversations();
    const savedActive = localStorage.getItem(STORAGE_KEY_ACTIVE);
    const validActive = savedActive && loaded.some((c) => c.id === savedActive);
    const activeId = validActive ? savedActive! : loaded[0]?.id ?? "";

    if (loaded.length === 0) {
      const c = makeConversation();
      loaded.push(c);
      setConversations([c]);
      setActiveConversationId(c.id);
      agentContextRef.current = c.agentContext ?? {};
      conversationIdRef.current = c.conversationId ?? generateId();
    } else {
      setConversations(loaded);
      setActiveConversationId(activeId);
      const current = loaded.find((c) => c.id === activeId);
      if (current) {
        agentContextRef.current = current.agentContext ?? {};
        conversationIdRef.current = current.conversationId ?? generateId();
      }
    }
    initializedRef.current = true;
  }, []);

  // Persist active ID
  useEffect(() => {
    if (activeConversationId) {
      localStorage.setItem(STORAGE_KEY_ACTIVE, activeConversationId);
    }
  }, [activeConversationId]);

  // ---- Actions ----

  const markAsRead = useCallback(() => setUnreadCount(0), []);
  const clearError = useCallback(() => setError(null), []);

  const clearMessages = useCallback(() => {
    setConversations((prev) => {
      const updated = prev.map((c) =>
        c.id === activeConversationId ? { ...c, messages: [], title: "", updatedAt: Date.now() } : c
      );
      return syncAndPersist(updated);
    });
  }, [activeConversationId, syncAndPersist]);

  const createConversation = useCallback(() => {
    setConversations((prev) => {
      if (prev.length >= MAX_CONVERSATIONS) return prev;
      const c = makeConversation();
      const next = syncAndPersist([c, ...prev]);
      setActiveConversationId(c.id);
      agentContextRef.current = c.agentContext ?? {};
      conversationIdRef.current = c.conversationId ?? "";
      return next;
    });
  }, [syncAndPersist]);

  const switchConversation = useCallback((id: string) => {
    setConversations((prev) => syncAndPersist(prev));
    setActiveConversationId(id);
    const target = conversations.find((c) => c.id === id);
    agentContextRef.current = target?.agentContext ?? {};
    conversationIdRef.current = target?.conversationId ?? generateId();
  }, [conversations, syncAndPersist]);

  const deleteConversation = useCallback((id: string) => {
    setConversations((prev) => {
      const remaining = prev.filter((c) => c.id !== id);
      if (remaining.length === 0) {
        const c = makeConversation();
        setActiveConversationId(c.id);
        agentContextRef.current = c.agentContext ?? {};
        conversationIdRef.current = c.conversationId ?? "";
        return syncAndPersist([c]);
      }
      if (id === activeConversationId) {
        const target = remaining[0];
        setActiveConversationId(target.id);
        agentContextRef.current = target.agentContext ?? {};
        conversationIdRef.current = target.conversationId ?? "";
      }
      return syncAndPersist(remaining);
    });
  }, [activeConversationId, syncAndPersist]);

  const clearAllConversations = useCallback(() => {
    const c = makeConversation();
    setConversations([c]);
    setActiveConversationId(c.id);
    agentContextRef.current = {};
    conversationIdRef.current = c.conversationId ?? "";
    persistConversations([c]);
  }, []);

  const sendMessage = useCallback(
    async (text: string, examId?: number, clarificationReply?: AIClarificationReply) => {
      setError(null);

      const rateLimitError = checkRateLimit();
      if (rateLimitError) {
        const errMsg: AIMessage = { id: generateId(), role: "assistant", content: rateLimitError, type: "error" };
        setConversations((prev) => {
          const updated = prev.map((c) =>
            c.id === activeConversationId
              ? { ...c, messages: [...c.messages, errMsg], updatedAt: Date.now() }
              : c
          );
          return syncAndPersist(updated);
        });
        setError(rateLimitError);
        return;
      }

      const displayText =
        clarificationReply && clarificationReply.value !== "取消"
          ? `已选择：${clarificationReply.label || clarificationReply.value}`
          : text;

      const userMsg: AIMessage = { id: generateId(), role: "user", content: displayText };
      const loadingMsgId = generateId();
      const loadingMsg: AIMessage = { id: loadingMsgId, role: "assistant", content: "正在查询中...", isLoading: true };

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== activeConversationId) return c;
          const newMessages = [...c.messages, userMsg, loadingMsg];
          const title = c.title || text.slice(0, 20);
          return { ...c, messages: newMessages, title, updatedAt: Date.now() };
        })
      );
      setIsLoading(true);

      try {
        recordRequest();
        const body: Record<string, unknown> = {
          message: clarificationReply && agentContextRef.current.raw_message
            ? (agentContextRef.current.raw_message as string)
            : text,
          conversation_id: conversationIdRef.current,
          context: agentContextRef.current,
        };
        if (clarificationReply) body.clarification_reply = clarificationReply;
        if (examId !== undefined) body.exam_id = examId;

        const response = await api.post<ScoreAgentResponse>("/ai/agent/query/", body);
        if (response.context) agentContextRef.current = response.context as Record<string, unknown>;

        const aiMsg: AIMessage = {
          id: generateId(), role: "assistant",
          content: response.summary || response.message || "",
          type: response.type, status: response.status,
          summary: response.summary, tables: response.tables, evidence: response.evidence,
          questionId: response.question_id, clarificationType: response.clarification_type,
          options: response.options, details: response.details,
          context: response.context, actions: response.actions, fallback: response.fallback,
        };

        setConversations((prev) =>
          syncAndPersist(
            prev.map((c) => {
              if (c.id !== activeConversationId) return c;
              const filtered = c.messages.filter((m) => m.id !== loadingMsgId);
              return { ...c, messages: [...filtered, aiMsg], updatedAt: Date.now() };
            })
          )
        );

        if (!isWindowOpenRef.current) setUnreadCount((prev) => prev + 1);
      } catch {
        const errorMsg: AIMessage = { id: generateId(), role: "assistant", content: "抱歉，查询失败了，请稍后重试。", type: "error" };
        setConversations((prev) =>
          syncAndPersist(
            prev.map((c) => {
              if (c.id !== activeConversationId) return c;
              const filtered = c.messages.filter((m) => m.id !== loadingMsgId);
              return { ...c, messages: [...filtered, errorMsg], updatedAt: Date.now() };
            })
          )
        );
        setError("抱歉，查询失败了，请稍后重试。");
      } finally {
        setIsLoading(false);
      }
    },
    [activeConversationId, syncAndPersist]
  );

  return {
    messages, isLoading, error, unreadCount,
    sendMessage, clearError, markAsRead,
    conversations, activeConversationId,
    createConversation, switchConversation, deleteConversation,
    clearAllConversations, clearMessages,
  };
}

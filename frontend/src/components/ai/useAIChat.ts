"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import type { AIMessage } from "./AIMessageBubble";

// --- API response types ---

interface AIQueryResponse {
  success: boolean;
  answer: string;
  data: Record<string, unknown> | null;
  status:
    | "success"
    | "ambiguous"
    | "student_not_found"
    | "subject_not_found"
    | "insufficient_data"
    | "permission_denied"
    | "irrelevant"
    | "plan_error";
  requires_disambiguation?: boolean;
  candidates?: Array<{
    exam_id: number;
    name: string;
    date: string;
    academic_year: string;
  }>;
}

// --- Storage keys ---

const STORAGE_KEY_CHAT = "ai-chat-history";
const STORAGE_KEY_TIMESTAMPS = "ai-request-timestamps";
const STORAGE_KEY_DAILY = "ai-daily-usage";

const RATE_LIMIT_PER_MINUTE = 3;
const RATE_LIMIT_PER_DAY = 50;

// --- Rate limiting helpers ---

function checkRateLimit(): string | null {
  const now = Date.now();

  // Per-minute check
  const timestampsRaw = localStorage.getItem(STORAGE_KEY_TIMESTAMPS);
  let timestamps: number[] = timestampsRaw ? JSON.parse(timestampsRaw) : [];
  timestamps = timestamps.filter((t) => now - t < 60_000);
  if (timestamps.length >= RATE_LIMIT_PER_MINUTE) {
    return "查询太频繁，请稍后再试";
  }

  // Per-day check
  const today = new Date().toDateString();
  const dailyRaw = localStorage.getItem(STORAGE_KEY_DAILY);
  let daily: { date: string; count: number } = dailyRaw
    ? JSON.parse(dailyRaw)
    : { date: today, count: 0 };
  if (daily.date !== today) {
    daily = { date: today, count: 0 };
  }
  if (daily.count >= RATE_LIMIT_PER_DAY) {
    return "今日查询次数已达上限";
  }

  return null;
}

function recordRequest(): void {
  const now = Date.now();

  // Update per-minute timestamps
  const timestampsRaw = localStorage.getItem(STORAGE_KEY_TIMESTAMPS);
  let timestamps: number[] = timestampsRaw ? JSON.parse(timestampsRaw) : [];
  timestamps = timestamps.filter((t) => now - t < 60_000);
  timestamps.push(now);
  localStorage.setItem(STORAGE_KEY_TIMESTAMPS, JSON.stringify(timestamps));

  // Update per-day count
  const today = new Date().toDateString();
  const dailyRaw = localStorage.getItem(STORAGE_KEY_DAILY);
  let daily: { date: string; count: number } = dailyRaw
    ? JSON.parse(dailyRaw)
    : { date: today, count: 0 };
  if (daily.date !== today) {
    daily = { date: today, count: 0 };
  }
  daily.count += 1;
  localStorage.setItem(STORAGE_KEY_DAILY, JSON.stringify(daily));
}

// --- Chat persistence helpers ---

function loadMessages(): AIMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CHAT);
    if (!raw) return [];
    const messages: AIMessage[] = JSON.parse(raw);
    // Strip any stale loading messages that might have been persisted
    return messages.filter((m) => !m.isLoading);
  } catch {
    return [];
  }
}

function persistMessages(messages: AIMessage[]): void {
  // Never persist loading-placeholder messages
  const toPersist = messages.filter((m) => !m.isLoading);
  localStorage.setItem(STORAGE_KEY_CHAT, JSON.stringify(toPersist));
}

// --- Hook return type ---

export interface UseAIChatReturn {
  messages: AIMessage[];
  isLoading: boolean;
  error: string | null;
  unreadCount: number;
  sendMessage: (text: string, examId?: number) => Promise<void>;
  clearMessages: () => void;
  markAsRead: () => void;
  clearError: () => void;
}

export function useAIChat(isWindowOpen: boolean): UseAIChatReturn {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Keep a mutable ref so the async callback always reads the latest window state
  const isWindowOpenRef = useRef(isWindowOpen);
  isWindowOpenRef.current = isWindowOpen;

  // Track whether initial load has happened (avoid overwriting persisted data)
  const initializedRef = useRef(false);

  // Load persisted messages on mount (client-side only)
  useEffect(() => {
    setMessages(loadMessages());
    initializedRef.current = true;
  }, []);

  // Persist messages on every change (skip the initial mount to avoid clearing)
  useEffect(() => {
    if (!initializedRef.current) return;
    persistMessages(messages);
  }, [messages]);

  // --- Actions ---

  const markAsRead = useCallback(() => {
    setUnreadCount(0);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY_CHAT);
    setUnreadCount(0);
  }, []);

  const sendMessage = useCallback(
    async (text: string, examId?: number) => {
      // Clear previous error
      setError(null);

      // Rate limit check
      const rateLimitError = checkRateLimit();
      if (rateLimitError) {
        const errMsg: AIMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: rateLimitError,
        };
        setMessages((prev) => [...prev, errMsg]);
        setError(rateLimitError);
        return;
      }

      // 1) Append user message
      const userMsg: AIMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
      };
      setMessages((prev) => [...prev, userMsg]);

      // 2) Append loading placeholder
      const loadingMsgId = crypto.randomUUID();
      const loadingMsg: AIMessage = {
        id: loadingMsgId,
        role: "assistant",
        content: "正在查询中...",
        isLoading: true,
      };
      setMessages((prev) => [...prev, loadingMsg]);
      setIsLoading(true);

      try {
        // Record the request before the API call
        recordRequest();

        // Build request body
        const body: Record<string, unknown> = { question: text };
        if (examId !== undefined) {
          body.exam_id = examId;
        }

        const response = await api.post<AIQueryResponse>(
          "/ai/query/",
          body
        );

        // DEBUG: log disambiguation responses
        if (response.status === "ambiguous" || response.requires_disambiguation) {
          console.log("[useAIChat] Disambiguation response:", {
            status: response.status,
            requires_disambiguation: response.requires_disambiguation,
            candidatesCount: response.candidates?.length ?? 0,
            candidates: response.candidates,
          });
        }

        // 3) Replace loading placeholder with real AI response
        const aiMsg: AIMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response.answer,
          status: response.status,
          data: response.data,
          candidates: response.candidates,
        };
        setMessages((prev) =>
          prev.map((m) => (m.id === loadingMsgId ? aiMsg : m))
        );

        // If the window is closed, increment unread badge
        if (!isWindowOpenRef.current) {
          setUnreadCount((prev) => prev + 1);
        }
      } catch {
        // 4) Replace loading placeholder with error message
        const errorMsg: AIMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "抱歉，查询失败了，请稍后重试。",
        };
        setMessages((prev) =>
          prev.map((m) => (m.id === loadingMsgId ? errorMsg : m))
        );
        setError("抱歉，查询失败了，请稍后重试。");
      } finally {
        setIsLoading(false);
      }
    },
    // isWindowOpenRef is a ref, so it doesn't need to be in deps
    []
  );

  return {
    messages,
    isLoading,
    error,
    unreadCount,
    sendMessage,
    clearMessages,
    markAsRead,
    clearError,
  };
}

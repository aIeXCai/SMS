import { renderHook, act } from "@testing-library/react/pure";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock api BEFORE any imports that use it
vi.mock("@/lib/api", () => ({
  api: {
    post: vi.fn(),
  },
}));

import { api } from "@/lib/api";
import { useAIChat } from "./useAIChat";

// --- Storage keys (must match the module under test) ---
const STORAGE_KEY_CHAT = "ai-chat-history";
const STORAGE_KEY_TIMESTAMPS = "ai-request-timestamps";
const STORAGE_KEY_DAILY = "ai-daily-usage";

// --- Helpers ---
function clearStorage() {
  localStorage.clear();
}

function setStorage(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

const mockSuccessResponse = {
  success: true,
  answer: "张三的数学成绩最近有所提升，从上次的85分提升到了92分。",
  data: { student_name: "张三" },
  status: "success" as const,
};

const mockAmbiguousResponse = {
  success: true,
  answer: "请选择具体哪次考试",
  data: null,
  status: "ambiguous" as const,
  requires_disambiguation: true,
  candidates: [
    { exam_id: 1, name: "期中考试", date: "2025-11-20", academic_year: "2025-2026" },
    { exam_id: 2, name: "期末考试", date: "2026-01-15", academic_year: "2025-2026" },
  ],
};

describe("useAIChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearStorage();
  });

  // ================================================================
  // AC1: sendMessage(text) sends request to /api/ai/query/
  // ================================================================
  describe("AC1 - sendMessage sends request to /api/ai/query/", () => {
    it("should call api.post with correct path and question body", async () => {
      vi.mocked(api.post).mockResolvedValueOnce(mockSuccessResponse);

      const { result } = renderHook(() => useAIChat(true));

      await act(async () => {
        await result.current.sendMessage("张三的数学成绩怎么样？");
      });

      expect(api.post).toHaveBeenCalledTimes(1);
      expect(api.post).toHaveBeenCalledWith("/ai/query/", {
        question: "张三的数学成绩怎么样？",
      });
    });

    it("should prepend user message to messages list", async () => {
      vi.mocked(api.post).mockResolvedValueOnce(mockSuccessResponse);

      const { result } = renderHook(() => useAIChat(true));

      await act(async () => {
        await result.current.sendMessage("hello");
      });

      // User message + AI reply (loading already replaced)
      expect(result.current.messages.length).toBeGreaterThanOrEqual(2);
      expect(result.current.messages[0].role).toBe("user");
      expect(result.current.messages[0].content).toBe("hello");
    });
  });

  // ================================================================
  // AC2: During request, shows "正在查询中..." and input disabled
  // ================================================================
  describe("AC2 - loading state during request", () => {
    it("should set isLoading=true while request is pending", async () => {
      // Use a deferred promise so we can inspect intermediate state
      let resolvePost: (value: typeof mockSuccessResponse) => void;
      const deferred = new Promise<typeof mockSuccessResponse>((resolve) => {
        resolvePost = resolve;
      });
      vi.mocked(api.post).mockReturnValueOnce(deferred);

      const { result } = renderHook(() => useAIChat(true));

      // Start sending — don't await yet
      let sendPromise: Promise<void>;
      await act(async () => {
        sendPromise = result.current.sendMessage("test");
      });

      // Loading placeholder should exist
      const loadingMessages = result.current.messages.filter((m) => m.isLoading);
      expect(loadingMessages.length).toBe(1);
      expect(loadingMessages[0].content).toBe("正在查询中...");
      expect(result.current.isLoading).toBe(true);

      // Resolve
      await act(async () => {
        resolvePost!(mockSuccessResponse);
        await sendPromise!;
      });

      // Loading should be cleared
      expect(result.current.isLoading).toBe(false);
      const stillLoading = result.current.messages.filter((m) => m.isLoading);
      expect(stillLoading.length).toBe(0);
    });
  });

  // ================================================================
  // AC3: After response, replace loading placeholder with real AI reply
  // ================================================================
  describe("AC3 - replace loading with real AI reply", () => {
    it("should replace loading placeholder with AI answer after success", async () => {
      vi.mocked(api.post).mockResolvedValueOnce(mockSuccessResponse);

      const { result } = renderHook(() => useAIChat(true));

      await act(async () => {
        await result.current.sendMessage("question");
      });

      // Should have no loading messages
      const loadingMsgs = result.current.messages.filter((m) => m.isLoading);
      expect(loadingMsgs.length).toBe(0);

      // Should have AI message with real content
      const aiMessages = result.current.messages.filter(
        (m) => m.role === "assistant" && !m.isLoading
      );
      expect(aiMessages.length).toBe(1);
      expect(aiMessages[0].content).toBe(mockSuccessResponse.answer);
      expect(aiMessages[0].status).toBe("success");
    });

    it("should include data and candidates in AI message when present", async () => {
      vi.mocked(api.post).mockResolvedValueOnce(mockAmbiguousResponse);

      const { result } = renderHook(() => useAIChat(true));

      await act(async () => {
        await result.current.sendMessage("分析张三的成绩");
      });

      const aiMsg = result.current.messages.find(
        (m) => m.role === "assistant" && !m.isLoading
      );
      expect(aiMsg).toBeDefined();
      expect(aiMsg!.status).toBe("ambiguous");
      expect(aiMsg!.candidates).toHaveLength(2);
      expect(aiMsg!.candidates![0].exam_id).toBe(1);
    });
  });

  // ================================================================
  // AC4: Messages persist via localStorage, restore on refresh (filter isLoading)
  // ================================================================
  describe("AC4 - localStorage persistence", () => {
    it("should save messages to localStorage (excluding isLoading placeholders)", async () => {
      vi.mocked(api.post).mockResolvedValueOnce(mockSuccessResponse);

      const { result } = renderHook(() => useAIChat(true));

      await act(async () => {
        await result.current.sendMessage("hello");
      });

      // Check localStorage has the messages
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY_CHAT)!);
      expect(stored).toBeDefined();
      expect(stored.length).toBeGreaterThanOrEqual(2);
      // No loading messages in storage
      const loadingInStorage = stored.filter(
        (m: { isLoading?: boolean }) => m.isLoading
      );
      expect(loadingInStorage.length).toBe(0);
    });

    it("should load messages from localStorage on mount", () => {
      const persistedMessages = [
        { id: "msg-1", role: "user", content: "previous question" },
        {
          id: "msg-2",
          role: "assistant",
          content: "previous answer",
          status: "success",
        },
        // Should be filtered out on load
        {
          id: "msg-3",
          role: "assistant",
          content: "正在查询中...",
          isLoading: true,
        },
      ];
      setStorage(STORAGE_KEY_CHAT, persistedMessages);

      const { result } = renderHook(() => useAIChat(true));

      const loaded = result.current.messages;
      expect(loaded.length).toBe(2);
      expect(loaded[0].content).toBe("previous question");
      expect(loaded[1].content).toBe("previous answer");
      // Ensure no loading messages survived
      const loadingMsgs = loaded.filter((m) => m.isLoading);
      expect(loadingMsgs.length).toBe(0);
    });

    it("should return empty array when localStorage is empty", () => {
      const { result } = renderHook(() => useAIChat(true));
      expect(result.current.messages).toEqual([]);
    });

    it("should clear localStorage when clearMessages is called", async () => {
      vi.mocked(api.post).mockResolvedValueOnce(mockSuccessResponse);
      const { result } = renderHook(() => useAIChat(true));

      await act(async () => {
        await result.current.sendMessage("hello");
      });

      // Should have saved to localStorage
      expect(localStorage.getItem(STORAGE_KEY_CHAT)).toBeTruthy();

      await act(async () => {
        result.current.clearMessages();
      });

      // After clearMessages + persist effect, key stores "[]" (not null)
      expect(localStorage.getItem(STORAGE_KEY_CHAT)).toBe("[]");
      expect(result.current.messages).toEqual([]);
    });

    it("should handle corrupted localStorage gracefully", () => {
      localStorage.setItem(STORAGE_KEY_CHAT, "not-valid-json{{{");

      const { result } = renderHook(() => useAIChat(true));
      expect(result.current.messages).toEqual([]);
    });
  });

  // ================================================================
  // AC5: Over 3/min → rate limit prompt
  // ================================================================
  describe("AC5 - per-minute rate limit (>3/min)", () => {
    it("should show rate limit message when >3 requests in a minute", async () => {
      const now = Date.now();
      const timestamps = [now - 30000, now - 20000, now - 10000]; // 3 recent timestamps
      setStorage(STORAGE_KEY_TIMESTAMPS, timestamps);

      const { result } = renderHook(() => useAIChat(true));

      await act(async () => {
        await result.current.sendMessage("another query");
      });

      // Should NOT call API
      expect(api.post).not.toHaveBeenCalled();

      // Should show rate limit error
      expect(result.current.error).toBe("查询太频繁，请稍后再试");

      // Should have rate limit message appended
      const rateLimitMsg = result.current.messages.find(
        (m) => m.content === "查询太频繁，请稍后再试"
      );
      expect(rateLimitMsg).toBeDefined();
    });

    it("should allow requests when less than 3 in a minute", async () => {
      const now = Date.now();
      const timestamps = [now - 30000]; // only 1 recent timestamp
      setStorage(STORAGE_KEY_TIMESTAMPS, timestamps);
      vi.mocked(api.post).mockResolvedValueOnce(mockSuccessResponse);

      const { result } = renderHook(() => useAIChat(true));

      await act(async () => {
        await result.current.sendMessage("valid query");
      });

      expect(api.post).toHaveBeenCalledTimes(1);
      expect(result.current.error).toBeNull();
    });

    it("should expire old timestamps (>60s) from the rate limit check", async () => {
      const now = Date.now();
      const timestamps = [
        now - 120000, // 2 min ago — expired
        now - 110000, // 1 min 50s ago — expired
        now - 90000, // 1 min 30s ago — expired
      ]; // All expired, so effectively 0 recent
      setStorage(STORAGE_KEY_TIMESTAMPS, timestamps);
      vi.mocked(api.post).mockResolvedValueOnce(mockSuccessResponse);

      const { result } = renderHook(() => useAIChat(true));

      await act(async () => {
        await result.current.sendMessage("valid query");
      });

      // All old timestamps expired → should pass rate limit
      expect(api.post).toHaveBeenCalledTimes(1);
    });
  });

  // ================================================================
  // AC6: Over 50/day → rate limit prompt
  // ================================================================
  describe("AC6 - per-day rate limit (>50/day)", () => {
    it("should show rate limit message when daily count >= 50", async () => {
      const today = new Date().toDateString();
      setStorage(STORAGE_KEY_DAILY, { date: today, count: 50 });

      const { result } = renderHook(() => useAIChat(true));

      await act(async () => {
        await result.current.sendMessage("query");
      });

      expect(api.post).not.toHaveBeenCalled();
      expect(result.current.error).toBe("今日查询次数已达上限");
    });

    it("should allow request when daily count < 50", async () => {
      const today = new Date().toDateString();
      setStorage(STORAGE_KEY_DAILY, { date: today, count: 49 });
      vi.mocked(api.post).mockResolvedValueOnce(mockSuccessResponse);

      const { result } = renderHook(() => useAIChat(true));

      await act(async () => {
        await result.current.sendMessage("query");
      });

      expect(api.post).toHaveBeenCalledTimes(1);
      expect(result.current.error).toBeNull();
    });

    it("should reset daily count when date changes", async () => {
      setStorage(STORAGE_KEY_DAILY, {
        date: "Tue Jan 01 2025",
        count: 50, // old day
      });
      vi.mocked(api.post).mockResolvedValueOnce(mockSuccessResponse);

      const { result } = renderHook(() => useAIChat(true));

      await act(async () => {
        await result.current.sendMessage("query");
      });

      // Date is different → count reset → should pass
      expect(api.post).toHaveBeenCalledTimes(1);
    });
  });

  // ================================================================
  // AC7: Request failure → error prompt
  // ================================================================
  describe("AC7 - request failure shows error", () => {
    it("should show error message and replace loading placeholder on failure", async () => {
      vi.mocked(api.post).mockRejectedValueOnce(new Error("Network Error"));

      const { result } = renderHook(() => useAIChat(true));

      await act(async () => {
        await result.current.sendMessage("query that fails");
      });

      expect(result.current.error).toBe("抱歉，查询失败了，请稍后重试。");
      expect(result.current.isLoading).toBe(false);

      // Should have error message as assistant response (no loading placeholder)
      const errorMsgs = result.current.messages.filter(
        (m) => m.content === "抱歉，查询失败了，请稍后重试。"
      );
      expect(errorMsgs.length).toBe(1);
      expect(errorMsgs[0].role).toBe("assistant");

      // No loading messages
      const loadingMsgs = result.current.messages.filter((m) => m.isLoading);
      expect(loadingMsgs.length).toBe(0);
    });

    it("should clear previous error on new sendMessage attempt", async () => {
      vi.mocked(api.post).mockRejectedValueOnce(new Error("Fail"));
      const { result } = renderHook(() => useAIChat(true));

      // First call fails
      await act(async () => {
        await result.current.sendMessage("first");
      });
      expect(result.current.error).toBe("抱歉，查询失败了，请稍后重试。");

      // Second call succeeds (but rate-limit is tripped by timestamps... let's clear them)
      clearStorage();
      vi.mocked(api.post).mockResolvedValueOnce(mockSuccessResponse);

      await act(async () => {
        await result.current.sendMessage("second");
      });

      // Error should be cleared
      expect(result.current.error).toBeNull();
    });

    it("should call clearError to manually clear error", () => {
      const { result } = renderHook(() => useAIChat(true));
      // error starts null
      expect(result.current.error).toBeNull();
      // We can still call clearError without issues
      act(() => {
        result.current.clearError();
      });
      expect(result.current.error).toBeNull();
    });
  });

  // ================================================================
  // AC8: Window closed when new reply arrives → red dot (unreadCount)
  // ================================================================
  describe("AC8 - unread badge when window closed", () => {
    it("should increment unreadCount when reply arrives with window closed", async () => {
      vi.mocked(api.post).mockResolvedValueOnce(mockSuccessResponse);

      // Window is CLOSED
      const { result } = renderHook(() => useAIChat(false));

      expect(result.current.unreadCount).toBe(0);

      await act(async () => {
        await result.current.sendMessage("query while closed");
      });

      expect(result.current.unreadCount).toBe(1);
    });

    it("should NOT increment unreadCount when reply arrives with window open", async () => {
      vi.mocked(api.post).mockResolvedValueOnce(mockSuccessResponse);

      // Window is OPEN
      const { result } = renderHook(() => useAIChat(true));

      await act(async () => {
        await result.current.sendMessage("query while open");
      });

      expect(result.current.unreadCount).toBe(0);
    });

    it("should reset unreadCount to 0 when markAsRead is called", async () => {
      vi.mocked(api.post).mockResolvedValueOnce(mockSuccessResponse);

      const { result } = renderHook(() => useAIChat(false));

      await act(async () => {
        await result.current.sendMessage("query while closed");
      });

      expect(result.current.unreadCount).toBe(1);

      await act(async () => {
        result.current.markAsRead();
      });

      expect(result.current.unreadCount).toBe(0);
    });
  });

  // ================================================================
  // AC9: After disambiguation, supports exam_id re-query
  // ================================================================
  describe("AC9 - exam_id disambiguation re-query", () => {
    it("should send exam_id in request body when provided", async () => {
      vi.mocked(api.post).mockResolvedValueOnce(mockSuccessResponse);

      const { result } = renderHook(() => useAIChat(true));

      await act(async () => {
        await result.current.sendMessage("分析张三的数学成绩", 42);
      });

      expect(api.post).toHaveBeenCalledWith("/ai/query/", {
        question: "分析张三的数学成绩",
        exam_id: 42,
      });
    });

    it("should NOT send exam_id when not provided", async () => {
      vi.mocked(api.post).mockResolvedValueOnce(mockSuccessResponse);

      const { result } = renderHook(() => useAIChat(true));

      await act(async () => {
        await result.current.sendMessage("general question");
      });

      const callArgs = vi.mocked(api.post).mock.calls[0][1] as Record<string, unknown>;
      expect(callArgs).not.toHaveProperty("exam_id");
      expect(callArgs).toEqual({ question: "general question" });
    });

    it("should handle disambiguation candidates from response", async () => {
      vi.mocked(api.post).mockResolvedValueOnce(mockAmbiguousResponse);

      const { result } = renderHook(() => useAIChat(true));

      await act(async () => {
        await result.current.sendMessage("分析张三的成绩");
      });

      const aiMsg = result.current.messages.find(
        (m) => m.role === "assistant" && !m.isLoading
      );
      expect(aiMsg).toBeDefined();
      expect(aiMsg!.status).toBe("ambiguous");
      expect(aiMsg!.candidates).toBeDefined();
      expect(aiMsg!.candidates!.length).toBe(2);

      // Now query with a specific exam_id
      vi.mocked(api.post).mockResolvedValueOnce(mockSuccessResponse);

      await act(async () => {
        await result.current.sendMessage(
          "分析张三的成绩",
          aiMsg!.candidates![0].exam_id
        );
      });

      expect(api.post).toHaveBeenLastCalledWith("/ai/query/", {
        question: "分析张三的成绩",
        exam_id: 1,
      });
    });
  });

  // ================================================================
  // Edge cases
  // ================================================================
  describe("Edge cases", () => {
    it("should record request timestamps after successful API call", async () => {
      vi.mocked(api.post).mockResolvedValueOnce(mockSuccessResponse);

      const { result } = renderHook(() => useAIChat(true));

      await act(async () => {
        await result.current.sendMessage("test");
      });

      const ts = JSON.parse(localStorage.getItem(STORAGE_KEY_TIMESTAMPS)!);
      expect(ts.length).toBe(1);

      const daily = JSON.parse(localStorage.getItem(STORAGE_KEY_DAILY)!);
      expect(daily.count).toBe(1);
      expect(daily.date).toBe(new Date().toDateString());
    });

    it("should NOT record timestamps when rate-limited", async () => {
      const today = new Date().toDateString();
      setStorage(STORAGE_KEY_DAILY, { date: today, count: 50 });

      const { result } = renderHook(() => useAIChat(true));

      await act(async () => {
        await result.current.sendMessage("blocked");
      });

      // Daily count should remain 50 (not incremented)
      const daily = JSON.parse(localStorage.getItem(STORAGE_KEY_DAILY)!);
      expect(daily.count).toBe(50);

      // No new timestamp recorded
      const ts = JSON.parse(
        localStorage.getItem(STORAGE_KEY_TIMESTAMPS) || "[]"
      );
      expect(ts.length).toBe(0);
    });

    it("should handle consecutive queries correctly", async () => {
      vi.mocked(api.post)
        .mockResolvedValueOnce(mockSuccessResponse)
        .mockResolvedValueOnce({
          ...mockSuccessResponse,
          answer: "Second answer",
        });

      const { result } = renderHook(() => useAIChat(true));

      await act(async () => {
        await result.current.sendMessage("first");
      });

      await act(async () => {
        await result.current.sendMessage("second");
      });

      // Total messages: user1, ai1, user2, ai2 = 4 non-loading messages
      const nonLoading = result.current.messages.filter((m) => !m.isLoading);
      expect(nonLoading.length).toBe(4);
      expect(nonLoading[0].content).toBe("first");
      expect(nonLoading[2].content).toBe("second");
      expect(nonLoading[3].content).toBe("Second answer");
    });

    it("should return correct UseAIChatReturn shape", () => {
      const { result } = renderHook(() => useAIChat(true));

      expect(result.current).toHaveProperty("messages");
      expect(result.current).toHaveProperty("isLoading");
      expect(result.current).toHaveProperty("error");
      expect(result.current).toHaveProperty("unreadCount");
      expect(result.current).toHaveProperty("sendMessage");
      expect(result.current).toHaveProperty("clearMessages");
      expect(result.current).toHaveProperty("markAsRead");
      expect(result.current).toHaveProperty("clearError");

      expect(Array.isArray(result.current.messages)).toBe(true);
      expect(typeof result.current.sendMessage).toBe("function");
      expect(typeof result.current.clearMessages).toBe("function");
      expect(typeof result.current.markAsRead).toBe("function");
      expect(typeof result.current.clearError).toBe("function");
    });
  });
});

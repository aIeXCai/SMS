import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Create controllable mock functions via hoisting
const { mockSendMessage, mockMarkAsRead, mockUseAIChat } = vi.hoisted(() => ({
  mockSendMessage: vi.fn(),
  mockMarkAsRead: vi.fn(),
  mockUseAIChat: vi.fn((_isOpen: boolean) => ({
    messages: [
      { id: "1", role: "user", content: "张三的数学成绩怎么样？" },
      { id: "2", role: "assistant", content: "请选择考试", status: "ambiguous" },
    ],
    isLoading: false,
    unreadCount: 0,
    sendMessage: mockSendMessage,
    markAsRead: mockMarkAsRead,
    error: null,
    clearMessages: vi.fn(),
    clearError: vi.fn(),
  })),
}));

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/dashboard"),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(() => ({
    user: { role: "teacher" },
    loading: false,
  })),
}));

vi.mock("@/components/Sidebar", () => ({
  Sidebar: ({
    isOpen,
    onClose,
  }: {
    isOpen: boolean;
    onClose: () => void;
  }) => (
    <div data-testid="mock-sidebar" data-open={isOpen}>
      <button onClick={onClose}>Close sidebar</button>
    </div>
  ),
}));

vi.mock("@/components/ai", () => ({
  FloatingAIButton: ({
    onClick,
    isOpen,
    hasUnread,
  }: {
    onClick: () => void;
    isOpen: boolean;
    hasUnread?: boolean;
  }) => (
    <button
      data-testid="floating-ai-button"
      data-open={isOpen}
      data-unread={hasUnread}
      onClick={onClick}
    >
      AI Button
    </button>
  ),
  AIChatWindow: ({
    isOpen,
    onClose,
    onDisambiguationSelect,
    welcomeQuestions,
  }: {
    isOpen: boolean;
    onClose: () => void;
    messages: unknown[];
    isLoading: boolean;
    onSendMessage: (content: string, examId?: number) => void;
    welcomeQuestions?: string[];
    onDisambiguationSelect?: (examId: number) => void;
    onSubjectTagClick?: (subject: string) => void;
  }) => (
    <div
      data-testid="ai-chat-window"
      data-open={isOpen}
      data-disambiguation-handler={String(!!onDisambiguationSelect)}
    >
      <button data-testid="close-ai" onClick={onClose}>Close</button>
      {welcomeQuestions?.map((q, i) => (
        <button key={i} data-testid={`welcome-q-${i}`}>
          {q}
        </button>
      ))}
    </div>
  ),
  useAIChat: mockUseAIChat,
}));

import { AppShell } from "./AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { usePathname } from "next/navigation";

describe("AppShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePathname).mockReturnValue("/dashboard");
    vi.mocked(useAuth).mockReturnValue({
      user: { role: "teacher" } as { role: string },
      loading: false,
      token: "mock-token",
    } as ReturnType<typeof useAuth>);
    // Reset useAIChat to default
    mockUseAIChat.mockImplementation((_isOpen: boolean) => ({
      messages: [
        { id: "1", role: "user", content: "张三的数学成绩怎么样？" },
        { id: "2", role: "assistant", content: "请选择考试", status: "ambiguous" },
      ],
      isLoading: false,
      unreadCount: 0,
      sendMessage: mockSendMessage,
      markAsRead: mockMarkAsRead,
      error: null,
      clearMessages: vi.fn(),
      clearError: vi.fn(),
    }));
  });

  // ================================================================
  // Login page bypass
  // ================================================================
  it("should render children directly on login page without shell", () => {
    vi.mocked(usePathname).mockReturnValue("/login");
    render(
      <AppShell>
        <div data-testid="login-content">Login Form</div>
      </AppShell>
    );

    expect(screen.getByTestId("login-content")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-sidebar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("floating-ai-button")).not.toBeInTheDocument();
  });

  // ================================================================
  // Non-login page: renders children in shell
  // ================================================================
  it("should render children inside main wrapper on non-login pages", () => {
    render(
      <AppShell>
        <div data-testid="page-content">Dashboard Content</div>
      </AppShell>
    );

    expect(screen.getByTestId("page-content")).toBeInTheDocument();
    expect(screen.getByTestId("mock-sidebar")).toBeInTheDocument();
  });

  // ================================================================
  // AI visibility: shown for non-admin
  // ================================================================
  describe("AI visibility based on role", () => {
    it("should show FloatingAIButton and AIChatWindow for teacher role", () => {
      vi.mocked(useAuth).mockReturnValue({
        user: { role: "teacher" } as { role: string },
        loading: false,
        token: "mock-token",
      } as ReturnType<typeof useAuth>);

      render(
        <AppShell>
          <div>Content</div>
        </AppShell>
      );

      expect(screen.getByTestId("floating-ai-button")).toBeInTheDocument();
      expect(screen.getByTestId("ai-chat-window")).toBeInTheDocument();
    });

    it("should show FloatingAIButton and AIChatWindow for student role", () => {
      vi.mocked(useAuth).mockReturnValue({
        user: { role: "student" } as { role: string },
        loading: false,
        token: "mock-token",
      } as ReturnType<typeof useAuth>);

      render(
        <AppShell>
          <div>Content</div>
        </AppShell>
      );

      expect(screen.getByTestId("floating-ai-button")).toBeInTheDocument();
      expect(screen.getByTestId("ai-chat-window")).toBeInTheDocument();
    });

    it("should hide AI components for admin role", () => {
      vi.mocked(useAuth).mockReturnValue({
        user: { role: "admin" } as { role: string },
        loading: false,
        token: "mock-token",
      } as ReturnType<typeof useAuth>);

      render(
        <AppShell>
          <div>Content</div>
        </AppShell>
      );

      expect(screen.queryByTestId("floating-ai-button")).not.toBeInTheDocument();
      expect(screen.queryByTestId("ai-chat-window")).not.toBeInTheDocument();
    });
  });

  // ================================================================
  // AI toggle
  // ================================================================
  it("should toggle AI chat window when floating button is clicked", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { role: "teacher" } as { role: string },
      loading: false,
      token: "mock-token",
    } as ReturnType<typeof useAuth>);

    render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    const aiButton = screen.getByTestId("floating-ai-button");
    expect(aiButton.getAttribute("data-open")).toBe("false");
    fireEvent.click(aiButton);
    expect(aiButton.getAttribute("data-open")).toBe("true");
    fireEvent.click(aiButton);
    expect(aiButton.getAttribute("data-open")).toBe("false");
  });

  // ================================================================
  // disambiguation wiring: verify handler is wired to AIChatWindow
  // ================================================================
  it("should wire onDisambiguationSelect to AIChatWindow", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { role: "teacher" } as { role: string },
      loading: false,
      token: "mock-token",
    } as ReturnType<typeof useAuth>);

    mockUseAIChat.mockReturnValue({
      messages: [
        { id: "1", role: "user", content: "分析张三的成绩" },
        {
          id: "2",
          role: "assistant",
          content: "请选择考试",
          status: "ambiguous",
          candidates: [
            {
              exam_id: 42,
              name: "期中考试",
              date: "2025-11-20",
              academic_year: "2025-2026",
            },
          ],
        },
      ],
      isLoading: false,
      unreadCount: 0,
      sendMessage: mockSendMessage,
      markAsRead: mockMarkAsRead,
      error: null,
      clearMessages: vi.fn(),
      clearError: vi.fn(),
    });

    render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    // Verify disambiguation handler is wired to AIChatWindow
    const chatWindow = screen.getByTestId("ai-chat-window");
    expect(chatWindow.getAttribute("data-disambiguation-handler")).toBe("true");
  });

  // ================================================================
  // markAsRead on open
  // ================================================================
  it("should call markAsRead when opening the AI window", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { role: "teacher" } as { role: string },
      loading: false,
      token: "mock-token",
    } as ReturnType<typeof useAuth>);

    render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    const aiButton = screen.getByTestId("floating-ai-button");
    fireEvent.click(aiButton); // Open
    expect(mockMarkAsRead).toHaveBeenCalledTimes(1);
  });

  it("should NOT call markAsRead when closing the AI window", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { role: "teacher" } as { role: string },
      loading: false,
      token: "mock-token",
    } as ReturnType<typeof useAuth>);

    render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    const aiButton = screen.getByTestId("floating-ai-button");
    fireEvent.click(aiButton); // Open
    expect(mockMarkAsRead).toHaveBeenCalledTimes(1);
    mockMarkAsRead.mockClear();

    fireEvent.click(aiButton); // Close
    expect(mockMarkAsRead).not.toHaveBeenCalled();
  });

  // ================================================================
  // Welcome questions passed to AIChatWindow
  // ================================================================
  it("should pass welcome questions to AIChatWindow", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { role: "teacher" } as { role: string },
      loading: false,
      token: "mock-token",
    } as ReturnType<typeof useAuth>);

    render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    expect(screen.getByTestId("welcome-q-0")).toHaveTextContent(
      "张三的数学成绩最近有什么变化？"
    );
    expect(screen.getByTestId("welcome-q-1")).toHaveTextContent(
      "初三年级本次考试的平均分是多少？"
    );
    expect(screen.getByTestId("welcome-q-2")).toHaveTextContent(
      "帮我对比一班和二班的英语成绩"
    );
  });
});

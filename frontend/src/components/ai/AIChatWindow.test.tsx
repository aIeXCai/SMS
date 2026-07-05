import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AIChatWindow } from "./AIChatWindow";
import type { AIMessage } from "./AIMessageBubble";

// Mock AIInputBar (we test it separately or via integration)
vi.mock("./AIInputBar", () => ({
  AIInputBar: ({
    onSend,
    disabled,
    placeholder,
  }: {
    onSend: (content: string) => void;
    disabled?: boolean;
    placeholder?: string;
  }) => (
    <div data-testid="mock-input-bar">
      <input
        data-testid="mock-input"
        placeholder={placeholder}
        disabled={disabled}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onSend((e.target as HTMLInputElement).value);
          }
        }}
      />
      <button
        data-testid="mock-send-button"
        disabled={disabled}
        onClick={() => {
          const input = document.querySelector(
            '[data-testid="mock-input"]'
          ) as HTMLInputElement;
          if (input) onSend(input.value);
        }}
      >
        Send
      </button>
    </div>
  ),
}));

describe("AIChatWindow", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    messages: [] as AIMessage[],
    isLoading: false,
    onSendMessage: vi.fn(),
  };

  // --- Visibility ---
  describe("visibility", () => {
    it("should be visible when isOpen=true", () => {
      render(<AIChatWindow {...defaultProps} isOpen={true} />);
      const window = screen.getByText("AI 助手").closest(".fixed");
      expect(window).toBeInTheDocument();
      // When open, right is "24px"
      expect(window?.getAttribute("style")).toContain("right: 24px");
    });

    it("should be hidden when isOpen=false", () => {
      render(<AIChatWindow {...defaultProps} isOpen={false} />);
      const window = screen.getByText("AI 助手").closest(".fixed");
      expect(window?.getAttribute("style")).toContain("right: -440px");
    });

    it("should not respond to pointer events when closed", () => {
      render(<AIChatWindow {...defaultProps} isOpen={false} />);
      const window = screen.getByText("AI 助手").closest(".fixed");
      expect(window?.getAttribute("style")).toContain("pointer-events: none");
    });
  });

  // --- Title ---
  it("should display the title", () => {
    render(<AIChatWindow {...defaultProps} title="自定义标题" />);
    expect(screen.getByText("自定义标题")).toBeInTheDocument();
  });

  it("should default title to AI 助手", () => {
    render(<AIChatWindow {...defaultProps} />);
    expect(screen.getByText("AI 助手")).toBeInTheDocument();
  });

  // --- Close button ---
  it("should call onClose when close/minimize buttons are clicked", () => {
    const onClose = vi.fn();
    render(<AIChatWindow {...defaultProps} onClose={onClose} />);

    const closeButtons = screen.getAllByLabelText(/Minimize chat|Close chat/);
    expect(closeButtons.length).toBe(2);

    fireEvent.click(closeButtons[1]); // Close button
    expect(onClose).toHaveBeenCalled();
  });

  // --- Welcome questions ---
  describe("welcome questions", () => {
    it("should show welcome screen when messages is empty", () => {
      render(
        <AIChatWindow
          {...defaultProps}
          messages={[]}
          welcomeQuestions={["问题1", "问题2"]}
        />
      );

      expect(screen.getByText("您好，我是 AI 助手")).toBeInTheDocument();
      expect(screen.getByText("问题1")).toBeInTheDocument();
      expect(screen.getByText("问题2")).toBeInTheDocument();
    });

    it("should NOT show welcome screen when messages exist", () => {
      const messages: AIMessage[] = [
        { id: "1", role: "user", content: "hello" },
        { id: "2", role: "assistant", content: "hi", status: "success" },
      ];
      render(
        <AIChatWindow
          {...defaultProps}
          messages={messages}
          welcomeQuestions={["问题1"]}
        />
      );

      expect(screen.queryByText("您好，我是 AI 助手")).not.toBeInTheDocument();
      expect(screen.queryByText("问题1")).not.toBeInTheDocument();
    });

    it("should NOT show welcome screen when isLoading even with empty messages", () => {
      render(
        <AIChatWindow
          {...defaultProps}
          messages={[]}
          isLoading={true}
          welcomeQuestions={["问题1"]}
        />
      );

      expect(screen.queryByText("您好，我是 AI 助手")).not.toBeInTheDocument();
    });

    it("should call onSendMessage when a welcome question is clicked", () => {
      const onSendMessage = vi.fn();
      render(
        <AIChatWindow
          {...defaultProps}
          messages={[]}
          onSendMessage={onSendMessage}
          welcomeQuestions={["帮我查询成绩"]}
        />
      );

      fireEvent.click(screen.getByText("帮我查询成绩"));
      expect(onSendMessage).toHaveBeenCalledWith("帮我查询成绩");
    });
  });

  // --- Loading → input disabled ---
  describe("input disabled during loading", () => {
    it("should pass disabled=true to AIInputBar when isLoading=true", () => {
      render(<AIChatWindow {...defaultProps} isLoading={true} />);
      const input = screen.getByTestId("mock-input");
      expect(input).toBeDisabled();
    });

    it("should pass disabled=false to AIInputBar when isLoading=false", () => {
      render(<AIChatWindow {...defaultProps} isLoading={false} />);
      const input = screen.getByTestId("mock-input");
      expect(input).not.toBeDisabled();
    });

    it("should disable send button during loading", () => {
      render(<AIChatWindow {...defaultProps} isLoading={true} />);
      const sendButton = screen.getByTestId("mock-send-button");
      expect(sendButton).toBeDisabled();
    });
  });

  // --- Message rendering ---
  describe("message rendering", () => {
    it("should render messages through AIMessageBubble", () => {
      const messages: AIMessage[] = [
        { id: "1", role: "user", content: "query" },
        { id: "2", role: "assistant", content: "answer", status: "success" },
        {
          id: "3",
          role: "assistant",
          content: "正在查询中...",
          isLoading: true,
        },
      ];
      render(<AIChatWindow {...defaultProps} messages={messages} />);

      expect(screen.getByText("query")).toBeInTheDocument();
      expect(screen.getByText("answer")).toBeInTheDocument();
      expect(screen.getByText("正在查询中...")).toBeInTheDocument();
    });

    it("should render empty message area with no messages and no welcome", () => {
      render(<AIChatWindow {...defaultProps} messages={[]} />);
      // Should not crash and should still render the input bar
      expect(screen.getByTestId("mock-input-bar")).toBeInTheDocument();
    });
  });

  // --- onSendMessage via input ---
  it("should call onSendMessage when input bar sends", () => {
    const onSendMessage = vi.fn();
    render(
      <AIChatWindow {...defaultProps} onSendMessage={onSendMessage} />
    );

    const input = screen.getByTestId("mock-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "test message" } });
    fireEvent.click(screen.getByTestId("mock-send-button"));

    expect(onSendMessage).toHaveBeenCalledWith("test message");
  });

  // --- onDisambiguationSelect pass-through ---
  it("should pass onDisambiguationSelect to AIMessageBubble", () => {
    const onDisambiguationSelect = vi.fn();
    const messages: AIMessage[] = [
      {
        id: "d1",
        role: "assistant",
        content: "Select exam",
        status: "ambiguous",
        candidates: [
          {
            exam_id: 1,
            name: "期中考试",
            date: "2025-11-20",
            academic_year: "2025-2026",
          },
        ],
      },
    ];
    render(
      <AIChatWindow
        {...defaultProps}
        messages={messages}
        onDisambiguationSelect={onDisambiguationSelect}
      />
    );

    // Click the select button rendered by AIDisambiguationCard
    fireEvent.click(screen.getByText("选择"));
    expect(onDisambiguationSelect).toHaveBeenCalledWith(1);
  });

  // --- onSubjectTagClick wiring ---
  it("should provide onSubjectTagClick callback to AIMessageBubble", () => {
    const onSubjectTagClick = vi.fn();
    const messages: AIMessage[] = [
      {
        id: "s1",
        role: "assistant",
        content: "Subject not found",
        status: "subject_not_found",
        data: {
          available_subjects: [
            { subject: "语文", count: 3 },
          ],
        },
      },
    ];
    render(
      <AIChatWindow
        {...defaultProps}
        messages={messages}
        onSubjectTagClick={onSubjectTagClick}
      />
    );

    // The subject tag should be clickable and invoke onSubjectTagClick
    const tag = screen.getByText("语文");
    fireEvent.click(tag);
    expect(onSubjectTagClick).toHaveBeenCalledWith("语文");
  });
});

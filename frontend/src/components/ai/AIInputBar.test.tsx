import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AIInputBar } from "./AIInputBar";

describe("AIInputBar", () => {
  // ================================================================
  // Basic rendering
  // ================================================================
  it("should render a textarea and send button", () => {
    render(<AIInputBar onSend={vi.fn()} />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send message" })).toBeInTheDocument();
  });

  it("should use default placeholder", () => {
    render(<AIInputBar onSend={vi.fn()} />);
    const textarea = screen.getByPlaceholderText("输入您的问题...");
    expect(textarea).toBeInTheDocument();
  });

  it("should accept custom placeholder", () => {
    render(
      <AIInputBar
        onSend={vi.fn()}
        placeholder="自定义占位符"
      />
    );
    expect(screen.getByPlaceholderText("自定义占位符")).toBeInTheDocument();
  });

  // ================================================================
  // Send on Enter
  // ================================================================
  it("should call onSend with trimmed content when Enter is pressed", () => {
    const onSend = vi.fn();
    render(<AIInputBar onSend={onSend} />);

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "hello world" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith("hello world");
  });

  it("should NOT send when Enter is pressed with Shift (Shift+Enter for newline)", () => {
    const onSend = vi.fn();
    render(<AIInputBar onSend={onSend} />);

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "test" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });

    expect(onSend).not.toHaveBeenCalled();
  });

  it("should NOT send empty/whitespace content", () => {
    const onSend = vi.fn();
    render(<AIInputBar onSend={onSend} />);

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "   " } });
    fireEvent.keyDown(textarea, { key: "Enter" });

    expect(onSend).not.toHaveBeenCalled();
  });

  // ================================================================
  // Send button click
  // ================================================================
  it("should call onSend when send button is clicked", () => {
    const onSend = vi.fn();
    render(<AIInputBar onSend={onSend} />);

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "button send" } });

    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(onSend).toHaveBeenCalledWith("button send");
  });

  // ================================================================
  // Clear input after send
  // ================================================================
  it("should clear input after sending", () => {
    const onSend = vi.fn();
    render(<AIInputBar onSend={onSend} />);

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "clear me" } });
    expect(textarea.value).toBe("clear me");

    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(textarea.value).toBe("");
  });

  // ================================================================
  // Disabled state
  // ================================================================
  it("should disable textarea when disabled=true", () => {
    render(<AIInputBar onSend={vi.fn()} disabled={true} />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("should disable send button when disabled=true", () => {
    render(<AIInputBar onSend={vi.fn()} disabled={true} />);
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
  });

  it("should disable send button when input is empty", () => {
    render(<AIInputBar onSend={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
  });

  it("should send button be enabled when input has content and not disabled", () => {
    render(<AIInputBar onSend={vi.fn()} />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "enabled" } });
    expect(screen.getByRole("button", { name: "Send message" })).not.toBeDisabled();
  });

  // ================================================================
  // fillText / fillKey mechanism
  // ================================================================
  it("should fill text into input when fillKey changes", () => {
    const { rerender } = render(
      <AIInputBar onSend={vi.fn()} fillText="查询成绩" fillKey={0} />
    );

    // Initial render - fillText should NOT be applied yet (fillKey hasn't "changed" from undef)
    // Rerender with new fillKey triggers the effect
    rerender(
      <AIInputBar onSend={vi.fn()} fillText="查询成绩" fillKey={1} />
    );

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toBe("查询成绩");
  });

  it("should not re-fill when fillKey does not change", () => {
    const onSend = vi.fn();
    const { rerender } = render(
      <AIInputBar onSend={onSend} fillText="first" fillKey={1} />
    );

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toBe("first");

    // User types something
    fireEvent.change(textarea, { target: { value: "user typed" } });
    expect(textarea.value).toBe("user typed");

    // Re-render with same fillKey (and same fillText) - should NOT overwrite
    rerender(
      <AIInputBar onSend={onSend} fillText="first" fillKey={1} />
    );
    expect(textarea.value).toBe("user typed");
  });

  it("should re-fill when fillKey increments", () => {
    const onSend = vi.fn();
    const { rerender } = render(
      <AIInputBar onSend={onSend} fillText="msg1" fillKey={1} />
    );

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toBe("msg1");

    // User types something
    fireEvent.change(textarea, { target: { value: "typed" } });
    // Rerender with new fillKey → should fill text2
    rerender(
      <AIInputBar onSend={onSend} fillText="msg2" fillKey={2} />
    );
    expect(textarea.value).toBe("msg2");
  });

  it("should not fill when fillText is undefined", () => {
    render(<AIInputBar onSend={vi.fn()} fillText={undefined} fillKey={0} />);

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toBe("");
  });

  it("should not fill when fillText is null", () => {
    render(
      <AIInputBar
        onSend={vi.fn()}
        fillText={null as unknown as string}
        fillKey={0}
      />
    );

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toBe("");
  });
});

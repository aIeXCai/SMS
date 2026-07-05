import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { FloatingAIButton } from "./FloatingAIButton";

describe("FloatingAIButton", () => {
  it("should render open-state icon (X) when isOpen=true", () => {
    const onClick = vi.fn();
    render(<FloatingAIButton onClick={onClick} isOpen={true} />);

    const button = screen.getByRole("button", { name: "Close AI chat" });
    expect(button).toBeInTheDocument();
    // Should contain two line elements (X icon)
    const lines = button.querySelectorAll("line");
    expect(lines.length).toBe(2);
  });

  it("should render closed-state icon (chat bubble) when isOpen=false", () => {
    const onClick = vi.fn();
    render(<FloatingAIButton onClick={onClick} isOpen={false} />);

    const button = screen.getByRole("button", { name: "Open AI chat" });
    expect(button).toBeInTheDocument();
    // Should contain a path element (chat bubble icon)
    const path = button.querySelector("path");
    expect(path).toBeInTheDocument();
  });

  it("should call onClick when clicked", () => {
    const onClick = vi.fn();
    render(<FloatingAIButton onClick={onClick} isOpen={false} />);

    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  describe("unread badge (red dot)", () => {
    it("should show red dot when hasUnread=true and isOpen=false", () => {
      const onClick = vi.fn();
      render(
        <FloatingAIButton onClick={onClick} isOpen={false} hasUnread={true} />
      );

      const badge = screen.getByLabelText("New AI messages");
      expect(badge).toBeInTheDocument();
      expect(badge.className).toContain("bg-red-500");
    });

    it("should NOT show red dot when hasUnread=true but isOpen=true", () => {
      const onClick = vi.fn();
      render(
        <FloatingAIButton onClick={onClick} isOpen={true} hasUnread={true} />
      );

      expect(
        screen.queryByLabelText("New AI messages")
      ).not.toBeInTheDocument();
    });

    it("should NOT show red dot when hasUnread=false", () => {
      const onClick = vi.fn();
      render(
        <FloatingAIButton onClick={onClick} isOpen={false} hasUnread={false} />
      );

      expect(
        screen.queryByLabelText("New AI messages")
      ).not.toBeInTheDocument();
    });

    it("should default hasUnread to false", () => {
      const onClick = vi.fn();
      render(<FloatingAIButton onClick={onClick} isOpen={false} />);

      expect(
        screen.queryByLabelText("New AI messages")
      ).not.toBeInTheDocument();
    });
  });

  it("should have correct aria-label when closed", () => {
    render(<FloatingAIButton onClick={vi.fn()} isOpen={false} />);
    expect(screen.getByRole("button", { name: "Open AI chat" })).toBeInTheDocument();
  });

  it("should have correct aria-label when open", () => {
    render(<FloatingAIButton onClick={vi.fn()} isOpen={true} />);
    expect(screen.getByRole("button", { name: "Close AI chat" })).toBeInTheDocument();
  });

  it("should apply fixed positioning classes", () => {
    const onClick = vi.fn();
    render(<FloatingAIButton onClick={onClick} isOpen={false} />);
    const button = screen.getByRole("button");
    expect(button.className).toContain("fixed");
    expect(button.className).toContain("z-[999]");
  });
});

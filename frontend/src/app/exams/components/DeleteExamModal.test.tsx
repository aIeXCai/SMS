import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DeleteExamModal from "./DeleteExamModal";

describe("DeleteExamModal", () => {
  it("renders with exam name", () => {
    render(
      <DeleteExamModal
        examName="期中考试"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByText("确认删除考试")).toBeInTheDocument();
    expect(screen.getByText('"期中考试"')).toBeInTheDocument();
  });

  it("renders cancel and confirm buttons", () => {
    render(
      <DeleteExamModal
        examName="期中考试"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByText("取消")).toBeInTheDocument();
    expect(screen.getByText("确认删除")).toBeInTheDocument();
  });

  it("renders warning message about score deletion", () => {
    render(
      <DeleteExamModal
        examName="期中考试"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByText(/此操作将同时删除该考试的所有成绩记录/)).toBeInTheDocument();
    expect(screen.getByText(/不可撤销/)).toBeInTheDocument();
  });

  it("calls onCancel when cancel button clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <DeleteExamModal
        examName="期中考试"
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />
    );
    await user.click(screen.getByText("取消"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onConfirm when confirm button clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <DeleteExamModal
        examName="期中考试"
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />
    );
    await user.click(screen.getByText("确认删除"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when close button clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <DeleteExamModal
        examName="期中考试"
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />
    );
    const closeBtn = screen.getByRole("button", { name: "关闭" }); // btn-close has no text
    await user.click(closeBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

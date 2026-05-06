import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BatchPromoteForm from "./BatchPromoteForm";

describe("BatchPromoteForm", () => {
  const baseProps = (overrides = {}) => ({
    studentCount: 5,
    gradeLevelChoices: ["一年级", "二年级", "三年级"],
    targetGradeLevel: "二年级",
    currentGradeLevel: "",
    autoCreateClasses: false,
    isSubmitting: false,
    onChange: vi.fn(),
    onSubmit: vi.fn((e) => e.preventDefault()),
    onCancel: vi.fn(),
    ...overrides,
  });

  it("renders with correct student count", () => {
    render(<BatchPromoteForm {...baseProps()} />);
    expect(screen.getAllByText("5")[0]).toBeInTheDocument();
    expect(screen.getByText("选中学生")).toBeInTheDocument();
  });

  it("renders target grade select with choices", () => {
    render(<BatchPromoteForm {...baseProps()} />);
    const select = screen.getByLabelText("目标年级") as HTMLSelectElement;
    expect(select.value).toBe("二年级");
    expect(screen.getAllByText("一年级")[0]).toBeInTheDocument();
    expect(screen.getAllByText("三年级")[0]).toBeInTheDocument();
  });

  it("renders current grade level filter selector", () => {
    render(<BatchPromoteForm {...baseProps()} />);
    expect(screen.getByLabelText("限定当前年级 (可选)")).toBeInTheDocument();
    expect(screen.getByText("不限定（全部选中学生均执行）")).toBeInTheDocument();
  });

  it("renders auto-create classes toggle", () => {
    render(<BatchPromoteForm {...baseProps({ autoCreateClasses: true })} />);
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it("renders operation instructions", () => {
    render(<BatchPromoteForm {...baseProps()} />);
    expect(screen.getByText("操作说明")).toBeInTheDocument();
    expect(screen.getByText("重要提示")).toBeInTheDocument();
    expect(screen.getByText("确认升年级")).toBeInTheDocument();
  });

  it("disables submit button when isSubmitting is true", () => {
    render(<BatchPromoteForm {...baseProps({ isSubmitting: true })} />);
    const button = screen.getByText("处理中...") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("disables submit button when studentCount is 0", () => {
    render(<BatchPromoteForm {...baseProps({ studentCount: 0 })} />);
    const button = screen.getByText("确认升年级") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("calls onCancel when cancel button clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<BatchPromoteForm {...baseProps({ onCancel })} />);
    await user.click(screen.getByText("取消"));
    expect(onCancel).toHaveBeenCalled();
  });

  it("calls onSubmit when form submitted", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((e) => e.preventDefault());
    render(<BatchPromoteForm {...baseProps({ onSubmit })} />);
    await user.click(screen.getByText("确认升年级"));
    expect(onSubmit).toHaveBeenCalled();
  });
});

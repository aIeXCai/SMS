import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StudentBatchBar from "./StudentBatchBar";
import type { Stats } from "./types";

const mockStats: Stats = {
  total_students: 100, active_students: 80,
  graduated_students: 15, suspended_students: 5,
  status_choices: ["在读", "毕业", "休学"],
  grade_level_choices: [],
  cohort_choices: [],
  class_name_choices: [],
};

describe("StudentBatchBar", () => {
  const baseProps = (overrides = {}) => ({
    selectedCount: 0,
    allSelected: false,
    batchStatus: "在读",
    stats: mockStats,
    canStudentWrite: true,
    error: null,
    selectAllRef: { current: null },
    onSelectAll: vi.fn(),
    onBatchStatusChange: vi.fn(),
    onBatchUpdateStatus: vi.fn(),
    onBatchDelete: vi.fn(),
    onBatchPromote: vi.fn(),
    onBatchGraduate: vi.fn(),
    ...overrides,
  });

  it("renders read-only alert when canStudentWrite is false", () => {
    render(<StudentBatchBar {...baseProps({ canStudentWrite: false })} />);
    expect(screen.getByText("当前角色仅可查看学生信息，写操作入口已隐藏。")).toBeInTheDocument();
  });

  it("renders batch operation controls when canStudentWrite is true", () => {
    render(<StudentBatchBar {...baseProps({ canStudentWrite: true })} />);
    expect(screen.getByText("批量操作")).toBeInTheDocument();
    expect(screen.getByText("全选")).toBeInTheDocument();
    expect(screen.getByText("批量修改状态为")).toBeInTheDocument();
  });

  it("shows selected count badge", () => {
    render(<StudentBatchBar {...baseProps({ selectedCount: 5 })} />);
    expect(screen.getByText("已选择 5 个学生")).toBeInTheDocument();
  });

  it("does NOT display batch operation buttons when canStudentWrite is false", () => {
    render(<StudentBatchBar {...baseProps({ canStudentWrite: false })} />);
    expect(screen.queryByText("应用状态修改")).not.toBeInTheDocument();
    expect(screen.queryByText("批量删除")).not.toBeInTheDocument();
    expect(screen.queryByText("批量升年级")).not.toBeInTheDocument();
    expect(screen.queryByText("批量毕业")).not.toBeInTheDocument();
  });

  it("displays all batch operation buttons when canStudentWrite is true", () => {
    render(<StudentBatchBar {...baseProps({ canStudentWrite: true })} />);
    expect(screen.getByText("应用状态修改")).toBeInTheDocument();
    expect(screen.getByText("批量删除")).toBeInTheDocument();
    expect(screen.getByText("批量升年级")).toBeInTheDocument();
    expect(screen.getByText("批量毕业")).toBeInTheDocument();
  });

  it("calls onBatchUpdateStatus when button clicked", async () => {
    const user = userEvent.setup();
    const onBatchUpdateStatus = vi.fn();
    render(<StudentBatchBar {...baseProps({ onBatchUpdateStatus })} />);
    await user.click(screen.getByText("应用状态修改"));
    expect(onBatchUpdateStatus).toHaveBeenCalled();
  });

  it("calls onBatchDelete when button clicked", async () => {
    const user = userEvent.setup();
    const onBatchDelete = vi.fn();
    render(<StudentBatchBar {...baseProps({ onBatchDelete })} />);
    await user.click(screen.getByText("批量删除"));
    expect(onBatchDelete).toHaveBeenCalled();
  });

  it("calls onBatchPromote when button clicked", async () => {
    const user = userEvent.setup();
    const onBatchPromote = vi.fn();
    render(<StudentBatchBar {...baseProps({ onBatchPromote })} />);
    await user.click(screen.getByText("批量升年级"));
    expect(onBatchPromote).toHaveBeenCalled();
  });

  it("calls onBatchGraduate when button clicked", async () => {
    const user = userEvent.setup();
    const onBatchGraduate = vi.fn();
    render(<StudentBatchBar {...baseProps({ onBatchGraduate })} />);
    await user.click(screen.getByText("批量毕业"));
    expect(onBatchGraduate).toHaveBeenCalled();
  });

  it("calls onSelectAll when select-all checkbox clicked", async () => {
    const user = userEvent.setup();
    const onSelectAll = vi.fn();
    render(<StudentBatchBar {...baseProps({ onSelectAll })} />);
    await user.click(screen.getByLabelText("全选"));
    expect(onSelectAll).toHaveBeenCalled();
  });

  it("shows error message when error prop is set", () => {
    render(<StudentBatchBar {...baseProps({ error: "网络错误，请重试" })} />);
    expect(screen.getByText("网络错误，请重试")).toBeInTheDocument();
  });
});

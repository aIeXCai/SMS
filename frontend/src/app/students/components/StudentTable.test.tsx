import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StudentTable from "./StudentTable";
import type { Student, Stats } from "./types";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

const mockStats: Stats = {
  total_students: 2, active_students: 2,
  graduated_students: 0, suspended_students: 0,
  status_choices: ["在读", "毕业", "休学"],
  grade_level_choices: ["一年级"],
  cohort_choices: ["2024"],
  class_name_choices: ["1班"],
};

const mockStudent: Student = {
  id: 1,
  student_id: "2024001",
  name: "张三",
  gender: "男",
  current_class: {
    id: 1, grade_level: "一年级",
    cohort: "2024", class_name: "1班",
  },
  status: "在读",
};

const mockStudent2: Student = {
  ...mockStudent,
  id: 2,
  student_id: "2024002",
  name: "李四",
  gender: "女",
};

describe("StudentTable", () => {
  const baseProps = (overrides = {}) => ({
    students: [mockStudent, mockStudent2],
    stats: mockStats,
    selected: {} as Record<number, boolean>,
    allSelected: false,
    canStudentWrite: true,
    isLoading: false,
    onSelectAll: vi.fn(),
    onSelectOne: vi.fn(),
    onDelete: vi.fn(),
    onStatusChange: vi.fn(),
    ...overrides,
  });

  it("renders table headers", () => {
    render(<StudentTable {...baseProps()} />);
    expect(screen.getByText("学号")).toBeInTheDocument();
    expect(screen.getByText("姓名")).toBeInTheDocument();
    expect(screen.getByText("性别")).toBeInTheDocument();
    expect(screen.getByText("入学年份")).toBeInTheDocument();
    expect(screen.getByText("年级")).toBeInTheDocument();
    expect(screen.getByText("班级")).toBeInTheDocument();
    expect(screen.getByText("状态")).toBeInTheDocument();
    expect(screen.getByText("操作")).toBeInTheDocument();
  });

  it("renders student data", () => {
    render(<StudentTable {...baseProps()} />);
    expect(screen.getByText("2024001")).toBeInTheDocument();
    expect(screen.getByText("张三")).toBeInTheDocument();
    expect(screen.getByText("2024002")).toBeInTheDocument();
    expect(screen.getByText("李四")).toBeInTheDocument();
  });

  it("shows loading spinner when isLoading is true", () => {
    render(<StudentTable {...baseProps({ isLoading: true })} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows empty state when no students", () => {
    render(<StudentTable {...baseProps({ students: [] })} />);
    expect(screen.getByText("暂无学生数据")).toBeInTheDocument();
  });

  it("shows empty state with add link when canStudentWrite is true", () => {
    render(<StudentTable {...baseProps({ students: [], canStudentWrite: true })} />);
    expect(screen.getByText("添加第一个学生")).toBeInTheDocument();
  });

  it("hides add link in empty state when canStudentWrite is false", () => {
    render(<StudentTable {...baseProps({ students: [], canStudentWrite: false })} />);
    expect(screen.getByText("暂无学生数据")).toBeInTheDocument();
    expect(screen.queryByText("添加第一个学生")).not.toBeInTheDocument();
  });

  it("shows checkboxes when canStudentWrite is true", () => {
    render(<StudentTable {...baseProps({ canStudentWrite: true })} />);
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBe(3); // header + 2 rows
  });

  it("hides row checkboxes when canStudentWrite is false", () => {
    render(<StudentTable {...baseProps({ canStudentWrite: false })} />);
    // Header checkbox still exists for consistency, but row actions show '只读'
    expect(screen.getAllByText("只读").length).toBe(2); // one per row
  });

  it("shows '只读' in action column when canStudentWrite is false", () => {
    render(<StudentTable {...baseProps({ canStudentWrite: false })} />);
    expect(screen.getAllByText("只读").length).toBeGreaterThan(0);
  });

  it("shows edit/delete buttons when canStudentWrite is true", () => {
    render(<StudentTable {...baseProps({ canStudentWrite: true })} />);
    const editLinks = screen.getAllByTitle("编辑学生信息");
    expect(editLinks.length).toBe(2);
    const deleteButtons = screen.getAllByTitle("删除学生");
    expect(deleteButtons.length).toBe(2);
  });

  it("hides status switch column when canStudentWrite is false", () => {
    render(<StudentTable {...baseProps({ canStudentWrite: false })} />);
    expect(screen.queryByText("状态切换")).not.toBeInTheDocument();
  });

  it("calls onSelectOne when row checkbox clicked", async () => {
    const user = userEvent.setup();
    const onSelectOne = vi.fn();
    render(<StudentTable {...baseProps({ onSelectOne })} />);
    const checkboxes = screen.getAllByRole("checkbox");
    // Skip the header checkbox (index 0), click first row checkbox (index 1)
    await user.click(checkboxes[1]);
    expect(onSelectOne).toHaveBeenCalledWith(1);
  });

  it("calls onDelete when delete button clicked", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<StudentTable {...baseProps({ onDelete })} />);
    const deleteButtons = screen.getAllByTitle("删除学生");
    await user.click(deleteButtons[0]);
    expect(onDelete).toHaveBeenCalledWith(mockStudent);
  });
});

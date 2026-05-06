import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ExamTable from "./ExamTable";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

const mockOptions = {
  academic_years: [
    { value: "2024-2025", label: "2024-2025" },
  ],
  grade_levels: [
    { value: "grade_10", label: "高一" },
  ],
};

const mockExam = {
  id: 1,
  name: "期中考试",
  academic_year: "2024-2025",
  grade_level: "grade_10",
  date: "2024-11-01",
  description: "期中综合考试",
};

const mockExam2 = {
  id: 2,
  name: "期末考试",
  academic_year: "2024-2025",
  grade_level: "grade_10",
  date: "2025-01-15",
  description: "",
};

describe("ExamTable", () => {
  const baseProps = (overrides = {}) => ({
    exams: [mockExam, mockExam2],
    options: mockOptions,
    totalCount: 2,
    currentPage: 1,
    pageSize: 10,
    isLoading: false,
    canExamWrite: true,
    selectedIds: new Set<number>(),
    onSelectAll: vi.fn(),
    onSelectOne: vi.fn(),
    onBatchDelete: vi.fn(),
    onSetCurrentPage: vi.fn(),
    onDeleteRequest: vi.fn(),
    ...overrides,
  });

  it("renders table headers", () => {
    render(<ExamTable {...baseProps()} />);
    expect(screen.getByText("学年")).toBeInTheDocument();
    expect(screen.getByText("考试名称")).toBeInTheDocument();
    expect(screen.getByText("适用年级")).toBeInTheDocument();
    expect(screen.getByText("考试日期")).toBeInTheDocument();
    expect(screen.getByText("考试描述")).toBeInTheDocument();
    expect(screen.getByText("操作")).toBeInTheDocument();
  });

  it("renders exam data", () => {
    render(<ExamTable {...baseProps()} />);
    expect(screen.getByText("期中考试")).toBeInTheDocument();
    expect(screen.getByText("期末考试")).toBeInTheDocument();
  });

  it("renders academic year", () => {
    render(<ExamTable {...baseProps()} />);
    expect(screen.getAllByText("2024-2025")[0]).toBeInTheDocument();
  });

  it("renders grade level label using options lookup", () => {
    render(<ExamTable {...baseProps()} />);
    expect(screen.getAllByText("高一").length).toBeGreaterThan(0);
  });

  it("shows '暂无描述' for empty description", () => {
    render(<ExamTable {...baseProps()} />);
    expect(screen.getByText("暂无描述")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    render(<ExamTable {...baseProps({ isLoading: true })} />);
    expect(screen.getByText("加载中...")).toBeInTheDocument();
  });

  it("shows empty state when no exams", () => {
    render(<ExamTable {...baseProps({ exams: [], totalCount: 0 })} />);
    expect(screen.getByText("暂无考试记录")).toBeInTheDocument();
  });

  it("shows 'create first exam' button in empty state when canExamWrite", () => {
    render(<ExamTable {...baseProps({ exams: [], totalCount: 0, canExamWrite: true })} />);
    expect(screen.getByText("创建第一个考试")).toBeInTheDocument();
  });

  it("hides 'create first exam' button when canExamWrite is false", () => {
    render(<ExamTable {...baseProps({ exams: [], totalCount: 0, canExamWrite: false })} />);
    expect(screen.getByText("暂无考试记录")).toBeInTheDocument();
    expect(screen.queryByText("创建第一个考试")).not.toBeInTheDocument();
  });

  it("shows edit/delete buttons when canExamWrite is true", () => {
    render(<ExamTable {...baseProps({ canExamWrite: true })} />);
    const editLinks = screen.getAllByTitle("编辑考试");
    expect(editLinks.length).toBe(2);
    const deleteButtons = screen.getAllByTitle("删除考试");
    expect(deleteButtons.length).toBe(2);
  });

  it("shows '只读' text when canExamWrite is false", () => {
    render(<ExamTable {...baseProps({ canExamWrite: false })} />);
    const readOnlyTexts = screen.getAllByText("只读");
    expect(readOnlyTexts.length).toBe(2); // one per row
  });

  it("calls onDeleteRequest when delete button clicked", async () => {
    const user = userEvent.setup();
    const onDeleteRequest = vi.fn();
    render(<ExamTable {...baseProps({ onDeleteRequest })} />);
    const deleteButtons = screen.getAllByTitle("删除考试");
    await user.click(deleteButtons[0]);
    expect(onDeleteRequest).toHaveBeenCalledWith({ id: 1, name: "期中考试" });
  });

  it("renders pagination with correct current page", () => {
    render(<ExamTable {...baseProps({ totalCount: 25, currentPage: 2 })} />);
    expect(screen.getByText("第 2 页")).toBeInTheDocument();
    expect(screen.getByText("共 25 条记录")).toBeInTheDocument();
  });

  it("disables 'previous page' on first page", () => {
    render(<ExamTable {...baseProps({ currentPage: 1, totalCount: 25 })} />);
    const prevButton = screen.getByText("上一页") as HTMLButtonElement;
    expect(prevButton.disabled).toBe(true);
  });

  it("disables 'next page' on last page", () => {
    render(<ExamTable {...baseProps({ currentPage: 3, pageSize: 10, totalCount: 25 })} />);
    const nextButton = screen.getByText("下一页") as HTMLButtonElement;
    expect(nextButton.disabled).toBe(true);
  });

  it("calls onSetCurrentPage when pagination buttons clicked", async () => {
    const user = userEvent.setup();
    const onSetCurrentPage = vi.fn();
    render(<ExamTable {...baseProps({ currentPage: 2, totalCount: 25, onSetCurrentPage })} />);
    await user.click(screen.getByText("上一页"));
    expect(onSetCurrentPage).toHaveBeenCalledWith(1);
  });
});

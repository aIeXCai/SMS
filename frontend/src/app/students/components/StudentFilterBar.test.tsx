import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StudentFilterBar from "./StudentFilterBar";
import type { Stats } from "./types";

const mockStats: Stats = {
  total_students: 100, active_students: 80,
  graduated_students: 15, suspended_students: 5,
  status_choices: ["在读", "毕业"],
  grade_level_choices: [],
  cohort_choices: ["2024", "2025"],
  class_name_choices: ["1班", "2班"],
};

describe("StudentFilterBar", () => {
  const baseProps = () => ({
    search: "",
    filterStatus: "",
    filterGrade: "",
    filterClass: "",
    filterGradeDropdownOpen: false,
    filterClassDropdownOpen: false,
    filterStatusDropdownOpen: false,
    stats: mockStats,
    onSearchChange: vi.fn(),
    onFilterStatusChange: vi.fn(),
    onFilterGradeChange: vi.fn(),
    onFilterClassChange: vi.fn(),
    onFilterGradeDropdownToggle: vi.fn(),
    onFilterClassDropdownToggle: vi.fn(),
    onFilterStatusDropdownToggle: vi.fn(),
    onReset: vi.fn(),
  });

  it("renders filter labels and inputs", () => {
    render(<StudentFilterBar {...baseProps()} />);
    expect(screen.getByText("搜索学号/姓名")).toBeInTheDocument();
    expect(screen.getByText("入学年份")).toBeInTheDocument();
    expect(screen.getByText("班级")).toBeInTheDocument();
    expect(screen.getByText("状态")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("输入关键字后自动更新")).toBeInTheDocument();
  });

  it("displays current filter values", () => {
    render(<StudentFilterBar {...baseProps()} search="张三" filterGrade="2024" />);
    const searchInput = screen.getByPlaceholderText("输入关键字后自动更新") as HTMLInputElement;
    expect(searchInput.value).toBe("张三");
    expect(screen.getAllByText("2024")[0]).toBeInTheDocument();
  });

  it("calls onSearchChange on search input", async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    render(<StudentFilterBar {...baseProps()} onSearchChange={onSearchChange} />);
    const input = screen.getByPlaceholderText("输入关键字后自动更新");
    await user.type(input, "李");
    expect(onSearchChange).toHaveBeenCalled();
  });

  it("calls onReset when reset button clicked", async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    render(<StudentFilterBar {...baseProps()} onReset={onReset} />);
    await user.click(screen.getByText("重置过滤条件"));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("toggles dropdowns on click", async () => {
    const user = userEvent.setup();
    const onFilterGradeDropdownToggle = vi.fn();
    const onFilterClassDropdownToggle = vi.fn();
    const onFilterStatusDropdownToggle = vi.fn();

    const { container } = render(
      <StudentFilterBar
        {...baseProps()}
        onFilterGradeDropdownToggle={onFilterGradeDropdownToggle}
        onFilterClassDropdownToggle={onFilterClassDropdownToggle}
        onFilterStatusDropdownToggle={onFilterStatusDropdownToggle}
      />
    );

    const buttons = container.querySelectorAll(".custom-dropdown-toggle");
    await user.click(buttons[0]);
    expect(onFilterGradeDropdownToggle).toHaveBeenCalled();

    await user.click(buttons[1]);
    expect(onFilterClassDropdownToggle).toHaveBeenCalled();

    await user.click(buttons[2]);
    expect(onFilterStatusDropdownToggle).toHaveBeenCalled();
  });

  it("shows dropdown items when dropdown is open", () => {
    render(<StudentFilterBar {...baseProps()} filterGradeDropdownOpen={true} />);
    expect(screen.getAllByText("2024")[0]).toBeInTheDocument();
    expect(screen.getByText("2025")).toBeInTheDocument();
  });

  it("shows '全部' for empty filter values", () => {
    render(<StudentFilterBar {...baseProps()} />);
    const allTexts = screen.getAllByText("全部");
    expect(allTexts.length).toBeGreaterThanOrEqual(3);
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ExamFilterBar from "./ExamFilterBar";

const mockOptions = {
  academic_years: [
    { value: "2024-2025", label: "2024-2025" },
    { value: "2025-2026", label: "2025-2026" },
  ],
  grade_levels: [
    { value: "grade_10", label: "高一" },
    { value: "grade_11", label: "高二" },
  ],
};

describe("ExamFilterBar", () => {
  const baseProps = (overrides = {}) => ({
    academicYear: "",
    gradeLevel: "",
    academicYearDropdownOpen: false,
    gradeLevelDropdownOpen: false,
    options: mockOptions,
    onAcademicYearChange: vi.fn(),
    onGradeLevelChange: vi.fn(),
    onAcademicYearDropdownToggle: vi.fn(),
    onGradeLevelDropdownToggle: vi.fn(),
    onFilter: vi.fn(),
    onReset: vi.fn(),
    ...overrides,
  });

  it("renders filter section", () => {
    render(<ExamFilterBar {...baseProps()} />);
    expect(screen.getByText("筛选条件")).toBeInTheDocument();
    expect(screen.getByText("学年")).toBeInTheDocument();
    expect(screen.getByText("年级")).toBeInTheDocument();
  });

  it("shows default text in dropdowns when no value selected", () => {
    render(<ExamFilterBar {...baseProps()} />);
    expect(screen.getAllByText("全部学年")[0]).toBeInTheDocument();
    expect(screen.getAllByText("全部年级")[0]).toBeInTheDocument();
  });

  it("shows selected academic year label", () => {
    render(<ExamFilterBar {...baseProps({ academicYear: "2024-2025" })} />);
    expect(screen.getAllByText("2024-2025")[0]).toBeInTheDocument();
  });

  it("shows selected grade level label", () => {
    render(<ExamFilterBar {...baseProps({ gradeLevel: "grade_10" })} />);
    expect(screen.getAllByText("高一")[0]).toBeInTheDocument();
  });

  it("renders filter and reset buttons", () => {
    render(<ExamFilterBar {...baseProps()} />);
    expect(screen.getByText("筛选")).toBeInTheDocument();
    expect(screen.getByText("重置")).toBeInTheDocument();
  });

  it("calls onFilter when filter button clicked", async () => {
    const user = userEvent.setup();
    const onFilter = vi.fn();
    render(<ExamFilterBar {...baseProps({ onFilter })} />);
    await user.click(screen.getByText("筛选"));
    expect(onFilter).toHaveBeenCalledTimes(1);
  });

  it("calls onReset when reset button clicked", async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    render(<ExamFilterBar {...baseProps({ onReset })} />);
    await user.click(screen.getByText("重置"));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("shows dropdown options when dropdown is open", () => {
    render(<ExamFilterBar {...baseProps({ academicYearDropdownOpen: true })} />);
    expect(screen.getAllByText("2024-2025")[0]).toBeInTheDocument();
    expect(screen.getByText("2025-2026")).toBeInTheDocument();
    expect(screen.getAllByText("全部学年")[0]).toBeInTheDocument();
  });

  it("renders with null options gracefully", () => {
    render(<ExamFilterBar {...baseProps({ options: null })} />);
    expect(screen.getAllByText("全部学年")[0]).toBeInTheDocument();
    expect(screen.getAllByText("全部年级")[0]).toBeInTheDocument();
  });
});

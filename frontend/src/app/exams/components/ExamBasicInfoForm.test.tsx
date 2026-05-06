import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ExamBasicInfoForm from "./ExamBasicInfoForm";

const mockOptions = {
  academic_years: [
    { value: "2024-2025", label: "2024-2025学年" },
    { value: "2025-2026", label: "2025-2026学年" },
  ],
  grade_levels: [
    { value: "grade_10", label: "高一" },
    { value: "grade_11", label: "高二" },
  ],
};

describe("ExamBasicInfoForm", () => {
  const baseProps = (overrides = {}) => ({
    academicYear: "",
    name: "",
    date: "",
    gradeLevel: "",
    description: "",
    options: mockOptions,
    errors: {},
    onAcademicYearChange: vi.fn(),
    onNameChange: vi.fn(),
    onDateChange: vi.fn(),
    onGradeLevelChange: vi.fn(),
    onDescriptionChange: vi.fn(),
    onNextStep: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  });

  it("renders form title", () => {
    render(<ExamBasicInfoForm {...baseProps()} />);
    expect(screen.getByText("考试基本信息")).toBeInTheDocument();
  });

  it("renders all required form fields", () => {
    render(<ExamBasicInfoForm {...baseProps()} />);
    expect(screen.getByText("学年")).toBeInTheDocument();
    expect(screen.getByText("考试名称")).toBeInTheDocument();
    expect(screen.getByText("考试日期")).toBeInTheDocument();
    expect(screen.getByText("适用年级")).toBeInTheDocument();
    expect(screen.getByText("考试描述（可选）")).toBeInTheDocument();
  });

  it("renders cancel and next step buttons", () => {
    render(<ExamBasicInfoForm {...baseProps()} />);
    expect(screen.getByText("取消")).toBeInTheDocument();
    expect(screen.getByText("下一步：配置科目")).toBeInTheDocument();
  });

  it("renders form fields with current values", () => {
    render(<ExamBasicInfoForm {...baseProps({
      name: "期中考试",
      date: "2024-11-01",
      description: "综合考试",
    })} />);
    const nameInput = screen.getByPlaceholderText(/期中考试/) as HTMLInputElement;
    expect(nameInput.value).toBe("期中考试");
    const dateInput = screen.getByDisplayValue("2024-11-01") as HTMLInputElement;
    expect(dateInput).toBeInTheDocument();
  });

  it("calls onNextStep when next button clicked", async () => {
    const user = userEvent.setup();
    const onNextStep = vi.fn();
    render(<ExamBasicInfoForm {...baseProps({ onNextStep })} />);
    await user.click(screen.getByText("下一步：配置科目"));
    expect(onNextStep).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when cancel button clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<ExamBasicInfoForm {...baseProps({ onCancel })} />);
    await user.click(screen.getByText("取消"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("shows edit banner when editBanner prop is set", () => {
    render(<ExamBasicInfoForm {...baseProps({ editBanner: "正在编辑考试：期中考试" })} />);
    expect(screen.getByText("正在编辑考试：期中考试")).toBeInTheDocument();
  });

  it("does NOT show edit banner when editBanner is not set", () => {
    render(<ExamBasicInfoForm {...baseProps()} />);
    expect(screen.queryByText(/正在编辑考试/)).not.toBeInTheDocument();
  });

  it("shows validation error when error is present", () => {
    render(<ExamBasicInfoForm {...baseProps({
      errors: { name: "考试名称不能为空" },
    })} />);
    expect(screen.getByText("考试名称不能为空")).toBeInTheDocument();
  });

  it("shows multiple validation errors", () => {
    render(<ExamBasicInfoForm {...baseProps({
      errors: {
        name: "名称不能为空",
        academicYear: "请选择学年",
      },
    })} />);
    expect(screen.getByText("名称不能为空")).toBeInTheDocument();
    expect(screen.getByText("请选择学年")).toBeInTheDocument();
  });

  it("calls onAcademicYearChange when academic year selection changes", async () => {
    const user = userEvent.setup();
    const onAcademicYearChange = vi.fn();
    render(<ExamBasicInfoForm {...baseProps({ onAcademicYearChange })} />);
    const select = screen.getAllByRole("combobox")[0];
    await user.selectOptions(select, "2024-2025");
    expect(onAcademicYearChange).toHaveBeenCalled();
  });

  it("calls onNameChange on text input change", async () => {
    const user = userEvent.setup();
    const onNameChange = vi.fn();
    render(<ExamBasicInfoForm {...baseProps({ onNameChange })} />);
    const input = screen.getByPlaceholderText(/期中考试/);
    await user.type(input, "期末");
    expect(onNameChange).toHaveBeenCalled();
  });
});

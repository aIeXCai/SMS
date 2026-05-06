import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StudentFormFields from "./StudentFormFields";

const mockStatsChoices = {
  status_choices: ["在读", "毕业", "休学"],
  grade_level_choices: ["一年级", "二年级", "三年级"],
  cohort_choices: ["2024", "2025"],
  class_name_choices: ["1班", "2班", "3班"],
};

describe("StudentFormFields", () => {
  const baseProps = (overrides = {}) => ({
    formData: {} as Record<string, string>,
    fieldErrors: {} as Record<string, string[]>,
    statsChoices: mockStatsChoices,
    onChange: vi.fn(),
    ...overrides,
  });

  it("renders basic text input fields", () => {
    render(<StudentFormFields {...baseProps()} />);
    expect(screen.getByLabelText("学号")).toBeInTheDocument();
    expect(screen.getByLabelText("姓名")).toBeInTheDocument();
  });

  it("renders gender select", () => {
    render(<StudentFormFields {...baseProps()} />);
    expect(screen.getByLabelText("性别")).toBeInTheDocument();
    expect(screen.getByText("男")).toBeInTheDocument();
    expect(screen.getByText("女")).toBeInTheDocument();
  });

  it("renders status select with choices", () => {
    render(<StudentFormFields {...baseProps()} />);
    expect(screen.getByLabelText("在校状态")).toBeInTheDocument();
    expect(screen.getByText("在读")).toBeInTheDocument();
    expect(screen.getByText("毕业")).toBeInTheDocument();
  });

  it("renders grade level select with choices", () => {
    render(<StudentFormFields {...baseProps()} />);
    expect(screen.getByLabelText("当前年级")).toBeInTheDocument();
    expect(screen.getByText("一年级")).toBeInTheDocument();
    expect(screen.getByText("二年级")).toBeInTheDocument();
  });

  it("renders class name select with choices", () => {
    render(<StudentFormFields {...baseProps()} />);
    expect(screen.getByLabelText("班级名称")).toBeInTheDocument();
    expect(screen.getByText("1班")).toBeInTheDocument();
  });

  it("renders section select", () => {
    render(<StudentFormFields {...baseProps()} />);
    expect(screen.getByLabelText("学段")).toBeInTheDocument();
    expect(screen.getByText("初中")).toBeInTheDocument();
    expect(screen.getByText("高中")).toBeInTheDocument();
  });

  it("renders cohort year select", () => {
    render(<StudentFormFields {...baseProps()} />);
    expect(screen.getByLabelText("入学年份")).toBeInTheDocument();
    expect(screen.getByText("2024级")).toBeInTheDocument();
  });

  it("renders additional optional fields", () => {
    render(<StudentFormFields {...baseProps()} />);
    expect(screen.getByLabelText("身份证号码")).toBeInTheDocument();
    expect(screen.getByLabelText("学籍号")).toBeInTheDocument();
    expect(screen.getByLabelText("家庭地址")).toBeInTheDocument();
    expect(screen.getByLabelText("监护人姓名")).toBeInTheDocument();
    expect(screen.getByLabelText("监护人联系电话")).toBeInTheDocument();
  });

  it("renders form fields with provided values", () => {
    render(<StudentFormFields {...baseProps({
      formData: {
        student_id: "2024001",
        name: "张三",
        gender: "男",
        status: "在读",
      },
    })} />);
    const studentIdInput = screen.getByDisplayValue("2024001") as HTMLInputElement;
    expect(studentIdInput).toBeInTheDocument();
    const nameInput = screen.getByDisplayValue("张三") as HTMLInputElement;
    expect(nameInput).toBeInTheDocument();
  });

  it("shows field errors when provided", () => {
    render(<StudentFormFields {...baseProps({
      fieldErrors: {
        student_id: ["学号不能为空"],
        name: ["姓名不能为空"],
      },
    })} />);
    expect(screen.getByText("学号不能为空")).toBeInTheDocument();
    expect(screen.getByText("姓名不能为空")).toBeInTheDocument();
  });

  it("calls onChange on text input change", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<StudentFormFields {...baseProps({ onChange })} />);
    const input = screen.getByLabelText("姓名");
    await user.type(input, "李");
    expect(onChange).toHaveBeenCalled();
  });
});

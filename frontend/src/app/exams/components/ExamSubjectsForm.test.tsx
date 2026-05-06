import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ExamSubjectsForm from "./ExamSubjectsForm";

const mockAllSubjects = [
  { value: "math", label: "数学" },
  { value: "chinese", label: "语文" },
  { value: "english", label: "英语" },
];

const mockSubjectRow = { subject_code: "math", max_score: 150 as number | "" };
const mockSubjectRow2 = { subject_code: "chinese", max_score: 150 as number | "" };

describe("ExamSubjectsForm", () => {
  const baseProps = (overrides = {}) => ({
    academicYear: "2024-2025",
    name: "期中考试",
    date: "2024-11-01",
    gradeLevelLabel: "高一",
    description: "综合考试",
    subjects: [mockSubjectRow, mockSubjectRow2],
    allSubjects: mockAllSubjects,
    loadingSubjects: false,
    submitting: false,
    onSubjectChange: vi.fn(),
    onAddSubject: vi.fn(),
    onRemoveSubject: vi.fn(),
    onSubmit: vi.fn(),
    onPrevStep: vi.fn(),
    onCancel: vi.fn(),
    submitLabel: "创建考试",
    ...overrides,
  });

  it("renders summary card with exam info", () => {
    render(<ExamSubjectsForm {...baseProps()} />);
    expect(screen.getByText("考试信息确认")).toBeInTheDocument();
    expect(screen.getByText("2024-2025")).toBeInTheDocument();
    expect(screen.getByText("期中考试")).toBeInTheDocument();
    expect(screen.getByText("2024-11-01")).toBeInTheDocument();
    expect(screen.getAllByText("高一")[0]).toBeInTheDocument();
    expect(screen.getByText("综合考试")).toBeInTheDocument();
  });

  it("renders subjects configuration section", () => {
    render(<ExamSubjectsForm {...baseProps()} />);
    expect(screen.getByText("科目配置")).toBeInTheDocument();
    expect(screen.getByText("2 个科目")).toBeInTheDocument();
  });

  it("renders subject rows with select and max score input", () => {
    render(<ExamSubjectsForm {...baseProps()} />);
    // Each row has a select for subject and input for max_score
    const selects = screen.getAllByRole("combobox");
    expect(selects.length).toBe(2);
    const maxScoreInputs = screen.getAllByPlaceholderText("满分");
    expect(maxScoreInputs.length).toBe(2);
  });

  it("renders add subject button", () => {
    render(<ExamSubjectsForm {...baseProps()} />);
    expect(screen.getByText("添加科目")).toBeInTheDocument();
  });

  it("renders navigation buttons", () => {
    render(<ExamSubjectsForm {...baseProps()} />);
    expect(screen.getByText("上一步")).toBeInTheDocument();
    expect(screen.getByText("取消")).toBeInTheDocument();
    expect(screen.getByText("创建考试")).toBeInTheDocument();
  });

  it("uses custom submitLabel when provided", () => {
    render(<ExamSubjectsForm {...baseProps({ submitLabel: "更新考试" })} />);
    expect(screen.getByText("更新考试")).toBeInTheDocument();
  });

  it("calls onAddSubject when add button clicked", async () => {
    const user = userEvent.setup();
    const onAddSubject = vi.fn();
    render(<ExamSubjectsForm {...baseProps({ onAddSubject })} />);
    await user.click(screen.getByText("添加科目"));
    expect(onAddSubject).toHaveBeenCalledTimes(1);
  });

  it("calls onRemoveSubject when delete button clicked", async () => {
    const user = userEvent.setup();
    const onRemoveSubject = vi.fn();
    render(<ExamSubjectsForm {...baseProps({ onRemoveSubject })} />);
    const deleteButtons = screen.getAllByTitle("删除此科目");
    await user.click(deleteButtons[0]);
    expect(onRemoveSubject).toHaveBeenCalledWith(0);
  });

  it("calls onSubmit when submit button clicked", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ExamSubjectsForm {...baseProps({ onSubmit })} />);
    await user.click(screen.getByText("创建考试"));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("calls onPrevStep when back button clicked", async () => {
    const user = userEvent.setup();
    const onPrevStep = vi.fn();
    render(<ExamSubjectsForm {...baseProps({ onPrevStep })} />);
    await user.click(screen.getByText("上一步"));
    expect(onPrevStep).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when cancel button clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<ExamSubjectsForm {...baseProps({ onCancel })} />);
    await user.click(screen.getByText("取消"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("disables submit button when submitting", () => {
    render(<ExamSubjectsForm {...baseProps({ submitting: true })} />);
    const button = screen.getByRole("button", { name: /提交中/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByText("提交中...")).toBeInTheDocument();
  });

  it("shows loading state when loadingSubjects is true", () => {
    render(<ExamSubjectsForm {...baseProps({ loadingSubjects: true })} />);
    expect(screen.getByText("正在加载默认科目...")).toBeInTheDocument();
  });

  it("shows empty state when no subjects", () => {
    render(<ExamSubjectsForm {...baseProps({ subjects: [] })} />);
    expect(screen.getByText("暂无科目，点击下方按钮添加")).toBeInTheDocument();
    expect(screen.getByText("0 个科目")).toBeInTheDocument();
  });

  it("calls onSubjectChange when subject select changes", async () => {
    const user = userEvent.setup();
    const onSubjectChange = vi.fn();
    render(<ExamSubjectsForm {...baseProps({ onSubjectChange })} />);
    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects[0], "english");
    expect(onSubjectChange).toHaveBeenCalledWith(0, "subject_code", "english");
  });
});

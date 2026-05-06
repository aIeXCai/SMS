import { vi, describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ScoreFilterBar from "./ScoreFilterBar";
import type { Filters, ScoreOptions, Option } from "../types";
import { EMPTY_FILTERS } from "../types";

const mockOptions: ScoreOptions = {
  exams: [{ value: "1", label: "期中考试" }],
  grade_levels: [{ value: "高一", label: "高一" }],
  class_name_choices: [],
  subjects: [],
  all_subjects: [],
  per_page_options: [10, 20, 50],
};

const noop = () => {};

describe("ScoreFilterBar", () => {
  it("renders collapsed by default", () => {
    render(
      <ScoreFilterBar
        filters={EMPTY_FILTERS} options={mockOptions} gradeClasses={[]}
        collapsed={true} onToggleCollapse={noop}
        gradeDropdownOpen={false} examDropdownOpen={false} classDropdownOpen={false}
        onGradeDropdownToggle={noop} onExamDropdownToggle={noop} onClassDropdownToggle={noop}
        onGradeSelect={noop} onExamSelect={noop} onClassSelect={noop}
        onStudentIdChange={noop} onStudentNameChange={noop}
        onFilter={noop} onReset={noop}
      />
    );
    expect(screen.getByText("高级筛选")).toBeInTheDocument();
    // Body should NOT be visible when collapsed
    expect(screen.queryByText("筛选")).not.toBeInTheDocument();
    expect(screen.queryByText("重置筛选")).not.toBeInTheDocument();
  });

  it("renders expanded body when not collapsed", () => {
    render(
      <ScoreFilterBar
        filters={EMPTY_FILTERS} options={mockOptions} gradeClasses={[]}
        collapsed={false} onToggleCollapse={noop}
        gradeDropdownOpen={false} examDropdownOpen={false} classDropdownOpen={false}
        onGradeDropdownToggle={noop} onExamDropdownToggle={noop} onClassDropdownToggle={noop}
        onGradeSelect={noop} onExamSelect={noop} onClassSelect={noop}
        onStudentIdChange={noop} onStudentNameChange={noop}
        onFilter={noop} onReset={noop}
      />
    );
    expect(screen.getByText("筛选")).toBeInTheDocument();
    expect(screen.getByText("重置筛选")).toBeInTheDocument();
    // Dropdown labels
    expect(screen.getByText("年级")).toBeInTheDocument();
    expect(screen.getByText("考试")).toBeInTheDocument();
    expect(screen.getByText("班级")).toBeInTheDocument();
  });

  it("calls onToggleCollapse when header is clicked", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <ScoreFilterBar
        filters={EMPTY_FILTERS} options={mockOptions} gradeClasses={[]}
        collapsed={true} onToggleCollapse={onToggle}
        gradeDropdownOpen={false} examDropdownOpen={false} classDropdownOpen={false}
        onGradeDropdownToggle={noop} onExamDropdownToggle={noop} onClassDropdownToggle={noop}
        onGradeSelect={noop} onExamSelect={noop} onClassSelect={noop}
        onStudentIdChange={noop} onStudentNameChange={noop}
        onFilter={noop} onReset={noop}
      />
    );
    await user.click(screen.getByText("高级筛选"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("calls onFilter and onReset when buttons are clicked", async () => {
    const user = userEvent.setup();
    const onFilter = vi.fn();
    const onReset = vi.fn();
    render(
      <ScoreFilterBar
        filters={EMPTY_FILTERS} options={mockOptions} gradeClasses={[]}
        collapsed={false} onToggleCollapse={noop}
        gradeDropdownOpen={false} examDropdownOpen={false} classDropdownOpen={false}
        onGradeDropdownToggle={noop} onExamDropdownToggle={noop} onClassDropdownToggle={noop}
        onGradeSelect={noop} onExamSelect={noop} onClassSelect={noop}
        onStudentIdChange={noop} onStudentNameChange={noop}
        onFilter={onFilter} onReset={onReset}
      />
    );
    await user.click(screen.getByText("筛选"));
    expect(onFilter).toHaveBeenCalledTimes(1);
    await user.click(screen.getByText("重置筛选"));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("shows chevron-down when collapsed, chevron-up when expanded", () => {
    const { rerender, container } = render(
      <ScoreFilterBar
        filters={EMPTY_FILTERS} options={mockOptions} gradeClasses={[]}
        collapsed={true} onToggleCollapse={noop}
        gradeDropdownOpen={false} examDropdownOpen={false} classDropdownOpen={false}
        onGradeDropdownToggle={noop} onExamDropdownToggle={noop} onClassDropdownToggle={noop}
        onGradeSelect={noop} onExamSelect={noop} onClassSelect={noop}
        onStudentIdChange={noop} onStudentNameChange={noop}
        onFilter={noop} onReset={noop}
      />
    );
    expect(container.querySelector(".fa-chevron-down")).toBeInTheDocument();

    rerender(
      <ScoreFilterBar
        filters={EMPTY_FILTERS} options={mockOptions} gradeClasses={[]}
        collapsed={false} onToggleCollapse={noop}
        gradeDropdownOpen={false} examDropdownOpen={false} classDropdownOpen={false}
        onGradeDropdownToggle={noop} onExamDropdownToggle={noop} onClassDropdownToggle={noop}
        onGradeSelect={noop} onExamSelect={noop} onClassSelect={noop}
        onStudentIdChange={noop} onStudentNameChange={noop}
        onFilter={noop} onReset={noop}
      />
    );
    expect(container.querySelector(".fa-chevron-up")).toBeInTheDocument();
  });
});

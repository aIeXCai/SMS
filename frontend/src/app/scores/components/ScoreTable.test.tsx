import { vi, describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import ScoreTable from "./ScoreTable";
import type { ScoreRow } from "../types";

const mockRow: ScoreRow = {
  record_key: "rk1",
  student_id: 1001,
  exam_id: 1,
  student: {
    student_id: "2024001",
    name: "张三",
    grade_level: "高一",
    grade_level_display: "高一",
  },
  class: { class_name: "1班" },
  exam: { id: 1, name: "期中考试", academic_year: "2024-2025", date: "2024-11-01" },
  scores: { "数学": 95, "语文": 88 },
};

describe("ScoreTable", () => {
  it("renders table headers with subjects", () => {
    render(
      <ScoreTable
        rows={[mockRow]} allSubjects={["数学", "语文"]}
        selected={{}} allFilteredSelected={false}
        currentPageIndeterminate={false} isSelectingAll={false}
        totalCount={1} canScoreWrite={true}
        onToggleSelectAll={vi.fn()} onToggleOne={vi.fn()}
      />
    );
    expect(screen.getByText("学号")).toBeInTheDocument();
    expect(screen.getByText("学生姓名")).toBeInTheDocument();
    expect(screen.getByText("年级")).toBeInTheDocument();
    expect(screen.getByText("班级")).toBeInTheDocument();
    expect(screen.getByText("考试名称")).toBeInTheDocument();
    expect(screen.getByText("数学")).toBeInTheDocument();
    expect(screen.getByText("语文")).toBeInTheDocument();
  });

  it("renders student data in rows", () => {
    render(
      <ScoreTable
        rows={[mockRow]} allSubjects={["数学", "语文"]}
        selected={{}} allFilteredSelected={false}
        currentPageIndeterminate={false} isSelectingAll={false}
        totalCount={1} canScoreWrite={true}
        onToggleSelectAll={vi.fn()} onToggleOne={vi.fn()}
      />
    );
    expect(screen.getByText("2024001")).toBeInTheDocument();
    expect(screen.getByText("张三")).toBeInTheDocument();
    expect(screen.getByText("高一")).toBeInTheDocument();
    expect(screen.getByText("1班")).toBeInTheDocument();
    expect(screen.getByText("期中考试")).toBeInTheDocument();
    expect(screen.getByText("95")).toBeInTheDocument();
    expect(screen.getByText("88")).toBeInTheDocument();
  });

  it("shows '-' for missing scores", () => {
    const rowNoScore: ScoreRow = {
      ...mockRow,
      record_key: "rk2",
      scores: { "数学": 95 },
    };
    render(
      <ScoreTable
        rows={[rowNoScore]} allSubjects={["数学", "语文"]}
        selected={{}} allFilteredSelected={false}
        currentPageIndeterminate={false} isSelectingAll={false}
        totalCount={1} canScoreWrite={true}
        onToggleSelectAll={vi.fn()} onToggleOne={vi.fn()}
      />
    );
    // Math score exists
    expect(screen.getByText("95")).toBeInTheDocument();
    // Chinese score is missing, shows dash
    expect(screen.getByText("-")).toBeInTheDocument();
  });

  it("shows checkboxes when canScoreWrite is true", () => {
    render(
      <ScoreTable
        rows={[mockRow]} allSubjects={["数学"]}
        selected={{}} allFilteredSelected={false}
        currentPageIndeterminate={false} isSelectingAll={false}
        totalCount={1} canScoreWrite={true}
        onToggleSelectAll={vi.fn()} onToggleOne={vi.fn()}
      />
    );
    const checkboxes = screen.getAllByRole("checkbox");
    // One for select-all, one for the row
    expect(checkboxes.length).toBe(2);
  });

  it("hides checkboxes when canScoreWrite is false", () => {
    render(
      <ScoreTable
        rows={[mockRow]} allSubjects={["数学"]}
        selected={{}} allFilteredSelected={false}
        currentPageIndeterminate={false} isSelectingAll={false}
        totalCount={1} canScoreWrite={false}
        onToggleSelectAll={vi.fn()} onToggleOne={vi.fn()}
      />
    );
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("shows '只读' when canScoreWrite is false", () => {
    render(
      <ScoreTable
        rows={[mockRow]} allSubjects={["数学"]}
        selected={{}} allFilteredSelected={false}
        currentPageIndeterminate={false} isSelectingAll={false}
        totalCount={1} canScoreWrite={false}
        onToggleSelectAll={vi.fn()} onToggleOne={vi.fn()}
      />
    );
    expect(screen.getByText("只读")).toBeInTheDocument();
    expect(screen.queryByText("编辑成绩")).not.toBeInTheDocument();
  });

  it("shows edit link when canScoreWrite is true", () => {
    render(
      <ScoreTable
        rows={[mockRow]} allSubjects={["数学"]}
        selected={{}} allFilteredSelected={false}
        currentPageIndeterminate={false} isSelectingAll={false}
        totalCount={1} canScoreWrite={true}
        onToggleSelectAll={vi.fn()} onToggleOne={vi.fn()}
      />
    );
    const editLink = screen.getByText("编辑成绩");
    expect(editLink).toBeInTheDocument();
    expect(editLink.closest("a")).toHaveAttribute("href", "/scores/batch-edit?student=1001&exam=1");
  });

  it("calls onToggleOne when row checkbox is clicked", async () => {
    const user = userEvent.setup();
    const onToggleOne = vi.fn();
    render(
      <ScoreTable
        rows={[mockRow]} allSubjects={["数学"]}
        selected={{}} allFilteredSelected={false}
        currentPageIndeterminate={false} isSelectingAll={false}
        totalCount={1} canScoreWrite={true}
        onToggleSelectAll={vi.fn()} onToggleOne={onToggleOne}
      />
    );
    const checkboxes = screen.getAllByRole("checkbox");
    // Second checkbox is the row one (first is select-all)
    await user.click(checkboxes[1]);
    expect(onToggleOne).toHaveBeenCalledWith("rk1");
  });

  it("calls onToggleSelectAll when select-all checkbox is clicked", async () => {
    const user = userEvent.setup();
    const onToggleSelectAll = vi.fn();
    render(
      <ScoreTable
        rows={[mockRow]} allSubjects={["数学"]}
        selected={{}} allFilteredSelected={false}
        currentPageIndeterminate={false} isSelectingAll={false}
        totalCount={1} canScoreWrite={true}
        onToggleSelectAll={onToggleSelectAll} onToggleOne={vi.fn()}
      />
    );
    await user.click(screen.getAllByRole("checkbox")[0]);
    expect(onToggleSelectAll).toHaveBeenCalledTimes(1);
  });

  it("disables select-all checkbox when isSelectingAll is true", () => {
    render(
      <ScoreTable
        rows={[mockRow]} allSubjects={["数学"]}
        selected={{}} allFilteredSelected={false}
        currentPageIndeterminate={false} isSelectingAll={true}
        totalCount={1} canScoreWrite={true}
        onToggleSelectAll={vi.fn()} onToggleOne={vi.fn()}
      />
    );
    const selectAllCheckbox = screen.getAllByRole("checkbox")[0] as HTMLInputElement;
    expect(selectAllCheckbox.disabled).toBe(true);
  });
});

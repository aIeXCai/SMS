import { vi, describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import ScoreWorkbench from "./ScoreWorkbench";

describe("ScoreWorkbench", () => {
  it("shows read-only view when canScoreWrite is false", () => {
    render(
      <ScoreWorkbench
        canScoreWrite={false}
        isGradeManager={false}
        onImportClick={vi.fn()}
      />
    );
    expect(screen.getByText("成绩管理")).toBeInTheDocument();
    expect(screen.getByText(/只读/)).toBeInTheDocument();
    // Should NOT render action buttons
    expect(screen.queryByText("手动新增成绩")).not.toBeInTheDocument();
    expect(screen.queryByText("批量导入")).not.toBeInTheDocument();
  });

  it("renders three operation cards when canScoreWrite is true", () => {
    render(
      <ScoreWorkbench
        canScoreWrite={true}
        isGradeManager={false}
        onImportClick={vi.fn()}
      />
    );
    // Empty state description
    expect(screen.getByText("暂未找到成绩记录")).toBeInTheDocument();
    // Three cards
    expect(screen.getByText("录入成绩")).toBeInTheDocument();
    const importElements = screen.getAllByText("批量导入");
    expect(importElements.length).toBeGreaterThanOrEqual(2); // header button + card
    expect(screen.getByText("查看进度")).toBeInTheDocument();
  });

  it("shows grade_manager specific third card", () => {
    render(
      <ScoreWorkbench
        canScoreWrite={true}
        isGradeManager={true}
        onImportClick={vi.fn()}
      />
    );
    expect(screen.getByText("年级概览")).toBeInTheDocument();
    expect(screen.queryByText("查看进度")).not.toBeInTheDocument();
  });

  it("shows admin/non-manager third card", () => {
    render(
      <ScoreWorkbench
        canScoreWrite={true}
        isGradeManager={false}
        onImportClick={vi.fn()}
      />
    );
    expect(screen.getByText("查看进度")).toBeInTheDocument();
    expect(screen.queryByText("年级概览")).not.toBeInTheDocument();
  });

  it("calls onImportClick when batch import card is clicked", async () => {
    const user = userEvent.setup();
    const onImportClick = vi.fn();
    render(
      <ScoreWorkbench
        canScoreWrite={true}
        isGradeManager={false}
        onImportClick={onImportClick}
      />
    );
    // The batch import card button (second occurrence, index 1 — first is header button)
    const importButtons = screen.getAllByText("批量导入");
    await user.click(importButtons[1]);
    expect(onImportClick).toHaveBeenCalledTimes(1);
  });

  it("renders action buttons in header", () => {
    render(
      <ScoreWorkbench
        canScoreWrite={true}
        isGradeManager={false}
        onImportClick={vi.fn()}
      />
    );
    expect(screen.getByText("手动新增成绩")).toBeInTheDocument();
    const addLink = screen.getByText("手动新增成绩").closest("a");
    expect(addLink).toHaveAttribute("href", "/scores/add");
  });
});

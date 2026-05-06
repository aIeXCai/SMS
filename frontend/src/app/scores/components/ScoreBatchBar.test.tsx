import { vi, describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ScoreBatchBar from "./ScoreBatchBar";

describe("ScoreBatchBar", () => {
  it("returns null when canScoreWrite is false", () => {
    const { container } = render(
      <ScoreBatchBar
        selectedCount={5} totalCount={100}
        canScoreWrite={false}
        onDeleteSelected={vi.fn()} onDeleteFiltered={vi.fn()}
      />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders batch operation bar with selected count", () => {
    render(
      <ScoreBatchBar
        selectedCount={5} totalCount={100}
        canScoreWrite={true}
        onDeleteSelected={vi.fn()} onDeleteFiltered={vi.fn()}
      />
    );
    expect(screen.getByText("批量操作")).toBeInTheDocument();
    expect(screen.getByText(/已选择: 5 \/ 100 条记录/)).toBeInTheDocument();
    expect(screen.getByText("删除选中项")).toBeInTheDocument();
    expect(screen.getByText("删除筛选结果")).toBeInTheDocument();
  });

  it("calls onDeleteSelected when delete selected button clicked", async () => {
    const user = userEvent.setup();
    const onDeleteSelected = vi.fn();
    render(
      <ScoreBatchBar
        selectedCount={5} totalCount={100}
        canScoreWrite={true}
        onDeleteSelected={onDeleteSelected} onDeleteFiltered={vi.fn()}
      />
    );
    await user.click(screen.getByText("删除选中项"));
    expect(onDeleteSelected).toHaveBeenCalledTimes(1);
  });

  it("calls onDeleteFiltered when delete filtered button clicked", async () => {
    const user = userEvent.setup();
    const onDeleteFiltered = vi.fn();
    render(
      <ScoreBatchBar
        selectedCount={5} totalCount={100}
        canScoreWrite={true}
        onDeleteSelected={vi.fn()} onDeleteFiltered={onDeleteFiltered}
      />
    );
    await user.click(screen.getByText("删除筛选结果"));
    expect(onDeleteFiltered).toHaveBeenCalledTimes(1);
  });
});

import { fireEvent, render, screen } from "@testing-library/react";

import SnapshotList, { FilterSnapshot } from "./SnapshotList";

const snapshots: FilterSnapshot[] = [
  {
    id: 1,
    snapshot_name: "较早快照",
    exam_name: "期中考试",
    exam_academic_year: "2024-2025",
    student_count: 12,
    created_at: "2025-01-01T00:00:00Z",
  },
  {
    id: 2,
    snapshot_name: "最新快照",
    exam_name: "期末考试",
    exam_academic_year: "2025-2026",
    student_count: 10,
    created_at: "2026-01-01T00:00:00Z",
  },
];

describe("SnapshotList", () => {
  it("按创建时间倒序展示快照", () => {
    render(
      <SnapshotList
        snapshots={snapshots}
        loading={false}
        error={null}
        baselineSnapshotId={null}
        comparisonSnapshotId={null}
        onSelectBaseline={() => undefined}
        onSelectComparison={() => undefined}
        onDeleteSnapshot={() => undefined}
      />
    );

    const nameCells = screen.getAllByRole("cell").filter((cell) =>
      ["较早快照", "最新快照"].includes(cell.textContent || "")
    );

    expect(nameCells[0]).toHaveTextContent("最新快照");
    expect(nameCells[1]).toHaveTextContent("较早快照");
  });

  it("点击操作按钮会触发对应回调", () => {
    const onSelectBaseline = vi.fn();
    const onSelectComparison = vi.fn();
    const onDeleteSnapshot = vi.fn();

    render(
      <SnapshotList
        snapshots={[snapshots[0]]}
        loading={false}
        error={null}
        baselineSnapshotId={null}
        comparisonSnapshotId={null}
        onSelectBaseline={onSelectBaseline}
        onSelectComparison={onSelectComparison}
        onDeleteSnapshot={onDeleteSnapshot}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "设为基准" }));
    fireEvent.click(screen.getByRole("button", { name: "设为对比" }));
    fireEvent.click(screen.getByRole("button", { name: "删除快照" }));

    expect(onSelectBaseline).toHaveBeenCalledWith(1);
    expect(onSelectComparison).toHaveBeenCalledWith(1);
    expect(onDeleteSnapshot).toHaveBeenCalledWith(1);
  });

  it("删除导致总页数下降时会自动回退到有效页", () => {
    const manySnapshots: FilterSnapshot[] = Array.from({ length: 11 }, (_, index) => ({
      id: index + 1,
      snapshot_name: `快照${index + 1}`,
      exam_name: "阶段考试",
      exam_academic_year: "2025-2026",
      student_count: 20,
      created_at: `2026-01-${String(index + 1).padStart(2, "0")}T00:00:00Z`,
    }));

    const { rerender } = render(
      <SnapshotList
        snapshots={manySnapshots}
        loading={false}
        error={null}
        baselineSnapshotId={null}
        comparisonSnapshotId={null}
        onSelectBaseline={() => undefined}
        onSelectComparison={() => undefined}
        onDeleteSnapshot={() => undefined}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "末页" }));
    expect(screen.getByText("第 2 / 2 页")).toBeInTheDocument();

    rerender(
      <SnapshotList
        snapshots={manySnapshots.slice(0, 10)}
        loading={false}
        error={null}
        baselineSnapshotId={null}
        comparisonSnapshotId={null}
        onSelectBaseline={() => undefined}
        onSelectComparison={() => undefined}
        onDeleteSnapshot={() => undefined}
      />
    );

    expect(screen.queryByText(/第\s*\d+\s*\/\s*\d+\s*页/)).not.toBeInTheDocument();
    expect(screen.getByText("快照10")).toBeInTheDocument();
    expect(screen.queryByText("快照11")).not.toBeInTheDocument();
  });
});

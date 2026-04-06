import { fireEvent, render, screen, within } from "@testing-library/react";

import ComparisonResult, { SnapshotComparisonResult } from "./ComparisonResult";

const xlsxMocks = vi.hoisted(() => ({
  writeFileMock: vi.fn(),
  appendSheetMock: vi.fn(),
  createSheetMock: vi.fn(() => ({})),
  createBookMock: vi.fn(() => ({})),
}));

vi.mock("xlsx", () => ({
  default: {},
  utils: {
    json_to_sheet: xlsxMocks.createSheetMock,
    book_new: xlsxMocks.createBookMock,
    book_append_sheet: xlsxMocks.appendSheetMock,
  },
  writeFile: xlsxMocks.writeFileMock,
}));

const result: SnapshotComparisonResult = {
  baseline: {
    id: 1,
    exam_name: "2025-2026 期中考试",
    snapshot_name: "期中快照",
    created_at: "2026-04-01T08:00:00Z",
  },
  comparison: {
    id: 2,
    exam_name: "2025-2026 期末考试",
    snapshot_name: "期末快照",
    created_at: "2026-06-20T08:00:00Z",
  },
  changes: {
    added: [
      {
        student_id: 1,
        cohort: "初中2026级",
        name: "甲",
        class_name: "1班",
        old_rank: 10,
        new_rank: 4,
        rank_change: 6,
      },
      {
        student_id: 2,
        cohort: "初中2026级",
        name: "乙",
        class_name: "1班",
        old_rank: 3,
        new_rank: 5,
        rank_change: -2,
      },
    ],
    removed: [],
    retained: [],
  },
  summary: {
    added_count: 2,
    removed_count: 0,
    retained_count: 0,
    retention_rate: "0.00%",
  },
};

describe("ComparisonResult", () => {
  beforeEach(() => {
    xlsxMocks.writeFileMock.mockClear();
    xlsxMocks.appendSheetMock.mockClear();
    xlsxMocks.createSheetMock.mockClear();
    xlsxMocks.createBookMock.mockClear();
  });

  it("点击排名变化表头可切换升降序", () => {
    render(<ComparisonResult result={result} loading={false} error={null} />);

    const addedCard = screen.getByText("新增名单").closest(".card") as HTMLElement;
    const tbody = within(addedCard).getByRole("table").querySelector("tbody") as HTMLTableSectionElement;

    const firstNameBefore = tbody.querySelector("tr td:nth-child(2)")?.textContent;
    expect(firstNameBefore).toBe("甲");

    fireEvent.click(within(addedCard).getByText("排名变化"));

    const firstNameAfter = tbody.querySelector("tr td:nth-child(2)")?.textContent;
    expect(firstNameAfter).toBe("乙");
  });

  it("支持单表导出与全部导出", () => {
    window.alert = vi.fn();

    render(<ComparisonResult result={result} loading={false} error={null} />);

    fireEvent.click(screen.getAllByRole("button", { name: /导出 Excel/ })[0]);
    expect(xlsxMocks.writeFileMock).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /全部导出/ }));
    expect(xlsxMocks.appendSheetMock).toHaveBeenCalledTimes(4);
  });
});

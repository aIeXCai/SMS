import { render, screen } from "@testing-library/react";

import ComparisonResult, { SnapshotComparisonResult } from "./ComparisonResult";

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
    ],
    removed: [],
    retained: [],
  },
  summary: {
    added_count: 1,
    removed_count: 0,
    retained_count: 0,
    retention_rate: "0.00%",
  },
};

const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Gecko/20100101 Firefox/138.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.4 Safari/605.1.15",
];

describe("Tracking browser compatibility baseline", () => {
  it.each(userAgents)("在UA=%s 下对比结果核心结构可渲染", (ua) => {
    Object.defineProperty(window.navigator, "userAgent", {
      value: ua,
      configurable: true,
    });

    render(<ComparisonResult result={result} loading={false} error={null} />);

    expect(screen.getByText("新增名单")).toBeInTheDocument();
    expect(screen.getByText("全部导出")).toBeInTheDocument();
    expect(screen.getByText("排名变化")).toBeInTheDocument();
    expect(screen.getByText("甲")).toBeInTheDocument();
  });
});

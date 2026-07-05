import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import StudentAnalysisDetailPage from "./page";

const pushMock = vi.fn();

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => ({
    get: (key: string) => (key === "student_id" ? "1" : null),
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ token: "mock-token", loading: false }),
}));

vi.mock("@/lib/chart", () => ({
  default: class MockChart {
    destroy() {}
  },
}));

const baseAnalysisPayload = {
  success: true,
  data: {
    student_info: {
      id: 1,
      student_id: "S001",
      name: "张三",
      grade_level: "2024级",
      class_name: "高一(3)班",
    },
    exams: [
      {
        id: 1,
        name: "期中",
        academic_year: "2025-2026",
        exam_date: "2025-11-20",
        grade_level: "高一",
        scores: [
          { subject_name: "语文", score_value: 100, full_score: 150, grade_rank: 10, class_rank: 3 },
        ],
        total_score: 100,
        average_score: 100,
        grade_total_rank: 10,
        class_total_rank: 3,
      },
    ],
    subjects: ["语文"],
    trend_data: {
      total: { class_ranks: [3], grade_ranks: [10], scores: [100], exam_names: ["期中"], exam_ids: [1] },
      语文: { class_ranks: [3], grade_ranks: [10], scores: [100], exam_names: ["期中"], exam_ids: [1] },
    },
    summary: { total_exams: 1, subjects_count: 1 },
  },
};

describe("StudentAnalysisDetail export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "location", {
      value: { hostname: "localhost" },
      writable: true,
    });
    window.URL.createObjectURL = vi.fn(() => "blob:mock-url");
    window.URL.revokeObjectURL = vi.fn();

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("student-analysis-data")) {
        return {
          ok: true,
          json: async () => baseAnalysisPayload,
        } as Response;
      }
      if (url.includes("student-analysis-report-export")) {
        return {
          ok: true,
          blob: async () => new Blob(["excel"], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
          headers: {
            get: (name: string) => {
              if (name.toLowerCase() === "content-disposition") {
                return "attachment; filename*=UTF-8''2024%E7%BA%A7%E9%AB%98%E4%B8%80(3)%E7%8F%AD%E5%BC%A0%E4%B8%89%E4%B8%AA%E4%BA%BA%E6%88%90%E7%BB%A9%E5%88%86%E6%9E%90%E6%8A%A5%E5%91%8A.xlsx";
              }
              return null;
            },
          },
        } as Response;
      }
      throw new Error(`Unexpected fetch url: ${url}`);
    }) as unknown as typeof fetch;
  });

  it("点击导出按钮后调用导出接口并显示成功提示", async () => {
    render(<StudentAnalysisDetailPage />);

    const exportButton = await screen.findByRole("button", { name: /导出个人报告/ });
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/scores/student-analysis-report-export?student_id=1"),
        expect.any(Object),
      );
    });

    expect(await screen.findByText("导出成功，文件已开始下载。")).toBeInTheDocument();
  });

  it("导出请求进行中按钮展示导出中并禁用", async () => {
    let resolveExport: ((value: Response) => void) | undefined;
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("student-analysis-data")) {
        return Promise.resolve({
          ok: true,
          json: async () => baseAnalysisPayload,
        } as Response);
      }
      if (url.includes("student-analysis-report-export")) {
        return new Promise((resolve) => {
          resolveExport = resolve;
        });
      }
      return Promise.reject(new Error(`Unexpected fetch url: ${url}`));
    }) as unknown as typeof fetch;

    render(<StudentAnalysisDetailPage />);
    const exportButton = await screen.findByRole("button", { name: /导出个人报告/ });
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /导出中\.\.\./ })).toBeDisabled();
    });

    if (resolveExport) {
      resolveExport({
        ok: true,
        blob: async () => new Blob(["excel"], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
        headers: { get: () => null },
      } as unknown as Response);
    }

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /导出个人报告/ })).not.toBeDisabled();
    });
  });
});

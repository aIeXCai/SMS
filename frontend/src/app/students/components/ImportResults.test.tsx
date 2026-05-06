import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ImportResults from "./ImportResults";

const successResults = {
  success: true,
  imported_count: 50,
  failed_count: 0,
  success_messages: [],
  error_messages: [],
  warning_messages: [],
  failed_rows: [],
};

const failureResults = {
  success: false,
  imported_count: 45,
  failed_count: 5,
  success_messages: [],
  error_messages: [],
  warning_messages: ["第3行日期格式有误，已自动修正"],
  failed_rows: [
    { row: 10, error: "学号不能为空" },
    { row: 15, error: "姓名不能为空" },
  ],
};

describe("ImportResults", () => {
  it("renders success message when import is successful", () => {
    render(<ImportResults importResults={successResults} onComplete={vi.fn()} />);
    expect(screen.getByText("导入完成！")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getByText(/成功导入/)).toBeInTheDocument();
  });

  it("renders failure message when import failed", () => {
    render(<ImportResults importResults={failureResults} onComplete={vi.fn()} />);
    expect(screen.getByText("导入失败！")).toBeInTheDocument();
    expect(screen.getByText("45")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("renders failed rows table when there are failures", () => {
    render(<ImportResults importResults={failureResults} onComplete={vi.fn()} />);
    expect(screen.getByText("失败详情")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();
    expect(screen.getByText("学号不能为空")).toBeInTheDocument();
    expect(screen.getByText("姓名不能为空")).toBeInTheDocument();
  });

  it("does NOT render failed rows table when there are no failures", () => {
    render(<ImportResults importResults={successResults} onComplete={vi.fn()} />);
    expect(screen.queryByText("失败详情")).not.toBeInTheDocument();
  });

  it("renders warning messages when present", () => {
    render(<ImportResults importResults={failureResults} onComplete={vi.fn()} />);
    expect(screen.getByText("警告信息 (已处理但需留意)")).toBeInTheDocument();
    expect(screen.getByText(/第3行日期格式有误/)).toBeInTheDocument();
  });

  it("does NOT render warning section when no warnings", () => {
    render(<ImportResults importResults={successResults} onComplete={vi.fn()} />);
    expect(screen.queryByText("警告信息")).not.toBeInTheDocument();
  });

  it("renders complete button", () => {
    render(<ImportResults importResults={successResults} onComplete={vi.fn()} />);
    expect(screen.getByText("完成并刷新数据")).toBeInTheDocument();
  });

  it("calls onComplete when complete button clicked", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<ImportResults importResults={successResults} onComplete={onComplete} />);
    await user.click(screen.getByText("完成并刷新数据"));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

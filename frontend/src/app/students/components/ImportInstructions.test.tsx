import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ImportInstructions from "./ImportInstructions";

describe("ImportInstructions", () => {
  it("renders import instructions header", () => {
    render(<ImportInstructions onDownloadTemplate={vi.fn()} />);
    expect(screen.getByText("导入说明")).toBeInTheDocument();
  });

  it("renders instruction list items", () => {
    render(<ImportInstructions onDownloadTemplate={vi.fn()} />);
    expect(screen.getByText(/Excel 模板文件/)).toBeInTheDocument();
    expect(screen.getAllByText(/学号/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/姓名/).length).toBeGreaterThan(0);
    expect(screen.getByText(/更新操作/)).toBeInTheDocument();
    expect(screen.getByText(/YYYY-MM-DD/)).toBeInTheDocument();
  });

  it("renders download template button", () => {
    render(<ImportInstructions onDownloadTemplate={vi.fn()} />);
    expect(screen.getByText("下载导入模板")).toBeInTheDocument();
  });

  it("calls onDownloadTemplate when button clicked", async () => {
    const user = userEvent.setup();
    const onDownloadTemplate = vi.fn();
    render(<ImportInstructions onDownloadTemplate={onDownloadTemplate} />);
    await user.click(screen.getByText("下载导入模板"));
    expect(onDownloadTemplate).toHaveBeenCalledTimes(1);
  });
});

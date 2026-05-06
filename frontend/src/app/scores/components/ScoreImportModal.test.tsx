import { vi, describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ScoreImportModal from "./ScoreImportModal";
import type { ScoreOptions } from "../types";

const mockOptions: ScoreOptions = {
  exams: [{ value: "1", label: "期中考试" }, { value: "2", label: "期末考试" }],
  grade_levels: [],
  class_name_choices: [],
  subjects: [],
  all_subjects: [],
  per_page_options: [],
};

describe("ScoreImportModal", () => {
  it("returns null when not visible", () => {
    const { container } = render(
      <ScoreImportModal
        visible={false} options={mockOptions}
onClose={vi.fn()}
        onImportSuccess={vi.fn()} onShowResult={vi.fn()}
      />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders import form when visible", () => {
    render(
      <ScoreImportModal
        visible={true} options={mockOptions}
onClose={vi.fn()}
        onImportSuccess={vi.fn()} onShowResult={vi.fn()}
      />
    );
    expect(screen.getByText("批量导入成绩 (Excel)")).toBeInTheDocument();
    expect(screen.getByText("选择考试")).toBeInTheDocument();
    expect(screen.getByText("开始上传")).toBeInTheDocument();
  });

  it("calls onClose when cancel button clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ScoreImportModal
        visible={true} options={mockOptions}
onClose={onClose}
        onImportSuccess={vi.fn()} onShowResult={vi.fn()}
      />
    );
    await user.click(screen.getByText("取消"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows validation error when submitting without exam selected", async () => {
    const user = userEvent.setup();
    const onShowResult = vi.fn();
    render(
      <ScoreImportModal
        visible={true} options={mockOptions}
onClose={vi.fn()}
        onImportSuccess={vi.fn()} onShowResult={onShowResult}
      />
    );
    await user.click(screen.getByText("开始上传"));
    expect(onShowResult).toHaveBeenCalledWith(
      "error", "导入提示", "缺少必要信息", "请选择考试"
    );
  });

  it("shows validation error when no file selected", async () => {
    const user = userEvent.setup();
    const onShowResult = vi.fn();
    render(
      <ScoreImportModal
        visible={true} options={mockOptions}
onClose={vi.fn()}
        onImportSuccess={vi.fn()} onShowResult={onShowResult}
      />
    );
    // Select an exam first
    const select = screen.getByRole("combobox");
    await user.selectOptions(select, "1");
    // Now submit without file
    await user.click(screen.getByText("开始上传"));
    expect(onShowResult).toHaveBeenCalledWith(
      "error", "导入提示", "缺少必要信息", "请选择Excel文件"
    );
  });

  it("renders exam options in select", () => {
    render(
      <ScoreImportModal
        visible={true} options={mockOptions}
onClose={vi.fn()}
        onImportSuccess={vi.fn()} onShowResult={vi.fn()}
      />
    );
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.options.length).toBe(3); // Default + 2 exams
    expect(screen.getByText("期中考试")).toBeInTheDocument();
    expect(screen.getByText("期末考试")).toBeInTheDocument();
  });

  it("renders usage instructions", () => {
    render(
      <ScoreImportModal
        visible={true} options={mockOptions}
onClose={vi.fn()}
        onImportSuccess={vi.fn()} onShowResult={vi.fn()}
      />
    );
    expect(screen.getByText("使用说明：")).toBeInTheDocument();
    expect(screen.getByText("下载模板文件")).toBeInTheDocument();
  });
});

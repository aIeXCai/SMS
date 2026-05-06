import { vi, describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ScoreConfirmModal from "./ScoreConfirmModal";
import type { ResultModalState } from "../types";

describe("ScoreConfirmModal — delete mode", () => {
  it("returns null when not visible", () => {
    const { container } = render(
      <ScoreConfirmModal
        mode="delete" visible={false}
        selectedCount={5} onConfirmDelete={vi.fn()} onCancelDelete={vi.fn()}
      />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders delete confirmation with selected count", () => {
    render(
      <ScoreConfirmModal
        mode="delete" visible={true}
        selectedCount={5} onConfirmDelete={vi.fn()} onCancelDelete={vi.fn()}
      />
    );
    expect(screen.getByText("确认批量删除")).toBeInTheDocument();
    expect(screen.getByText(/删除选中的 5 条成绩记录/)).toBeInTheDocument();
    expect(screen.getByText("确认删除")).toBeInTheDocument();
    expect(screen.getByText("取消")).toBeInTheDocument();
  });

  it("calls onConfirmDelete when confirm button clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ScoreConfirmModal
        mode="delete" visible={true}
        selectedCount={3} onConfirmDelete={onConfirm} onCancelDelete={vi.fn()}
      />
    );
    await user.click(screen.getByText("确认删除"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancelDelete when cancel button clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <ScoreConfirmModal
        mode="delete" visible={true}
        selectedCount={3} onConfirmDelete={vi.fn()} onCancelDelete={onCancel}
      />
    );
    await user.click(screen.getByText("取消"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe("ScoreConfirmModal — result mode", () => {
  it("returns null when not visible", () => {
    const { container } = render(
      <ScoreConfirmModal
        mode="result" visible={false}
        result={{ show: true, type: "success", title: "OK", subtitle: "", message: "" }}
        onCloseResult={vi.fn()}
      />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders success result", () => {
    const result: ResultModalState = {
      show: true, type: "success", title: "操作成功", subtitle: "数据已更新", message: "共导入10条记录",
    };
    render(
      <ScoreConfirmModal mode="result" visible={true} result={result} onCloseResult={vi.fn()} />
    );
    expect(screen.getByText("操作成功")).toBeInTheDocument();
    expect(screen.getByText("数据已更新")).toBeInTheDocument();
    expect(screen.getByText("共导入10条记录")).toBeInTheDocument();
  });

  it("renders error result", () => {
    const result: ResultModalState = {
      show: true, type: "error", title: "操作失败", subtitle: "导入失败", message: "文件格式不正确",
    };
    render(
      <ScoreConfirmModal mode="result" visible={true} result={result} onCloseResult={vi.fn()} />
    );
    expect(screen.getByText("操作失败")).toBeInTheDocument();
    expect(screen.getByText("导入失败")).toBeInTheDocument();
    expect(screen.getByText("文件格式不正确")).toBeInTheDocument();
  });

  it("calls onCloseResult when close button clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const result: ResultModalState = {
      show: true, type: "success", title: "OK", subtitle: "", message: "done",
    };
    render(
      <ScoreConfirmModal mode="result" visible={true} result={result} onCloseResult={onClose} />
    );
    // Click the "确定" button
    await user.click(screen.getByText("确定"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

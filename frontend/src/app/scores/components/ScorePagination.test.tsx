import { vi, describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ScorePagination from "./ScorePagination";

describe("ScorePagination", () => {
  it("returns null when numPages is 0", () => {
    const { container } = render(
      <ScorePagination
        currentPage={1} numPages={0} pageSize={10}
        totalCount={0} startIndex={0} endIndex={0}
        pageSizeOptions={[10, 20, 50]}
        onPageChange={vi.fn()} onPageSizeChange={vi.fn()}
      />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders page navigation for multiple pages", () => {
    render(
      <ScorePagination
        currentPage={1} numPages={5} pageSize={10}
        totalCount={50} startIndex={1} endIndex={10}
        pageSizeOptions={[10, 20, 50]}
        onPageChange={vi.fn()} onPageSizeChange={vi.fn()}
      />
    );
    // Should show page info text
    expect(screen.getByText(/显示第 1 - 10 条记录，共 50 条/)).toBeInTheDocument();
    // Should show page number buttons
    expect(screen.getByLabelText("首页")).toBeInTheDocument();
    expect(screen.getByLabelText("末页")).toBeInTheDocument();
  });

  it("shows page size selector", () => {
    render(
      <ScorePagination
        currentPage={1} numPages={5} pageSize={10}
        totalCount={50} startIndex={1} endIndex={10}
        pageSizeOptions={[10, 20, 50]}
        onPageChange={vi.fn()} onPageSizeChange={vi.fn()}
      />
    );
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("10");
    expect(screen.getByText("10 条")).toBeInTheDocument();
  });

  it("calls onPageChange when page number is clicked", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <ScorePagination
        currentPage={1} numPages={5} pageSize={10}
        totalCount={50} startIndex={1} endIndex={10}
        pageSizeOptions={[10, 20, 50]}
        onPageChange={onPageChange} onPageSizeChange={vi.fn()}
      />
    );
    // Click page 3
    await user.click(screen.getByText("3"));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("calls onPageSizeChange when page size is changed", async () => {
    const user = userEvent.setup();
    const onPageSizeChange = vi.fn();
    const onPageChange = vi.fn();
    render(
      <ScorePagination
        currentPage={3} numPages={5} pageSize={10}
        totalCount={50} startIndex={21} endIndex={30}
        pageSizeOptions={[10, 20, 50]}
        onPageChange={onPageChange} onPageSizeChange={onPageSizeChange}
      />
    );
    const select = screen.getByRole("combobox");
    await user.selectOptions(select, "20");
    expect(onPageSizeChange).toHaveBeenCalledWith(20);
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("disables first/prev buttons on first page", () => {
    render(
      <ScorePagination
        currentPage={1} numPages={5} pageSize={10}
        totalCount={50} startIndex={1} endIndex={10}
        pageSizeOptions={[10, 20, 50]}
        onPageChange={vi.fn()} onPageSizeChange={vi.fn()}
      />
    );
    expect(screen.getByLabelText("首页")).toBeDisabled();
    expect(screen.getByLabelText("上一页")).toBeDisabled();
  });

  it("disables last/next buttons on last page", () => {
    render(
      <ScorePagination
        currentPage={5} numPages={5} pageSize={10}
        totalCount={50} startIndex={41} endIndex={50}
        pageSizeOptions={[10, 20, 50]}
        onPageChange={vi.fn()} onPageSizeChange={vi.fn()}
      />
    );
    expect(screen.getByLabelText("末页")).toBeDisabled();
    expect(screen.getByLabelText("下一页")).toBeDisabled();
  });

  it("highlights current page as active", () => {
    render(
      <ScorePagination
        currentPage={3} numPages={5} pageSize={10}
        totalCount={50} startIndex={21} endIndex={30}
        pageSizeOptions={[10, 20, 50]}
        onPageChange={vi.fn()} onPageSizeChange={vi.fn()}
      />
    );
    expect(screen.getByText("3")).toHaveClass("bg-blue-600");
  });
});

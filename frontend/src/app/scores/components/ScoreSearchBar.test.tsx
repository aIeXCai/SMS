import { vi, describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ScoreSearchBar from "./ScoreSearchBar";

describe("ScoreSearchBar", () => {
  it("renders search inputs and button", () => {
    render(
      <ScoreSearchBar
        studentIdFilter=""
        studentNameFilter=""
        onStudentIdChange={vi.fn()}
        onStudentNameChange={vi.fn()}
        onSearch={vi.fn()}
      />
    );
    expect(screen.getByText("快速搜索")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("学号")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("学生姓名")).toBeInTheDocument();
    expect(screen.getByText("搜索")).toBeInTheDocument();
  });

  it("displays current filter values", () => {
    render(
      <ScoreSearchBar
        studentIdFilter="2024001"
        studentNameFilter="张三"
        onStudentIdChange={vi.fn()}
        onStudentNameChange={vi.fn()}
        onSearch={vi.fn()}
      />
    );
    const idInput = screen.getByPlaceholderText("学号") as HTMLInputElement;
    const nameInput = screen.getByPlaceholderText("学生姓名") as HTMLInputElement;
    expect(idInput.value).toBe("2024001");
    expect(nameInput.value).toBe("张三");
  });

  it("calls onSearch when search button is clicked", async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(
      <ScoreSearchBar
        studentIdFilter=""
        studentNameFilter=""
        onStudentIdChange={vi.fn()}
        onStudentNameChange={vi.fn()}
        onSearch={onSearch}
      />
    );
    await user.click(screen.getByText("搜索"));
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it("calls onSearch when Enter is pressed in input", async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(
      <ScoreSearchBar
        studentIdFilter=""
        studentNameFilter=""
        onStudentIdChange={vi.fn()}
        onStudentNameChange={vi.fn()}
        onSearch={onSearch}
      />
    );
    const idInput = screen.getByPlaceholderText("学号");
    await user.type(idInput, "{Enter}");
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it("calls onChange handlers on input", async () => {
    const user = userEvent.setup();
    const onStudentIdChange = vi.fn();
    const onStudentNameChange = vi.fn();
    render(
      <ScoreSearchBar
        studentIdFilter=""
        studentNameFilter=""
        onStudentIdChange={onStudentIdChange}
        onStudentNameChange={onStudentNameChange}
        onSearch={vi.fn()}
      />
    );
    await user.type(screen.getByPlaceholderText("学号"), "1");
    expect(onStudentIdChange).toHaveBeenCalled();
    await user.type(screen.getByPlaceholderText("学生姓名"), "张");
    expect(onStudentNameChange).toHaveBeenCalled();
  });
});

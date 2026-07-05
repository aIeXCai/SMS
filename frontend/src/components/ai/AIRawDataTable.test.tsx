import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { AIRawDataTable } from "./AIRawDataTable";

describe("AIRawDataTable", () => {
  // --- Null data ---
  it("should render '无原始数据' when data is null", () => {
    render(<AIRawDataTable data={null} />);
    expect(screen.getByText("无原始数据")).toBeInTheDocument();
  });

  // --- Empty data ---
  it("should render '数据为空' when data is an empty object", () => {
    render(<AIRawDataTable data={{}} />);
    expect(screen.getByText("数据为空")).toBeInTheDocument();
  });

  // --- Simple key-value pairs ---
  it("should render flat key-value pairs", () => {
    render(
      <AIRawDataTable
        data={{
          name: "张三",
          score: 92,
          grade: "高一",
        }}
      />
    );

    expect(screen.getByText("name")).toBeInTheDocument();
    expect(screen.getByText("张三")).toBeInTheDocument();
    expect(screen.getByText("score")).toBeInTheDocument();
    expect(screen.getByText("92")).toBeInTheDocument();
    expect(screen.getByText("grade")).toBeInTheDocument();
    expect(screen.getByText("高一")).toBeInTheDocument();
  });

  // --- Null/undefined values render as "—" ---
  it('should render null value as "—"', () => {
    render(
      <AIRawDataTable
        data={{
          name: null,
          count: 5,
        }}
      />
    );

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it('should render undefined value as "—"', () => {
    render(
      <AIRawDataTable
        data={{
          missing: undefined as unknown,
          count: 5,
        }}
      />
    );

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  // --- Nested objects ---
  it("should render nested objects with header row and indented children", () => {
    render(
      <AIRawDataTable
        data={{
          student: {
            id: 1,
            name: "张三",
          },
        }}
      />
    );

    // "student" is a header row (key, empty value, bold)
    expect(screen.getByText("student")).toBeInTheDocument();
    // Children are indented (depth=1 → paddingLeft: 8 + 16 = 24px)
    expect(screen.getByText("id")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("name")).toBeInTheDocument();
    expect(screen.getByText("张三")).toBeInTheDocument();

    // Check indentation exists on nested key
    const idCell = screen.getByText("id");
    expect(idCell.getAttribute("style")).toContain("padding-left");
  });

  // --- Arrays of primitives ---
  it("should render array of primitives as comma-joined string", () => {
    render(
      <AIRawDataTable
        data={{
          tags: ["语文", "数学", "英语"],
        }}
      />
    );

    expect(screen.getByText("tags")).toBeInTheDocument();
    expect(screen.getByText("语文, 数学, 英语")).toBeInTheDocument();
  });

  it("should render empty array as '[]'", () => {
    render(
      <AIRawDataTable
        data={{
          items: [],
        }}
      />
    );

    expect(screen.getByText("items")).toBeInTheDocument();
    expect(screen.getByText("[]")).toBeInTheDocument();
  });

  // --- Arrays of objects ---
  it("should render arrays of objects with index headers and nested content", () => {
    render(
      <AIRawDataTable
        data={{
          scores: [
            { subject: "语文", value: 88 },
            { subject: "数学", value: 92 },
          ],
        }}
      />
    );

    // Header shows item count
    expect(screen.getByText("scores")).toBeInTheDocument();
    expect(screen.getByText("[2 items]")).toBeInTheDocument();

    // Index headers
    expect(screen.getByText("[0]")).toBeInTheDocument();
    expect(screen.getByText("[1]")).toBeInTheDocument();

    // Nested content — "subject" appears for each object, use getAllByText
    const subjectEls = screen.getAllByText("subject");
    expect(subjectEls.length).toBe(2);
    expect(screen.getByText("语文")).toBeInTheDocument();
    expect(screen.getByText("数学")).toBeInTheDocument();
  });

  // --- Mixed nested data ---
  it("should render deeply nested mixed data", () => {
    render(
      <AIRawDataTable
        data={{
          exam: {
            name: "期中考试",
            meta: {
              year: "2025",
              semester: "上学期",
            },
            subjects: ["语文", "数学"],
          },
        }}
      />
    );

    // Top-level
    expect(screen.getByText("exam")).toBeInTheDocument();

    // Nested level 1
    expect(screen.getByText("name")).toBeInTheDocument();
    expect(screen.getByText("期中考试")).toBeInTheDocument();

    // Nested level 2 (meta)
    expect(screen.getByText("meta")).toBeInTheDocument();
    expect(screen.getByText("year")).toBeInTheDocument();
    expect(screen.getByText("2025")).toBeInTheDocument();
    expect(screen.getByText("semester")).toBeInTheDocument();
    expect(screen.getByText("上学期")).toBeInTheDocument();

    // Array of primitives
    expect(screen.getByText("subjects")).toBeInTheDocument();
    expect(screen.getByText("语文, 数学")).toBeInTheDocument();
  });

  // --- Boolean and number rendering ---
  it("should render boolean as string", () => {
    render(
      <AIRawDataTable
        data={{
          passed: true,
          active: false,
        }}
      />
    );

    expect(screen.getByText("true")).toBeInTheDocument();
    expect(screen.getByText("false")).toBeInTheDocument();
  });

  // --- Table structure ---
  it("should render a table element", () => {
    render(
      <AIRawDataTable
        data={{
          key: "value",
        }}
      />
    );

    const table = document.querySelector("table");
    expect(table).toBeInTheDocument();
    expect(table?.className).toContain("w-full");
  });

  // --- Rows with alternating background ---
  it("should apply alternating row backgrounds", () => {
    render(
      <AIRawDataTable
        data={{
          a: "1",
          b: "2",
          c: "3",
        }}
      />
    );

    const rows = document.querySelectorAll("tr");
    expect(rows.length).toBeGreaterThanOrEqual(2);

    // Even rows have bg-white
    if (rows[0]) {
      expect(rows[0].className).toContain("bg-white");
    }
    // Odd rows have bg-gray-50/50
    if (rows[1]) {
      expect(rows[1].className).toContain("bg-gray-50/50");
    }
  });
});

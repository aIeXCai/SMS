import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AIDisambiguationCard, type CandidateExam } from "./AIDisambiguationCard";

const mockCandidates: CandidateExam[] = [
  {
    exam_id: 1,
    name: "期中考试",
    date: "2025-11-20",
    academic_year: "2025-2026",
  },
  {
    exam_id: 2,
    name: "期末考试",
    date: "2026-01-15",
    academic_year: "2025-2026",
  },
];

describe("AIDisambiguationCard", () => {
  // --- AC: Empty/null candidates returns null ---
  it("should return null when candidates is empty array", () => {
    const { container } = render(
      <AIDisambiguationCard candidates={[]} onSelect={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("should return null when candidates is undefined (JavaScript, not TS)", () => {
    const { container } = render(
      <AIDisambiguationCard
        candidates={undefined as unknown as CandidateExam[]}
        onSelect={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  // --- AC: Renders candidate list ---
  it("should render heading text prompting exam selection", () => {
    render(
      <AIDisambiguationCard candidates={mockCandidates} onSelect={vi.fn()} />
    );

    expect(
      screen.getByText("找到了多次相关考试，请选择您要查询的考试：")
    ).toBeInTheDocument();
  });

  it("should render all candidate exam names", () => {
    render(
      <AIDisambiguationCard candidates={mockCandidates} onSelect={vi.fn()} />
    );

    expect(screen.getByText("期中考试")).toBeInTheDocument();
    expect(screen.getByText("期末考试")).toBeInTheDocument();
  });

  it("should render candidate dates and academic years", () => {
    render(
      <AIDisambiguationCard candidates={mockCandidates} onSelect={vi.fn()} />
    );

    // First candidate (both share same academic_year, use getAllByText)
    expect(screen.getAllByText(/2025-11-20/).length).toBeGreaterThanOrEqual(1);
    const yearElements = screen.getAllByText(/2025-2026/);
    expect(yearElements.length).toBe(2);
    expect(screen.getByText(/2026-01-15/)).toBeInTheDocument();
  });

  it("should render candidate without academic_year gracefully", () => {
    const candidates: CandidateExam[] = [
      { exam_id: 3, name: "月考", date: "2026-03-01", academic_year: "" },
    ];
    render(
      <AIDisambiguationCard candidates={candidates} onSelect={vi.fn()} />
    );

    expect(screen.getByText("月考")).toBeInTheDocument();
    expect(screen.getByText("2026-03-01")).toBeInTheDocument();
  });

  // --- AC: "选择" buttons click triggers onSelect ---
  it('should render "选择" buttons for each candidate', () => {
    render(
      <AIDisambiguationCard candidates={mockCandidates} onSelect={vi.fn()} />
    );

    const selectButtons = screen.getAllByText("选择");
    expect(selectButtons.length).toBe(2);
  });

  it("should call onSelect with correct exam_id when a select button is clicked", () => {
    const onSelect = vi.fn();
    render(
      <AIDisambiguationCard candidates={mockCandidates} onSelect={onSelect} />
    );

    const buttons = screen.getAllByText("选择");
    fireEvent.click(buttons[0]);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(1);

    fireEvent.click(buttons[1]);
    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(onSelect).toHaveBeenLastCalledWith(2);
  });

  // --- Single candidate ---
  it("should render single candidate correctly", () => {
    const singleCandidate: CandidateExam[] = [
      { exam_id: 5, name: "模拟考试", date: "2025-12-01", academic_year: "2025-2026" },
    ];
    render(
      <AIDisambiguationCard
        candidates={singleCandidate}
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByText("模拟考试")).toBeInTheDocument();
    const buttons = screen.getAllByText("选择");
    expect(buttons.length).toBe(1);
  });
});

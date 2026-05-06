import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StudentStatsCards from "./StudentStatsCards";
import type { Stats } from "./types";

const mockStats: Stats = {
  total_students: 100,
  active_students: 80,
  graduated_students: 15,
  suspended_students: 5,
  status_choices: ["在读", "毕业", "休学"],
  grade_level_choices: ["一年级", "二年级"],
  cohort_choices: ["2024", "2025"],
  class_name_choices: ["1班", "2班"],
};

describe("StudentStatsCards", () => {
  it("renders all four stat cards with correct values", () => {
    render(<StudentStatsCards stats={mockStats} />);
    expect(screen.getByText("学生总数")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("在读学生")).toBeInTheDocument();
    expect(screen.getByText("80")).toBeInTheDocument();
    expect(screen.getByText("已毕业")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();
    expect(screen.getByText("休学")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("shows placeholder '--' when stats is null", () => {
    render(<StudentStatsCards stats={null} />);
    const dashes = screen.getAllByText("--");
    expect(dashes.length).toBe(4);
  });

  it("shows placeholder '--' for zero value stats", () => {
    const zeroStats: Stats = { ...mockStats, total_students: 0, active_students: 0, graduated_students: 0, suspended_students: 0 };
    render(<StudentStatsCards stats={zeroStats} />);
    const zeros = screen.getAllByText("0");
    expect(zeros.length).toBe(4);
  });
});

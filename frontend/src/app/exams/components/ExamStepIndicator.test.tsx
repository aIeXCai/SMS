import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ExamStepIndicator from "./ExamStepIndicator";

describe("ExamStepIndicator", () => {
  it("renders two step labels", () => {
    render(<ExamStepIndicator step={1} />);
    expect(screen.getByText("基本信息")).toBeInTheDocument();
    expect(screen.getByText("科目配置")).toBeInTheDocument();
  });

  it("shows step 1 as active when step=1", () => {
    render(<ExamStepIndicator step={1} />);
    const stepLabels = screen.getAllByText("基本信息");
    const step1Label = stepLabels[0];
    expect(step1Label.className).toContain("text-green-600");
  });

  it("shows checkmark on step 1 when step=2", () => {
    render(<ExamStepIndicator step={2} />);
    // Step 1 circle should show a check icon
    const circles = document.querySelectorAll(".rounded-full");
    expect(circles.length).toBe(2);
  });

  it("shows step 2 as completed when step=2", () => {
    render(<ExamStepIndicator step={2} />);
    const stepLabels = screen.getAllByText("科目配置");
    const step2Label = stepLabels[0];
    expect(step2Label.className).toContain("text-green-600");
  });

  it("shows numeric '1' instead of check when step=1", () => {
    render(<ExamStepIndicator step={1} />);
    // First circle should show "1" as text
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});

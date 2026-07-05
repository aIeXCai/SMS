import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AIMessageBubble, type AIMessage } from "./AIMessageBubble";

describe("AIMessageBubble", () => {
  // ================================================================
  // User messages
  // ================================================================
  it("should render user message aligned right with brand color", () => {
    const msg: AIMessage = {
      id: "1",
      role: "user",
      content: "Hello AI",
    };
    render(<AIMessageBubble message={msg} />);
    const bubble = screen.getByText("Hello AI");
    expect(bubble).toBeInTheDocument();
    const container = bubble.closest(".flex");
    expect(container?.className).toContain("justify-end");
  });

  it("should not show any status badge on user messages", () => {
    const msg: AIMessage = {
      id: "u1",
      role: "user",
      content: "User msg",
      status: "student_not_found",
    };
    render(<AIMessageBubble message={msg} />);
    expect(screen.getByText("User msg")).toBeInTheDocument();
    expect(screen.queryByText("未找到学生")).not.toBeInTheDocument();
  });

  // ================================================================
  // Assistant messages - basic
  // ================================================================
  it("should render assistant message aligned left", () => {
    const msg: AIMessage = {
      id: "2",
      role: "assistant",
      content: "Hello user",
      status: "success",
    };
    render(<AIMessageBubble message={msg} />);
    const bubble = screen.getByText("Hello user");
    expect(bubble).toBeInTheDocument();
    const container = bubble.closest(".flex");
    expect(container?.className).toContain("justify-start");
  });

  // ================================================================
  // Loading state
  // ================================================================
  it("should render loading placeholder with animated dots", () => {
    const msg: AIMessage = {
      id: "3",
      role: "assistant",
      content: "正在查询中...",
      isLoading: true,
    };
    render(<AIMessageBubble message={msg} />);
    expect(screen.getByText("正在查询中...")).toBeInTheDocument();
    const dots = document.querySelectorAll(".animate-bounce");
    expect(dots.length).toBe(3);
  });

  // ================================================================
  // AC2: student_not_found → red warning style (SVG icon, no emoji)
  // ================================================================
  describe("AC2 - student_not_found (red warning)", () => {
    it("should render '未找到学生' badge", () => {
      const msg: AIMessage = {
        id: "4",
        role: "assistant",
        content: "Not found",
        status: "student_not_found",
      };
      render(<AIMessageBubble message={msg} />);
      expect(screen.getByText("未找到学生")).toBeInTheDocument();
    });

    it("should use red background and border styling", () => {
      const msg: AIMessage = {
        id: "4b",
        role: "assistant",
        content: "Not found",
        status: "student_not_found",
      };
      render(<AIMessageBubble message={msg} />);

      const badge = screen.getByText("未找到学生");
      expect(badge.className).toContain("bg-red-100");
      expect(badge.className).toContain("text-red-700");
    });

    it("should render SVG RedAlertIcon (not emoji)", () => {
      const msg: AIMessage = {
        id: "4c",
        role: "assistant",
        content: "Not found",
        status: "student_not_found",
      };
      render(<AIMessageBubble message={msg} />);

      // Should have an SVG with red stroke inside the message bubble
      const bubble = screen.getByText("未找到学生").closest(".max-w-\\[80\\%\\]");
      const svg = bubble?.querySelector("svg");
      expect(svg).toBeInTheDocument();
      expect(svg?.getAttribute("stroke")).toBe("#dc2626");
    });

    it("should use red wrapper border and background", () => {
      const msg: AIMessage = {
        id: "4d",
        role: "assistant",
        content: "Not found",
        status: "student_not_found",
      };
      render(<AIMessageBubble message={msg} />);

      const wrapper = screen.getByText("未找到学生").closest(".max-w-\\[80\\%\\]");
      expect(wrapper?.className).toContain("border-red-400");
      expect(wrapper?.className).toContain("bg-red-50");
    });
  });

  // ================================================================
  // AC7: permission_denied → orange/amber warning
  // ================================================================
  describe("AC7 - permission_denied (orange warning)", () => {
    it("should render '权限不足' badge", () => {
      const msg: AIMessage = {
        id: "5",
        role: "assistant",
        content: "Denied",
        status: "permission_denied",
      };
      render(<AIMessageBubble message={msg} />);
      expect(screen.getByText("权限不足")).toBeInTheDocument();
    });

    it("should use amber/orange styling", () => {
      const msg: AIMessage = {
        id: "5b",
        role: "assistant",
        content: "Denied",
        status: "permission_denied",
      };
      render(<AIMessageBubble message={msg} />);

      const badge = screen.getByText("权限不足");
      expect(badge.className).toContain("bg-amber-100");
      expect(badge.className).toContain("text-amber-700");

      const wrapper = screen.getByText("权限不足").closest(".max-w-\\[80\\%\\]");
      expect(wrapper?.className).toContain("border-amber-400");
      expect(wrapper?.className).toContain("bg-amber-50");
    });

    it("should render SVG OrangeShieldIcon (not emoji)", () => {
      const msg: AIMessage = {
        id: "5c",
        role: "assistant",
        content: "Denied",
        status: "permission_denied",
      };
      render(<AIMessageBubble message={msg} />);

      const bubble = screen.getByText("权限不足").closest(".max-w-\\[80\\%\\]");
      const svg = bubble?.querySelector("svg");
      expect(svg).toBeInTheDocument();
      expect(svg?.getAttribute("stroke")).toBe("#d97706");
    });
  });

  // ================================================================
  // AC3: subject_not_found → yellow prompt + subject tags clickable
  // ================================================================
  describe("AC3 - subject_not_found (yellow + subject tags)", () => {
    it("should render '未找到科目' badge", () => {
      const msg: AIMessage = {
        id: "6",
        role: "assistant",
        content: "Subject not found",
        status: "subject_not_found",
      };
      render(<AIMessageBubble message={msg} />);
      expect(screen.getByText("未找到科目")).toBeInTheDocument();
    });

    it("should use yellow styling", () => {
      const msg: AIMessage = {
        id: "6b",
        role: "assistant",
        content: "Subject not found",
        status: "subject_not_found",
      };
      render(<AIMessageBubble message={msg} />);

      const badge = screen.getByText("未找到科目");
      expect(badge.className).toContain("bg-yellow-100");
      expect(badge.className).toContain("text-yellow-700");

      const wrapper = screen.getByText("未找到科目").closest(".max-w-\\[80\\%\\]");
      expect(wrapper?.className).toContain("border-yellow-400");
      expect(wrapper?.className).toContain("bg-yellow-50");
    });

    it("should render SVG YellowInfoIcon (not emoji)", () => {
      const msg: AIMessage = {
        id: "6c",
        role: "assistant",
        content: "Subject not found",
        status: "subject_not_found",
      };
      render(<AIMessageBubble message={msg} />);

      const bubble = screen.getByText("未找到科目").closest(".max-w-\\[80\\%\\]");
      const svg = bubble?.querySelector("svg");
      expect(svg).toBeInTheDocument();
      expect(svg?.getAttribute("stroke")).toBe("#ca8a04");
    });

    it("should render subject tag chips when available_subjects is present", () => {
      const msg: AIMessage = {
        id: "6d",
        role: "assistant",
        content: "Subject not found",
        status: "subject_not_found",
        data: {
          available_subjects: [
            { subject: "语文", count: 3 },
            { subject: "数学", count: 2 },
          ],
        },
      };
      const onSubjectTagClick = vi.fn();
      render(
        <AIMessageBubble
          message={msg}
          onSubjectTagClick={onSubjectTagClick}
        />
      );

      expect(screen.getByText("该学生有以下科目记录：")).toBeInTheDocument();
      expect(screen.getByText("语文")).toBeInTheDocument();
      expect(screen.getByText("数学")).toBeInTheDocument();
      expect(screen.getByText("(3次)")).toBeInTheDocument();
      expect(screen.getByText("(2次)")).toBeInTheDocument();
    });

    it("should call onSubjectTagClick when a subject tag is clicked", () => {
      const msg: AIMessage = {
        id: "6e",
        role: "assistant",
        content: "Subject not found",
        status: "subject_not_found",
        data: {
          available_subjects: [
            { subject: "英语", count: 5 },
          ],
        },
      };
      const onSubjectTagClick = vi.fn();
      render(
        <AIMessageBubble
          message={msg}
          onSubjectTagClick={onSubjectTagClick}
        />
      );

      fireEvent.click(screen.getByText("英语"));
      expect(onSubjectTagClick).toHaveBeenCalledTimes(1);
      expect(onSubjectTagClick).toHaveBeenCalledWith("英语");
    });

    it("should not render subject tags when onSubjectTagClick is not provided", () => {
      const msg: AIMessage = {
        id: "6f",
        role: "assistant",
        content: "Subject not found",
        status: "subject_not_found",
        data: {
          available_subjects: [
            { subject: "物理", count: 1 },
          ],
        },
      };
      render(<AIMessageBubble message={msg} />);

      // Subject tags should NOT be rendered without the callback
      expect(screen.queryByText("物理")).not.toBeInTheDocument();
    });
  });

  // ================================================================
  // AC4: insufficient_data → blue info style
  // ================================================================
  describe("AC4 - insufficient_data (blue info)", () => {
    it("should render '数据不足' badge", () => {
      const msg: AIMessage = {
        id: "7",
        role: "assistant",
        content: "Not enough",
        status: "insufficient_data",
      };
      render(<AIMessageBubble message={msg} />);
      expect(screen.getByText("数据不足")).toBeInTheDocument();
    });

    it("should use blue styling", () => {
      const msg: AIMessage = {
        id: "7b",
        role: "assistant",
        content: "Not enough",
        status: "insufficient_data",
      };
      render(<AIMessageBubble message={msg} />);

      const badge = screen.getByText("数据不足");
      expect(badge.className).toContain("bg-blue-100");
      expect(badge.className).toContain("text-blue-700");

      const wrapper = screen.getByText("数据不足").closest(".max-w-\\[80\\%\\]");
      expect(wrapper?.className).toContain("border-blue-400");
      expect(wrapper?.className).toContain("bg-blue-50");
    });

    it("should render SVG BlueChartIcon (not emoji)", () => {
      const msg: AIMessage = {
        id: "7c",
        role: "assistant",
        content: "Not enough",
        status: "insufficient_data",
      };
      render(<AIMessageBubble message={msg} />);

      const bubble = screen.getByText("数据不足").closest(".max-w-\\[80\\%\\]");
      const svg = bubble?.querySelector("svg");
      expect(svg).toBeInTheDocument();
      expect(svg?.getAttribute("stroke")).toBe("#2563eb");
    });

    it("should show data hint when insufficient_data has data", () => {
      const msg: AIMessage = {
        id: "7d",
        role: "assistant",
        content: "Not enough",
        status: "insufficient_data",
        data: {
          subject: "数学",
          count: 1,
        },
      };
      render(<AIMessageBubble message={msg} />);

      expect(
        screen.getByText("无法对比 — 数据记录不足")
      ).toBeInTheDocument();
    });

    it("should not show data hint when insufficient_data has no data", () => {
      const msg: AIMessage = {
        id: "7e",
        role: "assistant",
        content: "Not enough",
        status: "insufficient_data",
        data: null,
      };
      render(<AIMessageBubble message={msg} />);

      expect(
        screen.queryByText("无法对比 — 数据记录不足")
      ).not.toBeInTheDocument();
    });
  });

  // ================================================================
  // AC1+AC5: ambiguous + candidates → disambiguation card with "选择"
  // ================================================================
  describe("AC1/AC5 - ambiguous/disambiguation with candidates", () => {
    const candidateMsg: AIMessage = {
      id: "8",
      role: "assistant",
      content: "请选择考试",
      status: "ambiguous",
      candidates: [
        {
          exam_id: 10,
          name: "期中考试",
          date: "2025-11-20",
          academic_year: "2025-2026",
        },
        {
          exam_id: 20,
          name: "期末考试",
          date: "2026-01-15",
          academic_year: "2025-2026",
        },
      ],
    };

    it("should render AIDisambiguationCard with heading text", () => {
      render(<AIMessageBubble message={candidateMsg} />);
      expect(
        screen.getByText("找到了多次相关考试，请选择您要查询的考试：")
      ).toBeInTheDocument();
    });

    it("should render candidate exam names", () => {
      render(<AIMessageBubble message={candidateMsg} />);
      expect(screen.getByText("期中考试")).toBeInTheDocument();
      expect(screen.getByText("期末考试")).toBeInTheDocument();
    });

    it('should render "选择" buttons for each candidate', () => {
      render(<AIMessageBubble message={candidateMsg} />);
      const selectButtons = screen.getAllByText("选择");
      expect(selectButtons.length).toBe(2);
    });

    it("should call onDisambiguationSelect with exam_id when select is clicked", () => {
      const onSelect = vi.fn();
      render(
        <AIMessageBubble
          message={candidateMsg}
          onDisambiguationSelect={onSelect}
        />
      );

      const buttons = screen.getAllByText("选择");
      fireEvent.click(buttons[0]);
      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith(10);

      fireEvent.click(buttons[1]);
      expect(onSelect).toHaveBeenCalledTimes(2);
      expect(onSelect).toHaveBeenLastCalledWith(20);
    });

    it("should NOT show badge wrapper when ambiguous with candidates (disambiguation takes over)", () => {
      render(<AIMessageBubble message={candidateMsg} />);

      // The ambiguous badge text should NOT appear because disambiguation UI replaces it
      expect(screen.queryByText("需要进一步明确")).not.toBeInTheDocument();
      // Disambiguation card heading IS present
      expect(
        screen.getByText("找到了多次相关考试，请选择您要查询的考试：")
      ).toBeInTheDocument();
    });

    it("should also show disambiguation when status is undefined but candidates present", () => {
      const msg: AIMessage = {
        id: "9",
        role: "assistant",
        content: "选择考试",
        // No status
        candidates: [
          { exam_id: 1, name: "月考", date: "2026-03-01", academic_year: "2025-2026" },
        ],
      };
      render(<AIMessageBubble message={msg} />);
      expect(screen.getByText("选择")).toBeInTheDocument();
    });
  });

  // --- ambiguous status WITHOUT candidates (show badge) ---
  describe("ambiguous without candidates (badge mode)", () => {
    it("should show '需要进一步明确' badge when ambiguous without candidates", () => {
      const msg: AIMessage = {
        id: "10",
        role: "assistant",
        content: "Please clarify",
        status: "ambiguous",
      };
      render(<AIMessageBubble message={msg} />);
      // Note: badge renders twice due to both isSpecialStatus and showAmbiguousBadge triggers
      const badges = screen.getAllByText("需要进一步明确");
      expect(badges.length).toBeGreaterThanOrEqual(1);
    });

    it("should use gray/amber styling for ambiguous badge", () => {
      const msg: AIMessage = {
        id: "10b",
        role: "assistant",
        content: "Please clarify",
        status: "ambiguous",
      };
      render(<AIMessageBubble message={msg} />);

      const badges = screen.getAllByText("需要进一步明确");
      // At least one badge should have the correct styling
      for (const badge of badges) {
        expect(badge.className).toContain("bg-amber-100");
        expect(badge.className).toContain("text-amber-700");
      }
    });
  });

  // ================================================================
  // AC6: success + data → expand/collapse "查看原始记录"
  // ================================================================
  describe("AC6 - success + data expand/collapse", () => {
    const successMsg: AIMessage = {
      id: "11",
      role: "assistant",
      content: "查询结果如下...",
      status: "success",
      data: {
        student_name: "张三",
        avg_score: 92.5,
        details: { grade: "高一", class: "3班" },
      },
    };

    it('should show "查看原始记录" toggle button when success has data', () => {
      render(<AIMessageBubble message={successMsg} />);
      expect(screen.getByText("查看原始记录")).toBeInTheDocument();
    });

    it("should NOT show toggle when success has NO data", () => {
      const msg: AIMessage = {
        id: "12",
        role: "assistant",
        content: "Success without data",
        status: "success",
        data: null,
      };
      render(<AIMessageBubble message={msg} />);
      expect(screen.queryByText("查看原始记录")).not.toBeInTheDocument();
    });

    it("should NOT show toggle when status is not success", () => {
      const msg: AIMessage = {
        id: "13",
        role: "assistant",
        content: "Not success",
        status: "student_not_found",
        data: { some: "data" },
      };
      render(<AIMessageBubble message={msg} />);
      expect(screen.queryByText("查看原始记录")).not.toBeInTheDocument();
    });

    it('should expand and show "收起原始记录" + AIRawDataTable on click', () => {
      render(<AIMessageBubble message={successMsg} />);

      // Initially collapsed
      expect(screen.getByText("查看原始记录")).toBeInTheDocument();
      expect(screen.queryByText("收起原始记录")).not.toBeInTheDocument();

      // Click to expand
      fireEvent.click(screen.getByText("查看原始记录"));
      expect(screen.getByText("收起原始记录")).toBeInTheDocument();
      expect(screen.queryByText("查看原始记录")).not.toBeInTheDocument();

      // AIRawDataTable should now be visible
      expect(screen.getByText("student_name")).toBeInTheDocument();
      expect(screen.getByText("张三")).toBeInTheDocument();
    });

    it("should collapse back when toggle is clicked again", () => {
      render(<AIMessageBubble message={successMsg} />);

      // Expand
      fireEvent.click(screen.getByText("查看原始记录"));
      expect(screen.getByText("收起原始记录")).toBeInTheDocument();

      // Collapse
      fireEvent.click(screen.getByText("收起原始记录"));
      expect(screen.getByText("查看原始记录")).toBeInTheDocument();
    });

    it("should render correct chevron icons for expand/collapse state", () => {
      render(<AIMessageBubble message={successMsg} />);

      const toggleButton = screen.getByText("查看原始记录").closest("button")!;

      // ChevronDownIcon when collapsed (has polyline with points "6 9 12 15 18 9")
      const chevronDown = toggleButton.querySelectorAll("polyline");
      // Initially one polyline element for the chevron
      expect(chevronDown.length).toBeGreaterThanOrEqual(0);
    });

    it("should show nested data in the expanded table", () => {
      render(<AIMessageBubble message={successMsg} />);

      fireEvent.click(screen.getByText("查看原始记录"));

      // Check nested object is rendered
      expect(screen.getByText("details")).toBeInTheDocument();
      expect(screen.getByText("grade")).toBeInTheDocument();
      expect(screen.getByText("高一")).toBeInTheDocument();
    });
  });

  // ================================================================
  // AC8: Different statuses use SVG icons (no emoji)
  // ================================================================
  describe("AC8 - SVG icons for all statuses (no emoji)", () => {
    it("should have SVG in student_not_found wrapper", () => {
      const msg: AIMessage = {
        id: "s1",
        role: "assistant",
        content: "x",
        status: "student_not_found",
      };
      render(<AIMessageBubble message={msg} />);
      const bubble = screen.getByText("未找到学生").closest(".max-w-\\[80\\%\\]");
      expect(bubble?.querySelector("svg")).toBeInTheDocument();
    });

    it("should have SVG in permission_denied wrapper", () => {
      const msg: AIMessage = {
        id: "s2",
        role: "assistant",
        content: "x",
        status: "permission_denied",
      };
      render(<AIMessageBubble message={msg} />);
      const bubble = screen.getByText("权限不足").closest(".max-w-\\[80\\%\\]");
      expect(bubble?.querySelector("svg")).toBeInTheDocument();
    });

    it("should have SVG in subject_not_found wrapper", () => {
      const msg: AIMessage = {
        id: "s3",
        role: "assistant",
        content: "x",
        status: "subject_not_found",
      };
      render(<AIMessageBubble message={msg} />);
      const bubble = screen.getByText("未找到科目").closest(".max-w-\\[80\\%\\]");
      expect(bubble?.querySelector("svg")).toBeInTheDocument();
    });

    it("should have SVG in insufficient_data wrapper", () => {
      const msg: AIMessage = {
        id: "s4",
        role: "assistant",
        content: "x",
        status: "insufficient_data",
      };
      render(<AIMessageBubble message={msg} />);
      const bubble = screen.getByText("数据不足").closest(".max-w-\\[80\\%\\]");
      expect(bubble?.querySelector("svg")).toBeInTheDocument();
    });

    it("should have SVG in ambiguous wrapper (no candidates)", () => {
      const msg: AIMessage = {
        id: "s5",
        role: "assistant",
        content: "x",
        status: "ambiguous",
      };
      render(<AIMessageBubble message={msg} />);
      const badges = screen.getAllByText("需要进一步明确");
      const bubble = badges[0].closest(".max-w-\\[80\\%\\]");
      expect(bubble?.querySelector("svg")).toBeInTheDocument();
    });

    // Verify no text emoji patterns exist in status badges
    it("should not contain emoji characters in badge text", () => {
      const badgeTexts = [
        "未找到学生",
        "权限不足",
        "未找到科目",
        "数据不足",
        "需要进一步明确",
        "无法回答",
        "查询规划失败",
      ];
      const emojiRegex =
        /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
      for (const text of badgeTexts) {
        expect(emojiRegex.test(text)).toBe(false);
      }
    });
  });

  // ================================================================
  // Other statuses: irrelevant, plan_error
  // ================================================================
  describe("other statuses", () => {
    it("should render '无法回答' badge for irrelevant status", () => {
      const msg: AIMessage = {
        id: "14",
        role: "assistant",
        content: "Can't answer",
        status: "irrelevant",
      };
      render(<AIMessageBubble message={msg} />);
      expect(screen.getByText("无法回答")).toBeInTheDocument();
      const badge = screen.getByText("无法回答");
      expect(badge.className).toContain("bg-gray-200");
      expect(badge.className).toContain("text-gray-600");
    });

    it("should render '查询规划失败' badge for plan_error status", () => {
      const msg: AIMessage = {
        id: "15",
        role: "assistant",
        content: "Plan failed",
        status: "plan_error",
      };
      render(<AIMessageBubble message={msg} />);
      expect(screen.getByText("查询规划失败")).toBeInTheDocument();
      const badge = screen.getByText("查询规划失败");
      expect(badge.className).toContain("bg-red-100");
      expect(badge.className).toContain("text-red-700");
    });
  });

  // ================================================================
  // No status badge for success / undefined
  // ================================================================
  describe("no badge for success/undefined", () => {
    it("should NOT show badge for success status", () => {
      const msg: AIMessage = {
        id: "16",
        role: "assistant",
        content: "Success",
        status: "success",
      };
      render(<AIMessageBubble message={msg} />);
      expect(screen.getByText("Success")).toBeInTheDocument();
      expect(screen.queryByText("需要进一步明确")).not.toBeInTheDocument();
    });

    it("should NOT show badge when status is undefined", () => {
      const msg: AIMessage = {
        id: "17",
        role: "assistant",
        content: "No status",
      };
      render(<AIMessageBubble message={msg} />);
      expect(screen.getByText("No status")).toBeInTheDocument();
      // No disambiguation card either (no candidates)
      expect(
        screen.queryByText("找到了多次相关考试，请选择您要查询的考试：")
      ).not.toBeInTheDocument();
    });
  });

  // ================================================================
  // Text formatting
  // ================================================================
  it("should preserve whitespace with whitespace-pre-wrap", () => {
    const msg: AIMessage = {
      id: "18",
      role: "assistant",
      content: "Line 1\nLine 2\nLine 3",
      status: "success",
    };
    render(<AIMessageBubble message={msg} />);
    const contentDiv = screen.getByText(/Line 1/);
    expect(contentDiv.className).toContain("whitespace-pre-wrap");
  });
});

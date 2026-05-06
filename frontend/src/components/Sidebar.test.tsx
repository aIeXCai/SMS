import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock next/navigation
const mockPathname = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

// Mock next/image
vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} alt={props.alt || ""} />;
  },
}));

// Mock AuthContext
const mockUser = vi.fn();
const mockLogout = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    
    user: mockUser(),
    token: "fake-token",
    loading: false,
    login: vi.fn(),
    logout: mockLogout,
  }),
}));

// Must import after mocks
import { Sidebar } from "./Sidebar";

function renderSidebar(path = "/") {
  mockPathname.mockReturnValue(path);
  return render(<Sidebar />);
}

describe("Sidebar component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname.mockReturnValue("/");
  });

  describe("when user is admin", () => {
    beforeEach(() => {
      mockUser.mockReturnValue({
        id: 1,
        username: "admin1",
        email: "admin@test.com",
        name: "管理员张",
        role: "admin",
      });
    });

    it("renders the school branding", () => {
      renderSidebar();
      expect(screen.getByText("白云实验学校管理系统")).toBeInTheDocument();
    });

    it("shows user name and 管理员 role label", () => {
      renderSidebar();
      expect(screen.getByText("管理员张")).toBeInTheDocument();
      expect(screen.getByText("管理员")).toBeInTheDocument();
    });

    it("renders Dashboard link", () => {
      renderSidebar();
      expect(screen.getByText("Dashboard")).toBeInTheDocument();
    });

    it('renders 学生管理 link', () => {
      renderSidebar();
      expect(screen.getByText("学生管理")).toBeInTheDocument();
    });

    it('renders 考试管理 link', () => {
      renderSidebar();
      expect(screen.getByText("考试管理")).toBeInTheDocument();
    });

    it('renders 成绩管理 submenu with 成绩查询 and 成绩分析 children', () => {
      renderSidebar();
      // The top-level label "成绩管理" appears both as a nav-link text and could be ambiguous
      // The submenu link text for scores page is also "成绩管理"
      expect(screen.getByText("成绩查询")).toBeInTheDocument();
      expect(screen.getByText("成绩分析")).toBeInTheDocument();
    });

    it('renders 目标生筛选 submenu with child links', () => {
      renderSidebar();
      // The top-level label is "目标生筛选"
      const targetLinks = screen.getAllByText("目标生筛选");
      expect(targetLinks.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("简单筛选")).toBeInTheDocument();
      expect(screen.getByText("高级筛选")).toBeInTheDocument();
      expect(screen.getByText("我的规则")).toBeInTheDocument();
      expect(screen.getByText("变化追踪")).toBeInTheDocument();
    });

    it('does NOT show grade_manager-specific labels like 年级学生', () => {
      renderSidebar();
      expect(screen.queryByText("年级学生")).not.toBeInTheDocument();
      expect(screen.queryByText("年级考试")).not.toBeInTheDocument();
      expect(screen.queryByText("年级成绩")).not.toBeInTheDocument();
      expect(screen.queryByText("年级分析")).not.toBeInTheDocument();
    });

    it('does NOT show subject_teacher-specific labels like 任教学生', () => {
      renderSidebar();
      expect(screen.queryByText("任教学生")).not.toBeInTheDocument();
    });

    it("highlights 学生管理 as active when path starts with /students", () => {
      renderSidebar("/students/1");
      const studentLink = screen.getByText("学生管理").closest("a");
      expect(studentLink?.className).toContain("active");
    });

    it("highlights 考试管理 as active when path starts with /exams", () => {
      renderSidebar("/exams");
      const examLink = screen.getByText("考试管理").closest("a");
      expect(examLink?.className).toContain("active");
    });

    it("highlight Dashboard as active when on root path", () => {
      renderSidebar("/");
      const dashLink = screen.getByText("Dashboard").closest("a");
      expect(dashLink?.className).toContain("active");
    });
  });

  describe("when user is grade_manager", () => {
    beforeEach(() => {
      mockUser.mockReturnValue({
        id: 2,
        username: "jichang1",
        email: "jichang@test.com",
        name: "级长李",
        role: "grade_manager",
        managed_grade: "初中2026级",
      });
    });

    it("shows 级长 role label", () => {
      renderSidebar();
      expect(screen.getByText("级长")).toBeInTheDocument();
    });

    it('renders 年级学生 link instead of 学生管理', () => {
      renderSidebar();
      expect(screen.getByText("年级学生")).toBeInTheDocument();
      expect(screen.queryByText("学生管理")).not.toBeInTheDocument();
    });

    it('renders 年级考试 link instead of 考试管理', () => {
      renderSidebar();
      expect(screen.getByText("年级考试")).toBeInTheDocument();
      expect(screen.queryByText("考试管理")).not.toBeInTheDocument();
    });

    it('renders 成绩管理 as a submenu (not plain link)', () => {
      renderSidebar();
      expect(screen.getByText("成绩管理")).toBeInTheDocument();
    });

    it('renders 成绩查询 link', () => {
      renderSidebar();
      expect(screen.getByText("成绩查询")).toBeInTheDocument();
    });

    it('renders 成绩分析 link', () => {
      renderSidebar();
      expect(screen.getByText("成绩分析")).toBeInTheDocument();
    });

    it('renders 个人分析 link', () => {
      renderSidebar();
      expect(screen.getByText("个人分析")).toBeInTheDocument();
    });

    it('renders 目标生筛选 as a submenu with child links', () => {
      renderSidebar();
      const targetLinks = screen.getAllByText("目标生筛选");
      // grade_manager has target-students as a submenu toggle + submenu items
      expect(targetLinks.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("简单筛选")).toBeInTheDocument();
      expect(screen.getByText("高级筛选")).toBeInTheDocument();
      expect(screen.getByText("我的规则")).toBeInTheDocument();
      expect(screen.getByText("变化追踪")).toBeInTheDocument();
    });

    it("does NOT show admin-specific labels like 学生管理", () => {
      renderSidebar();
      expect(screen.queryByText("学生管理")).not.toBeInTheDocument();
      expect(screen.queryByText("考试管理")).not.toBeInTheDocument();
    });
  });

  describe("when user is subject_teacher", () => {
    beforeEach(() => {
      mockUser.mockReturnValue({
        id: 3,
        username: "teacher1",
        email: "teacher@test.com",
        name: "王老师",
        role: "subject_teacher",
        teaching_classes: [
          { id: 1, grade_level: "初中2026级", class_name: "1班", display_name: "初中2026级1班" },
        ],
      });
    });

    it("shows 科任老师 role label", () => {
      renderSidebar();
      expect(screen.getByText("科任老师")).toBeInTheDocument();
    });

    it('renders 任教学生 link', () => {
      renderSidebar();
      expect(screen.getByText("任教学生")).toBeInTheDocument();
    });

    it('renders 成绩查询 link', () => {
      renderSidebar();
      expect(screen.getByText("成绩查询")).toBeInTheDocument();
    });

    it('renders 成绩分析 submenu with 班级对比 and 个人追踪', () => {
      renderSidebar();
      expect(screen.getByText("班级对比")).toBeInTheDocument();
      expect(screen.getByText("个人追踪")).toBeInTheDocument();
    });

    it('renders 目标生筛选 link', () => {
      renderSidebar();
      expect(screen.getByText("目标生筛选")).toBeInTheDocument();
    });

    it("does NOT have 学生管理 entry", () => {
      renderSidebar();
      expect(screen.queryByText("学生管理")).not.toBeInTheDocument();
    });

    it("does NOT have 考试管理 entry", () => {
      renderSidebar();
      expect(screen.queryByText("考试管理")).not.toBeInTheDocument();
    });

    it("does NOT have 成绩管理 submenu entry", () => {
      renderSidebar();
      const gmLabels = screen.queryAllByText("成绩管理");
      expect(gmLabels.length).toBe(0);
    });

    it("does NOT have 年级学生 / 年级考试 / 年级成绩 / 年级分析", () => {
      renderSidebar();
      expect(screen.queryByText("年级学生")).not.toBeInTheDocument();
      expect(screen.queryByText("年级考试")).not.toBeInTheDocument();
      expect(screen.queryByText("年级成绩")).not.toBeInTheDocument();
      expect(screen.queryByText("年级分析")).not.toBeInTheDocument();
    });
  });

  describe("when user is null (not logged in)", () => {
    it("returns null (renders nothing)", () => {
      mockUser.mockReturnValue(null);
      const { container } = render(<Sidebar />);
      expect(container.innerHTML).toBe("");
    });
  });

  describe("logout button", () => {
    it("calls logout when clicked", () => {
      mockUser.mockReturnValue({
        id: 1,
        username: "admin1",
        email: "admin@test.com",
        name: "管理员张",
        role: "admin",
      });
      renderSidebar();
      // Find the logout button (it has fa-sign-out-alt icon)
      const logoutBtn = document.querySelector(".logout-btn");
      expect(logoutBtn).not.toBeNull();
      logoutBtn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(mockLogout).toHaveBeenCalled();
    });
  });

  describe("dead link removal verification", () => {
    beforeEach(() => {
      mockUser.mockReturnValue({ id: 1, username: "a", email: "a@a.com", name: "A", role: "admin" });
    });

    const deadPaths = ["/admin", "/reports", "/backup", "/help", "/support", "/graduation"];

    it.each(deadPaths)("does not contain dead link to %s", (deadPath) => {
      renderSidebar();
      const links = Array.from(document.querySelectorAll("a[href]"));
      const found = links.some((a) => a.getAttribute("href") === deadPath);
      expect(found).toBe(false);
    });
  });
});

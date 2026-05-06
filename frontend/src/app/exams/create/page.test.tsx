import { vi, describe, it, expect, beforeEach } from "vitest";
import { render } from "@testing-library/react";

// Mock next/navigation
const mockReplace = vi.fn();
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => {
    // eslint-disable-next-line @next/next/no-html-link-for-pages
    return <a href={href} {...props}>{children}</a>;
  },
}));

// Mock AuthContext
const mockUseAuth = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock permissions
vi.mock("@/lib/permissions", () => ({
  canWriteExams: vi.fn((user: { role?: string } | null) => {
    if (!user) return false;
    return ["admin", "grade_manager", "staff"].includes(user.role || "");
  }),
}));

// Must import after mocks
import CreateExamPage from "./page";

function renderPage() {
  return render(<CreateExamPage />);
}

describe("CreateExamPage — subject_teacher redirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects subject_teacher to / (dashboard)", () => {
    mockUseAuth.mockReturnValue({
      user: { id: 3, username: "t1", email: "t@t.com", name: "T", role: "subject_teacher" },
      token: "tok",
      loading: false,
    });
    renderPage();
    expect(mockReplace).toHaveBeenCalledWith("/");
  });

  it("does NOT redirect admin", () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: "a", email: "a@a.com", name: "A", role: "admin" },
      token: "tok",
      loading: false,
    });
    renderPage();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("does NOT redirect grade_manager", () => {
    mockUseAuth.mockReturnValue({
      user: { id: 2, username: "g", email: "g@g.com", name: "G", role: "grade_manager" },
      token: "tok",
      loading: false,
    });
    renderPage();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("does NOT redirect staff (can write exams)", () => {
    mockUseAuth.mockReturnValue({
      user: { id: 5, username: "s", email: "s@s.com", name: "S", role: "staff" },
      token: "tok",
      loading: false,
    });
    renderPage();
    expect(mockReplace).not.toHaveBeenCalled();
    // staff is in EXAM_WRITE_ROLES, so canWriteExams returns true and no redirect occurs.
  });

  it("redirects lesson_entry users (cannot write exams) to /exams", () => {
    mockUseAuth.mockReturnValue({
      user: { id: 6, username: "le", email: "le@le.com", name: "LE", role: "lesson_entry" },
      token: "tok",
      loading: false,
    });
    renderPage();
    expect(mockReplace).toHaveBeenCalled();
    // lesson_entry roles and other non-privileged roles should be redirected to /exams
  });

  it("does NOT redirect while still loading", () => {
    mockUseAuth.mockReturnValue({
      user: { id: 3, username: "t1", email: "t@t.com", name: "T", role: "subject_teacher" },
      token: "tok",
      loading: true,
    });
    renderPage();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("does NOT redirect when user is null", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      token: null,
      loading: false,
    });
    renderPage();
    expect(mockReplace).not.toHaveBeenCalledWith("/");
  });
});

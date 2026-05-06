import { vi, describe, it, expect, beforeEach } from "vitest";
import { render } from "@testing-library/react";

// Mock next/navigation
const mockReplace = vi.fn();
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
}));

// Mock AuthContext
const mockUseAuth = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock permissions
vi.mock("@/lib/permissions", () => ({
  canWriteScores: vi.fn((user: { role?: string } | null) => {
    if (!user) return false;
    return ["admin", "grade_manager", "staff"].includes(user.role || "");
  }),
}));

// Must import after mocks
import ScoresPage from "./page";

function renderPage() {
  return render(<ScoresPage />);
}

describe("ScoresPage — subject_teacher redirect", () => {
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

  it("does NOT redirect while still loading", () => {
    mockUseAuth.mockReturnValue({
      user: { id: 3, username: "t1", email: "t@t.com", name: "T", role: "subject_teacher" },
      token: "tok",
      loading: true,
    });
    renderPage();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("does NOT redirect when user is null (will be handled by auth redirect)", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      token: null,
      loading: false,
    });
    renderPage();
    // The no-token redirect pushes to /login, not replace to /
    expect(mockReplace).not.toHaveBeenCalledWith("/");
  });
});

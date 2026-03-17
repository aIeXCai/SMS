"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname() || "";
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const fullName = `${user?.last_name ?? ""}${user?.first_name ?? ""}`.trim() || user?.username || "";

  const getRoleDisplay = (role: string) => {
    switch (role) {
      case "admin":
        return "管理员";
      case "grade_manager":
        return "级长";
      case "subject_teacher":
        return "科任老师";
      default:
        return "教辅人员";
    }
  };

  useEffect(() => {
    // 默认打开成绩分析子菜单，如果当前路径属于分析页
    if (pathname?.startsWith("/analysis")) {
      setAnalysisOpen(true);
    }
  }, [pathname]);

  const handleNavClick = () => {
    if (onClose) onClose();
  };

  if (!user) {
    return null;
  }

  const makeLink = (href: string, label: string, icon: string, active?: boolean) => (
    <Link
      href={href}
      className={`nav-link${active ? " active" : ""}`}
      onClick={handleNavClick}
    >
      <i className={`fas ${icon}`} />
      {label}
    </Link>
  );

  return (
    <div className={`sidebar${isOpen ? " show" : ""}`}>
      <div className="sidebar-header">
        <Link href="/" className="sidebar-brand" onClick={handleNavClick}>
          <Image
            src="/logo.png"
            alt="白云实验学校logo"
            width={28}
            height={28}
            style={{ marginRight: 8, borderRadius: 6 }}
          />
          白云实验学校管理系统
        </Link>
      </div>

      <div className="user-info">
        <div className="user-avatar">
          <i className="fas fa-user" style={{ color: "white", fontSize: 16 }} />
        </div>
        <div className="user-details">
          <p className="user-name">{fullName}</p>
          <p className="user-role">{getRoleDisplay(user.role)}</p>
        </div>
        <button
          className="btn btn-sm btn-light logout-btn"
          style={{ marginLeft: "auto", borderRadius: 6 }}
          onClick={() => {
            logout();
            handleNavClick();
          }}
        >
          <i className="fas fa-sign-out-alt" />
        </button>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">
          <h6 className="nav-section-title">主要功能</h6>
          <ul className="nav flex-column">
            <li className="nav-item">
              {makeLink("/", "Dashboard", "fa-th-large", pathname === "/")}
            </li>
          </ul>
        </div>

        <div className="nav-section">
          <h6 className="nav-section-title">教学管理</h6>
          <ul className="nav flex-column">
            <li className="nav-item">
              {makeLink("/students", "学生信息", "fa-user-graduate", pathname.startsWith("/students"))}
            </li>
            <li className="nav-item">
              {makeLink("/exams", "考试管理", "fa-clipboard-list", pathname.startsWith("/exams"))}
            </li>
            <li className="nav-item">
              {makeLink(
                "/scores",
                "成绩管理",
                "fa-chart-line",
                pathname === "/scores" || pathname.startsWith("/scores/add") || pathname.startsWith("/scores/batch-edit")
              )}
            </li>
            <li className="nav-item">
              {makeLink("/scores/query", "成绩查询", "fa-search", pathname.startsWith("/scores/query"))}
            </li>
            <li className={`nav-item has-submenu ${analysisOpen ? "open" : ""}`}>
              <a
                className="nav-link"
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setAnalysisOpen((prev) => !prev);
                }}
              >
                <i className="fas fa-chart-bar" />
                成绩分析
              </a>
              <ul className="nav-submenu">
                <li className="nav-item">
                  {makeLink(
                    "/analysis/class-grade",
                    "班级/年级分析",
                    "",
                    pathname.startsWith("/analysis/class-grade")
                  )}
                </li>
                <li className="nav-item">
                  {makeLink(
                    "/analysis/student",
                    "个人成绩分析",
                    "",
                    pathname.startsWith("/analysis/student")
                  )}
                </li>
              </ul>
            </li>
          </ul>
        </div>

        <div className="nav-section">
          <h6 className="nav-section-title">系统管理</h6>
          <ul className="nav flex-column">
            <li className="nav-item">
              {makeLink("/admin", "系统设置", "fa-cog", pathname.startsWith("/admin"))}
            </li>
            <li className="nav-item">
              {makeLink("/reports", "报表管理", "fa-file-alt", pathname.startsWith("/reports"))}
            </li>
            <li className="nav-item">
              {makeLink("/backup", "数据备份", "fa-database", pathname.startsWith("/backup"))}
            </li>
          </ul>
        </div>

        <div className="nav-section">
          <h6 className="nav-section-title">其他功能</h6>
          <ul className="nav flex-column">
            <li className="nav-item">
              {makeLink("/help", "帮助中心", "fa-shield-alt", pathname.startsWith("/help"))}
            </li>
            <li className="nav-item">
              {makeLink("/support", "技术支持", "fa-book", pathname.startsWith("/support"))}
            </li>
            <li className="nav-item">
              {makeLink("/graduation", "毕业管理", "fa-graduation-cap", pathname.startsWith("/graduation"))}
            </li>
          </ul>
        </div>
      </nav>
    </div>
  );
}

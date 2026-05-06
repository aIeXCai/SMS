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
  const [scoresOpen, setScoresOpen] = useState(false);
  const [targetStudentsOpen, setTargetStudentsOpen] = useState(false);
  const fullName = user?.name?.trim() || user?.username || "";

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
    if (pathname?.startsWith("/analysis")) {
      setAnalysisOpen(true);
    }
    if (pathname?.startsWith("/scores")) {
      setScoresOpen(true);
    }
    if (pathname?.startsWith("/target-students")) {
      setTargetStudentsOpen(true);
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
          className="text-sm px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors logout-btn"
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
        {/* ── Admin 管理员菜单 ── */}
        {user.role === "admin" && (
          <>
            <div className="nav-section">
              <h6 className="nav-section-title">主要功能</h6>
              <ul className="flex flex-col">
                <li className="nav-item">
                  {makeLink("/", "Dashboard", "fa-th-large", pathname === "/")}
                </li>
              </ul>
            </div>

            <div className="nav-section">
              <h6 className="nav-section-title">全校管理</h6>
              <ul className="flex flex-col">
                <li className="nav-item">
                  {makeLink("/students", "学生管理", "fa-user-graduate", pathname.startsWith("/students"))}
                </li>
                <li className="nav-item">
                  {makeLink("/exams", "考试管理", "fa-clipboard-list", pathname.startsWith("/exams"))}
                </li>
                <li className={`nav-item has-submenu ${scoresOpen ? "open" : ""}`}>
                  <a
                    className="nav-link"
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setScoresOpen((prev) => !prev);
                    }}
                  >
                    <i className="fas fa-chart-line" />
                    成绩管理
                  </a>
                  <ul className="nav-submenu">
                    <li className="nav-item">
                      {makeLink(
                        "/scores",
                        "成绩管理",
                        "",
                        pathname === "/scores" || pathname.startsWith("/scores/add") || pathname.startsWith("/scores/batch-edit")
                      )}
                    </li>
                    <li className="nav-item">
                      {makeLink("/scores/query", "成绩查询", "", pathname.startsWith("/scores/query"))}
                    </li>
                    <li className="nav-item">
                      {makeLink(
                        "/analysis/class-grade",
                        "成绩分析",
                        "",
                        pathname.startsWith("/analysis/class-grade")
                      )}
                    </li>
                    <li className="nav-item">
                      {makeLink(
                        "/analysis/student",
                        "个人分析",
                        "",
                        pathname.startsWith("/analysis/student")
                      )}
                    </li>
                  </ul>
                </li>
                <li className={`nav-item has-submenu ${targetStudentsOpen ? "open" : ""}`}>
                  <a
                    className={`nav-link${pathname.startsWith("/target-students") ? " active" : ""}`}
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setTargetStudentsOpen((prev) => !prev);
                    }}
                  >
                    <i className="fas fa-bullseye" />
                    目标生筛选
                  </a>
                  <ul className="nav-submenu">
                    <li className="nav-item">
                      {makeLink("/target-students", "简单筛选", "", pathname === "/target-students")}
                    </li>
                    <li className="nav-item">
                      {makeLink("/target-students/advanced", "高级筛选", "", pathname.startsWith("/target-students/advanced"))}
                    </li>
                    <li className="nav-item">
                      {makeLink("/target-students/rules", "我的规则", "", pathname.startsWith("/target-students/rules"))}
                    </li>
                    <li className="nav-item">
                      {makeLink("/target-students/tracking", "变化追踪", "", pathname.startsWith("/target-students/tracking"))}
                    </li>
                  </ul>
                </li>
              </ul>
            </div>
          </>
        )}

        {/* ── Grade Manager 级长菜单 ── */}
        {user.role === "grade_manager" && (
          <>
            <div className="nav-section">
              <h6 className="nav-section-title">主要功能</h6>
              <ul className="flex flex-col">
                <li className="nav-item">
                  {makeLink("/", "Dashboard", "fa-th-large", pathname === "/")}
                </li>
              </ul>
            </div>

            <div className="nav-section">
              <h6 className="nav-section-title">年级管理</h6>
              <ul className="flex flex-col">
                <li className="nav-item">
                  {makeLink("/students", "年级学生", "fa-user-graduate", pathname.startsWith("/students"))}
                </li>
                <li className="nav-item">
                  {makeLink("/exams", "年级考试", "fa-clipboard-list", pathname.startsWith("/exams"))}
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
                <li className="nav-item">
                  {makeLink("/analysis/class-grade", "成绩分析", "fa-chart-bar", pathname.startsWith("/analysis/class-grade"))}
                </li>
                <li className="nav-item">
                  {makeLink("/analysis/student", "个人分析", "fa-chart-bar", pathname.startsWith("/analysis/student"))}
                </li>
                <li className={`nav-item has-submenu ${targetStudentsOpen ? "open" : ""}`}>
                  <a
                    className={`nav-link${pathname.startsWith("/target-students") ? " active" : ""}`}
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setTargetStudentsOpen((prev) => !prev);
                    }}
                  >
                    <i className="fas fa-bullseye" />
                    目标生筛选
                  </a>
                  <ul className="nav-submenu">
                    <li className="nav-item">
                      {makeLink("/target-students", "简单筛选", "", pathname === "/target-students")}
                    </li>
                    <li className="nav-item">
                      {makeLink("/target-students/advanced", "高级筛选", "", pathname.startsWith("/target-students/advanced"))}
                    </li>
                    <li className="nav-item">
                      {makeLink("/target-students/rules", "我的规则", "", pathname.startsWith("/target-students/rules"))}
                    </li>
                    <li className="nav-item">
                      {makeLink("/target-students/tracking", "变化追踪", "", pathname.startsWith("/target-students/tracking"))}
                    </li>
                  </ul>
                </li>
              </ul>
            </div>
          </>
        )}

        {/* ── Subject Teacher 科任老师菜单 ── */}
        {user.role === "subject_teacher" && (
          <>
            <div className="nav-section">
              <h6 className="nav-section-title">主要功能</h6>
              <ul className="flex flex-col">
                <li className="nav-item">
                  {makeLink("/", "Dashboard", "fa-th-large", pathname === "/")}
                </li>
              </ul>
            </div>

            <div className="nav-section">
              <h6 className="nav-section-title">教学管理</h6>
              <ul className="flex flex-col">
                <li className="nav-item">
                  {makeLink("/students", "任教学生", "fa-user-graduate", pathname.startsWith("/students"))}
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
                      {makeLink("/analysis/class-grade", "班级对比", "", pathname.startsWith("/analysis/class-grade"))}
                    </li>
                    <li className="nav-item">
                      {makeLink("/analysis/student", "个人追踪", "", pathname.startsWith("/analysis/student"))}
                    </li>
                  </ul>
                </li>
                <li className="nav-item">
                  {makeLink("/target-students", "目标生筛选", "fa-bullseye", pathname.startsWith("/target-students"))}
                </li>
              </ul>
            </div>
          </>
        )}
      </nav>
    </div>
  );
}

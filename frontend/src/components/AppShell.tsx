"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <>
      <button
        className="mobile-toggle btn btn-light"
        onClick={() => setSidebarOpen((prev) => !prev)}
        type="button"
      >
        <i className="fas fa-bars"></i>
      </button>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-wrapper">
        <div className="main-content">{children}</div>
      </div>
    </>
  );
}

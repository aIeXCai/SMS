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
        className="mobile-toggle bg-white border border-gray-300 px-4 py-2 rounded hover:bg-gray-50 transition-colors"
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

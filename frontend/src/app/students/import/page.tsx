"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

export default function StudentImportPage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="container py-5">
        <h2>请先登录</h2>
        <p>您需要登录后才能访问此页面。</p>
      </div>
    );
  }

  return (
    <div className="container py-5">
      <h2>批量导入（功能待完成）</h2>
      <p>此页面为占位页面，后续将实现 Excel 导入功能，并调用后端接口完成批量导入。</p>
      <Link href="/students" className="btn btn-primary">
        返回学生列表
      </Link>
    </div>
  );
}

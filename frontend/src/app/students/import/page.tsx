"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { canWriteStudents } from "@/lib/permissions";

export default function StudentImportPage() {
  const { user } = useAuth();
  const router = useRouter();
  const canStudentWrite = canWriteStudents(user);

  useEffect(() => {
    if (user && !canStudentWrite) {
      router.push("/students");
    }
  }, [user, canStudentWrite, router]);

  if (!user) {
    return (
      <div className="container py-5">
        <h2>请先登录</h2>
        <p>您需要登录后才能访问此页面。</p>
      </div>
    );
  }

  if (!canStudentWrite) {
    return (
      <div className="container py-5">
        <h2>无权限访问</h2>
        <p>当前角色仅可查看学生信息，不能进行导入操作。</p>
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

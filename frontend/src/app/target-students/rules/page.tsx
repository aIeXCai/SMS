"use client";

import Link from "next/link";

export default function TargetStudentRulesPage() {
  return (
    <div className="container-fluid py-4">
      <div className="page-header p-4 mb-4 rounded-3 text-white" style={{ background: "rgb(1, 135, 108)" }}>
        <h1 className="mb-2"><i className="fas fa-bookmark me-2"></i>我的规则</h1>
        <p className="mb-0 opacity-75">用于管理高级筛选规则（新建、编辑、删除、复用）</p>
      </div>

      <div className="card filter-card">
        <div className="card-body py-5 text-center text-secondary">
          <p className="mb-3">该页面即将接入规则列表与编辑功能。</p>
          <Link href="/target-students/advanced" className="btn btn-outline-success">
            返回高级筛选
          </Link>
        </div>
      </div>
    </div>
  );
}

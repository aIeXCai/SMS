"use client";

import Link from "next/link";

export default function TargetStudentTrackingPage() {
  return (
    <div className="container-fluid py-4">
      <div className="page-header p-4 mb-4 rounded-3 text-white" style={{ background: "rgb(1, 135, 108)" }}>
        <h1 className="mb-2"><i className="fas fa-chart-line me-2"></i>变化追踪</h1>
        <p className="mb-0 opacity-75">用于快照管理与两次筛选结果对比</p>
      </div>

      <div className="card filter-card">
        <div className="card-body py-5 text-center text-secondary">
          <p className="mb-3">该页面即将接入快照列表、对比与报告导出功能。</p>
          <Link href="/target-students/advanced" className="btn btn-outline-success">
            返回高级筛选
          </Link>
        </div>
      </div>
    </div>
  );
}

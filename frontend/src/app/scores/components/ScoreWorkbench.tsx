"use client";

import Link from "next/link";

interface ScoreWorkbenchProps {
  canScoreWrite: boolean;
  isGradeManager: boolean;
  onImportClick: () => void;
}

const cardBase =
  "rounded-2xl border border-gray-100 bg-white p-6 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col items-center text-center";

const iconCircle =
  "mb-4 flex h-14 w-14 items-center justify-center rounded-full text-xl text-white";

export default function ScoreWorkbench({
  canScoreWrite,
  isGradeManager,
  onImportClick,
}: ScoreWorkbenchProps) {
  if (!canScoreWrite) {
    return (
      <div className="w-full px-4 mx-auto max-w-[1400px] py-5 text-center">
        <div className="max-w-lg mx-auto">
          <i className="fas fa-chart-line text-6xl text-gray-300 mb-4 block"></i>
          <h3 className="text-xl font-semibold text-gray-600 mb-2">成绩管理</h3>
          <p className="text-gray-400">
            当前角色为只读，暂无可用操作。如需录入或管理成绩，请联系管理员。
          </p>
        </div>
      </div>
    );
  }

  const thirdCard = isGradeManager
    ? {
        icon: "fa-layer-group",
        bg: "bg-indigo-500",
        title: "年级概览",
        desc: "查看本年级整体成绩分布与趋势分析",
        href: "/analysis/class-grade",
      }
    : {
        icon: "fa-chart-bar",
        bg: "bg-amber-500",
        title: "查看进度",
        desc: "查看各班级考试进度与完成情况",
        href: "/analysis/class-grade",
      };

  return (
    <div className="w-full px-4 mx-auto max-w-[1400px] py-4">
      {/* Page header */}
      <div className="page-header">
        <div className="w-full px-4 mx-auto max-w-[1400px]">
          <div className="flex flex-wrap items-center">
            <div className="w-full md:w-2/3">
              <h1>
                <i className="fas fa-chart-line mr-3"></i>成绩管理
              </h1>
              <p className="mb-0 opacity-75">管理学生考试成绩，支持手动录入和批量导入</p>
            </div>
            <div className="w-full md:w-1/3 text-right">
              <Link href="/scores/add" className="bg-white border border-gray-300 px-4 py-2 rounded hover:bg-gray-50 transition-colors mr-2">
                <i className="fas fa-plus mr-2"></i>手动新增成绩
              </Link>
              <button
                type="button"
                className="bg-white border border-gray-300 px-4 py-2 rounded hover:bg-gray-50 transition-colors"
                onClick={onImportClick}
              >
                <i className="fas fa-file-import mr-2"></i>批量导入
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Empty state description */}
      <div className="text-center py-4">
        <i className="fas fa-inbox text-5xl text-gray-300 mb-3 block"></i>
        <h5 className="text-gray-500 mb-2">暂未找到成绩记录</h5>
        <p className="text-gray-400 mb-4">
          当前没有任何成绩数据。选择以下方式开始管理：
        </p>
      </div>

      {/* Operation cards */}
      <div className="flex flex-wrap gap-4 justify-center" style={{ maxWidth: "960px", margin: "0 auto" }}>
        {/* Card 1: Add score */}
        <div className="w-full md:w-1/3">
          <Link href="/scores/add" className="no-underline">
            <div className={cardBase}>
              <div className={`${iconCircle} bg-emerald-500`}>
                <i className="fas fa-plus"></i>
              </div>
              <h5 className="text-lg font-semibold text-gray-800 mb-2">
                录入成绩
              </h5>
              <p className="text-sm text-gray-500">
                手动为单个学生录入考试成绩，适合少量数据录入场景
              </p>
            </div>
          </Link>
        </div>

        {/* Card 2: Batch import */}
        <div className="w-full md:w-1/3">
          <button
            onClick={onImportClick}
            className={`${cardBase} w-full border-0 cursor-pointer`}
            style={{ background: "white" }}
          >
            <div className={`${iconCircle} bg-blue-500`}>
              <i className="fas fa-file-import"></i>
            </div>
            <h5 className="text-lg font-semibold text-gray-800 mb-2">
              批量导入
            </h5>
            <p className="text-sm text-gray-500">
              通过Excel模板批量导入成绩数据，适合大量数据录入
            </p>
          </button>
        </div>

        {/* Card 3: varies by role */}
        <div className="w-full md:w-1/3">
          <Link href={thirdCard.href} className="no-underline">
            <div className={cardBase}>
              <div className={`${iconCircle} ${thirdCard.bg}`}>
                <i className={`fas ${thirdCard.icon}`}></i>
              </div>
              <h5 className="text-lg font-semibold text-gray-800 mb-2">
                {thirdCard.title}
              </h5>
              <p className="text-sm text-gray-500">{thirdCard.desc}</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

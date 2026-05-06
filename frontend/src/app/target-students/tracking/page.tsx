"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import SnapshotList, { FilterSnapshot } from "./components/SnapshotList";
import ComparisonResult, { SnapshotComparisonResult } from "./components/ComparisonResult";
import UnifiedModal from "../components/UnifiedModal";

const normalizeSnapshotList = (payload: unknown): FilterSnapshot[] => {
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { results?: unknown[] }).results)
      ? (payload as { results: unknown[] }).results
      : [];

  return rows
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    .map((item) => ({
      id: Number(item.id),
      snapshot_name: String(item.snapshot_name || "未命名快照"),
      exam_name: String(item.exam_name || "-"),
      exam_academic_year: item.exam_academic_year ? String(item.exam_academic_year) : null,
      student_count: Number(item.student_count || 0),
      created_at: String(item.created_at || ""),
    }))
    .filter((item) => Number.isFinite(item.id) && item.id > 0);
};

function TargetStudentTrackingContent() {
  const { token, loading, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [snapshots, setSnapshots] = useState<FilterSnapshot[]>([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [baselineSnapshotId, setBaselineSnapshotId] = useState<number | null>(null);
  const [comparisonSnapshotId, setComparisonSnapshotId] = useState<number | null>(null);
  const [deletingSnapshotId, setDeletingSnapshotId] = useState<number | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [comparisonResult, setComparisonResult] = useState<SnapshotComparisonResult | null>(null);
  const [modalState, setModalState] = useState<{
    open: boolean;
    variant: "success" | "error" | "warning" | "info";
    title: string;
    message: string;
    showCancel: boolean;
    confirmText: string;
    cancelText: string;
    onConfirmAction: (() => void) | null;
  }>({
    open: false,
    variant: "info",
    title: "提示",
    message: "",
    showCancel: false,
    confirmText: "确定",
    cancelText: "取消",
    onConfirmAction: null,
  });

  const baselineSnapshot = useMemo(
    () => snapshots.find((item) => item.id === baselineSnapshotId) || null,
    [snapshots, baselineSnapshotId]
  );
  const comparisonSnapshot = useMemo(
    () => snapshots.find((item) => item.id === comparisonSnapshotId) || null,
    [snapshots, comparisonSnapshotId]
  );

  useEffect(() => {
    if (!loading && !token) {
      router.push("/login");
    }
  }, [loading, token, router]);

  useEffect(() => {
    if (!token) return;

    const fetchSnapshots = async () => {
      setLoadingSnapshots(true);
      setSnapshotError(null);

      try {
        const data = await api.get<unknown>('/filter-snapshots/');
        const normalized = normalizeSnapshotList(data);
        setSnapshots(normalized);

        const preselectId = Number(searchParams.get("snapshot_id") || 0);
        if (preselectId > 0 && normalized.some((item) => item.id === preselectId)) {
          setComparisonSnapshotId(preselectId);
        }
      } catch (error) {
        console.error("Failed to fetch snapshots:", error);
        setSnapshotError("加载快照失败，请检查网络后重试");
        setSnapshots([]);
      } finally {
        setLoadingSnapshots(false);
      }
    };

    fetchSnapshots();
  }, [token, searchParams]);

  const handleSelectBaseline = (snapshotId: number) => {
    setBaselineSnapshotId((prev) => (prev === snapshotId ? null : snapshotId));
    setComparisonSnapshotId((prev) => (prev === snapshotId ? null : prev));
    setComparisonError(null);
    setComparisonResult(null);
  };

  const handleSelectComparison = (snapshotId: number) => {
    setComparisonSnapshotId((prev) => (prev === snapshotId ? null : snapshotId));
    setBaselineSnapshotId((prev) => (prev === snapshotId ? null : prev));
    setComparisonError(null);
    setComparisonResult(null);
  };

  const showInfoModal = (
    message: string,
    title = "操作提示",
    variant: "success" | "error" | "warning" | "info" = "info"
  ) => {
    setModalState({
      open: true,
      variant,
      title,
      message,
      showCancel: false,
      confirmText: "确定",
      cancelText: "取消",
      onConfirmAction: null,
    });
  };

  const showConfirmModal = (message: string, onConfirm: () => void, title = "请确认") => {
    setModalState({
      open: true,
      variant: "warning",
      title,
      message,
      showCancel: true,
      confirmText: "确认",
      cancelText: "取消",
      onConfirmAction: onConfirm,
    });
  };

  const handleCompareSnapshots = async () => {
    if (!baselineSnapshotId || !comparisonSnapshotId) {
      setComparisonError("请先选择基准快照和对比快照");
      return;
    }

    if (baselineSnapshotId === comparisonSnapshotId) {
      setComparisonError("基准快照和对比快照不能相同");
      return;
    }

    try {
      setComparisonLoading(true);
      setComparisonError(null);
      setComparisonResult(null);

      const data = await api.post<SnapshotComparisonResult>('/filter-snapshots/compare/', {
        baseline_snapshot_id: baselineSnapshotId,
        comparison_snapshot_id: comparisonSnapshotId,
      });

      setComparisonResult(data);
    } catch (error) {
      console.error("Failed to compare snapshots:", error);
      setComparisonError("对比分析失败，请检查网络后重试");
    } finally {
      setComparisonLoading(false);
    }
  };

  const handleDeleteSnapshot = async (snapshotId: number) => {
    const target = snapshots.find((item) => item.id === snapshotId);
    if (!target) return;

    showConfirmModal(`确认删除快照「${target.snapshot_name}」吗？`, async () => {
      try {
        setDeletingSnapshotId(snapshotId);
        await api.delete(`/filter-snapshots/${snapshotId}/`);

        setSnapshots((prev) => prev.filter((item) => item.id !== snapshotId));
        setBaselineSnapshotId((prev) => (prev === snapshotId ? null : prev));
        setComparisonSnapshotId((prev) => (prev === snapshotId ? null : prev));
        setComparisonResult(null);
        setComparisonError(null);
        showInfoModal("快照删除成功", "快照删除", "success");
      } catch (error) {
        console.error("Failed to delete snapshot:", error);
        showInfoModal("删除快照失败，请检查网络后重试", "快照删除", "error");
      } finally {
        setDeletingSnapshotId(null);
      }
    }, "确认删除快照");
  };

  if (loading) return <div className="p-4">加载中...</div>;
  if (!user) return null;

  return (
    <div>
      <div className="page-header">
        <div className="w-full px-4 mx-auto max-w-[1400px]">
          <div className="flex flex-wrap items-center">
            <div className="flex-1">
              <h1>
                <i className="fas fa-chart-line mr-3"></i>变化追踪
              </h1>
              <p className="mb-0 opacity-75">用于快照管理、历史对比与变化分析</p>
            </div>
            <div className="flex-shrink-0 text-right">
              <Link href="/target-students/advanced" className="secondary-action">
                <i className="fas fa-arrow-left mr-2"></i>返回高级筛选
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-4 mx-auto max-w-[1400px]">
        <div className="flex flex-wrap gap-3 md:gap-4">
          <div className="w-full xl:w-[70%]">
            <div className="bg-white rounded-lg shadow filter-card h-100">
              <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                <h5 className="mb-0">
                  <i className="fas fa-camera-retro mr-2"></i>历史快照列表
                </h5>
                <button
                  type="button"
                  className="bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 transition-colors text-sm"
                  onClick={() => router.push("/target-students/advanced")}
                >
                  <i className="fas fa-plus mr-1"></i>前往保存快照
                </button>
              </div>
              <div className="p-4">
                <SnapshotList
                  snapshots={snapshots}
                  loading={loadingSnapshots}
                  error={snapshotError}
                  baselineSnapshotId={baselineSnapshotId}
                  comparisonSnapshotId={comparisonSnapshotId}
                  deletingSnapshotId={deletingSnapshotId}
                  onSelectBaseline={handleSelectBaseline}
                  onSelectComparison={handleSelectComparison}
                  onDeleteSnapshot={handleDeleteSnapshot}
                />
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-lg shadow filter-card h-100">
              <div className="px-4 py-3 border-b border-gray-200">
                <h5 className="mb-0">
                  <i className="fas fa-code-compare mr-2"></i>对比分析区
                </h5>
              </div>
              <div className="p-4">
                <p className="text-gray-500 mb-3">已支持双快照选择与对比分析，结果包含新增/退出/保留名单及排名变化。</p>

                <div className="selected-snapshot-panel mb-3">
                  <div className="text-sm text-gray-500 mb-2">当前选择</div>
                  <div className="mb-2">
                    <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded mr-2">基准</span>
                    <span className="text-sm">{baselineSnapshot?.snapshot_name || "未选择"}</span>
                  </div>
                  <div>
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded mr-2">对比</span>
                    <span className="text-sm">{comparisonSnapshot?.snapshot_name || "未选择"}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    className="border border-green-300 text-green-600 px-4 py-2 rounded hover:bg-green-50 transition-colors"
                    onClick={() => {
                      setBaselineSnapshotId(null);
                      setComparisonError(null);
                      setComparisonResult(null);
                    }}
                    disabled={!baselineSnapshotId}
                  >
                    清空基准快照
                  </button>
                  <button
                    type="button"
                    className="border border-gray-300 px-4 py-2 rounded hover:bg-gray-50 transition-colors"
                    onClick={() => {
                      setComparisonSnapshotId(null);
                      setComparisonError(null);
                      setComparisonResult(null);
                    }}
                    disabled={!comparisonSnapshotId}
                  >
                    清空对比快照
                  </button>
                  <button
                    type="button"
                    className="border border-blue-300 text-blue-600 px-4 py-2 rounded hover:bg-blue-50 transition-colors"
                    disabled={!baselineSnapshotId || !comparisonSnapshotId || comparisonLoading}
                    onClick={handleCompareSnapshots}
                  >
                    {comparisonLoading ? "对比中..." : "开始对比分析"}
                  </button>
                </div>

                <hr className="my-3" />

                <div className="text-sm text-gray-500">
                  快捷入口：
                  <Link href="/target-students/advanced" className="ml-1">
                    返回高级筛选继续筛选
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap mt-3">
          <div className="w-full">
            <div className="bg-white rounded-lg shadow filter-card">
              <div className="px-4 py-3 border-b border-gray-200">
                <h5 className="mb-0">
                  <i className="fas fa-chart-bar mr-2"></i>对比结果展示
                </h5>
              </div>
              <div className="p-4">
                <ComparisonResult
                  result={comparisonResult}
                  loading={comparisonLoading}
                  error={comparisonError}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap mt-3">
          <div className="w-full">
            <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded border-0 tips-alert">
              <div className="flex items-center">
                <i className="fas fa-lightbulb fa-2x mr-3 text-green-600"></i>
                <div>
                  <h6 className="alert-heading mb-1 text-green-600">使用指引</h6>
                  <p className="mb-0 text-sm text-green-600">
                    建议先在高级筛选页保存关键阶段快照，再在本页做双快照对比，快速定位名单变化和学生排名波动。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mt-2">
          <div className="flex-1 min-w-0">
            <div className="intro-card h-100">
              <div className="intro-card-header">
                <div className="intro-icon-wrapper">
                  <i className="fas fa-list-check"></i>
                </div>
                <h5 className="mb-0">推荐操作流程</h5>
              </div>
              <div className="intro-card-body">
                <div className="feature-item">
                  <div className="feature-icon">
                    <i className="fas fa-1"></i>
                  </div>
                  <div className="feature-content">
                    <h6>保存关键节点快照</h6>
                    <p>期中、月考、期末等节点建议固定保存快照，形成可追溯历史。</p>
                  </div>
                </div>
                <div className="feature-item">
                  <div className="feature-icon">
                    <i className="fas fa-2"></i>
                  </div>
                  <div className="feature-content">
                    <h6>选择基准与对比</h6>
                    <p>建议选择时间连续的两次快照，便于解释变化原因。</p>
                  </div>
                </div>
                <div className="feature-item">
                  <div className="feature-icon">
                    <i className="fas fa-3"></i>
                  </div>
                  <div className="feature-content">
                    <h6>输出变化报告</h6>
                    <p>对新增、退出、保留名单进行复核后再导出报告共享。</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="intro-card h-100">
              <div className="intro-card-header">
                <div className="intro-icon-wrapper">
                  <i className="fas fa-circle-info"></i>
                </div>
                <h5 className="mb-0">对比口径建议</h5>
              </div>
              <div className="intro-card-body">
                <div className="indicator-item">
                  <div className="indicator-tag">新增</div>
                  <p>建议优先关注"新进入名单"学生，及时制定跟进策略。</p>
                </div>
                <div className="indicator-item">
                  <div className="indicator-tag">退出</div>
                  <p>建议结合单科排名波动，排查退出名单的关键影响因素。</p>
                </div>
                <div className="indicator-item">
                  <div className="indicator-tag warning">保留但波动</div>
                  <p>重点关注保留名单中的排名大幅波动学生，避免状态误判。</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <UnifiedModal
        open={modalState.open}
        variant={modalState.variant}
        title={modalState.title}
        message={modalState.message}
        showCancel={modalState.showCancel}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
        onConfirm={() => {
          const action = modalState.onConfirmAction;
          setModalState((prev) => ({ ...prev, open: false, onConfirmAction: null }));
          if (action) {
            action();
          }
        }}
        onClose={() => setModalState((prev) => ({ ...prev, open: false, onConfirmAction: null }))}
      />

      <style jsx global>{`
        .page-header {
          background: rgb(1, 135, 108);
          color: white;
          padding: 2rem 0;
          margin-bottom: 2rem;
          border-radius: 10px;
        }
        a.secondary-action,
        a.secondary-action:link,
        a.secondary-action:visited,
        a.secondary-action:hover,
        a.secondary-action:active {
          display: inline-flex; align-items: center; justify-content: center;
          min-height: 44px; min-width: 144px; padding: 0 16px; border-radius: 12px;
          background: rgba(255,255,255,0.72); color: #2f3a4b; font-size: 14px;
          text-decoration: none; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
          transition: all 0.2s ease; cursor: pointer;
        }
        a.secondary-action:hover { background: rgba(255,255,255,0.9); color: #1a2535; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .comparison-meta {
          border: 1px solid #e8f5e9;
          border-radius: 10px;
          background: #f8fff8;
          padding: 0.75rem;
        }
        .selected-snapshot-panel {
          border: 1px solid #e9ecef;
          border-radius: 10px;
          background: #f8f9fa;
          padding: 0.75rem;
        }
      `}</style>
    </div>
  );
}

export default function TargetStudentTrackingPage() {
  return (
    <Suspense fallback={<div className="p-4">加载中...</div>}>
      <TargetStudentTrackingContent />
    </Suspense>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import SnapshotList, { FilterSnapshot } from "./components/SnapshotList";
import ComparisonResult, { SnapshotComparisonResult } from "./components/ComparisonResult";
import UnifiedModal from "../components/UnifiedModal";

const backendBaseUrl =
  typeof window !== "undefined"
    ? `http://${window.location.hostname}:8000`
    : "http://localhost:8000";
const FILTER_SNAPSHOT_API = `${backendBaseUrl}/api/filter-snapshots/`;
const FILTER_COMPARE_API = `${backendBaseUrl}/api/filter-snapshots/compare/`;

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

export default function TargetStudentTrackingPage() {
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

  const effectiveToken = useMemo(() => {
    if (token) return token;
    if (typeof window !== "undefined") return localStorage.getItem("accessToken");
    return null;
  }, [token]);

  const authHeader = useMemo(() => {
    if (!effectiveToken) return undefined;
    return { Authorization: `Bearer ${effectiveToken}` };
  }, [effectiveToken]);

  const baselineSnapshot = useMemo(
    () => snapshots.find((item) => item.id === baselineSnapshotId) || null,
    [snapshots, baselineSnapshotId]
  );
  const comparisonSnapshot = useMemo(
    () => snapshots.find((item) => item.id === comparisonSnapshotId) || null,
    [snapshots, comparisonSnapshotId]
  );

  useEffect(() => {
    if (!loading && !effectiveToken) {
      router.push("/login");
    }
  }, [loading, effectiveToken, router]);

  useEffect(() => {
    if (!effectiveToken) return;

    const fetchSnapshots = async () => {
      setLoadingSnapshots(true);
      setSnapshotError(null);

      try {
        const res = await fetch(FILTER_SNAPSHOT_API, {
          headers: { ...authHeader },
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setSnapshotError("加载快照失败，请稍后重试");
          setSnapshots([]);
          return;
        }

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
  }, [effectiveToken, authHeader, searchParams]);

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

      const res = await fetch(FILTER_COMPARE_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify({
          baseline_snapshot_id: baselineSnapshotId,
          comparison_snapshot_id: comparisonSnapshotId,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message =
          data && typeof data === "object" && "message" in data && typeof data.message === "string"
            ? data.message
            : "对比分析失败，请稍后重试";
        setComparisonError(message);
        return;
      }

      setComparisonResult(data as SnapshotComparisonResult);
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
        const res = await fetch(`${FILTER_SNAPSHOT_API}${snapshotId}/`, {
          method: "DELETE",
          headers: { ...authHeader },
        });

        if (!res.ok) {
          showInfoModal("删除快照失败，请稍后重试", "快照删除", "error");
          return;
        }

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
        <div className="container-fluid">
          <div className="row align-items-center">
            <div className="col-md-8">
              <h1>
                <i className="fas fa-chart-line me-3"></i>变化追踪
              </h1>
              <p className="mb-0 opacity-75">用于快照管理、历史对比与变化分析</p>
            </div>
            <div className="col-md-4 text-end mt-3 mt-md-0">
              <button
                type="button"
                className="btn btn-light"
                onClick={() => router.push("/target-students/advanced")}
              >
                <i className="fas fa-arrow-left me-1"></i>返回高级筛选
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container-fluid">
        <div className="row g-3 g-md-4">
          <div className="col-12 col-xl-8">
            <div className="card filter-card h-100">
              <div className="card-header d-flex justify-content-between align-items-center">
                <h5 className="mb-0">
                  <i className="fas fa-camera-retro me-2"></i>历史快照列表
                </h5>
                <button
                  type="button"
                  className="btn btn-success btn-sm"
                  onClick={() => router.push("/target-students/advanced")}
                >
                  <i className="fas fa-plus me-1"></i>前往保存快照
                </button>
              </div>
              <div className="card-body">
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

          <div className="col-12 col-xl-4">
            <div className="card filter-card h-100">
              <div className="card-header">
                <h5 className="mb-0">
                  <i className="fas fa-code-compare me-2"></i>对比分析区
                </h5>
              </div>
              <div className="card-body">
                <p className="text-secondary mb-3">已支持双快照选择与对比分析，结果包含新增/退出/保留名单及排名变化。</p>

                <div className="selected-snapshot-panel mb-3">
                  <div className="small text-muted mb-2">当前选择</div>
                  <div className="mb-2">
                    <span className="badge bg-success-subtle text-success-emphasis me-2">基准</span>
                    <span className="small">{baselineSnapshot?.snapshot_name || "未选择"}</span>
                  </div>
                  <div>
                    <span className="badge bg-primary-subtle text-primary-emphasis me-2">对比</span>
                    <span className="small">{comparisonSnapshot?.snapshot_name || "未选择"}</span>
                  </div>
                </div>

                <div className="d-grid gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-success"
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
                    className="btn btn-outline-secondary"
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
                    className="btn btn-outline-primary"
                    disabled={!baselineSnapshotId || !comparisonSnapshotId || comparisonLoading}
                    onClick={handleCompareSnapshots}
                  >
                    {comparisonLoading ? "对比中..." : "开始对比分析"}
                  </button>
                </div>

                <hr className="my-3" />

                <div className="small text-secondary">
                  快捷入口：
                  <Link href="/target-students/advanced" className="ms-1 text-decoration-none">
                    返回高级筛选继续筛选
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="row mt-3">
          <div className="col-12">
            <div className="card filter-card">
              <div className="card-header">
                <h5 className="mb-0">
                  <i className="fas fa-chart-bar me-2"></i>对比结果展示
                </h5>
              </div>
              <div className="card-body">
                <ComparisonResult
                  result={comparisonResult}
                  loading={comparisonLoading}
                  error={comparisonError}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="row mt-3">
          <div className="col-12">
            <div className="alert alert-info border-0 tips-alert">
              <div className="d-flex align-items-center">
                <i className="fas fa-lightbulb fa-2x me-3 text-success"></i>
                <div>
                  <h6 className="alert-heading mb-1 text-success">使用指引</h6>
                  <p className="mb-0 small text-success">
                    建议先在高级筛选页保存关键阶段快照，再在本页做双快照对比，快速定位名单变化和学生排名波动。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="row g-4 mt-2">
          <div className="col-lg-6">
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

          <div className="col-lg-6">
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
                  <p>建议优先关注“新进入名单”学生，及时制定跟进策略。</p>
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

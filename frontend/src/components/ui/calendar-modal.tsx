"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

interface CalendarEventFormData {
  title: string;
  start: string;
  end: string | null;
  is_all_day: boolean;
  event_type: string;
  description: string;
  grade: string;
  visibility: string;
}

interface CalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  mode: "create" | "edit";
  initialData?: {
    id: string;
    title: string;
    start: string;
    end: string;
    is_all_day: boolean;
    event_type: string;
    description: string;
    grade: string;
    visibility: string;
  };
  initialDate?: string;
  userRole: string;
  userManagedGrade?: string;
  backendBaseUrl: string;
  authToken: string;
  onDelete?: (id: string) => void;
}

const EVENT_TYPES = [
  { value: "exam", label: "考试" },
  { value: "meeting", label: "会议" },
  { value: "activity", label: "活动" },
  { value: "reminder", label: "提醒" },
  { value: "other", label: "其他" },
];

const GRADE_OPTIONS = [
  { value: "初一", label: "初一" },
  { value: "初二", label: "初二" },
  { value: "初三", label: "初三" },
  { value: "高一", label: "高一" },
  { value: "高二", label: "高二" },
  { value: "高三", label: "高三" },
];

function formatDateForInput(dateStr: string): string {
  if (!dateStr) return "";
  // dateStr is ISO format like "2026-04-20T09:00:00" or "2026-04-20"
  const d = new Date(dateStr);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateOnly(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function CalendarModal({
  isOpen,
  onClose,
  onSuccess,
  mode,
  initialData,
  initialDate,
  userRole,
  userManagedGrade,
  backendBaseUrl,
  authToken,
  onDelete,
}: CalendarModalProps) {
  const isEdit = mode === "edit";

  const getInitialFormData = (): CalendarEventFormData => {
    if (isEdit && initialData) {
      return {
        title: initialData.title || "",
        start: initialData.start ? formatDateForInput(initialData.start) : "",
        end: initialData.end ? formatDateForInput(initialData.end) : "",
        is_all_day: initialData.is_all_day || false,
        event_type: initialData.event_type || "reminder",
        description: initialData.description || "",
        grade: initialData.grade || userManagedGrade || "",
        visibility: initialData.visibility || "personal",
      };
    }
    return {
      title: "",
      start: initialDate ? `${initialDate}T09:00` : "",
      end: initialDate ? `${initialDate}T10:00` : "",
      is_all_day: false,
      event_type: "reminder",
      description: "",
      grade: userManagedGrade || "",
      visibility: "personal",
    };
  };

  const [formData, setFormData] = useState<CalendarEventFormData>(getInitialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [mounted, setMounted] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Reset form when modal opens or initialData content changes (not just reference)
  useEffect(() => {
    // Only reset if initialData actually has meaningful changes
    if (!isOpen) return;
    if (initialData) {
      setFormData({
        title: initialData.title || "",
        start: initialData.start ? formatDateForInput(initialData.start) : "",
        end: initialData.end ? formatDateForInput(initialData.end) : "",
        is_all_day: initialData.is_all_day || false,
        event_type: initialData.event_type || "reminder",
        description: initialData.description || "",
        grade: initialData.grade || userManagedGrade || "",
        visibility: initialData.visibility || "personal",
      });
    } else {
      setFormData({
        title: "",
        start: initialDate ? `${initialDate}T09:00` : "",
        end: initialDate ? `${initialDate}T10:00` : "",
        is_all_day: false,
        event_type: "reminder",
        description: "",
        grade: userManagedGrade || "",
        visibility: "personal",
      });
    }
    setErrorMsg("");
    setIsSubmitting(false);
  }, [isOpen]);

  // Role-based visibility restrictions
  useEffect(() => {
    if (!isEdit) {
      if (userRole === "grade_manager" && formData.visibility === "school") {
        setFormData((prev) => ({ ...prev, visibility: "grade" }));
      } else if (userRole !== "admin" && userRole !== "grade_manager") {
        setFormData((prev) => ({ ...prev, visibility: "personal", grade: "" }));
      }
    }
  }, [userRole, isEdit]);

  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      onClose();
    }
  }, [isSubmitting, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      setErrorMsg("请输入日程标题");
      return;
    }
    if (!formData.start) {
      setErrorMsg("请选择开始时间");
      return;
    }
    if (formData.visibility === "grade" && !formData.grade) {
      setErrorMsg("请选择年级");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");

    const payload = {
      ...formData,
      end: formData.is_all_day ? null : formData.end || null,
    };
    console.log('[CalendarModal] 保存时 payload:', JSON.stringify(payload, null, 2));

    const url = isEdit
      ? `${backendBaseUrl}/api/calendar-events/${initialData?.id}/`
      : `${backendBaseUrl}/api/calendar-events/`;

    try {
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        if (isEdit && onDelete && payload.visibility === "delete") {
          onDelete(initialData!.id);
        }
        onSuccess();
        onClose();
      } else {
        const data = await res.json();
        setErrorMsg(data.detail || data.message || "保存失败，请重试");
      }
    } catch {
      setErrorMsg("网络异常，请重试");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!isEdit || !initialData?.id) return;
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!initialData?.id) return;
    setShowDeleteConfirm(false);
    setIsSubmitting(true);
    setErrorMsg("");

    try {
      const res = await fetch(
        `${backendBaseUrl}/api/calendar-events/${initialData.id}/`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      if (res.ok || res.status === 204) {
        onSuccess();
        onClose();
      } else {
        const data = await res.json();
        setErrorMsg(data.detail || "删除失败，请重试");
      }
    } catch {
      setErrorMsg("网络异常，请重试");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAllDayChange = (checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      is_all_day: checked,
      end: checked ? null : (initialDate ? `${initialDate}T10:00` : ""),
    }));
  };

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div
      className="modal d-block"
      style={{
        backgroundColor: "rgba(0,0,0,0.6)",
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1050,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="modal-dialog modal-lg modal-dialog-centered"
        role="document"
        style={{ marginTop: "5vh" }}
      >
        <div
          className="modal-content border-0 shadow-lg"
          style={{
            borderRadius: "15px",
            overflow: "hidden",
            borderLeft: `4px solid ${isEdit ? "#0369a1" : "#01876c"}`,
          }}
        >
          <div
            className="modal-header border-bottom"
            style={{
              background: isEdit
                ? "linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)"
                : "linear-gradient(135deg, #e8f7f4 0%, #c3e6cb 100%)",
              padding: "1.5rem",
            }}
          >
            <h5 className="modal-title fw-bold text-dark mb-0">
              <i
                className={`fas ${isEdit ? "fa-edit" : "fa-calendar-plus"} me-2`}
                style={{ color: isEdit ? "#0369a1" : "#01876c" }}
              ></i>
              {isEdit ? "编辑日程" : "新建日程"}
            </h5>
            <button
              type="button"
              className="btn-close"
              onClick={handleClose}
              aria-label="Close"
              disabled={isSubmitting}
            ></button>
          </div>

          <div className="modal-body" style={{ padding: "2rem" }}>
            {errorMsg && (
              <div
                className="alert alert-danger border-0 rounded-3 d-flex align-items-center mb-4 shadow-sm"
                role="alert"
              >
                <i className="fas fa-exclamation-triangle me-3 fs-4"></i>
                <div>{errorMsg}</div>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* 标题 */}
              <div className="mb-3">
                <label className="form-label fw-bold">
                  日程标题 <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="请输入日程标题"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  maxLength={100}
                  disabled={isSubmitting}
                />
              </div>

              {/* 类型和全天 */}
              <div className="row mb-3">
                <div className="col-md-6">
                  <label className="form-label fw-bold">日程类型</label>
                  <select
                    className="form-select"
                    value={formData.event_type}
                    onChange={(e) =>
                      setFormData({ ...formData, event_type: e.target.value })
                    }
                    disabled={isSubmitting}
                  >
                    {EVENT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6 d-flex align-items-center">
                  <div className="form-check mt-4">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="is_all_day"
                      checked={formData.is_all_day}
                      onChange={(e) => handleAllDayChange(e.target.checked)}
                      disabled={isSubmitting}
                    />
                    <label
                      className="form-check-label fw-bold"
                      htmlFor="is_all_day"
                    >
                      全天事件
                    </label>
                  </div>
                </div>
              </div>

              {/* 开始和结束时间 */}
              <div className="row mb-3">
                <div className="col-md-6">
                  <label className="form-label fw-bold">
                    开始时间 <span className="text-danger">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    className="form-control"
                    value={formData.start}
                    onChange={(e) =>
                      setFormData({ ...formData, start: e.target.value })
                    }
                    disabled={isSubmitting}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-bold">结束时间</label>
                  <input
                    type="datetime-local"
                    className="form-control"
                    value={formData.end ?? ""}
                    onChange={(e) =>
                      setFormData({ ...formData, end: e.target.value })
                    }
                    disabled={formData.is_all_day || isSubmitting}
                  />
                </div>
              </div>

              {/* 可见性和年级 */}
              <div className="row mb-3">
                <div className="col-md-6">
                  <label className="form-label fw-bold">可见范围</label>
                  <select
                    className="form-select"
                    value={formData.visibility}
                    onChange={(e) =>
                      setFormData({ ...formData, visibility: e.target.value })
                    }
                    disabled={isSubmitting || (isEdit && userRole !== "admin")}
                  >
                    <option value="personal">个人（仅自己可见）</option>
                    {userRole === "grade_manager" && (
                      <option value="grade">年级（年级内可见）</option>
                    )}
                    {userRole === "admin" && (
                      <>
                        <option value="grade">年级（年级内可见）</option>
                        <option value="school">全校（所有教师可见）</option>
                      </>
                    )}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-bold">年级</label>
                  <select
                    className="form-select"
                    value={formData.grade}
                    onChange={(e) =>
                      setFormData({ ...formData, grade: e.target.value })
                    }
                    disabled={formData.visibility !== "grade" || isSubmitting}
                  >
                    <option value="">请选择年级</option>
                    {GRADE_OPTIONS.map((g) => (
                      <option key={g.value} value={g.value}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 描述 */}
              <div className="mb-4">
                <label className="form-label fw-bold">描述/备注</label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="请输入日程描述或备注（可选）"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  disabled={isSubmitting}
                />
              </div>

              {/* 按钮 */}
              <div className="text-center mt-4">
                <button
                  type="submit"
                  className={`btn btn-${isEdit ? "primary" : "success"} btn-lg rounded-pill shadow px-5`}
                  style={
                    isEdit
                      ? {
                          background: "linear-gradient(135deg, #0369a1 0%, #0284c7 100%)",
                          border: "none",
                        }
                      : {
                          background: "linear-gradient(135deg, #01876c 0%, #02a080 100%)",
                          border: "none",
                        }
                  }
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                        aria-hidden="true"
                      ></span>
                      保存中...
                    </>
                  ) : (
                    <>
                      <i className={`fas ${isEdit ? "fa-save" : "fa-check"} me-2`}></i>
                      {isEdit ? "保存修改" : "创建日程"}
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="btn btn-light btn-lg rounded-pill shadow-sm px-5 ms-3 border"
                  onClick={handleClose}
                  disabled={isSubmitting}
                >
                  取消
                </button>
                {isEdit && userRole === "admin" && (
                  <button
                    type="button"
                    className="btn btn-danger btn-lg rounded-pill shadow-sm px-5 ms-3"
                    onClick={handleDelete}
                    disabled={isSubmitting}
                  >
                    <i className="fas fa-trash me-2"></i>
                    删除
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* 自定义删除确认对话框 */}
      {showDeleteConfirm && (
        <div
          className="d-flex align-items-center justify-content-center"
          style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 1060,
          }}
        >
          <div
            className="bg-white shadow-lg p-4 mx-3"
            style={{ maxWidth: 380, width: '100%', textAlign: 'center', borderRadius: '1rem' }}
          >
            <div
              className="mb-3 mx-auto d-flex align-items-center justify-content-center rounded-circle"
              style={{ width: 56, height: 56, background: '#fee2e2' }}
            >
              <i className="fas fa-exclamation-triangle fa-lg" style={{ color: '#ef4444' }}></i>
            </div>
            <h5 className="mb-2" style={{ fontWeight: 600 }}>确定要删除这个日程吗？</h5>
            <p className="text-muted small mb-4">删除后无法恢复</p>
            <div className="d-flex gap-3 justify-content-center">
              <button
                type="button"
                className="btn btn-light rounded-pill px-4"
                onClick={() => setShowDeleteConfirm(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="btn btn-danger rounded-pill px-4"
                onClick={handleConfirmDelete}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="spinner-border spinner-border-sm me-1"></span>
                ) : (
                  <i className="fas fa-trash me-1"></i>
                )}
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(modalContent, document.body);
  }
  return null;
}

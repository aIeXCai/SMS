"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg } from "@fullcalendar/core";
import { CalendarModal } from "./calendar-modal";

type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay?: boolean;
  color?: string;
  extendedProps?: {
    type: string;
    grade: string;
    academic_year: string;
    description: string;
    visibility: string;
    creator_name: string;
  };
};

type PopoverState = {
  visible: boolean;
  x: number;
  y: number;
  event: CalendarEvent | null;
};

type User = {
  id: number;
  username: string;
  role: string;
  managed_grade?: string;
};

type CalendarWidgetProps = {
  user?: User | null;
};

export function CalendarWidget({ user }: CalendarWidgetProps) {
  const calendarRef = useRef<FullCalendar>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [popover, setPopover] = useState<PopoverState>({
    visible: false,
    x: 0,
    y: 0,
    event: null,
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      const token = localStorage.getItem("accessToken");
      const hostname = window.location.hostname;
      const url = token
        ? `http://${hostname}:8000/api/dashboard/events/?token=${encodeURIComponent(token)}`
        : `http://${hostname}:8000/api/dashboard/events/`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      // Force all events to display as all-day in month view (no time shown)
      const allDayEvents = (data.events || []).map((e: CalendarEvent) => ({ ...e, allDay: true }));
      setEvents(allDayEvents);
    } catch (e) {
      console.error("获取日历事件失败", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleEventClick = useCallback((info: EventClickArg) => {
    const event = info.event.toPlainObject() as CalendarEvent;
    setEditingEvent(event);
    setModalOpen(true);
  }, []);

  const handleDateClick = useCallback((info: { dateStr: string }) => {
    const dateStr = info.dateStr.split("T")[0];
    setSelectedDate(dateStr);
    setEditingEvent(null); // clear editing state for new event
    setModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setModalOpen(false);
    setSelectedDate("");
    setEditingEvent(null);
  }, []);

  const handleModalSuccess = useCallback(() => {
    fetchEvents();
  }, [fetchEvents]);

  const closePopover = useCallback(() => {
    setPopover((p) => ({ ...p, visible: false }));
  }, []);

  useEffect(() => {
    if (!popover.visible) return;
    const handler = () => closePopover();
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [popover.visible, closePopover]);

  return (
    <div className="cal-widget">
      {loading ? (
        <div className="cal-loading">
          <div className="cal-spinner" />
          <span>加载日历...</span>
        </div>
      ) : (
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek",
          }}
          buttonText={{
            today: "今天",
            month: "月",
            week: "周",
          }}
          events={events}
          eventClick={handleEventClick}
          dateClick={handleDateClick}
          height={580}
          eventDisplay="block"
          eventTimeFormat={{
            hour: "2-digit",
            minute: "2-digit",
            meridiem: false,
            hour12: false,
          }}
        />
      )}

      {popover.visible && popover.event && (
        <div
          className="cal-popover"
          style={{
            left: popover.x,
            top: popover.y,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="cal-popover-header">
            <div className="cal-popover-dot" />
            <span className="cal-popover-type">{popover.event.extendedProps?.type === "exam" ? "考试" : "日程"}</span>
            <button className="cal-popover-close" onClick={closePopover}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div className="cal-popover-title">{popover.event.title}</div>
          <div className="cal-popover-meta">
            <span>📅 {popover.event.start}</span>
            {popover.event.extendedProps?.grade && (
              <span>📚 {popover.event.extendedProps.grade}</span>
            )}
          </div>
          {popover.event.extendedProps?.description && (
            <div className="cal-popover-desc">{popover.event.extendedProps.description}</div>
          )}
        </div>
      )}

      {modalOpen && (
        <CalendarModal
          isOpen={modalOpen}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
          mode={editingEvent ? "edit" : "create"}
          initialData={
            editingEvent
              ? {
                  id: editingEvent.id,
                  title: editingEvent.title,
                  start: editingEvent.start,
                  end: editingEvent.end || "",
                  is_all_day: editingEvent.allDay ?? false,
                  event_type: editingEvent.extendedProps?.type || "other",
                  description: editingEvent.extendedProps?.description || "",
                  grade: editingEvent.extendedProps?.grade || "",
                  visibility: editingEvent.extendedProps?.visibility || "personal",
                }
              : undefined
          }
          initialDate={selectedDate}
          userRole={user?.role || "subject_teacher"}
          userManagedGrade={user?.managed_grade || ""}
          backendBaseUrl={`${window.location.hostname}:8000`}
          authToken={localStorage.getItem("accessToken") || ""}
        />
      )}

      <style>{`
        .cal-widget {
          padding: 1rem;
          font-family: 'Outfit', 'Noto Sans SC', 'Segoe UI', sans-serif;
          overflow: hidden;
        }
        .cal-widget .fc {
          overflow-x: hidden;
          overflow-y: auto;
        }

        .cal-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 3rem;
          color: #8fa398;
          font-size: 0.88rem;
        }

        .cal-spinner {
          width: 28px;
          height: 28px;
          border: 2px solid #e2e8e5;
          border-top-color: #01876c;
          border-radius: 50%;
          animation: cal-spin 0.75s linear infinite;
        }

        @keyframes cal-spin {
          to { transform: rotate(360deg); }
        }

        /* FullCalendar custom theme */
        .cal-widget .fc {
          --fc-border-color: #e2e8e5;
          --fc-button-bg-color: #ffffff;
          --fc-button-border-color: #e2e8e5;
          --fc-button-text-color: #5a6b63;
          --fc-button-hover-bg-color: #e8f7f4;
          --fc-button-hover-border-color: #01876c;
          --fc-button-active-bg-color: #01876c;
          --fc-button-active-border-color: #01876c;
          --fc-today-bg-color: #e8f7f4;
          --fc-event-bg-color: #01876c;
          --fc-event-border-color: #017a63;
          --fc-page-bg-color: transparent;
          --fc-neutral-bg-color: #f8f9fa;
          --fc-list-event-hover-bg-color: #e8f7f4;
        }

        .cal-widget .fc .fc-toolbar-title {
          font-size: 1rem;
          font-weight: 600;
          color: #1a2820;
          letter-spacing: -0.01em;
        }

        .cal-widget .fc .fc-button {
          border-radius: 8px !important;
          font-size: 0.82rem !important;
          font-weight: 500 !important;
          padding: 0.35rem 0.75rem !important;
          box-shadow: none !important;
          transition: all 0.2s ease;
          font-family: inherit;
        }

        .cal-widget .fc .fc-button:focus {
          box-shadow: 0 0 0 3px rgba(1, 135, 108, 0.15) !important;
        }

        .cal-widget .fc .fc-button-primary:not(:disabled).fc-button-active,
        .cal-widget .fc .fc-button-primary:not(:disabled):active {
          background-color: #01876c !important;
          border-color: #01876c !important;
          color: #ffffff !important;
        }

        .cal-widget .fc .fc-col-header-cell {
          padding: 8px 0;
          background: #f8f9fa;
          font-weight: 600;
          font-size: 0.82rem;
          color: #5a6b63;
          border-color: #e2e8e5 !important;
        }

        .cal-widget .fc .fc-col-header-cell-cushion {
          color: #5a6b63;
          text-decoration: none;
          font-weight: 600;
        }

        .cal-widget .fc .fc-daygrid-day {
          transition: background-color 0.15s ease;
          border-color: #f1f3f4 !important;
        }

        .cal-widget .fc .fc-daygrid-day:hover {
          background-color: #f8f9f8;
        }

        .cal-widget .fc .fc-daygrid-day-number {
          font-size: 0.82rem;
          color: #5a6b63;
          text-decoration: none;
          padding: 6px 8px;
          font-weight: 500;
        }

        .cal-widget .fc .fc-day-today .fc-daygrid-day-number {
          background: #01876c;
          color: #ffffff;
          border-radius: 50%;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 4px;
          padding: 0;
          font-weight: 700;
        }

        .cal-widget .fc .fc-daygrid-event {
          border-radius: 6px !important;
          font-size: 0.78rem !important;
          padding: 2px 6px !important;
          border: none !important;
          margin: 1px 4px !important;
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
          font-weight: 500;
        }

        .cal-widget .fc .fc-daygrid-event:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 6px rgba(1, 135, 108, 0.25);
        }

        .cal-widget .fc .fc-daygrid-event .fc-event-main {
          padding: 0;
        }

        .cal-widget .fc .fc-daygrid-more-link {
          font-size: 0.75rem;
          color: #01876c;
          font-weight: 600;
          margin-top: 2px;
        }

        .cal-widget .fc .fc-daygrid-more-link:hover {
          text-decoration: underline;
        }

        .cal-widget .fc .fc-scrollgrid {
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid #e2e8e5;
        }

        .cal-widget .fc .fc-scrollgrid td,
        .cal-widget .fc .fc-scrollgrid th {
          border-color: #f1f3f4 !important;
        }

        .cal-widget .fc .fc-timegrid-slot {
          height: 36px !important;
          border-color: #f1f3f4 !important;
        }

        .cal-widget .fc .fc-timegrid-slot-label {
          font-size: 0.75rem;
          color: #8fa398;
          vertical-align: top;
          padding-top: 4px;
        }

        .cal-widget .fc .fc-event {
          border-radius: 6px;
          cursor: pointer;
        }

        .cal-widget .fc .fc-event .fc-bg-event {
          opacity: 0.3;
        }

        .cal-widget .fc .fc-list {
          border-radius: 12px;
          border: 1px solid #e2e8e5;
          overflow: hidden;
        }

        .cal-widget .fc .fc-list-day-cushion {
          background: #f8f9fa !important;
          font-weight: 600;
          color: #5a6b63;
          font-size: 0.85rem;
        }

        .cal-widget .fc .fc-list-event:hover td {
          background: #e8f7f4 !important;
        }

        /* Popover */
        .cal-popover {
          position: fixed;
          transform: translate(-50%, calc(-100% - 10px));
          background: #ffffff;
          border: 1px solid #e2e8e5;
          border-radius: 12px;
          padding: 12px 14px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
          min-width: 200px;
          max-width: 280px;
          z-index: 99999;
          animation: cal-popover-in 0.15s ease;
        }

        .cal-popover::after {
          content: '';
          position: absolute;
          bottom: -6px;
          left: 50%;
          transform: translateX(-50%) rotate(45deg);
          width: 10px;
          height: 10px;
          background: #ffffff;
          border-right: 1px solid #e2e8e5;
          border-bottom: 1px solid #e2e8e5;
        }

        @keyframes cal-popover-in {
          from { opacity: 0; transform: translate(-50%, calc(-100% - 6px)); }
          to { opacity: 1; transform: translate(-50%, calc(-100% - 10px)); }
        }

        .cal-popover-header {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 6px;
        }

        .cal-popover-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #01876c;
          flex-shrink: 0;
        }

        .cal-popover-type {
          font-size: 0.72rem;
          color: #8fa398;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          flex: 1;
        }

        .cal-popover-close {
          background: none;
          border: none;
          cursor: pointer;
          color: #8fa398;
          padding: 2px;
          display: flex;
          align-items: center;
          border-radius: 4px;
          transition: color 0.15s ease;
        }

        .cal-popover-close:hover {
          color: #1a2820;
        }

        .cal-popover-title {
          font-size: 0.95rem;
          font-weight: 600;
          color: #1a2820;
          margin-bottom: 6px;
          line-height: 1.3;
        }

        .cal-popover-meta {
          display: flex;
          flex-direction: column;
          gap: 3px;
          font-size: 0.8rem;
          color: #5a6b63;
        }

        .cal-popover-desc {
          margin-top: 8px;
          font-size: 0.8rem;
          color: #5a6b63;
          line-height: 1.5;
          padding-top: 8px;
          border-top: 1px solid #f1f3f4;
        }
      `}</style>
    </div>
  );
}

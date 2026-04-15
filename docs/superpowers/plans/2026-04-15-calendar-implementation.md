# 日历日程功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Dashboard 日历上实现教师个人/年级/全校三级日程管理，考试创建时自动同步到全校日程。

**Architecture:** 后端新增 CalendarEvent 模型和 ViewSet，通过 visibility 字段控制可见性，Exam.save() 钩子自动创建全校日程。前端在 CalendarWidget 基础上扩展 dateClick 弹窗和筛选功能，弹窗样式参考 BatchImportModal。

**Tech Stack:** Django + DRF + FullCalendar + Bootstrap Modal

---

## 文件结构

```
后端新增/修改：
- school_management/students_grades/models/calendar.py       # 新增 CalendarEvent 模型
- school_management/students_grades/models/__init__.py      # 修改 导入 CalendarEvent
- school_management/students_grades/views/calendar.py       # 新增 CalendarEventViewSet
- school_management/students_grades/views/__init__.py       # 修改 导入 CalendarEventViewSet
- school_management/students_grades/serializers.py          # 修改 添加 CalendarEventSerializer
- school_management/students_grades/api_urls.py              # 修改 注册路由
- school_management/students_grades/models/exam.py          # 修改 save() 钩子自动创建 CalendarEvent
- school_management/views.py                                # 修改 dashboard_events_api 对接新模型

前端新增/修改：
- frontend/src/components/ui/calendar-modal.tsx            # 新增 新建/编辑日程弹窗组件
- frontend/src/components/ui/calendar-widget.tsx            # 修改 添加 dateClick、筛选器、颜色映射
- frontend/src/app/page.tsx                                # 修改 传入用户角色信息给日历

测试：
- school_management/students_grades/tests/calendar/         # 新增 日历功能测试
```

---

## Task 1: 创建 CalendarEvent 模型

**Files:**
- Create: `school_management/students_grades/models/calendar.py`
- Modify: `school_management/students_grades/models/__init__.py`

- [ ] **Step 1: 创建 calendar.py**

```python
# school_management/students_grades/models/calendar.py
import uuid
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


class CalendarEvent(models.Model):
    """日历日程模型"""

    VISIBILITY_CHOICES = [
        ('personal', '个人'),
        ('grade', '年级'),
        ('school', '全校'),
    ]

    EVENT_TYPE_CHOICES = [
        ('exam', '考试'),
        ('meeting', '会议'),
        ('activity', '活动'),
        ('reminder', '提醒'),
        ('other', '其他'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField('标题', max_length=100)
    start = models.DateTimeField('开始时间')
    end = models.DateTimeField('结束时间', null=True, blank=True)
    is_all_day = models.BooleanField('全天事件', default=False)
    event_type = models.CharField('类型', max_length=20, choices=EVENT_TYPE_CHOICES, default='other')
    description = models.TextField('描述', blank=True, default='')
    grade = models.CharField('年级', max_length=50, blank=True, default='')
    visibility = models.CharField('可见性', max_length=20, choices=VISIBILITY_CHOICES, default='personal')
    creator = models.ForeignKey(User, on_delete=models.CASCADE, related_name='calendar_events', verbose_name='创建者')
    created_at = models.DateTimeField('创建时间', auto_now_add=True)
    updated_at = models.DateTimeField('更新时间', auto_now=True)

    class Meta:
        db_table = 'calendar_events'
        ordering = ['start']
        verbose_name = '日程'
        verbose_name_plural = '日程'

    def __str__(self):
        return f"{self.title} ({self.get_visibility_display()})"

    def get_visibility_display(self):
        return dict(self.VISIBILITY_CHOICES).get(self.visibility, self.visibility)

    def get_event_type_display(self):
        return dict(self.EVENT_TYPE_CHOICES).get(self.event_type, self.event_type)
```

- [ ] **Step 2: 更新 models/__init__.py**

```python
# school_management/students_grades/models/__init__.py
# 在文件开头添加导入
from .calendar import CalendarEvent

# 在 __all__ 列表中添加
__all__ = [
    # ... 现有内容 ...
    # 日程相关
    'CalendarEvent',
]
```

- [ ] **Step 3: 执行数据库迁移**

Run: `cd /Users/caijinbin/Desktop/白实/信息/信息管理系统/SMS && python manage.py makemigrations students_grades --name add_calendar_event && python manage.py migrate`

Expected: 生成迁移文件并执行成功

- [ ] **Step 4: Commit**

```bash
git add school_management/students_grades/models/calendar.py school_management/students_grades/models/__init__.py
git commit -m "feat(calendar): add CalendarEvent model"
```

---

## Task 2: 创建 CalendarEventSerializer

**Files:**
- Modify: `school_management/students_grades/serializers.py`

- [ ] **Step 1: 在 serializers.py 末尾添加 CalendarEventSerializer**

```python
# school_management/students_grades/serializers.py

class CalendarEventSerializer(serializers.ModelSerializer):
    """日历日程序列化器"""
    creator_name = serializers.CharField(source='creator.get_full_name', read_only=True)

    class Meta:
        model = CalendarEvent
        fields = [
            'id', 'title', 'start', 'end', 'is_all_day',
            'event_type', 'description', 'grade', 'visibility',
            'creator', 'creator_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'creator', 'creator_name', 'created_at', 'updated_at']

    def create(self, validated_data):
        validated_data['creator'] = self.context['request'].user
        return super().create(validated_data)

    def validate(self, data):
        """权限校验"""
        user = self.context['request'].user
        visibility = data.get('visibility', getattr(self.instance, 'visibility', 'personal'))

        if visibility == 'grade' and user.role != 'grade_manager':
            raise serializers.ValidationError({'visibility': '只有级长可以创建年级日程'})
        if visibility == 'school' and user.role != 'admin':
            raise serializers.ValidationError({'visibility': '只有管理员可以创建全校日程'})

        if visibility == 'grade' and not data.get('grade'):
            raise serializers.ValidationError({'grade': '年级日程必须指定年级'})

        return data
```

- [ ] **Step 2: Commit**

```bash
git add school_management/students_grades/serializers.py
git commit -m "feat(calendar): add CalendarEventSerializer with permission validation"
```

---

## Task 3: 创建 CalendarEventViewSet

**Files:**
- Create: `school_management/students_grades/views/calendar.py`
- Modify: `school_management/students_grades/views/__init__.py`

- [ ] **Step 1: 创建 calendar.py ViewSet**

```python
# school_management/students_grades/views/calendar.py
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q

from ..models.calendar import CalendarEvent
from ..serializers import CalendarEventSerializer


class CalendarEventViewSet(viewsets.ModelViewSet):
    """日历日程 ViewSet"""
    serializer_class = CalendarEventSerializer
    queryset = CalendarEvent.objects.all()

    def get_queryset(self):
        """返回当前用户可见的日程"""
        user = self.request.user
        queryset = CalendarEvent.objects.all()

        # 管理员可见所有
        if user.role == 'admin':
            return queryset

        # 级长可见 personal + 本人 grade + school
        if user.role == 'grade_manager':
            return queryset.filter(
                Q(visibility='personal', creator=user) |
                Q(visibility='grade', grade=user.managed_grade) |
                Q(visibility='school')
            )

        # 普通教师可见 personal + school
        return queryset.filter(
            Q(visibility='personal', creator=user) |
            Q(visibility='school')
        )

    def perform_create(self, serializer):
        serializer.save()

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        user = request.user

        # 权限校验：仅 creator 或 admin 可更新
        if instance.creator != user and user.role != 'admin':
            return Response({'detail': '无权修改此日程'}, status=status.HTTP_403_FORBIDDEN)

        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        user = request.user

        # 权限校验：仅 creator 或 admin 可删除
        if instance.creator != user and user.role != 'admin':
            return Response({'detail': '无权删除此日程'}, status=status.HTTP_403_FORBIDDEN)

        return super().destroy(request, *args, **kwargs)
```

- [ ] **Step 2: 更新 views/__init__.py**

```python
# school_management/students_grades/views/__init__.py
# 在文件开头添加导入
from .calendar import CalendarEventViewSet

# 在 __all__ 列表中添加
__all__ = [
    # ... 现有内容 ...
    'CalendarEventViewSet',
]
```

- [ ] **Step 3: 更新 api_urls.py 注册路由**

```python
# school_management/students_grades/api_urls.py
# 在导入部分添加
from .views import CalendarEventViewSet

# 在 router.register 后添加
router.register(r'calendar-events', CalendarEventViewSet)
```

- [ ] **Step 4: Commit**

```bash
git add school_management/students_grades/views/calendar.py school_management/students_grades/views/__init__.py school_management/students_grades/api_urls.py
git commit -m "feat(calendar): add CalendarEventViewSet with CRUD and permission control"
```

---

## Task 4: Exam 模型添加 save() 钩子自动同步

**Files:**
- Modify: `school_management/students_grades/models/exam.py`

- [ ] **Step 1: 查看 Exam 模型现有 save 方法或确定钩子位置**

Run: `grep -n "def save" school_management/students_grades/models/exam.py`

Expected: 找到 save 方法行号，如果没有则需要添加

- [ ] **Step 2: 添加 save() 钩子**

```python
# school_management/students_grades/models/exam.py
# 在文件顶部添加导入
from ..models.calendar import CalendarEvent

# 找到 Exam 类的 save 方法，在其中添加钩子
# 如果没有 save 方法，在 Meta 类之后添加以下方法

def save(self, *args, **kwargs):
    is_new = self.pk is None
    super().save(*args, **kwargs)

    # 新建 Exam 时自动创建全校 CalendarEvent
    if is_new:
        CalendarEvent.objects.create(
            title=self.name,
            start=self.date,
            end=None,
            is_all_day=True,
            event_type='exam',
            description=self.description or '',
            grade=self.grade_level or '',
            visibility='school',
            creator=self.created_by or self.exam_creator,
        )
```

**注意**: 需要确认 Exam 模型中创建者的字段名（可能是 created_by 或 exam_creator）。如果不确定，先用 `created_by = kwargs.get('created_by', None)` 方式处理。

- [ ] **Step 3: Commit**

```bash
git add school_management/students_grades/models/exam.py
git commit -m "feat(calendar): auto-create CalendarEvent when Exam is created"
```

---

## Task 5: 更新 dashboard/events API

**Files:**
- Modify: `school_management/views.py`

- [ ] **Step 1: 更新 dashboard_events_api 对接新模型**

```python
# school_management/views.py
# 修改 dashboard_events_api 函数

@login_required
def dashboard_events_api(request):
    """
    Dashboard calendar events API
    Returns exam dates and school events as FullCalendar-compatible events
    """
    from school_management.students_grades.models.calendar import CalendarEvent
    from school_management.students_grades.models.exam import Exam
    from django.utils import timezone

    # 获取当前用户可见的日程
    user = request.user
    events = []

    # 全校日程所有人都可见
    school_events = CalendarEvent.objects.filter(visibility='school')
    for event in school_events:
        events.append({
            'id': str(event.id),
            'title': event.title,
            'start': event.start.isoformat(),
            'end': event.end.isoformat() if event.end else None,
            'is_all_day': event.is_all_day,
            'color': _get_event_color(event.event_type),
            'extendedProps': {
                'type': event.event_type,
                'grade': event.grade,
                'description': event.description,
                'visibility': event.visibility,
                'creator_name': event.creator.get_full_name() if event.creator else '',
            }
        })

    # 个人日程（仅 creator 本人）
    if user.role != 'admin':
        personal_events = CalendarEvent.objects.filter(visibility='personal', creator=user)
        for event in personal_events:
            events.append({
                'id': str(event.id),
                'title': event.title,
                'start': event.start.isoformat(),
                'end': event.end.isoformat() if event.end else None,
                'is_all_day': event.is_all_day,
                'color': _get_event_color(event.event_type),
                'extendedProps': {
                    'type': event.event_type,
                    'grade': event.grade,
                    'description': event.description,
                    'visibility': event.visibility,
                    'creator_name': event.creator.get_full_name() if event.creator else '',
                }
            })

        # 年级日程（级长可见本年级）
        if user.role == 'grade_manager' and user.managed_grade:
            grade_events = CalendarEvent.objects.filter(visibility='grade', grade=user.managed_grade)
            for event in grade_events:
                events.append({
                    'id': str(event.id),
                    'title': event.title,
                    'start': event.start.isoformat(),
                    'end': event.end.isoformat() if event.end else None,
                    'is_all_day': event.is_all_day,
                    'color': _get_event_color(event.event_type),
                    'extendedProps': {
                        'type': event.event_type,
                        'grade': event.grade,
                        'description': event.description,
                        'visibility': event.visibility,
                        'creator_name': event.creator.get_full_name() if event.creator else '',
                    }
                })

    return JsonResponse({'events': events})


def _get_event_color(event_type):
    """根据日程类型返回颜色"""
    colors = {
        'exam': '#b45309',
        'meeting': '#0369a1',
        'activity': '#7c3aed',
        'reminder': '#01876c',
        'other': '#6b7280',
    }
    return colors.get(event_type, '#6b7280')
```

- [ ] **Step 2: Commit**

```bash
git add school_management/views.py
git commit -m "feat(calendar): update dashboard_events_api to return CalendarEvent data"
```

---

## Task 6: 前端 - 创建日程弹窗组件

**Files:**
- Create: `frontend/src/components/ui/calendar-modal.tsx`

- [ ] **Step 1: 创建 calendar-modal.tsx**

```tsx
// frontend/src/components/ui/calendar-modal.tsx
"use client";

import React, { useState, useEffect } from "react";

interface CalendarEventFormData {
  title: string;
  start: string;
  end: string;
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
  initialDate?: string; // 点击的日期 YYYY-MM-DD
  userRole: string;
  userManagedGrade?: string;
  backendBaseUrl: string;
  authToken: string;
}

const EVENT_TYPES = [
  { value: "exam", label: "考试" },
  { value: "meeting", label: "会议" },
  { value: "activity", label: "活动" },
  { value: "reminder", label: "提醒" },
  { value: "other", label: "其他" },
];

export function CalendarModal({
  isOpen,
  onClose,
  onSuccess,
  initialDate,
  userRole,
  userManagedGrade,
  backendBaseUrl,
  authToken,
}: CalendarModalProps) {
  const [formData, setFormData] = useState<CalendarEventFormData>({
    title: "",
    start: initialDate ? `${initialDate}T09:00` : "",
    end: initialDate ? `${initialDate}T10:00` : "",
    is_all_day: false,
    event_type: "reminder",
    description: "",
    grade: userManagedGrade || "",
    visibility: "personal",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    // 根据角色限制 visibility 选项
    if (userRole === "admin") {
      setFormData((prev) => prev);
    } else if (userRole === "grade_manager") {
      // grade_manager 只能选 personal 或 grade
      if (formData.visibility === "school") {
        setFormData((prev) => ({ ...prev, visibility: "grade" }));
      }
    } else {
      // 普通老师只能选 personal
      setFormData((prev) => ({ ...prev, visibility: "personal" }));
    }
  }, [userRole]);

  if (!isOpen) return null;

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

    try {
      const res = await fetch(`${backendBaseUrl}/api/students_grades/calendar-events/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          ...formData,
          end: formData.is_all_day ? null : formData.end,
        }),
      });

      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        const data = await res.json();
        setErrorMsg(data.detail || "创建失败，请重试");
      }
    } catch (err) {
      setErrorMsg("网络异常，请重试");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="modal d-block"
      style={{ backgroundColor: "rgba(0,0,0,0.6)", position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1050 }}
    >
      <div className="modal-dialog modal-lg modal-dialog-centered" role="document" style={{ marginTop: "5vh" }}>
        <div
          className="modal-content border-0 shadow-lg"
          style={{ borderRadius: "15px", overflow: "hidden", borderLeft: "4px solid #01876c" }}
        >
          <div
            className="modal-header border-bottom"
            style={{ background: "linear-gradient(135deg, #e8f7f4 0%, #c3e6cb 100%)", padding: "1.5rem" }}
          >
            <h5 className="modal-title fw-bold text-dark mb-0">
              <i className="fas fa-calendar-plus me-2" style={{ color: "#01876c" }}></i>
              新建日程
            </h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close"></button>
          </div>

          <div className="modal-body" style={{ padding: "2rem" }}>
            {errorMsg && (
              <div className="alert alert-danger border-0 rounded-3 d-flex align-items-center mb-4 shadow-sm">
                <i className="fas fa-exclamation-triangle me-3 fs-4"></i>
                <div>{errorMsg}</div>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* 标题 */}
              <div className="mb-3">
                <label className="form-label fw-bold">日程标题 <span className="text-danger">*</span></label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="请输入日程标题"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  maxLength={100}
                />
              </div>

              {/* 类型和全天 */}
              <div className="row mb-3">
                <div className="col-md-6">
                  <label className="form-label fw-bold">日程类型</label>
                  <select
                    className="form-select"
                    value={formData.event_type}
                    onChange={(e) => setFormData({ ...formData, event_type: e.target.value })}
                  >
                    {EVENT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
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
                      onChange={(e) => setFormData({ ...formData, is_all_day: e.target.checked })}
                    />
                    <label className="form-check-label fw-bold" htmlFor="is_all_day">
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
                    onChange={(e) => setFormData({ ...formData, start: e.target.value })}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-bold">结束时间</label>
                  <input
                    type="datetime-local"
                    className="form-control"
                    value={formData.end}
                    onChange={(e) => setFormData({ ...formData, end: e.target.value })}
                    disabled={formData.is_all_day}
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
                    onChange={(e) => setFormData({ ...formData, visibility: e.target.value })}
                  >
                    <option value="personal">个人（仅自己可见）</option>
                    {userRole === "grade_manager" && (
                      <option value="grade">年级（年级内可见）</option>
                    )}
                    {userRole === "admin" && (
                      <option value="school">全校（所有教师可见）</option>
                    )}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-bold">年级</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder={formData.visibility === "grade" ? "请输入年级，如初一" : "年级日程时填写"}
                    value={formData.grade}
                    onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                    disabled={formData.visibility !== "grade"}
                  />
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
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              {/* 按钮 */}
              <div className="text-center mt-4">
                <button
                  type="submit"
                  className="btn btn-success btn-lg rounded-pill shadow px-5"
                  style={{ background: "linear-gradient(135deg, #01876c 0%, #02a080 100%)", border: "none" }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                      创建中...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-check me-2"></i>创建日程
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="btn btn-light btn-lg rounded-pill shadow-sm px-5 ms-3 border"
                  onClick={onClose}
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ui/calendar-modal.tsx
git commit -m "feat(calendar): add CalendarModal component for creating events"
```

---

## Task 7: 前端 - 更新 CalendarWidget 添加 dateClick 和筛选

**Files:**
- Modify: `frontend/src/components/ui/calendar-widget.tsx`

- [ ] **Step 1: 更新 calendar-widget.tsx**

在文件开头添加 CalendarModal 导入：

```tsx
import { CalendarModal } from "./calendar-modal";
```

添加状态变量（在现有状态后添加）：

```tsx
const [modalOpen, setModalOpen] = useState(false);
const [selectedDate, setSelectedDate] = useState<string>("");
const [visibilityFilter, setVisibilityFilter] = useState<string>("all");
```

添加 dateClick 处理（在 handleEventClick 后添加）：

```tsx
const handleDateClick = useCallback((info: { dateStr: string }) => {
  setSelectedDate(info.dateStr.split("T")[0]); // 取日期部分
  setModalOpen(true);
}, []);

const handleModalClose = useCallback(() => {
  setModalOpen(false);
  setSelectedDate("");
}, []);

const handleModalSuccess = useCallback(() => {
  fetchEvents(); // 刷新日历
}, [fetchEvents]);
```

在 FullCalendar 组件中添加 dateClick：

```tsx
<FullCalendar
  // ... existing props ...
  dateClick={handleDateClick}
  // ... existing props ...
/>
```

在日历 header 工具栏后添加筛选按钮（如果需要，可在 right 部分添加自定义按钮）。

添加 CalendarModal 组件（在 popover 后添加）：

```tsx
{modalOpen && (
  <CalendarModal
    isOpen={modalOpen}
    onClose={handleModalClose}
    onSuccess={handleModalSuccess}
    initialDate={selectedDate}
    userRole={user?.role || "subject_teacher"}
    userManagedGrade={user?.managed_grade}
    backendBaseUrl={`${window.location.hostname}:8000`}
    authToken={localStorage.getItem("accessToken") || ""}
  />
)}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ui/calendar-widget.tsx
git commit -m "feat(calendar): integrate dateClick and CalendarModal into CalendarWidget"
```

---

## Task 8: 前端 - 在 Dashboard 传入用户角色信息

**Files:**
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: 确认 AuthContext 已提供 user.role**

检查 `useAuth()` 返回的 user 对象是否包含 role 字段。如果不包含，需要更新 AuthContext。

- [ ] **Step 2: 将 user 传给 CalendarWidget**

在 page.tsx 中找到 CalendarWidget 组件调用处，添加 user prop：

```tsx
<CalendarWidget user={user} />
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/page.tsx
git commit -m "feat(calendar): pass user info to CalendarWidget"
```

---

## Task 9: 编写测试用例

**Files:**
- Create: `school_management/students_grades/tests/calendar/__init__.py`
- Create: `school_management/students_grades/tests/calendar/test_models.py`
- Create: `school_management/students_grades/tests/calendar/test_views.py`

- [ ] **Step 1: 创建测试目录和文件**

```python
# school_management/students_grades/tests/calendar/__init__.py
```

```python
# school_management/students_grades/tests/calendar/test_models.py
from django.test import TestCase
from django.contrib.auth.models import User
from school_management.students_grades.models.calendar import CalendarEvent


class CalendarEventModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="teacher1", password="test123")
        self.admin = User.objects.create_superuser(username="admin1", password="admin123")

    def test_create_personal_event(self):
        event = CalendarEvent.objects.create(
            title="个人会议",
            start="2026-04-20T09:00:00",
            event_type="meeting",
            visibility="personal",
            creator=self.user,
        )
        self.assertEqual(event.title, "个人会议")
        self.assertEqual(event.visibility, "personal")
        self.assertEqual(str(event), "个人会议 (个人)")

    def test_create_school_event_by_admin(self):
        event = CalendarEvent.objects.create(
            title="全校大会",
            start="2026-04-21T10:00:00",
            event_type="meeting",
            visibility="school",
            creator=self.admin,
        )
        self.assertEqual(event.visibility, "school")
```

```python
# school_management/students_grades/tests/calendar/test_views.py
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from school_management.students_grades.models.calendar import CalendarEvent


class CalendarEventViewSetTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.teacher = User.objects.create_user(username="teacher1", password="test123")
        self.admin = User.objects.create_superuser(username="admin1", password="admin123")
        self.client.force_authenticate(user=self.teacher)

    def test_list_personal_events(self):
        CalendarEvent.objects.create(
            title="个人备忘",
            start="2026-04-20T09:00:00",
            visibility="personal",
            creator=self.teacher,
        )
        response = self.client.get("/api/students_grades/calendar-events/")
        self.assertEqual(response.status_code, 200)

    def test_teacher_cannot_create_school_event(self):
        response = self.client.post("/api/students_grades/calendar-events/", {
            "title": "全校大会",
            "start": "2026-04-21T10:00:00",
            "visibility": "school",
            "event_type": "meeting",
        })
        self.assertEqual(response.status_code, 400)
```

- [ ] **Step 2: 运行测试验证**

Run: `cd /Users/caijinbin/Desktop/白实/信息/信息管理系统/SMS && python manage.py test students_grades.tests.calendar -v 2`

Expected: 所有测试通过

- [ ] **Step 3: Commit**

```bash
git add school_management/students_grades/tests/calendar/
git commit -m "test(calendar): add tests for CalendarEvent model and views"
```

---

## 实施检查清单

完成所有任务后，运行以下检查：

1. `python manage.py check` — Django 系统检查
2. `python manage.py test students_grades.tests.calendar` — 日历测试通过
3. `cd frontend && npm run lint` — 前端 ESLint 检查通过
4. `npm run build` — 前端构建成功
5. 手动测试：
   - [ ] 日历上点击日期弹出新建日程弹窗
   - [ ] 提交表单后日历显示新日程
   - [ ] 不同角色看到的日程范围正确
   - [ ] 创建 Exam 后日历自动显示考试日程

---

## 预计文件变更汇总

| 文件 | 操作 | 说明 |
|------|------|------|
| `school_management/students_grades/models/calendar.py` | 新增 | CalendarEvent 模型 |
| `school_management/students_grades/models/__init__.py` | 修改 | 导出 CalendarEvent |
| `school_management/students_grades/models/exam.py` | 修改 | save() 钩子自动创建日程 |
| `school_management/students_grades/serializers.py` | 修改 | 添加 CalendarEventSerializer |
| `school_management/students_grades/views/calendar.py` | 新增 | CalendarEventViewSet |
| `school_management/students_grades/views/__init__.py` | 修改 | 导出 CalendarEventViewSet |
| `school_management/students_grades/api_urls.py` | 修改 | 注册 calendar-events 路由 |
| `school_management/views.py` | 修改 | dashboard_events_api 对接新模型 |
| `frontend/src/components/ui/calendar-modal.tsx` | 新增 | 新建日程弹窗组件 |
| `frontend/src/components/ui/calendar-widget.tsx` | 修改 | 集成 dateClick 和筛选 |
| `frontend/src/app/page.tsx` | 修改 | 传入 user 信息 |
| `school_management/students_grades/tests/calendar/` | 新增 | 测试用例 |

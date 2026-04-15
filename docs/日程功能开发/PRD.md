# 学校日程管理系统 — 产品需求文档（PRD）

**版本**：v1.0  
**日期**：2026-04-15  
**状态**：待审批  
**负责人**：Alex（白云实验学校 AI/信息科技教师）

---

## 一、项目概览

### 1.1 背景

每学期初，学校会发布一份行事历，包含考试、会议、活动等重要日程。目前这些信息分散管理，教师无法统一查看。本功能旨在将行事历数字化，并在 Dashboard 日历组件上实现个人/年级/全校三级日程管理。

### 1.2 目标

- 教师可在日历上查看本校本学期的所有重要日程
- 教师可创建个人备忘/日程（仅自己可见）
- 级长可创建年级日程（年级内可见）
- 管理员可创建全校日程（全校可见）
- 考试创建时自动同步到全校日程

---

## 二、功能详情

### 2.1 日程类型

| 类型 | 颜色 | 说明 |
|------|------|------|
| exam（考试） | #b45309 橙 | 考试相关日程 |
| meeting（会议） | #0369a1 蓝 | 教研/校务会议 |
| activity（活动） | #7c3aed 紫 | 运动会/家长会等活动 |
| reminder（提醒） | #01876c 绿 | 个人提醒 |
| other（其他） | #6b7280 灰 | 其他类型 |

### 2.2 三级可见性

| 类型 | 创建者 | 可见范围 | 颜色标识 |
|------|--------|----------|----------|
| personal（个人） | 任何登录用户 | 仅自己 | 绿色边框 |
| grade（年级） | 级长 | 同年级教师 | 蓝色边框 |
| school（全校） | 管理员 | 全校教师 | 橙色边框 |

### 2.3 日程字段

| 字段 | 必填 | 类型 | 说明 |
|------|------|------|------|
| title（标题） | ✅ | 文本，最长100字 | 日程名称 |
| start（开始时间） | ✅ | DateTime | 开始时间 |
| end（结束时间） | ❌ | DateTime | 结束时间，为空表示全天 |
| is_all_day（全天事件） | ❌ | 布尔 | 勾选则忽略时间 |
| event_type（类型） | ✅ | 下拉选择 | exam/meeting/activity/reminder/other |
| description（描述） | ❌ | 长文本 | 备注说明 |
| grade（年级） | 条件必填 | 文本 | 年级日程时必填 |
| visibility（可见性） | ✅ | 下拉选择 | personal/grade/school |

---

## 三、用户交互

### 3.1 创建入口

**方式：直接在日历上点击日期**

- 用户在月视图点击任意日期，弹出"新建日程"表单
- 日期自动填充为所点击的日期
- 表单包含所有字段（见 2.3）
- visibility 选项根据用户角色动态显示（见权限矩阵）

### 3.2 弹窗样式规范

**参考组件**：`frontend/src/app/students/BatchImportModal.tsx`

新建/编辑日程的弹窗采用与 BatchImportModal 一致的样式：

- Bootstrap `modal-dialog modal-lg modal-dialog-centered`
- 圆角卡片（`border-radius: 15px`）+ 左侧彩色边条
- 渐变 header 背景
- 白色 body 内容区
- 弹窗内使用 Bootstrap 表单组件（input、select、checkbox）
- 提交按钮样式：`rounded-pill` + 渐变背景 + 阴影悬停效果
- 取消按钮样式：`btn-light rounded-pill border`
- 表单下方显示操作结果（成功/失败提示）

### 3.3 权限下的可见性

| 用户角色 | 可建 personal | 可建 grade | 可建 school |
|----------|--------------|------------|-------------|
| admin（管理员） | ✅ | ✅ | ✅ |
| grade_manager（级长） | ✅ | ✅ | ❌ |
| subject_teacher（科任老师） | ✅ | ❌ | ❌ |
| 其他 | ✅ | ❌ | ❌ |

### 3.4 日程筛选

日历右上角添加筛选按钮：
- 「全部」— 显示用户可见的所有日程
- 「我的日程」— 仅 personal 类型
- 「年级日程」— 仅 grade 类型
- 「全校日程」— 仅 school 类型

### 3.5 日程点击

点击已有日程弹出详情气泡，显示：
- 标题、类型
- 开始/结束时间
- 年级（如有）
- 描述（如有）
- 如为本人创建或管理员，显示「编辑」「删除」按钮

---

## 四、数据模型

### CalendarEvent

```
school_management/students_grades/models/calendar.py
```

| 字段 | Django 字段类型 | 说明 |
|------|----------------|------|
| id | UUIDField | 主键 |
| title | CharField(100) | 标题 |
| start | DateTimeField | 开始时间 |
| end | DateTimeField | 结束时间，可为空 |
| is_all_day | BooleanField | 是否全天 |
| event_type | CharField(20) | exam/meeting/activity/reminder/other |
| description | TextField | 描述 |
| grade | CharField(50) | 年级 |
| visibility | CharField(20) | personal/grade/school |
| creator | ForeignKey(User) | 创建者 |
| created_at | DateTimeField | 创建时间 |
| updated_at | DateTimeField | 更新时间 |

---

## 五、API 设计

### 5.1 获取日程列表

```
GET /api/dashboard/events/
```

**权限**：返回当前用户可见的日程

**查询参数**：
- `visibility`（可选）：personal / grade / school

**响应**：
```json
{
  "events": [
    {
      "id": "uuid-string",
      "title": "期中考试",
      "start": "2026-04-20T09:00:00",
      "end": "2026-04-22T17:00:00",
      "is_all_day": false,
      "event_type": "exam",
      "description": "初一级期中考试",
      "grade": "初一",
      "visibility": "grade",
      "creator_name": "张级长"
    }
  ]
}
```

### 5.2 创建日程

```
POST /api/dashboard/events/
```

**权限校验**：
- personal：任何登录用户
- grade：仅 grade_manager 角色
- school：仅 admin 角色

**请求体**：
```json
{
  "title": "教研会议",
  "start": "2026-04-18T14:00:00",
  "end": "2026-04-18T16:00:00",
  "is_all_day": false,
  "event_type": "meeting",
  "description": "期中考试质量分析",
  "grade": "初一",
  "visibility": "grade"
}
```

### 5.3 更新日程

```
PUT /api/dashboard/events/<id>/
```

**权限**：仅 creator 或 admin 可更新

### 5.4 删除日程

```
DELETE /api/dashboard/events/<id>/
```

**权限**：仅 creator 或 admin 可删除

---

## 六、Exam 自动同步

### 6.1 同步规则

创建 Exam 时，自动创建 `CalendarEvent(visibility=school)`：
- title = Exam.name
- start = Exam.date（整天事件）
- event_type = "exam"
- description = Exam.description
- grade = Exam.grade_level
- visibility = "school"
- creator = Exam 创建者

### 6.2 实现方式

在 `Exam` 模型中重写 `save()` 方法，保存后自动创建 CalendarEvent。

---

## 七、技术方案

### 7.1 后端

- **模型**：`school_management/students_grades/models/calendar.py`
- **序列化器**：`school_management/students_grades/serializers.py`
- **视图集**：`school_management/students_grades/views/`
- **路由**：`school_management/students_grades/api_urls.py`
- **钩子**：Exam 模型 save() 方法

### 7.2 前端

- **日历组件**：`frontend/src/components/ui/calendar-widget.tsx`（已有，扩展）
- **新建表单**：点击日期弹出的 Modal/Sheet
- **类型筛选**：日历工具栏旁添加筛选按钮
- **颜色逻辑**：根据 event_type 返回对应颜色

### 7.3 数据库迁移

1. 新建 `CalendarEvent` 模型
2. 执行 `python manage.py makemigrations` 和 `migrate`

---

## 八、验收标准

- [ ] 教师登录后，日历显示所有可见日程
- [ ] 点击日期弹出新建表单，填写后可保存
- [ ] 级长可创建年级日程，同年级其他教师可见
- [ ] 管理员可创建全校日程，所有教师可见
- [ ] 非创建者无法编辑/删除他人日程
- [ ] 创建 Exam 时自动同步到日历
- [ ] 不同类型日程显示不同颜色
- [ ] 筛选器可按可见性过滤日程
- [ ] 前端通过 ESLint 检查

---

## 九、优先级

| 优先级 | 任务 |
|--------|------|
| P0 | CalendarEvent 模型创建 |
| P0 | API CRUD 接口 |
| P0 | Exam save() 钩子自动同步 |
| P1 | 前端新建日程表单（点击日期弹窗） |
| P1 | 前端日程颜色和筛选 |
| P2 | 编辑/删除功能 |
| P2 | 测试用例 |

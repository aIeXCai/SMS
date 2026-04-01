# 目标生筛选系统第二期 - 项目开发文档

**项目名称**: 目标生筛选系统增强版
**版本**: v2.0
**文档创建日期**: 2026-04-01
**预计开发周期**: 2-3周
**技术栈**: Django 5.2.4 + DRF + SimpleJWT | Next.js 15 + React 19 + TypeScript + Tailwind CSS

---

## 目录

- [1. 项目概述](#1-项目概述)
- [2. 技术架构](#2-技术架构)
- [3. 数据库设计](#3-数据库设计)
- [4. 后端 API 设计](#4-后端-api-设计)
- [5. 前端开发规范](#5-前端开发规范)
- [6. 核心服务实现](#6-核心服务实现)
- [7. 开发任务分解](#7-开发任务分解)
- [8. 测试策略](#8-测试策略)
- [9. 部署指南](#9-部署指南)
- [10. 附录](#10-附录)

---

## 1. 项目概述

### 1.1 功能范围

目标生筛选系统第二期在第一期的简单筛选基础上，新增 3 个核心功能模块：

| 功能模块 | 路由 | 核心能力 |
|---------|------|---------|
| 高级筛选 | `/target-students/advanced` | 多条件组合（AND/OR）、学科排名条件、实时预览 |
| 我的规则 | `/target-students/rules` | 规则保存、管理、复用、编辑、删除 |
| 变化追踪 | `/target-students/tracking` | 快照管理、历史对比、进退分析、报告导出 |

### 1.2 技术约束

- **后端框架**: Django 5.2.4 + Django REST Framework 3.14+
- **前端框架**: Next.js 15 + React 19 + TypeScript
- **数据库**: SQLite（开发）/ PostgreSQL（生产）
- **认证方式**: JWT + Session 双认证
- **性能要求**: 筛选响应 < 2秒，并发 ≥ 50 用户

### 1.3 目录结构

```
SMS/
├── school_management/
│   ├── students_grades/
│   │   ├── models/
│   │   │   └── filter.py              # 新增：筛选相关模型
│   │   ├── api_views/
│   │   │   └── filter.py              # 新增：筛选相关 API
│   │   ├── services/
│   │   │   ├── advanced_filter.py     # 新增：高级筛选服务
│   │   │   └── filter_comparison.py   # 新增：快照对比服务
│   │   └── serializers/
│   │       └── filter.py              # 新增：筛选相关序列化器
│   └── users/
│       └── permissions.py             # 修改：新增筛选权限检查
├── frontend/
│   └── app/
│       └── dashboard/
│           └── target-students/
│               ├── page.tsx           # 第一期：保持不变
│               ├── advanced/          # 新增 1/3：高级筛选
│               │   ├── page.tsx
│               │   └── components/
│               │       ├── FilterBuilder.tsx
│               │       ├── FilterResults.tsx
│               │       ├── RuleSelector.tsx
│               │       └── hooks/
│               │           ├── useFilterRules.ts
│               │           └── useFilter.ts
│               ├── rules/             # 新增 2/3：我的规则
│               │   ├── page.tsx
│               │   └── components/
│               │       ├── RuleList.tsx
│               │       └── RuleEditor.tsx
│               └── tracking/          # 新增 3/3：变化追踪
│                   ├── page.tsx
│                   └── components/
│                       ├── SnapshotList.tsx
│                       ├── ComparisonResult.tsx
│                       └── ReportExporter.tsx
└── docs/
    └── 目标生筛选-第二期/
        ├── PRD-目标生筛选第二期.md     # 产品需求文档
        └── DEV-目标生筛选第二期.md     # 本文档
```

---

## 2. 技术架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        前端层 (Next.js 15)                   │
├─────────────────────────────────────────────────────────────┤
│  简单筛选页 │ 高级筛选页 │ 我的规则页 │ 变化追踪页        │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP/HTTPS
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                   API 网关层 (Next.js Rewrite)               │
└────────────────────┬────────────────────────────────────────┘
                     │ /api/* → http://localhost:8000/api/*
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                   应用层 (Django 5.2.4)                      │
├─────────────────────────────────────────────────────────────┤
│  API Views (DRF) │ 认证中间件 │ 权限检查                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                     服务层 (Services)                        │
├─────────────────────────────────────────────────────────────┤
│  AdvancedFilterService │ FilterComparisonService             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                   数据层 (Models + ORM)                      │
├─────────────────────────────────────────────────────────────┤
│  ExamScore │ Exam │ SavedFilterRule │ FilterResultSnapshot   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                   存储层 (SQLite/PostgreSQL)                  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 数据流向

**高级筛选流程**:

```
1. 用户配置筛选条件（前端）
   ↓
2. POST /api/students/advanced-filter/ （API）
   ↓
3. AdvancedFilterService.apply_filter() （服务层）
   ↓
4. ExamScore ORM 查询（数据层）
   ↓
5. 返回学生列表（JSON）
   ↓
6. 前端渲染结果表格
```

**规则保存流程**:

```
1. 用户点击"保存规则"（前端）
   ↓
2. POST /api/filter-rules/ （API）
   ↓
3. SavedFilterRule.objects.create() （数据层）
   ↓
4. 返回规则 ID
```

**快照对比流程**:

```
1. 用户选择两个快照（前端）
   ↓
2. POST /api/filter-snapshots/compare/ （API）
   ↓
3. FilterComparisonService.compare_snapshots() （服务层）
   ↓
4. 计算集合差集（算法）
   ↓
5. 查询排名变化（ORM）
   ↓
6. 返回对比结果（JSON）
   ↓
7. 前端渲染新增/退出/保留学生列表
```

### 2.3 关键技术选型

| 技术 | 选型 | 理由 |
|------|------|------|
| **后端框架** | Django 5.2.4 | 项目现有技术栈，成熟稳定 |
| **API 框架** | Django REST Framework 3.14+ | RESTful API 标准，自动生成文档 |
| **认证** | JWT + Session | 兼容现有系统，前后端分离 |
| **前端框架** | Next.js 15 | 项目现有技术栈，SSR 支持 |
| **状态管理** | React Hooks | 简单场景足够，避免引入 Redux |
| **UI 组件库** | Ant Design 5.x | 企业级组件，表单功能完善 |
| **数据库** | SQLite (开发) / PostgreSQL (生产) | 开发环境轻量，生产环境稳定 |

---

## 3. 数据库设计

### 3.1 新增模型

#### 3.1.1 SavedFilterRule（筛选规则）

**文件路径**: `school_management/students_grades/models/filter.py`

**字段说明**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `user` | ForeignKey | 所属用户（一对一关系） |
| `name` | CharField | 规则名称 |
| `rule_type` | CharField | 规则类型（simple/advanced） |
| `rule_config` | JSONField | 规则配置（conditions + logic） |
| `usage_count` | IntegerField | 使用次数 |
| `last_used_at` | DateTimeField | 最后使用时间 |
| `created_at` | DateTimeField | 创建时间 |
| `updated_at` | DateTimeField | 更新时间 |

**索引设计**:

- `idx_user_last_used`: `(user_id, last_used_at DESC)` - 快速查询用户规则，按使用时间排序
- `idx_rule_type`: `(rule_type)` - 按规则类型过滤

#### 3.1.2 FilterResultSnapshot（筛选结果快照）

**文件路径**: `school_management/students_grades/models/filter.py`

**字段说明**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `user` | ForeignKey | 所属用户 |
| `exam` | ForeignKey | 关联考试 |
| `rule` | ForeignKey | 使用的规则（可为空） |
| `rule_config_snapshot` | JSONField | 规则配置快照（防止规则被修改后历史数据丢失） |
| `result_snapshot` | JSONField | 筛选结果快照（student_ids + count） |
| `snapshot_name` | CharField | 快照名称 |
| `created_at` | DateTimeField | 创建时间 |

**索引设计**:

- `idx_user_created`: `(user_id, created_at DESC)` - 快速查询用户快照
- `idx_exam_created`: `(exam_id, created_at DESC)` - 按考试查询快照
- `idx_rule_created`: `(rule_id, created_at DESC)` - 按规则查询快照

### 3.2 数据库迁移

**文件路径**: `school_management/students_grades/migrations/XXXX_add_filter_models.py`


### 3.3 现有模型扩展

#### 3.3.1 ExamScore 模型

**文件路径**: `school_management/students_grades/models/exam.py`（现有）

**无需修改**，使用现有字段：

- `rank_in_grade`: 年级排名
- `rank_in_class`: 班级排名
- `{subject}_score`: 各科成绩（如 `math_score`, `chinese_score`）
- `{subject}_rank_in_grade`: 各科年级排名
- `{subject}_rank_in_class`: 各科班级排名

#### 3.3.2 Exam 模型

**文件路径**: `school_management/students_grades/models/exam.py`（现有）

**无需修改**，使用现有字段。

---

## 4. 后端 API 设计

### 4.1 API 端点总览

| 端点 | 方法 | 说明 | 权限 |
|------|------|------|------|
| `/api/students/advanced-filter/` | POST | 高级筛选（多条件组合） | 认证用户 |
| `/api/filter-rules/` | GET | 获取用户规则列表 | 认证用户 |
| `/api/filter-rules/` | POST | 保存新规则 | 认证用户 |
| `/api/filter-rules/{id}/` | GET | 获取规则详情 | 认证用户（仅本人） |
| `/api/filter-rules/{id}/` | PUT | 更新规则 | 认证用户（仅本人） |
| `/api/filter-rules/{id}/` | DELETE | 删除规则 | 认证用户（仅本人） |
| `/api/filter-snapshots/` | GET | 获取用户快照列表 | 认证用户 |
| `/api/filter-snapshots/` | POST | 保存快照 | 认证用户 |
| `/api/filter-snapshots/{id}/` | DELETE | 删除快照 | 认证用户（仅本人） |
| `/api/filter-snapshots/compare/` | POST | 对比两个快照 | 认证用户 |

### 4.2 高级筛选 API

#### 4.2.1 端点信息

- **URL**: `POST /api/students/advanced-filter/`
- **权限**: `IsAuthenticated`
- **限流**: 100 请求/分钟

#### 4.2.2 请求体

```json
{
  "exam_id": 42,
  "logic": "AND",
  "conditions": [
    {
      "subject": "total",
      "dimension": "grade",
      "operator": "top_n",
      "value": 50
    },
    {
      "subject": "math",
      "dimension": "grade",
      "operator": "top_n",
      "value": 30
    }
  ],
  "class_id": null
}
```

**字段说明**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `exam_id` | Integer | 是 | 考试 ID |
| `logic` | String | 是 | 逻辑关系："AND" 或 "OR" |
| `conditions` | Array | 是 | 条件列表，至少 1 个 |
| `conditions[].subject` | String | 是 | 科目："total", "chinese", "math", "english", "physics", "chemistry", "biology", "history", "geography", "politics" |
| `conditions[].dimension` | String | 是 | 排名维度："grade" 或 "class" |
| `conditions[].operator` | String | 是 | 操作符："top_n", "bottom_n", "range" |
| `conditions[].value` | Integer / Array | 是 | 数值：前 N 名填 N，后 N 名填 N，区间填 [N, M] |
| `class_id` | Integer / Null | 否 | 可选，筛选特定班级 |

#### 4.2.3 响应体

```json
{
  "count": 28,
  "students": [
    {
      "student_id": 1,
      "student_number": "24001",
      "name": "张三",
      "class_name": "初二(1)班",
      "total_score": 485,
      "total_rank": 3,
      "subject_scores": {
        "math": {
          "score": 98,
          "rank_in_grade": 5,
          "rank_in_class": 2
        },
        "chinese": {
          "score": 95,
          "rank_in_grade": 8,
          "rank_in_class": 3
        }
      }
    }
  ],
  "filter_summary": {
    "total_students_in_exam": 450,
    "filtered_count": 28,
    "filter_rate": "6.22%"
  }
}
```

**字段说明**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `count` | Integer | 符合条件的学生总数 |
| `students` | Array | 学生列表 |
| `students[].student_id` | Integer | 学生 ID |
| `students[].student_number` | String | 学号 |
| `students[].name` | String | 姓名 |
| `students[].class_name` | String | 班级名称 |
| `students[].total_score` | Integer | 总分 |
| `students[].total_rank` | Integer | 总分排名 |
| `students[].subject_scores` | Object | 各科成绩和排名 |
| `filter_summary` | Object | 筛选摘要 |
| `filter_summary.total_students_in_exam` | Integer | 考试总人数 |
| `filter_summary.filtered_count` | Integer | 筛选出的人数 |
| `filter_summary.filter_rate` | String | 筛选比例 |

#### 4.2.4 错误响应

**400 Bad Request**:

```json
{
  "error": "参数错误",
  "details": {
    "exam_id": ["该字段是必填项。"],
    "conditions": ["至少需要 1 个条件。"]
  }
}
```

**404 Not Found**:

```json
{
  "error": "考试不存在",
  "exam_id": 42
}
```

#### 4.2.5 实现代码

**文件路径**: `school_management/students_grades/api_views/filter.py`

```python
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Q
from ..models import Exam, ExamScore
from ..services.advanced_filter import AdvancedFilterService

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def advanced_filter(request):
    """
    高级筛选接口
    """
    try:
        # 验证必填字段
        exam_id = request.data.get('exam_id')
        logic = request.data.get('logic')
        conditions = request.data.get('conditions')
        class_id = request.data.get('class_id')

        if not all([exam_id, logic, conditions]):
            return Response(
                {"error": "参数错误", "details": "exam_id, logic, conditions 为必填项"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not conditions or len(conditions) == 0:
            return Response(
                {"error": "参数错误", "details": "至少需要 1 个条件"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 获取考试
        try:
            exam = Exam.objects.get(id=exam_id)
        except Exam.DoesNotExist:
            return Response(
                {"error": "考试不存在", "exam_id": exam_id},
                status=status.HTTP_404_NOT_FOUND
            )

        # 调用筛选服务
        student_ids = AdvancedFilterService.apply_filter(
            exam_id=exam_id,
            logic=logic,
            conditions=conditions,
            class_id=class_id
        )

        # 查询学生详细信息
        exam_scores = ExamScore.objects.filter(
            exam=exam,
            student_id__in=student_ids
        ).select_related(
            'student__current_class'
        ).prefetch_related(
            'student__current_class'
        )

        # 构建响应数据
        students = []
        for exam_score in exam_scores:
            student = exam_score.student
            student_data = {
                "student_id": student.id,
                "student_number": student.student_number,
                "name": student.name,
                "class_name": student.current_class.name if student.current_class else "",
                "total_score": exam_score.total_score,
                "total_rank": exam_score.rank_in_grade,
                "subject_scores": {}
            }

            # 添加各科成绩
            subjects = ['chinese', 'math', 'english', 'physics', 'chemistry', 
                        'biology', 'history', 'geography', 'politics']
            for subject in subjects:
                score_field = f'{subject}_score'
                rank_grade_field = f'{subject}_rank_in_grade'
                rank_class_field = f'{subject}_rank_in_class'

                if hasattr(exam_score, score_field):
                    student_data['subject_scores'][subject] = {
                        "score": getattr(exam_score, score_field),
                        "rank_in_grade": getattr(exam_score, rank_grade_field, None),
                        "rank_in_class": getattr(exam_score, rank_class_field, None)
                    }

            students.append(student_data)

        # 构建筛选摘要
        total_students = ExamScore.objects.filter(exam=exam).count()
        filter_rate = f"{(len(student_ids) / total_students * 100):.2f}%" if total_students > 0 else "0%"

        response_data = {
            "count": len(student_ids),
            "students": students,
            "filter_summary": {
                "total_students_in_exam": total_students,
                "filtered_count": len(student_ids),
                "filter_rate": filter_rate
            }
        }

        return Response(response_data, status=status.HTTP_200_OK)

    except Exception as e:
        return Response(
            {"error": "服务器错误", "details": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
```

### 4.3 规则管理 API

#### 4.3.1 获取用户规则列表

- **URL**: `GET /api/filter-rules/`
- **权限**: `IsAuthenticated`
- **查询参数**:
  - `rule_type` (可选): 过滤规则类型（"simple" 或 "advanced"）
  - `page` (可选): 页码，默认 1
  - `page_size` (可选): 每页数量，默认 20

**响应体**:

```json
{
  "count": 5,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 1,
      "name": "数学培优班名单",
      "rule_type": "advanced",
      "usage_count": 12,
      "last_used_at": "2026-03-30T14:30:00Z",
      "created_at": "2026-03-15T10:00:00Z"
    }
  ]
}
```

#### 4.3.2 保存新规则

- **URL**: `POST /api/filter-rules/`
- **权限**: `IsAuthenticated`

**请求体**:

```json
{
  "name": "数学培优班名单",
  "rule_type": "advanced",
  "rule_config": {
    "logic": "AND",
    "conditions": [
      {"subject": "total", "dimension": "grade", "operator": "top_n", "value": 50},
      {"subject": "math", "dimension": "grade", "operator": "top_n", "value": 30}
    ]
  }
}
```

**响应体**:

```json
{
  "id": 1,
  "name": "数学培优班名单",
  "rule_type": "advanced",
  "usage_count": 0,
  "last_used_at": null,
  "created_at": "2026-04-01T10:00:00Z"
}
```

#### 4.3.3 获取规则详情

- **URL**: `GET /api/filter-rules/{id}/`
- **权限**: `IsAuthenticated`（仅本人可查看）

**响应体**:

```json
{
  "id": 1,
  "name": "数学培优班名单",
  "rule_type": "advanced",
  "rule_config": {
    "logic": "AND",
    "conditions": [
      {"subject": "total", "dimension": "grade", "operator": "top_n", "value": 50},
      {"subject": "math", "dimension": "grade", "operator": "top_n", "value": 30}
    ]
  },
  "usage_count": 12,
  "last_used_at": "2026-03-30T14:30:00Z",
  "created_at": "2026-03-15T10:00:00Z"
}
```

#### 4.3.4 更新规则

- **URL**: `PUT /api/filter-rules/{id}/`
- **权限**: `IsAuthenticated`（仅本人可修改）

**请求体**:

```json
{
  "name": "数学培优班名单（已更新）",
  "rule_type": "advanced",
  "rule_config": {
    "logic": "AND",
    "conditions": [
      {"subject": "total", "dimension": "grade", "operator": "top_n", "value": 40},
      {"subject": "math", "dimension": "grade", "operator": "top_n", "value": 20}
    ]
  }
}
```

**响应体**: 同获取规则详情

#### 4.3.5 删除规则

- **URL**: `DELETE /api/filter-rules/{id}/`
- **权限**: `IsAuthenticated`（仅本人可删除）

**响应体**:

```json
{
  "message": "规则删除成功"
}
```

#### 4.3.6 实现代码

**文件路径**: `school_management/students_grades/api_views/filter.py`

```python
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend
from ..models import SavedFilterRule
from ..serializers.filter import SavedFilterRuleSerializer

class FilterRulePagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100

class FilterRuleListView(ListCreateAPIView):
    """
    规则列表视图：获取列表、创建新规则
    """
    serializer_class = SavedFilterRuleSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = FilterRulePagination
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['rule_type']

    def get_queryset(self):
        # 只返回当前用户的规则
        return SavedFilterRule.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        # 创建时自动关联当前用户
        serializer.save(user=self.request.user)

class FilterRuleDetailView(RetrieveUpdateDestroyAPIView):
    """
    规则详情视图：获取详情、更新、删除
    """
    serializer_class = SavedFilterRuleSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'id'

    def get_queryset(self):
        # 只能操作自己的规则
        return SavedFilterRule.objects.filter(user=self.request.user)

    def destroy(self, request, *args, **kwargs):
      instance = self.get_object()
      self.perform_destroy(instance)
        return Response(
            {"message": "规则删除成功"},
            status=status.HTTP_200_OK
        )
```

### 4.4 快照管理 API

#### 4.4.1 获取用户快照列表

- **URL**: `GET /api/filter-snapshots/`
- **权限**: `IsAuthenticated`
- **查询参数**:
  - `exam_id` (可选): 过滤考试
  - `rule_id` (可选): 过滤规则
  - `page` (可选): 页码，默认 1
  - `page_size` (可选): 每页数量，默认 20

**响应体**:

```json
{
  "count": 10,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 1,
      "snapshot_name": "期中考试-数学培优班",
      "exam_id": 42,
      "exam_name": "期中考试(2026春季)",
      "rule_id": 1,
      "rule_name": "数学培优班名单",
      "student_count": 28,
      "created_at": "2026-04-15T10:00:00Z"
    }
  ]
}
```

#### 4.4.2 保存快照

- **URL**: `POST /api/filter-snapshots/`
- **权限**: `IsAuthenticated`

**请求体**:

```json
{
  "exam_id": 42,
  "rule_id": 1,
  "snapshot_name": "期中考试-数学培优班",
  "result_snapshot": {
    "student_ids": [1, 5, 12, 23, 42],
    "count": 5
  }
}
```

**响应体**:

```json
{
  "id": 1,
  "snapshot_name": "期中考试-数学培优班",
  "exam_id": 42,
  "exam_name": "期中考试(2026春季)",
  "rule_id": 1,
  "rule_name": "数学培优班名单",
  "student_count": 5,
  "created_at": "2026-04-15T10:00:00Z"
}
```

#### 4.4.3 删除快照

- **URL**: `DELETE /api/filter-snapshots/{id}/`
- **权限**: `IsAuthenticated`（仅本人可删除）

**响应体**:

```json
{
  "message": "快照删除成功"
}
```

#### 4.4.4 对比两个快照

- **URL**: `POST /api/filter-snapshots/compare/`
- **权限**: `IsAuthenticated`

**请求体**:

```json
{
  "baseline_snapshot_id": 10,
  "comparison_snapshot_id": 15
}
```

**响应体**:

```json
{
  "baseline": {
    "exam_name": "期中考试(2026春季)",
    "snapshot_name": "期中考试-数学培优班",
    "created_at": "2026-04-15T10:00:00Z"
  },
  "comparison": {
    "exam_name": "期末考试(2026春季)",
    "snapshot_name": "期末考试-数学培优班",
    "created_at": "2026-06-25T10:00:00Z"
  },
  "changes": {
    "added": [
      {
        "student_id": 25,
        "student_number": "24025",
        "name": "王五",
        "class_name": "初二(2)班",
        "old_rank": 52,
        "new_rank": 18,
        "rank_change": 34
      }
    ],
    "removed": [
      {
        "student_id": 28,
        "student_number": "24028",
        "name": "孙七",
        "class_name": "初二(2)班",
        "old_rank": 35,
        "new_rank": 58,
        "rank_change": -23
      }
    ],
    "retained": [
      {
        "student_id": 1,
        "student_number": "24001",
        "name": "张三",
        "class_name": "初二(1)班",
        "old_rank": 3,
        "new_rank": 5,
        "rank_change": -2
      }
    ]
  },
  "summary": {
    "added_count": 5,
    "removed_count": 5,
    "retained_count": 23,
    "retention_rate": "82.14%"
  }
}
```

#### 4.4.5 实现代码

**文件路径**: `school_management/students_grades/api_views/filter.py`

```python
from rest_framework.generics import ListCreateAPIView, DestroyAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend
from ..models import FilterResultSnapshot
from ..serializers.filter import FilterResultSnapshotSerializer
from ..services.filter_comparison import FilterComparisonService

class FilterSnapshotPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100

class FilterSnapshotListView(ListCreateAPIView):
    """
    快照列表视图：获取列表、创建新快照
    """
    serializer_class = FilterResultSnapshotSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = FilterSnapshotPagination
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['exam', 'rule']

    def get_queryset(self):
        # 只返回当前用户的快照
        return FilterResultSnapshot.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        # 创建时自动关联当前用户
        serializer.save(user=self.request.user)

class FilterSnapshotDetailView(DestroyAPIView):
    """
    快照删除视图
    """
    serializer_class = FilterResultSnapshotSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'id'

    def get_queryset(self):
        # 只能操作自己的快照
        return FilterResultSnapshot.objects.filter(user=self.request.user)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response(
            {"message": "快照删除成功"},
            status=status.HTTP_200_OK
        )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def compare_snapshots(request):
    """
    对比两个快照
    """
    try:
        baseline_snapshot_id = request.data.get('baseline_snapshot_id')
        comparison_snapshot_id = request.data.get('comparison_snapshot_id')

        if not all([baseline_snapshot_id, comparison_snapshot_id]):
            return Response(
                {"error": "参数错误", "details": "baseline_snapshot_id 和 comparison_snapshot_id 为必填项"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 获取两个快照
        try:
            baseline_snapshot = FilterResultSnapshot.objects.get(
                id=baseline_snapshot_id,
                user=request.user
            )
            comparison_snapshot = FilterResultSnapshot.objects.get(
                id=comparison_snapshot_id,
                user=request.user
            )
        except FilterResultSnapshot.DoesNotExist:
            return Response(
                {"error": "快照不存在或无权限访问"},
                status=status.HTTP_404_NOT_FOUND
            )

        # 调用对比服务
        comparison_result = FilterComparisonService.compare_snapshots(
            baseline_snapshot=baseline_snapshot,
            comparison_snapshot=comparison_snapshot
        )

        # 构建响应
        response_data = {
            "baseline": {
                "exam_name": baseline_snapshot.exam.name,
                "snapshot_name": baseline_snapshot.snapshot_name,
                "created_at": baseline_snapshot.created_at.isoformat()
            },
            "comparison": {
                "exam_name": comparison_snapshot.exam.name,
                "snapshot_name": comparison_snapshot.snapshot_name,
                "created_at": comparison_snapshot.created_at.isoformat()
            },
            "changes": comparison_result,
            "summary": comparison_result.get('summary', {})
        }

        return Response(response_data, status=status.HTTP_200_OK)

    except Exception as e:
        return Response(
            {"error": "服务器错误", "details": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
```

### 4.5 序列化器

**文件路径**: `school_management/students_grades/serializers/filter.py`

```python
from rest_framework import serializers
from ..models import Exam
from ..models import SavedFilterRule, FilterResultSnapshot

class SavedFilterRuleSerializer(serializers.ModelSerializer):
    """筛选规则序列化器"""

    class Meta:
        model = SavedFilterRule
        fields = [
            'id', 'name', 'rule_type', 'rule_config',
            'usage_count', 'last_used_at', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'usage_count', 'last_used_at', 'created_at', 'updated_at']

    def validate_name(self, value):
        """验证规则名称"""
        user = self.context['request'].user
        # 检查同名规则
        if SavedFilterRule.objects.filter(user=user, name=value).exists():
            if self.instance is None or self.instance.name != value:
                raise serializers.ValidationError("规则名称已存在")
        return value

    def validate_rule_config(self, value):
        """验证规则配置"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("规则配置必须是 JSON 对象")

        if 'logic' not in value:
            raise serializers.ValidationError("规则配置缺少 logic 字段")

        if value['logic'] not in ['AND', 'OR']:
            raise serializers.ValidationError("logic 必须是 'AND' 或 'OR'")

        if 'conditions' not in value or not isinstance(value['conditions'], list):
            raise serializers.ValidationError("规则配置缺少 conditions 字段或格式错误")

        if len(value['conditions']) == 0:
            raise serializers.ValidationError("至少需要 1 个条件")

        for i, condition in enumerate(value['conditions']):
            if not isinstance(condition, dict):
                raise serializers.ValidationError(f"条件 {i+1} 格式错误")

            required_fields = ['subject', 'dimension', 'operator', 'value']
            for field in required_fields:
                if field not in condition:
                    raise serializers.ValidationError(f"条件 {i+1} 缺少 {field} 字段")

            # 验证 subject
            valid_subjects = ['total', 'chinese', 'math', 'english', 'physics', 
                            'chemistry', 'biology', 'history', 'geography', 'politics']
            if condition['subject'] not in valid_subjects:
                raise serializers.ValidationError(f"条件 {i+1} 的 subject 值无效")

            # 验证 dimension
            if condition['dimension'] not in ['grade', 'class']:
                raise serializers.ValidationError(f"条件 {i+1} 的 dimension 值无效")

            # 验证 operator
            if condition['operator'] not in ['top_n', 'bottom_n', 'range']:
                raise serializers.ValidationError(f"条件 {i+1} 的 operator 值无效")

            # 验证 value
            if condition['operator'] == 'range':
                if not isinstance(condition['value'], list) or len(condition['value']) != 2:
                    raise serializers.ValidationError(f"条件 {i+1} 的 value 必须是 [N, M] 格式")
                if condition['value'][0] >= condition['value'][1]:
                    raise serializers.ValidationError(f"条件 {i+1} 的 value 范围无效")
            else:
                if not isinstance(condition['value'], int) or condition['value'] <= 0:
                    raise serializers.ValidationError(f"条件 {i+1} 的 value 必须是正整数")

        return value

class FilterResultSnapshotSerializer(serializers.ModelSerializer):
    """筛选结果快照序列化器"""

    exam_id = serializers.PrimaryKeyRelatedField(
        source='exam',
        queryset=Exam.objects.all(),
        write_only=True
    )
    rule_id = serializers.PrimaryKeyRelatedField(
        source='rule',
        queryset=SavedFilterRule.objects.all(),
        required=False,
        allow_null=True,
        write_only=True
    )
    exam_name = serializers.CharField(source='exam.name', read_only=True)
    rule_name = serializers.CharField(source='rule.name', read_only=True, allow_null=True)
    student_count = serializers.IntegerField(source='result_snapshot.count', read_only=True)

    class Meta:
        model = FilterResultSnapshot
        fields = [
            'id', 'snapshot_name', 'exam_id', 'exam_name',
            'rule_id', 'rule_name', 'student_count', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']

    def validate(self, data):
        """验证快照数据"""
        user = self.context['request'].user

        # 验证 exam 是否属于当前用户可见范围
        exam = data.get('exam')
        if exam and not hasattr(exam, 'is_visible_to_user'):
            # 假设 Exam 模型有权限检查方法
            pass

        # 验证 rule 是否属于当前用户
        rule = data.get('rule')
        if rule and rule.user != user:
            raise serializers.ValidationError("只能使用自己创建的规则")

        # 验证 result_snapshot 格式
        result_snapshot = data.get('result_snapshot')
        if not isinstance(result_snapshot, dict):
            raise serializers.ValidationError("result_snapshot 必须是 JSON 对象")

        if 'student_ids' not in result_snapshot or not isinstance(result_snapshot['student_ids'], list):
            raise serializers.ValidationError("result_snapshot 缺少 student_ids 字段或格式错误")

        if 'count' not in result_snapshot or not isinstance(result_snapshot['count'], int):
            raise serializers.ValidationError("result_snapshot 缺少 count 字段或格式错误")

        return data
```

### 4.6 URL 路由配置

**文件路径**: `school_management/urls.py`（主路由）

```python
from django.urls import path, include
from .students_grades.api_views import filter as filter_views

urlpatterns = [
    # 筛选相关 API（显式挂载，避免对 GenericAPIView 使用 router.register）
    path('api/students/advanced-filter/', filter_views.advanced_filter, name='advanced-filter'),
    path('api/filter-rules/', filter_views.FilterRuleListView.as_view(), name='filter-rule-list'),
    path('api/filter-rules/<int:id>/', filter_views.FilterRuleDetailView.as_view(), name='filter-rule-detail'),
    path('api/filter-snapshots/', filter_views.FilterSnapshotListView.as_view(), name='filter-snapshot-list'),
    path('api/filter-snapshots/<int:id>/', filter_views.FilterSnapshotDetailView.as_view(), name='filter-snapshot-detail'),
    path('api/filter-snapshots/compare/', filter_views.compare_snapshots, name='compare-snapshots'),
]
```

### 4.7 权限实现约束（必须遵循）

- 所有写操作接口（`POST` / `PUT` / `PATCH` / `DELETE`）必须走统一写权限分支，禁止回落为“仅登录可写”。
- 若后续改为 ViewSet + `@action`，必须在 `get_permissions()` 中覆盖所有写 action。
- 规则与快照接口必须保持对象级权限：仅允许用户操作本人数据。
- 验收要求：对非授权写请求稳定返回 `403 Forbidden`。

---

## 5. 前端开发规范

### 5.1 目录结构

```
frontend/
└── src/
  └── app/
    └── target-students/
      ├── page.tsx                        # 第一期：简单筛选
      ├── advanced/                       # 新增 1/3：高级筛选
      │   ├── page.tsx                    # 高级筛选主页面
      │   ├── components/
      │   │   ├── FilterBuilder.tsx       # 筛选条件构建器
      │   │   ├── FilterResults.tsx       # 筛选结果展示
      │   │   └── RuleSelector.tsx        # 规则选择器
      │   └── hooks/
      │       ├── useFilterRules.ts       # 规则管理 Hook
      │       └── useFilter.ts            # 筛选逻辑 Hook
      ├── rules/                          # 新增 2/3：我的规则
      │   ├── page.tsx                    # 规则管理主页面
      │   └── components/
      │       ├── RuleList.tsx            # 规则列表
      │       └── RuleEditor.tsx          # 规则编辑对话框
      └── tracking/                       # 新增 3/3：变化追踪
        ├── page.tsx                    # 快照管理和对比主页面
        └── components/
          ├── SnapshotList.tsx        # 快照列表
          ├── ComparisonResult.tsx    # 对比结果展示
          └── ReportExporter.tsx      # 报告导出
```

### 5.2 TypeScript 类型定义

**文件路径**: `frontend/types/filter.ts`

```typescript
/**
 * 筛选相关类型定义
 */

// 科目类型
export type Subject = 
  | 'total' 
  | 'chinese' 
  | 'math' 
  | 'english' 
  | 'physics' 
  | 'chemistry' 
  | 'biology' 
  | 'history' 
  | 'geography' 
  | 'politics';

// 排名维度
export type Dimension = 'grade' | 'class';

// 操作符
export type Operator = 'top_n' | 'bottom_n' | 'range';

// 逻辑关系
export type Logic = 'AND' | 'OR';

// 筛选条件
export interface Condition {
  id: string;
  subject: Subject;
  dimension: Dimension;
  operator: Operator;
  value: number | [number, number];
}

// 筛选请求
export interface FilterRequest {
  exam_id: number;
  logic: Logic;
  conditions: Condition[];
  class_id?: number | null;
}

// 学生成绩
export interface SubjectScore {
  score: number;
  rank_in_grade: number | null;
  rank_in_class: number | null;
}

// 筛选结果学生
export interface FilterResultStudent {
  student_id: number;
  student_number: string;
  name: string;
  class_name: string;
  total_score: number;
  total_rank: number;
  subject_scores: Record<string, SubjectScore>;
}

// 筛选响应
export interface FilterResponse {
  count: number;
  students: FilterResultStudent[];
  filter_summary: {
    total_students_in_exam: number;
    filtered_count: number;
    filter_rate: string;
  };
}

// 规则类型
export type RuleType = 'simple' | 'advanced';

// 规则配置
export interface RuleConfig {
  logic: Logic;
  conditions: Condition[];
}

// 筛选规则
export interface FilterRule {
  id: number;
  name: string;
  rule_type: RuleType;
  rule_config: RuleConfig;
  usage_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

// 快照
export interface FilterSnapshot {
  id: number;
  snapshot_name: string;
  exam_id: number;
  exam_name: string;
  rule_id: number | null;
  rule_name: string | null;
  student_count: number;
  created_at: string;
}

// 快照请求
export interface CreateSnapshotRequest {
  exam_id: number;
  rule_id?: number;
  snapshot_name: string;
  result_snapshot: {
    student_ids: number[];
    count: number;
  };
}

// 对比变化学生
export interface ChangeStudent {
  student_id: number;
  student_number: string;
  name: string;
  class_name: string;
  old_rank: number | null;
  new_rank: number | null;
  rank_change: number | null;
}

// 对比结果
export interface ComparisonResult {
  added: ChangeStudent[];
  removed: ChangeStudent[];
  retained: ChangeStudent[];
  summary: {
    added_count: number;
    removed_count: number;
    retained_count: number;
    retention_rate: string;
  };
}

// 对比请求
export interface CompareSnapshotsRequest {
  baseline_snapshot_id: number;
  comparison_snapshot_id: number;
}

// 对比响应
export interface CompareSnapshotsResponse {
  baseline: {
    exam_name: string;
    snapshot_name: string;
    created_at: string;
  };
  comparison: {
    exam_name: string;
    snapshot_name: string;
    created_at: string;
  };
  changes: ComparisonResult;
  summary: {
    added_count: number;
    removed_count: number;
    retained_count: number;
    retention_rate: string;
  };
}
```

### 5.3 API 客户端

**文件路径**: `frontend/lib/api/filter.ts`

```typescript
import { 
  FilterRequest, 
  FilterResponse,
  FilterRule,
  CreateSnapshotRequest,
  FilterSnapshot,
  CompareSnapshotsRequest,
  CompareSnapshotsResponse
} from '@/types/filter';

/**
 * 筛选 API 客户端
 */

const API_BASE_URL = '/api';

// 高级筛选
export const advancedFilter = async (data: FilterRequest): Promise<FilterResponse> => {
  const response = await fetch(`${API_BASE_URL}/students/advanced-filter/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '筛选失败');
  }

  return response.json();
};

// 获取规则列表
export const getFilterRules = async (params?: {
  rule_type?: 'simple' | 'advanced';
  page?: number;
  page_size?: number;
}): Promise<{ count: number; results: FilterRule[] }> => {
  const queryParams = new URLSearchParams();
  if (params?.rule_type) queryParams.append('rule_type', params.rule_type);
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.page_size) queryParams.append('page_size', params.page_size.toString());

  const response = await fetch(`${API_BASE_URL}/filter-rules/?${queryParams.toString()}`);

  if (!response.ok) {
    throw new Error('获取规则列表失败');
  }

  return response.json();
};

// 保存规则
export const createFilterRule = async (data: {
  name: string;
  rule_type: 'simple' | 'advanced';
  rule_config: {
    logic: 'AND' | 'OR';
    conditions: any[];
  };
}): Promise<FilterRule> => {
  const response = await fetch(`${API_BASE_URL}/filter-rules/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '保存规则失败');
  }

  return response.json();
};

// 获取规则详情
export const getFilterRule = async (id: number): Promise<FilterRule> => {
  const response = await fetch(`${API_BASE_URL}/filter-rules/${id}/`);

  if (!response.ok) {
    throw new Error('获取规则详情失败');
  }

  return response.json();
};

// 更新规则
export const updateFilterRule = async (id: number, data: Partial<FilterRule>): Promise<FilterRule> => {
  const response = await fetch(`${API_BASE_URL}/filter-rules/${id}/`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '更新规则失败');
  }

  return response.json();
};

// 删除规则
export const deleteFilterRule = async (id: number): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/filter-rules/${id}/`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('删除规则失败');
  }
};

// 获取快照列表
export const getFilterSnapshots = async (params?: {
  exam_id?: number;
  rule_id?: number;
  page?: number;
  page_size?: number;
}): Promise<{ count: number; results: FilterSnapshot[] }> => {
  const queryParams = new URLSearchParams();
  if (params?.exam_id) queryParams.append('exam_id', params.exam_id.toString());
  if (params?.rule_id) queryParams.append('rule_id', params.rule_id.toString());
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.page_size) queryParams.append('page_size', params.page_size.toString());

  const response = await fetch(`${API_BASE_URL}/filter-snapshots/?${queryParams.toString()}`);

  if (!response.ok) {
    throw new Error('获取快照列表失败');
  }

  return response.json();
};

// 保存快照
export const createFilterSnapshot = async (data: CreateSnapshotRequest): Promise<FilterSnapshot> => {
  const response = await fetch(`${API_BASE_URL}/filter-snapshots/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '保存快照失败');
  }

  return response.json();
};

// 删除快照
export const deleteFilterSnapshot = async (id: number): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/filter-snapshots/${id}/`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('删除快照失败');
  }
};

// 对比快照
export const compareSnapshots = async (data: CompareSnapshotsRequest): Promise<CompareSnapshotsResponse> => {
  const response = await fetch(`${API_BASE_URL}/filter-snapshots/compare/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '对比快照失败');
  }

  return response.json();
};
```

### 5.4 组件开发规范

#### 5.4.1 组件命名

- **页面组件**: `page.tsx`（文件名）
- **业务组件**: PascalCase（如 `FilterBuilder.tsx`）
- **工具组件**: PascalCase（如 `Button.tsx`）

#### 5.4.2 组件结构

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Condition, FilterResponse } from '@/types/filter';

interface ComponentProps {
  // Props 定义
}

export default function ComponentName({ }: ComponentProps) {
  // 1. Hooks
  const [state, setState] = useState();

  // 2. Effects
  useEffect(() => {
    // 副作用
  }, []);

  // 3. Event Handlers
  const handleEvent = () => {
    // 事件处理
  };

  // 4. Render
  return (
    <div>
      {/* JSX */}
    </div>
  );
}
```

#### 5.4.3 样式规范

- 使用 Tailwind CSS
- 优先使用工具类
- 复杂组件使用 `cn()` 函数合并 className

```typescript
import { cn } from '@/lib/utils';

<div className={cn(
  'flex items-center gap-2',
  isActive && 'bg-blue-500 text-white'
)}>
```

### 5.5 错误处理

**文件路径**: `frontend/lib/error.ts`

```typescript
/**
 * 错误处理工具
 */

export class ApiError extends Error {
  constructor(
    public message: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const handleApiError = (error: unknown): string => {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return '发生未知错误';
};

export const showErrorToast = (error: unknown) => {
  const message = handleApiError(error);
  // 使用 toast 组件显示错误
  console.error('API Error:', error);
};
```

### 5.6 状态管理

对于简单场景，使用 React Hooks + Context；对于复杂场景，考虑使用 Zustand。

**示例**: 使用 Context

**文件路径**: `frontend/context/FilterContext.tsx`

```typescript
'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { Condition, FilterResponse, FilterRule } from '@/types/filter';

interface FilterContextType {
  conditions: Condition[];
  setConditions: (conditions: Condition[]) => void;
  logic: 'AND' | 'OR';
  setLogic: (logic: 'AND' | 'OR') => void;
  filterResult: FilterResponse | null;
  setFilterResult: (result: FilterResponse | null) => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export const FilterProvider = ({ children }: { children: ReactNode }) => {
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [logic, setLogic] = useState<'AND' | 'OR'>('AND');
  const [filterResult, setFilterResult] = useState<FilterResponse | null>(null);

  return (
    <FilterContext.Provider
      value={{
        conditions,
        setConditions,
        logic,
        setLogic,
        filterResult,
        setFilterResult,
      }}
    >
      {children}
    </FilterContext.Provider>
  );
};

export const useFilter = () => {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilter must be used within FilterProvider');
  }
  return context;
};
```

---

## 6. 核心服务实现

### 6.1 高级筛选服务

**文件路径**: `school_management/students_grades/services/advanced_filter.py`

```python
from typing import List, Dict, Set
from django.db.models import Q, Count
from ..models import ExamScore, Exam, Student

class AdvancedFilterService:
    """高级筛选服务"""

    @staticmethod
    def apply_filter(
        exam_id: int,
        logic: str,
        conditions: List[Dict],
        class_id: int = None
    ) -> List[int]:
        """
        应用多条件筛选

        Args:
            exam_id: 考试ID
            logic: 逻辑关系 "AND" 或 "OR"
            conditions: 条件列表
            class_id: 可选，筛选特定班级

        Returns:
            符合条件的学生ID列表
        """
        exam = Exam.objects.get(id=exam_id)

        # 每个条件筛选出的学生集合
        condition_results = []

        for condition in conditions:
            student_ids = AdvancedFilterService._apply_single_condition(
                exam, condition
            )
            condition_results.append(set(student_ids))

        # 应用逻辑组合
        if logic == "AND":
            if condition_results:
                final_result = set.intersection(*condition_results)
            else:
                final_result = set()
        else:  # OR
            if condition_results:
                final_result = set.union(*condition_results)
            else:
                final_result = set()

        # 如果指定了班级，再筛选一次
        if class_id:
            class_student_ids = set(
                Student.objects.filter(
                    current_class_id=class_id
                ).values_list('id', flat=True)
            )
            final_result = final_result & class_student_ids

        return list(final_result)

    @staticmethod
    def _apply_single_condition(exam: Exam, condition: Dict) -> List[int]:
        """
        应用单个筛选条件

        Args:
            exam: 考试对象
            condition: 条件字典

        Returns:
            符合条件的学生ID列表
        """
        subject = condition['subject']  # "total", "math", "chinese", ...
        dimension = condition['dimension']  # "grade" or "class"
        operator = condition['operator']  # "top_n", "bottom_n", "range"
        value = condition['value']

        # 构建查询
        queryset = ExamScore.objects.filter(exam=exam)

        # 确定排名字段
        if subject == "total":
            rank_field = 'rank_in_grade' if dimension == 'grade' else 'rank_in_class'
        else:
            rank_field = f'{subject}_rank_in_grade' if dimension == 'grade' else f'{subject}_rank_in_class'

        # 应用操作符
        if operator == "top_n":
            queryset = queryset.filter(**{f"{rank_field}__lte": value})
        elif operator == "bottom_n":
            # 需要先查询总人数
            total_count = queryset.filter(**{f"{rank_field}__isnull": False}).count()
            if total_count == 0:
                return []
            queryset = queryset.filter(**{f"{rank_field}__gte": total_count - value + 1})
        elif operator == "range":
            # N名到M名
            start, end = value
            queryset = queryset.filter(**{f"{rank_field}__range": [start, end]})

        return list(queryset.values_list('student_id', flat=True))

    @staticmethod
    def validate_condition(condition: Dict) -> bool:
        """
        验证条件格式

        Args:
            condition: 条件字典

        Returns:
            是否有效
        """
        required_fields = ['subject', 'dimension', 'operator', 'value']
        for field in required_fields:
            if field not in condition:
                return False

        valid_subjects = ['total', 'chinese', 'math', 'english', 'physics', 
                         'chemistry', 'biology', 'history', 'geography', 'politics']
        if condition['subject'] not in valid_subjects:
            return False

        if condition['dimension'] not in ['grade', 'class']:
            return False

        if condition['operator'] not in ['top_n', 'bottom_n', 'range']:
            return False

        return True
```

### 6.2 快照对比服务

**文件路径**: `school_management/students_grades/services/filter_comparison.py`

```python
from typing import Dict, List, Set
from django.db.models import Q, F
from ..models import FilterResultSnapshot, ExamScore, Student

class FilterComparisonService:
    """筛选结果对比服务"""

    @staticmethod
    def compare_snapshots(
        baseline_snapshot: FilterResultSnapshot,
        comparison_snapshot: FilterResultSnapshot
    ) -> Dict:
        """
        对比两个快照的差异

        Args:
            baseline_snapshot: 基准快照
            comparison_snapshot: 对比快照

        Returns:
            对比结果字典
        """
        baseline_ids = set(baseline_snapshot.result_snapshot['student_ids'])
        comparison_ids = set(comparison_snapshot.result_snapshot['student_ids'])

        # 计算变化
        added = list(comparison_ids - baseline_ids)
        removed = list(baseline_ids - comparison_ids)
        retained = list(baseline_ids & comparison_ids)

        # 查询学生详细信息
        students = Student.objects.filter(
            id__in=added + removed + retained
        ).select_related('current_class')

        # 构建学生映射
        student_map = {s.id: s for s in students}

        # 计算排名变化（针对保留学生）
        rank_changes = FilterComparisonService._calculate_rank_changes(
            baseline_snapshot.exam,
            comparison_snapshot.exam,
            retained,
            student_map
        )

        # 构建结果
        added_students = [
            FilterComparisonService._build_student_dict(
                student_map[sid],
                comparison_snapshot.exam,
                None
            )
            for sid in added
        ]

        removed_students = [
            FilterComparisonService._build_student_dict(
                student_map[sid],
                baseline_snapshot.exam,
                None
            )
            for sid in removed
        ]

        retained_students = [
            FilterComparisonService._build_student_dict(
                student_map[sid],
                comparison_snapshot.exam,
                rank_changes.get(sid)
            )
            for sid in retained
        ]

        return {
            "added": added_students,
            "removed": removed_students,
            "retained": retained_students,
            "summary": {
                "added_count": len(added),
                "removed_count": len(removed),
                "retained_count": len(retained),
                "retention_rate": f"{(len(retained) / len(baseline_ids) * 100):.2f}%" if len(baseline_ids) > 0 else "0%"
            }
        }

    @staticmethod
    def _calculate_rank_changes(
        baseline_exam,
        comparison_exam,
        student_ids: List[int],
        student_map: Dict[int, Student]
    ) -> Dict[int, Dict]:
        """
        计算保留学生的排名变化

        Args:
            baseline_exam: 基准考试
            comparison_exam: 对比考试
            student_ids: 学生ID列表
            student_map: 学生映射

        Returns:
            学生ID到排名变化的映射
        """
        rank_changes = {}

        # 查询两次考试的总分排名
        baseline_scores = ExamScore.objects.filter(
            exam=baseline_exam,
            student_id__in=student_ids
        ).values('student_id', 'rank_in_grade')

        comparison_scores = ExamScore.objects.filter(
            exam=comparison_exam,
            student_id__in=student_ids
        ).values('student_id', 'rank_in_grade')

        # 构建排名映射
        baseline_ranks = {s['student_id']: s['rank_in_grade'] for s in baseline_scores}
        comparison_ranks = {s['student_id']: s['rank_in_grade'] for s in comparison_scores}

        # 计算变化
        for sid in student_ids:
            old_rank = baseline_ranks.get(sid)
            new_rank = comparison_ranks.get(sid)

            if old_rank is not None and new_rank is not None:
                rank_change = old_rank - new_rank  # 正数表示进步
                rank_changes[sid] = {
                    "old_rank": old_rank,
                    "new_rank": new_rank,
                    "change": rank_change
                }
            elif new_rank is not None:
                # 新进榜单
                rank_changes[sid] = {
                    "old_rank": None,
                    "new_rank": new_rank,
                    "change": new_rank
                }

        return rank_changes

    @staticmethod
    def _build_student_dict(
        student: Student,
        exam,
        rank_change: Dict = None
    ) -> Dict:
        """
        构建学生字典

        Args:
            student: 学生对象
            exam: 考试对象
            rank_change: 排名变化

        Returns:
            学生字典
        """
        student_dict = {
            "student_id": student.id,
            "student_number": student.student_number,
            "name": student.name,
            "class_name": student.current_class.name if student.current_class else "",
            "old_rank": None,
            "new_rank": None,
            "rank_change": None
        }

        if rank_change:
            student_dict.update(rank_change)

        return student_dict
```

---

## 7. 开发任务分解

### 7.1 开发阶段划分

| 阶段 | 内容 | 预计时间 | 负责人 |
|------|------|---------|--------|
| **阶段 1** | 数据库设计 + 后端模型 | 0.5 天 | 后端开发 |
| **阶段 2** | 后端服务实现 | 1 天 | 后端开发 |
| **阶段 3** | 后端 API 开发（含权限/路由约束） | 1.5 天 | 后端开发 |
| **阶段 4** | 前端高级筛选页面 | 1.5 天 | 前端开发 |
| **阶段 5** | 前端规则管理页面 | 1 天 | 前端开发 |
| **阶段 6** | 前端变化追踪页面 | 1 天 | 前端开发 |
| **阶段 7** | 测试分层执行 + Bug 修复 | 1.5 天 | 全栈开发 |
| **阶段 8** | 文档编写 + 部署 | 0.5 天 | DevOps |
| **总计** | - | 8.5 天 | - |

### 7.2 详细任务清单

#### 阶段 1: 数据库设计 + 后端模型

**任务 1.1**: 创建筛选相关模型
- [x] 创建 `SavedFilterRule` 模型
- [x] 创建 `FilterResultSnapshot` 模型
- [x] 添加索引
- [x] 编写模型测试

**任务 1.2**: 数据库迁移
- [x] 生成迁移文件
- [x] 测试迁移（开发环境）
- [x] 准备生产环境迁移脚本

#### 阶段 2: 后端服务实现

**任务 2.1**: 高级筛选服务
- [x] `AdvancedFilterService.apply_filter()`
- [x] `AdvancedFilterService._apply_single_condition()`
- [x] 单元测试

**任务 2.2**: 快照对比服务
- [x] `FilterComparisonService.compare_snapshots()`
- [x] `FilterComparisonService._calculate_rank_changes()`
- [x] 单元测试

#### 阶段 3: 后端 API 开发（含权限/路由约束）

**任务 3.1**: 序列化器开发
- [x] `SavedFilterRuleSerializer`
- [x] `FilterResultSnapshotSerializer`
- [x] 为 `exam_id`、`rule_id` 增加显式 `source` + `write_only` 映射
- [x] 验证逻辑

**任务 3.2**: API 视图开发
- [x] 高级筛选 API (`advanced_filter`)
- [x] 规则管理 API (`FilterRuleListView`, `FilterRuleDetailView`)
- [x] 快照管理 API (`FilterSnapshotListView`, `FilterSnapshotDetailView`)
- [x] 快照对比 API (`compare_snapshots`)
- [x] 删除接口统一使用 `destroy()` 返回自定义响应（`perform_destroy()` 仅执行删除）

**任务 3.3**: URL 路由配置
- [x] 使用 `path()` 显式挂载筛选相关接口（不对 `ListCreateAPIView` 使用 `router.register`）
- [x] 测试路由访问

**任务 3.4**: 权限约束落地
- [x] 所有写接口（POST/PUT/PATCH/DELETE）接入统一写权限分支
- [x] 规则与快照接口保持对象级权限（仅本人可读写删）
- [x] 编写未授权写入场景，验证稳定返回 `403 Forbidden`

#### 阶段 4: 前端高级筛选页面

**任务 4.1**: 基础页面
- [x] 创建 `advanced/page.tsx`
- [x] 页面布局

**任务 4.2**: 筛选条件构建器组件
- [x] `FilterBuilder.tsx`
- [x] 条件增删改
- [x] 逻辑选择（AND/OR）

**任务 4.3**: 筛选结果展示组件
- [ ] `FilterResults.tsx`
- [ ] 结果表格
- [ ] 导出功能

**任务 4.4**: 规则选择器
- [ ] `RuleSelector.tsx`
- [ ] 规则下拉选择
- [ ] 规则加载

#### 阶段 5: 前端规则管理页面

**任务 5.1**: 基础页面
- [ ] 创建 `rules/page.tsx`
- [ ] 页面布局

**任务 5.2**: 规则列表组件
- [ ] `RuleList.tsx`
- [ ] 规则表格
- [ ] 分页

**任务 5.3**: 规则编辑对话框
- [ ] `RuleEditor.tsx`
- [ ] 新建/编辑规则
- [ ] 表单验证

#### 阶段 6: 前端变化追踪页面

**任务 6.1**: 基础页面
- [ ] 创建 `tracking/page.tsx`
- [ ] 页面布局

**任务 6.2**: 快照列表组件
- [ ] `SnapshotList.tsx`
- [ ] 快照表格
- [ ] 选择对比快照

**任务 6.3**: 对比结果展示
- [ ] `ComparisonResult.tsx`
- [ ] 新增/退出/保留学生列表
- [ ] 排名变化展示

**任务 6.4**: 报告导出
- [ ] `ReportExporter.tsx`
- [ ] 导出 PDF
- [ ] 导出 Excel

#### 阶段 7: 测试分层执行 + Bug 修复

**任务 7.1**: 单元测试
- [ ] 后端服务测试
- [ ] 前端组件测试

**任务 7.2**: API 集成测试
- [ ] 规则 CRUD 接口测试
- [ ] 快照 CRUD + 对比接口测试
- [ ] 权限负例测试（未授权写入返回 `403`）

**任务 7.3**: 端到端与非功能测试
- [ ] 端到端测试
- [ ] 性能测试
- [ ] 浏览器兼容性测试

**任务 7.4**: Bug 修复
- [ ] 修复测试发现的问题
- [ ] 代码审查
- [ ] 优化

#### 阶段 8: 文档编写 + 部署

**任务 8.1**: 文档编写
- [ ] API 文档
- [ ] 用户使用手册
- [ ] 开发文档（本文档）

**任务 8.2**: 部署
- [ ] 数据库迁移（生产环境）
- [ ] 代码部署
- [ ] 验证上线

### 7.3 交付物与验收标准

| 阶段 | 交付物 | 验收标准 |
|------|--------|---------|
| **阶段 1** 数据库设计 + 后端模型 | `SavedFilterRule` 与 `FilterResultSnapshot` 模型代码、迁移文件、模型测试 | 本地迁移可正反执行；模型索引生效；模型测试通过 |
| **阶段 2** 后端服务实现 | `AdvancedFilterService`、`FilterComparisonService`、服务层单元测试 | AND/OR、top_n/bottom_n/range 结果正确；快照对比新增/退出/保留计算正确；服务测试通过 |
| **阶段 3** 后端 API 开发（含权限/路由约束） | 序列化器、API 视图、显式 `path()` 路由、权限策略与权限负例用例 | `exam_id/rule_id` 映射正确；删除接口在 `destroy()` 返回消息；未授权写请求返回 `403`；关键端点联调通过 |
| **阶段 4** 前端高级筛选页面 | `advanced/page.tsx` 及 `FilterBuilder/FilterResults/RuleSelector` | 支持多条件构建与 AND/OR 组合；可调用高级筛选 API 并展示结果；基础交互与异常提示可用 |
| **阶段 5** 前端规则管理页面 | `rules/page.tsx` 及 `RuleList/RuleEditor` | 规则 CRUD 全流程可用；分页与表单校验生效；仅展示当前用户规则 |
| **阶段 6** 前端变化追踪页面 | `tracking/page.tsx` 及 `SnapshotList/ComparisonResult/ReportExporter` | 快照创建、选择、对比链路可用；新增/退出/保留与排名变化展示正确；导出功能可用 |
| **阶段 7** 测试分层执行 + Bug 修复 | 单元测试报告、API 集成测试报告、E2E/性能/兼容性结果、缺陷修复记录 | 单元/API/E2E 关键用例通过；性能满足目标（筛选 < 2 秒）；阻塞级缺陷清零 |
| **阶段 8** 文档编写 + 部署 | API 文档、用户手册、发布记录、上线回滚记录 | 文档与实现一致；生产迁移与回滚演练通过；上线后核心流程验收通过 |

---

## 8. 测试策略

### 8.1 单元测试

#### 8.1.1 后端测试

**文件路径**: `school_management/students_grades/tests/test_filter_service.py`

```python
from django.test import TestCase
from django.contrib.auth import get_user_model
from ..models import Exam, ExamScore, Student, Class
from ..services.advanced_filter import AdvancedFilterService

User = get_user_model()

class AdvancedFilterServiceTest(TestCase):
    """高级筛选服务测试"""

    def setUp(self):
        """设置测试数据"""
        self.user = User.objects.create_user(username='test', password='test')
        
        # 创建班级
        self.class1 = Class.objects.create(name='初一(1)班')
        
        # 创建学生
        self.student1 = Student.objects.create(
            student_number='24001',
            name='张三',
            current_class=self.class1
        )
        self.student2 = Student.objects.create(
            student_number='24002',
            name='李四',
            current_class=self.class1
        )
        
        # 创建考试
        self.exam = Exam.objects.create(
            name='期中考试',
            exam_date='2026-04-01'
        )
        
        # 创建成绩
        ExamScore.objects.create(
            exam=self.exam,
            student=self.student1,
            total_score=450,
            rank_in_grade=1,
            math_score=90,
            math_rank_in_grade=1
        )
        ExamScore.objects.create(
            exam=self.exam,
            student=self.student2,
            total_score=400,
            rank_in_grade=2,
            math_score=85,
            math_rank_in_grade=2
        )

    def test_single_condition_top_n(self):
        """测试单个条件：前 N 名"""
        conditions = [
            {"subject": "total", "dimension": "grade", "operator": "top_n", "value": 5}
        ]
        
        result = AdvancedFilterService.apply_filter(
            exam_id=self.exam.id,
            logic="AND",
            conditions=conditions
        )
        
        self.assertEqual(len(result), 2)
        self.assertIn(self.student1.id, result)
        self.assertIn(self.student2.id, result)

    def test_multiple_conditions_and(self):
        """测试多条件 AND 逻辑"""
        conditions = [
            {"subject": "total", "dimension": "grade", "operator": "top_n", "value": 5},
            {"subject": "math", "dimension": "grade", "operator": "top_n", "value": 5}
        ]
        
        result = AdvancedFilterService.apply_filter(
            exam_id=self.exam.id,
            logic="AND",
            conditions=conditions
        )
        
        self.assertEqual(len(result), 2)

    def test_multiple_conditions_or(self):
        """测试多条件 OR 逻辑"""
        # 添加更多测试数据
        # ...
        
        conditions = [
            {"subject": "total", "dimension": "grade", "operator": "top_n", "value": 1},
            {"subject": "math", "dimension": "grade", "operator": "top_n", "value": 2}
        ]
        
        result = AdvancedFilterService.apply_filter(
            exam_id=self.exam.id,
            logic="OR",
            conditions=conditions
        )
        
        # 验证结果
        # ...
```

#### 8.1.2 前端测试

**文件路径**: `frontend/app/target-students/advanced/components/__tests__/FilterBuilder.test.tsx`

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import FilterBuilder from '../FilterBuilder';

describe('FilterBuilder', () => {
  it('renders condition list', () => {
    render(<FilterBuilder onFilter={jest.fn()} />);
    expect(screen.getByText('筛选条件')).toBeInTheDocument();
  });

  it('adds new condition', () => {
    const onFilter = jest.fn();
    render(<FilterBuilder onFilter={onFilter} />);
    
    const addButton = screen.getByText('添加条件');
    fireEvent.click(addButton);
    
    // 验证条件已添加
    // ...
  });

  it('removes condition', () => {
    // ...
  });
});
```

### 8.2 集成测试

#### 8.2.1 API 集成测试

**文件路径**: `school_management/students_grades/tests/test_filter_api.py`

```python
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from ..models import Exam, Student, Class, SavedFilterRule

User = get_user_model()

class FilterAPITest(TestCase):
    """筛选 API 集成测试"""

    def setUp(self):
        """设置测试数据"""
        self.client = APIClient()
        self.user = User.objects.create_user(username='test', password='test')
        self.client.force_authenticate(user=self.user)
        
        # 创建测试数据
        # ...

    def test_advanced_filter(self):
        """测试高级筛选 API"""
        response = self.client.post(
            '/api/students/advanced-filter/',
            {
                "exam_id": 1,
                "logic": "AND",
                "conditions": [
                    {"subject": "total", "dimension": "grade", "operator": "top_n", "value": 50}
                ]
            }
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('count', response.data)
        self.assertIn('students', response.data)

    def test_create_filter_rule(self):
        """测试创建规则"""
        response = self.client.post(
            '/api/filter-rules/',
            {
                "name": "测试规则",
                "rule_type": "advanced",
                "rule_config": {
                    "logic": "AND",
                    "conditions": [
                        {"subject": "total", "dimension": "grade", "operator": "top_n", "value": 50}
                    ]
                }
            }
        )
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(SavedFilterRule.objects.count(), 1)

    def test_compare_snapshots(self):
        """测试快照对比"""
        # 先创建两个快照
        # ...
        
        response = self.client.post(
            '/api/filter-snapshots/compare/',
            {
                "baseline_snapshot_id": 1,
                "comparison_snapshot_id": 2
            }
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('changes', response.data)
        self.assertIn('summary', response.data)
```

### 8.3 性能测试

#### 8.3.1 筛选性能测试

```python
import time
from django.test import TestCase
from ..services.advanced_filter import AdvancedFilterService

class FilterPerformanceTest(TestCase):
    """筛选性能测试"""

    def test_filter_performance_large_dataset(self):
        """测试大数据集筛选性能"""
        # 创建 1000 个学生
        # ...
        
        conditions = [
            {"subject": "total", "dimension": "grade", "operator": "top_n", "value": 100}
        ]
        
        start_time = time.time()
        result = AdvancedFilterService.apply_filter(
            exam_id=self.exam.id,
            logic="AND",
            conditions=conditions
        )
        end_time = time.time()
        
        elapsed_time = end_time - start_time
        self.assertLess(elapsed_time, 2.0, f"筛选耗时 {elapsed_time:.2f} 秒，超过目标 2 秒")
```

### 8.4 测试覆盖率目标

| 测试类型 | 覆盖率目标 |
|---------|-----------|
| 后端服务 | ≥ 90% |
| API 视图 | ≥ 85% |
| 前端组件 | ≥ 80% |
| 集成测试 | ≥ 75% |

---

## 9. 部署指南

### 9.1 开发环境部署

#### 9.1.1 后端启动

```bash
# 激活 conda 环境
conda activate sms

# 安装依赖
pip install -r requirements.txt

# 数据库迁移
python manage.py makemigrations
python manage.py migrate

# 创建超级用户（如果需要）
python manage.py createsuperuser

# 启动开发服务器
python manage.py runserver
```

#### 9.1.2 前端启动

```bash
# 进入前端目录
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev --turbopack
```

#### 9.1.3 一键启动

使用项目提供的启动脚本：

```bash
# 使用 start_sms.sh
./start_sms.sh
```

### 9.2 生产环境部署

#### 9.2.1 数据库迁移

```bash
# 备份数据库
pg_dump sms_production > backup_$(date +%Y%m%d).sql

# 执行迁移
python manage.py migrate

# 验证迁移
python manage.py showmigrations
```

#### 9.2.2 代码部署

```bash
# 拉取最新代码
git pull origin main

# 安装依赖
pip install -r requirements.txt

# 收集静态文件
python manage.py collectstatic --noinput

# 重启服务
systemctl restart gunicorn
systemctl restart nginx
```

#### 9.2.3 前端部署

```bash
# 构建生产版本
npm run build

# 上传到服务器
# ...

# 配置 Nginx
# ...
```

### 9.3 回滚方案

#### 9.3.1 数据库回滚

```bash
# 反向迁移
python manage.py migrate students_grades XXXX_previous_migration

# 或手动删除新增表
python manage.py dbshell
> DROP TABLE IF EXISTS filter_result_snapshots;
> DROP TABLE IF EXISTS saved_filter_rules;
```

#### 9.3.2 代码回滚

```bash
# Git 回滚
git revert HEAD
git push origin main

# 或回退到指定版本
git reset --hard <commit_hash>
git push --force origin main
```

---

## 10. 附录

### 10.1 API 文档

完整的 API 文档可通过 Django REST Framework 的自动文档功能访问：

- **开发环境**: `http://localhost:8000/api/docs/`
- **生产环境**: `https://sms.example.com/api/docs/`

### 10.2 常见问题

#### Q1: 筛选响应慢怎么办？

**A**: 
1. 检查数据库索引是否正常
2. 使用 `select_related` 和 `prefetch_related` 优化查询
3. 考虑引入 Redis 缓存
4. 对大数据集使用分页

#### Q2: 如何处理学生转班后的历史成绩？

**A**: 
- 当前系统使用 `current_class_id` 关联班级
- 转班后的历史成绩归属不变
- 如需解决，可参考 `MEMORY.md` 中的"Score 表字段优化"规划

#### Q3: 规则删除后，关联的快照怎么办？

**A**: 
- `FilterResultSnapshot.rule` 字段设置了 `on_delete=models.SET_NULL`
- 删除规则后，快照仍保留，但 `rule` 字段为 `NULL`
- 快照的 `rule_config_snapshot` 字段保留了创建时的配置

### 10.3 参考资料

- [Django 官方文档](https://docs.djangoproject.com/en/5.2/)
- [Django REST Framework 文档](https://www.django-rest-framework.org/)
- [Next.js 官方文档](https://nextjs.org/docs)
- [React 官方文档](https://react.dev/)
- [Tailwind CSS 文档](https://tailwindcss.com/docs)
- [Ant Design 文档](https://ant.design/)

### 10.4 术语表

| 术语 | 说明 |
|------|------|
| **目标生** | 学校重点培养的优秀学生，通常指年级排名前一定比例的学生 |
| **筛选规则** | 一组筛选条件的集合，可保存复用 |
| **快照** | 某次筛选结果的保存版本，用于历史对比 |
| **条件** | 单个筛选条件，包含科目、维度、操作符、数值 |
| **逻辑关系** | 多个条件之间的组合方式（AND/OR） |
| **学科排名** | 按单科成绩排名筛选 |
| **总分排名** | 按总分排名筛选 |
| **年级排名** | 在整个年级中的排名 |
| **班级排名** | 在班级中的排名 |

---

**文档修订历史**:

| 版本 | 日期 | 修订人 | 修订内容 |
|------|------|--------|---------|
| v1.0 | 2026-04-01 | AI Assistant | 初始版本 |
| v1.1 | 2026-04-01 | AI Assistant | 同步 PRD 约束：显式 path 挂载、规则删除返回规范、快照序列化 exam_id/rule_id 显式映射、写权限统一收紧；同步目标生路由与前端目录前缀 |
| v1.2 | 2026-04-01 | AI Assistant | 重构第7章任务分解：后端服务前置、API阶段纳入路由/权限约束、测试分层拆分（单元/API集成/E2E）并增加 403 权限负例验收 |
| v1.3 | 2026-04-01 | AI Assistant | 新增 7.3 交付物与验收标准：按阶段定义可交付产物和验收口径，便于排期与上线验收 |

---

**审批签字**:

- 技术负责人: ________________  日期: ______
- 项目经理: ________________  日期: ______

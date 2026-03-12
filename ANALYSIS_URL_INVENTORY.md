# 成绩分析入口 URL 盘点清单

更新时间：2026-03-12

## 1) 页面入口（Django 路由层）

说明：以下 URL 由 `students_grades/urls.py` 提供，当前均已接入重定向到前端分析页面。

| 类型 | 访问 URL | 当前处理 | 实际落点（前端） | 备注 |
|---|---|---|---|---|
| 新入口 | `/analysis/class-grade/` | redirect | `/analysis/class-grade` | 班级/年级分析入口 |
| 新入口 | `/analysis/class-grade/class/` | redirect | `/analysis/class-grade/class` | 单班分析页面 |
| 新入口 | `/analysis/class-grade/grade/` | redirect | `/analysis/class-grade/grade` | 年级分析页面 |
| 新入口 | `/analysis/student/` | redirect | `/analysis/student` | 学生分析入口 |
| 新入口 | `/analysis/student/detail/` | redirect | `/analysis/student/detail` | 学生分析详情 |

---

## 2) 分析 API 入口（后端数据接口）

说明：以下接口由 `api_urls.py` 注册的 `ScoreViewSet` 提供，统一挂载在 `/api/` 下。

| 接口 URL | 方法 | 用途 | 当前前端调用 |
|---|---|---|---|
| `/api/scores/class-analysis-single/` | GET | 单班分析数据 | 是 |
| `/api/scores/class-analysis-multi/` | GET | 多班对比数据 | 是 |
| `/api/scores/class-analysis-grade/` | GET | 年级分析数据 | 是 |
| `/api/scores/student-analysis-data/` | GET | 学生分析详情数据 | 是 |

---

## 3) 旧分析 AJAX（模板侧）

说明：旧分析 AJAX 路由已在 `students_grades/urls.py` 下线，不再对外暴露；模板侧调用也已切换为新 API。

| URL 名称 | 实际路径 | 来源模板 | 状态 |
|---|---|---|---|
| `get_classes_by_grade` | `/get_classes_by_grade/` | `templates/scores/score_analysis_student.html` | 已迁移到 `/api/classes/` |
| `get_students_by_class` | `/get_students_by_class/` | `templates/scores/score_analysis_student.html` | 已迁移到 `/api/students/` |
| `get_student_analysis_data` | `/get_student_analysis_data/` | `templates/scores/score_analysis_student_detail.html` | 已迁移到 `/api/scores/student-analysis-data/` |

---

## 4) 结论

- 分析“页面入口”已统一为 `/analysis/*` 新入口并导向前端页面。
- 分析“主数据链路”已统一到 `/api/scores/*analysis*`。
- 旧分析 AJAX 路由与模板调用均已迁移完成，A-04 可判定完成。

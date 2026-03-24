# 学段 + xx级 改造完整清单

## 1. 改造目标

- 将当前单字段年级体系（如 初一/高一）升级为可扩展体系：学段 + 届别（xx级）+ 可选当前年级。
- 解决未来初中部/高中部并行招生时的标识冲突问题。
- 保证成绩查询、考试管理、分析、排名、导入导出、权限体系在迁移后行为一致。

## 2. 设计原则

- 业务主键不再依赖单一 grade_level 文本。
- 新旧字段并行一段时间，避免一次性硬切换。
- API 先兼容，前端逐步切换，最后再移除旧字段。
- 所有高风险改动可回滚，迁移可重复执行或可校验。

## 3. 目标数据模型

### 3.1 核心字段设计

#### Student / Class 模型

| 字段 | 用途 | 说明 |
|------|------|------|
| grade_level | **展示 + 批量升年级** | 值域变化：从"初一/初二..."变为"初中2026级/初中2025级/高中2026级..." |
| cohort | **查询用** | section + cohort_year 组合值，如"初中2026级"、"高中2025级" |

#### Exam 模型

| 字段 | 用途 | 说明 |
|------|------|------|
| grade_level | **适用年级 = cohort** | 存储 cohort 值（如"初中2026级"），**既是适用年级也是查询标识** |
| academic_year | **学年** | 用户手动指定（如"2025-2026"），不变 |

#### grade_level 值域对照表

| 旧值（改造前） | 新值（改造后） |
|---------------|---------------|
| 初一 | 初中2026级 |
| 初二 | 初中2025级 |
| 初三 | 初中2024级 |
| 高一 | 高中2026级 |
| 高二 | 高中2025级 |
| 高三 | 高中2024级 |

**说明**：
- 改造后 grade_level 的值 = section + cohort_year 组合
- 例如"初中2026级"表示2026年入学的初中生
- Exam.grade_level 存储的即为 cohort 值

### 3.2 字段职责划分

| 字段 | 职责 |
|------|------|
| **grade_level** | 1. 界面展示<br>2. 批量升年级逻辑 |
| **cohort** (Student/Class) | 查询、筛选、过滤、分组 |

### 3.3 重要说明

#### cohort 字段来源
- **新建学生/班级**：用户在导入/创建时选择 section + cohort_year，系统组合为 cohort
- **历史学生/班级**：导出现有数据后，用户补充 section + cohort_year，再重新导入

#### grade_level 值的选择
- 用户在创建/编辑时，需要**同时选择 grade_level 和 cohort**
- grade_level 下拉选项 = cohort 值（如"初中2026级"）
- 系统自动将用户选择的 cohort 值写入 grade_level

#### Exam.grade_level 的特殊性
- Exam 的"适用年级"直接存储 cohort 值
- 查询某届学生的考试时，直接用 `exam.grade_level = "初中2026级"` 过滤

#### Score.total_score_rank_in_grade 处理策略
- **不需要回填**
- 该字段只和当场考试有关，按"当时考试对应的 grade_level"计算
- 即使出现休学、留级等情况，历史排名数据保持不变


## 4. 受影响范围与文件清单

## 4.1 后端模型与迁移

- school_management/students_grades/models/student.py
- school_management/students_grades/models/exam.py
- school_management/students_grades/models/score.py（间接受影响）
- school_management/students_grades/migrations/（新增迁移）
- school_management/students_grades/migrations/0002_initial.py（现有唯一约束参考）
- school_management/users/models.py（managed_grade 体系对齐）

## 4.2 后端 API 与业务逻辑

- school_management/students_grades/api_views.py
- school_management/students_grades/serializers.py
- school_management/students_grades/tasks.py
- school_management/students_grades/services/analysis_service.py
- school_management/users/serializers.py（managed_grade 输出字段策略）

## 4.3 前端页面

- frontend/src/app/scores/query/page.tsx
- frontend/src/app/students/page.tsx
- frontend/src/app/students/add/page.tsx
- frontend/src/app/students/[id]/edit/page.tsx
- frontend/src/app/students/batch-promote/page.tsx
- frontend/src/app/exams/create/page.tsx
- frontend/src/app/exams/[id]/edit/page.tsx
- frontend/src/app/analysis/student/page.tsx
- frontend/src/contexts/AuthContext.tsx

## 4.4 文档与契约

- docs/student_management_api_contract.md
- docs/exam_management_api_contract.md
- docs/score_management_api_contract.md
- docs/analysis_api_contract.md
- docs/permission_system_v1.md

## 5. 改造阶段与执行清单

## 阶段 A：冻结与基线 ✅ FINISHED

- [x] 创建迁移分支，例如 feature/grade-section-cohort
- [x] 备份数据库（至少一份本地快照）
- [x] 导出现网关键报表基线（查询结果、排名、年级分析）
- [x] 记录当前 API 响应样例用于回归对比

交付物：
- ✅ 基线数据包（json/csv）：`docs/年级字段更改/baseline_data.json`
- ✅ 回滚用数据库副本：`data/backups/db_backup_20260324_095219.sqlite3`
- ✅ API响应样例：`docs/年级字段更改/api_samples.json`

## 阶段 B：模型扩展（不破坏旧逻辑）✅ FINISHED

- [x] Student 增加字段：`cohort`（存储格式如"初中2026级"）
- [x] Class 增加字段：`cohort`（存储格式如"初中2026级"）
- [x] Exam **不增加新字段**，grade_level 的值域改为 cohort 格式
- [x] 保留旧 grade_level 字段不删除（用于展示）
- [x] 新增联合索引（cohort）
- [x] 新增唯一约束草案（见阶段 D 执行）

> **⚠️ 后期待办**：当前 cohort 字段暂时允许 null（因为现有数据库有数据）。等阶段C完成数据重新导入后，需创建迁移将 cohort 改为必填（`null=False`）。

### 新建学生/班级时的 cohort 来源
- **用户手动选择**：在导入/创建时，用户选择 section + cohort_year，系统组合为 cohort
- 导入模板新增 section 和 cohort_year 两列（必填）
- 前端表单新增 section 和 cohort_year 选择器

### cohort 值格式
- 格式：`{section_display}{cohort_year}级`
- 示例：`初中2026级`、`高中2025级`
- section_display：初中 / 高中
- cohort_year：2024 / 2025 / 2026 / ...

### 约束建议（迁移后启用）：
- Class: unique(cohort, class_name)
- Exam: unique(academic_year, name, grade_level)

## 阶段 C：历史数据回填迁移

### Student 回填方案（方案A：重新导入）

- [ ] 导出现有学生数据（包含当前所有学生信息）
- [ ] 用户手动补充 section 列（学段：初中部/高中部）和 cohort_year 列（入学年份）
- [ ] 修改学生导入模板 Excel，新增 section 和 cohort_year 列
- [ ] 按新模板重新导入学生数据
- [ ] 生成导入校验报告

**关键原则**：
- **cohort_year = 入学年份，学生升年级时保持不变**
- **section 在学生整个求学期间保持不变**（初中部始终 junior，高中始终 senior）
- section 和 cohort_year 均由用户在导入模板中手动填写
- 初中部对应 junior，高中部对应 senior
- **留级、跳级等特殊情况**：系统检测到同一班级内存在不同 cohort_year 的学生时，**提示管理员手动确认**

**Cohort 变更场景**：
| 场景 | 处理方式 |
|------|---------|
| 正常升学 | cohort 不变，grade_level 变化 |
| 初中升高中 | **不考虑**（初中部和高中部独立管理） |

### Class 数据填充规则
- [ ] 班级是固定的，同一班级和年级不会存在不同届学生
- [ ] 根据班级内学生的 cohort_year 填充（正常情况下全班一致）
- [ ] 如发现同一班级内存在不同 cohort_year 的学生，**提示管理员手动确认**

### Exam 数据填充规则
- [ ] 导出现有考试数据（备份）
- [ ] 删除所有现有考试记录
- [ ] 按新格式重新导入考试（用户选择 section + cohort_year，系统组合为 cohort 写入 grade_level）

## 阶段 D：后端逻辑双栈兼容

- [ ] API 入参新增 section、cohort_year
- [ ] 保留旧入参 grade_level，服务端做兼容转换（向后兼容）
- [ ] **查询逻辑改为只按 section + cohort_year 过滤**
- [ ] 排名任务改为按 section + cohort_year 分组
- [ ] 分析服务改为按 section + cohort_year 聚合
- [ ] 导入导出模板新增列：学段、届别
- [ ] 旧列年级保留一版周期，并在响应中标记 deprecated

**查询策略变更**：
- **Student/Class**：查询使用 cohort 字段（如 `cohort = "初中2026级"`）
- **Exam**：查询使用 grade_level 字段（存储的即为 cohort 值，如 `grade_level = "初中2026级"`）
- **grade_level 仅用于展示和批量升年级，不再参与实际业务查询**

兼容策略：
- Student/Class 的 grade_level 仅做展示用
- 旧参数 grade_level 在灰度期内可继续传入，但会被忽略
- cohort 为实际查询条件

## 阶段 E：前端切换

- [ ] 所有筛选组件增加学段、届别两个控件
- [ ] 所有请求参数改为 section + cohort_year
- [ ] 列表展示改为 full_grade_display（例如 高中2026级）
- [ ] 保留旧显示字段 fallback（避免灰度期间空白）
- [ ] 批量升年级页面改名为批量升届/升学段（按实际业务）

交互建议：
- 查询页先选学段，再联动届别列表
- 如果仅展示 xx级，tooltip 或副标题显示学段，避免歧义

## 阶段 F：权限与角色字段治理

- [ ] 统一 managed_grade 表达方式（建议 managed_section + managed_cohort_year）
- [ ] 权限判断改造为按新字段做数据范围过滤（可先只做结构不启用）
- [ ] 角色管理脚本和测试账号生成脚本同步升级

## 阶段 G：测试与验收

- [ ] 模型迁移测试（空库、已有数据、脏数据三类）
- [ ] API 兼容测试（旧参数、新参数、混合参数）
- [ ] 排名一致性测试（改造前后同数据同排序）
- [ ] 分析页面回归测试（单班、多班、年级分析）
- [ ] 导入导出往返测试（导入后导出字段一致）
- [ ] 权限回归（admin/grade_manager/staff）

验收通过条件：
- 关键查询结果与基线误差为 0（或在可解释范围）
- 无 P0/P1 级缺陷
- 性能不低于当前版本

## 阶段 H：收尾与旧字段下线

- [ ] 完成前端全部新字段切换
- [ ] 完成外部调用方改造通知
- [ ] 停止旧参数写入，保留只读兼容窗口
- [ ] 删除旧 grade_level 依赖逻辑
- [ ] 删除旧文档描述并更新 API 合同

## 阶段 5.5：SQL/约束改造建议（落地级）

- [ ] 添加索引：
  - Student(section, cohort_year)
  - Class(section, cohort_year, class_name)
  - Exam(section, cohort_year, academic_year)
  - Score(exam_id, student_id, subject)
- [ ] 新唯一约束启用前，先执行冲突检测脚本
- [ ] 对高频查询条件建立组合索引，避免查询性能下降

## 7. 风险清单与规避

- 风险 1：cohort_year 无法自动推导
  - 规避：预置人工映射表 + 迁移前审计
- 风险 2：班级唯一约束冲突
  - 规避：先检测再加约束，冲突人工确认
- 风险 3：排名范围错误（跨学段混算）
  - 规避：任务分组键强制 section + cohort_year
- 风险 4：前后端参数不同步
  - 规避：灰度期双参数兼容 + 响应双字段
- 风险 5：权限范围失效
  - 规避：权限用例回归，先观测再强约束

## 8. 工期估算（按一名熟悉项目开发者）

- 最小可用改造（展示层 + API 兼容，不下线旧字段）：2-4 天
- 完整改造（模型/迁移/逻辑/前端/测试）：7-15 天
- 含灰度与回滚演练：10-20 天

## 9. 里程碑建议

- M1：模型扩展 + 数据回填完成
- M2：后端双栈兼容上线
- M3：前端全面切换
- M4：权限治理完成
- M5：旧字段下线

## 10. 你可以直接照着执行的顺序

- [ ] 第 1 天：阶段 A + 阶段 B（字段新增）
- [ ] 第 2 天：阶段 C（数据回填 + 校验报告）
- [ ] 第 3-4 天：阶段 D（API/任务/分析服务兼容）
- [ ] 第 5-6 天：阶段 E（前端切换）
- [ ] 第 7 天：阶段 F + G（权限与回归）
- [ ] 第 8 天：阶段 H（收尾与文档）

---

## 11. 关键定义确认（已确认）

| 定义项 | 值 | 说明 |
|--------|-----|------|
| cohort 定义 | **学段+届别组合** | 格式如"初中2026级"、"高中2025级"；**学生升学后保持不变** |
| Student/Class.cohort | **新增字段** | 用于查询、筛选、分组 |
| Student/Class.grade_level | **保留字段，值域改变** | 展示用 + 批量升年级；改造后值如"初中2026级" |
| Exam.grade_level | **存储 cohort 值** | 既是适用年级也是查询标识 |
| 查询策略 | **按 cohort 查询** | Student/Class 用 cohort；Exam 用 grade_level（=cohort） |
| grade_level 职责 | **展示 + 批量升年级** | 不参与业务查询 |
| Score.total_score_rank_in_grade | **不需回填** | 只和当场考试有关，历史数据不变 |
| 初高中衔接 | **不考虑** | 初中部和高中部独立管理 |

---

如果你希望，我可以继续在这份清单基础上再生成两个配套文件：

- 改造任务分解表（按文件到函数级）
- 数据迁移映射模板（含你当前初中/高中到届别的规则表）

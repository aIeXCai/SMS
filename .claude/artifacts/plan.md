# 开发计划

## 需求理解
Dashboard page.tsx 当前约 1046 行，是一个巨大的上帝组件，包含类型定义、工具函数、数据获取、6 个 UI 区块（HeroPanel、TaskGrid、RecentExams、SystemSignals、QuickActions、SystemStatus）以及 530+ 行 CSS。需要参照 scores/page.tsx 的拆分方式（从 1177 行缩减到 181 行），将其拆分为多个专注的子组件，每个组件管理自己的样式和逻辑，降低复杂度。

## 技术方案
参照 scores/page.tsx 的拆分模式：
- `types.ts` 存放共享类型和常量
- `utils.ts` 存放纯工具函数（无 Hook 依赖）
- `components/` 目录存放各个 UI 子组件
- `page.tsx` 只负责数据获取、组合子组件、保留布局级 CSS

关键决策：
1. **CSS 策略**：每个子组件内部使用 `<style jsx>` 管理自己的样式，page.tsx 只保留顶层布局（.workspace-home、.content-grid 等 grid 定义）和响应式断点。不引入 Tailwind 改写（当前 styles 多为自定义设计系统，强行用 Tailwind 会丢失视觉一致性）。
2. **数据传递**：page.tsx 保持所有数据获取逻辑（useEffect + api.get），通过 props 向下传递。暂不引入自定义 Hook（Dashboard 数据获取比 Scores 简单很多，3 个并行的 GET 请求，无分页/筛选/批量操作）。
3. **目录结构**：组件放在 `frontend/src/app/dashboard/components/`，`types.ts` 和 `utils.ts` 放在 `frontend/src/app/dashboard/`。

## Dashboard 区块分析

| 区块 | JSX 行数 | CSS 行数（估） | 说明 |
|------|---------|-------------|------|
| HeroPanel | ~25 | ~80 | 欢迎语 + 用户身份卡片 + 主副操作按钮 |
| TaskGrid | ~18 | ~40 | 动态待办任务卡片，最多 3 个 |
| RecentExams | ~43 | ~70 | 最近考试列表 + 状态标签(pill) + 空状态 |
| SystemSignals | ~37 | ~50 | 成绩规模/考试节奏/校历三条提醒 |
| QuickActions | ~33 | ~40 | 2x2 快捷操作入口网格 |
| SystemStatus | ~16 | ~20 | 当前概况数字统计 |
| LoadingSpinner | ~28 | ~20 | 加载态 spinner |
| 工具函数 | ~108 | 0 | 6 个纯函数 + QUICK_ACTIONS 常量 |
| 数据获取+编排 | ~100 | ~180(布局) | 页面主体逻辑 + 顶层布局 CSS |

## 任务列表

### Task 1: 提取 types 和 utils
- **目标**: 将类型定义、常量、纯工具函数从 page.tsx 中抽离为独立模块
- **涉及文件**:
  - 新增 `frontend/src/app/dashboard/types.ts`
  - 新增 `frontend/src/app/dashboard/utils.ts`
  - 修改 `frontend/src/app/page.tsx`（移除已抽离代码，改为导入）
- **验收标准**: page.tsx 中不再包含 `type`/`interface`/`const` 定义和函数 `formatDate`/`formatDateTime`/`getExamStatus`/`buildTasks`/`buildLatestExamAnalysisHref`/`getLatestArchivedExam`，全部从 `./dashboard/` 导入；`npm run build` 通过
- **依赖**: 无

### Task 2: 提取 LoadingSpinner 组件
- **目标**: 将加载状态 UI 抽离为独立组件
- **涉及文件**:
  - 新增 `frontend/src/app/dashboard/components/LoadingSpinner.tsx`
  - 修改 `frontend/src/app/page.tsx`（替换内联加载 JSX 为 `<LoadingSpinner />`）
- **验收标准**: 加载状态下页面显示与拆分前完全一致；组件使用 `<style jsx>` 管理 spinner 动画和布局
- **依赖**: Task 1

### Task 3: 提取 HeroPanel 组件
- **目标**: 将顶部 hero 区块（欢迎文案 + 用户身份卡片 + 操作按钮）抽离为独立组件
- **涉及文件**:
  - 新增 `frontend/src/app/dashboard/components/HeroPanel.tsx`
  - 修改 `frontend/src/app/page.tsx`（替换 hero-panel JSX）
- **验收标准**:
  - HeroPanel 接收 props: `user`, `displayName`, `roleTitle`, `summaryText`, `coverageLabel`, `coverageValue`, `latestExamAnalysisHref`
  - 视觉与拆分前完全一致，包含 hero 渐变背景、伪元素装饰、身份卡片、操作按钮
  - 响应式行为不变（小屏单列）
- **依赖**: Task 1

### Task 4: 提取 TaskGrid 组件
- **目标**: 将"今日待办"任务卡片区抽离为独立组件
- **涉及文件**:
  - 新增 `frontend/src/app/dashboard/components/TaskGrid.tsx`
  - 修改 `frontend/src/app/page.tsx`
- **验收标准**:
  - TaskGrid 接收 tasks: TaskItem[] 作为 props
  - 三个任务卡片按 tone（teal/amber/blue）着色正确
  - 视觉与拆分前一致
- **依赖**: Task 1

### Task 5: 提取四个底部面板组件
- **目标**: 将 content-grid 和 lower-grid 中的四个面板拆分为独立组件
- **涉及文件**:
  - 新增 `frontend/src/app/dashboard/components/RecentExams.tsx`
  - 新增 `frontend/src/app/dashboard/components/SystemSignals.tsx`
  - 新增 `frontend/src/app/dashboard/components/QuickActions.tsx`
  - 新增 `frontend/src/app/dashboard/components/SystemStatus.tsx`
  - 修改 `frontend/src/app/page.tsx`
- **验收标准**:
  - RecentExams 接收 exams: Exam[]，内部使用 `getExamStatus` 渲染状态 pill，含空状态展示
  - SystemSignals 接收 stats + events，展示三条信号（含空校历事件的兜底文案）
  - QuickActions 无外部依赖（内部引用 QUICK_ACTIONS 常量），2x2 网格布局
  - SystemStatus 接收 stats + events，展示三条数字统计
  - 所有组件视觉与拆分前一致，含 hover 效果
- **依赖**: Task 1

### Task 6: 最终清理 page.tsx 并验证
- **目标**: 清理 page.tsx 中所有已迁移的 JSX 和 CSS，仅保留数据获取和组件组合，验证整体一致性
- **涉及文件**:
  - 修改 `frontend/src/app/page.tsx`（移除所有已迁移 JSX/style 段，仅含数据获取 + 组件组合 + 顶层布局 CSS + 响应式断点）
- **验收标准**:
  - page.tsx 行数从 1046 缩减到 ~200 行以内
  - `npm run build` 无报错
  - 页面在每个区块的视觉表现与拆分前完全一致：加载态、含数据态、空数据态
  - 各角色视角（admin / grade_manager / subject_teacher / staff）显示正确
  - 响应式布局行为不变（1100px / 768px 断点）
- **依赖**: Task 2, Task 3, Task 4, Task 5

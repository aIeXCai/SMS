# 目标生筛选系统第二期 - 产品需求文档（PRD）

**项目名称**: 目标生筛选系统增强版  
**版本**: v2.0  
**文档创建日期**: 2026-03-31  
**负责人**: 产品团队  
**预计开发周期**: 2-3周  

---

## 1. 项目概述

### 1.1 背景

目标生筛选系统第一期已于 2026年3月 上线，提供了基础的总分筛选功能：
- ✅ 支持按年级排名前N名筛选
- ✅ 支持按班级排名前N名筛选
- ✅ 支持导出筛选结果

**当前痛点**：
1. 教师需要组合多个条件筛选（如"总分前50且数学前30"），目前只能手动交叉对比
2. 无法保存常用筛选规则，每次都要重新配置
3. 无法追踪目标生变化情况（进步/退步/新增/退出）
4. 缺乏学科维度的精细化筛选

### 1.2 目标

构建一个**灵活、可追溯、可复用**的目标生筛选系统，提升教务工作效率 50% 以上。

### 1.3 关键成果（OKR）

- **O**: 提升目标生管理效率，支撑教学质量提升
- **KR1**: 筛选操作时间从平均 15 分钟降至 3 分钟
- **KR2**: 支持保存至少 20 种常用筛选规则
- **KR3**: 提供至少 3 个维度的目标生变化追踪

### 1.4 核心新增功能

**目标生筛选 2.0 新增 3 个核心功能模块**：

| 功能模块 | 核心能力 | 对应页面 |
|---------|---------|---------|
| **高级筛选** | 多条件组合（AND/OR）、学科排名条件、实时预览 | `/target-students/advanced` |
| **我的规则** | 规则保存、管理、复用、编辑、删除 | `/target-students/rules` |
| **变化追踪** | 快照管理、历史对比、进退分析、报告导出 | `/target-students/tracking` |

---

## 2. 用户角色与场景

### 2.1 用户角色

| 角色 | 核心需求 | 使用频率 |
|------|---------|---------|
| **级长** | 筛选年级培优名单、追踪目标生变化 | 每周 2-3 次 |
| **班主任** | 筛选班级尖子生、重点关注对象 | 每周 1-2 次 |
| **科任老师** | 筛选学科优秀/潜力学生 | 每月 1-2 次 |
| **教务主任** | 查看全校目标生分布、生成报告 | 每月 1 次 |

### 2.2 核心用户故事

#### US-01: 多条件组合筛选（最高优先级）
> 作为**级长**，我希望能够**组合多个条件筛选学生**（如"总分年级前50且数学年级前30"），以便**精准识别学科均衡的优秀学生**。

**验收标准**:
- [ ] 支持至少 2 个条件的 AND 组合
- [ ] 支持至少 2 个条件的 OR 组合
- [ ] 支持添加/删除条件
- [ ] 实时显示符合条件的学生数量

#### US-02: 学科排名筛选（作为多条件中的条件类型）
> 作为**科任老师**，我希望能够**在多条件筛选器中按单科排名添加条件**（如"数学年级前30名"），以便**灵活识别学科优秀和潜力学生**。

**验收标准**:
- [ ] 多条件构建器中，科目选择支持总分及任意单科（语文/数学/英语/物理/化学/生物/历史/地理/政治）
- [ ] 支持按年级/班级两个维度筛选
- [ ] 支持设置排名范围（如前10名、前20名）
- [ ] 单科条件可与其他条件自由组合（AND/OR）

#### US-03: 筛选规则保存与复用
> 作为**级长**，我希望能够**保存常用的筛选规则**，以便**下次一键复用，避免重复配置**。

**验收标准**:
- [ ] 支持为规则命名（如"数学培优班名单"）
- [ ] 支持保存规则到个人规则库
- [ ] 支持一键加载历史规则
- [ ] 支持规则删除和编辑

#### US-04: 目标生变化追踪
> 作为**级长**，我希望能够**查看目标生名单的变化情况**，以便**及时干预和鼓励**。

**验收标准**:
- [ ] 对比两次筛选结果，显示新增/退出/保留学生
- [ ] 显示学生排名变化趋势（进步/退步）
- [ ] 支持导出变化报告

---

## 3. 功能需求详细设计

### 3.0 界面架构设计（新增）

#### 3.0.1 设计原则

采用**分离式界面架构**，第一期和第二期功能完全解耦：

- **第一期（简单筛选）**：保持原有界面，提供单一条件筛选
- **第二期（高级筛选）**：新增独立界面，提供多条件组合、规则保存、变化追踪等高级功能

#### 3.0.2 路由结构

```
/target-students/            # 第一期：简单筛选（保持不变）
/target-students/advanced    # 新增 1/3：高级筛选
/target-students/rules       # 新增 2/3：我的规则
/target-students/tracking    # 新增 3/3：变化追踪
```

#### 3.0.3 导航流程

```
Dashboard
    ↓
侧边栏点击"目标生筛选"
    ↓
┌──────────────────────────────────────────────────┐
│  目标生筛选（侧边栏展开）                         │
│  ├── 简单筛选 (默认)                              │
│  ├── 高级筛选       ← 新增                        │
│  ├── 我的规则       ← 新增，独立管理规则           │
│  └── 变化追踪       ← 新增，独立查看快照和对比     │
└──────────────────────────────────────────────────┘
```

**页面关系说明**：

- **简单筛选**：第一期页面，单条件快速筛选
- **高级筛选**：多条件组合筛选，可加载规则、保存快照
- **我的规则**：独立管理规则页面（新建/编辑/删除/预览）
- **变化追踪**：独立快照管理和对比页面（查看历史、对比两次结果）

**跳转关系**：
- 简单筛选 → 高级筛选
- 高级筛选 → 我的规则（管理规则按钮）
- 高级筛选 → 变化追踪（保存为快照按钮）
- 规则/追踪页 → 高级筛选（返回按钮）

#### 3.0.4 第一期界面（保持不变）

```
┌─────────────────────────────────────────────────────────────┐
│  目标生筛选                                                │
├─────────────────────────────────────────────────────────────┤
│  简单筛选模式                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ 选择考试: [期中考试(2026春季) ▼]                     │ │
│  │ 筛选条件: [年级排名前 ▼] [50] 名                   │ │
│  │                                                         │ │
│  │ [开始筛选]                                              │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  💡 需要更复杂的筛选？                                        │
│  [进入高级筛选模式 →]  ← 点击跳转到第二期                    │
└─────────────────────────────────────────────────────────────┘
```

#### 3.0.5 高级筛选页（新增）- `/target-students/advanced`

```
┌─────────────────────────────────────────────────────────────────────────┐
│  目标生筛选（高级模式）                                    [返回简单]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [新建筛选]   [加载规则 ▼]  [管理规则 →]                                 │
│     ↑ 重置条件   ↑ 选择保存的规则     ↑ 跳转到 /rules 管理页面            │
│                                                                         │
│  筛选条件                                                               │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ 条件 1: [科目: 总分 ▼] [年级排名前 ▼] [50] 名              [删除]  │ │
│  │                                                                 │ │
│  │ 条件 2: [科目: 数学 ▼] [年级排名前 ▼] [30] 名              [删除]  │ │
│  │                                                                 │ │
│  │ 逻辑关系: ◉ AND  ○ OR                                             │ │
│  │                                                                 │ │
│  │ [+ 添加条件]                                                      │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  [开始筛选]                                                              │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  筛选结果: 共 28 名学生符合条件                     [保存为快照 →]      │
│                                                          ↑ 跳转到 /tracking│
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │  学号   │ 姓名   │ 班级     │ 总分排名 │ 数学排名 │ 语文排名 │ ...  │ │
│  ├───────────────────────────────────────────────────────────────────┤ │
│  │ 24001 │ 张三   │ 初二(1)班│ 第3名   │ 第5名    │ 第8名    │ ...  │ │
│  │ 24015 │ 李四   │ 初二(3)班│ 第12名  │ 第8名    │ 第15名   │ ...  │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  [导出Excel]  [导出PDF]                                                  │
└─────────────────────────────────────────────────────────────────────────┘
```

**操作说明**：
- **新建筛选**：清空所有条件，重新开始
- **加载规则**：下拉框选择保存的规则，自动填充条件
- **管理规则**：跳转到 `/rules` 页面管理所有规则
- **保存为快照**：筛选完成后，跳转到 `/tracking` 页面保存快照

#### 3.0.6 设计优势

| 优势 | 说明 |
|------|------|
| **降低学习门槛** | 新手老师用简单筛选，资深老师用高级筛选 |
| **界面清晰** | 避免"一个页面塞太多功能"，各页面职责明确 |
| **性能优化** | 按需加载高级功能，简单页面更快 |
| **架构解耦** | 四个页面独立开发、测试、维护 |
| **便于扩展** | 未来可轻松添加第三期、第四期 |

#### 3.0.7 我的规则页（新增）- `/target-students/rules`

```
┌─────────────────────────────────────────────────────────────────────────┐
│  我的筛选规则                                              [返回高级筛选] │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [+ 新建规则]                                                            │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │  规则名称           │ 类型  │ 使用次数 │ 最后使用     │ 操作     │ │
│  ├───────────────────────────────────────────────────────────────────┤ │
│  │  数学培优班名单      │ 高级 │ 12次    │ 2026-03-30  │ [编辑] [删除] │ │
│  │  总分前50+数学前30   │ 高级 │ 8次     │ 2026-03-28  │ [编辑] [删除] │ │
│  │  均衡优等生          │ 高级 │ 5次     │ 2026-03-25  │ [编辑] [删除] │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  分页: [上一页] 1/5 [下一页]                                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**核心功能**：
- 查看所有保存的规则（表格/卡片展示）
- 新建规则（打开编辑对话框，与高级筛选页共用组件）
- 编辑规则（打开编辑对话框）
- 删除规则（二次确认）
- 规则预览（点击查看详细配置）

#### 3.0.8 变化追踪页（新增）- `/target-students/tracking`

```
┌─────────────────────────────────────────────────────────────────────────┐
│  目标生变化追踪                                            [返回高级筛选] │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [保存当前筛选结果为快照]                                                │
│                                                                         │
│  历史快照                                                               │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │  快照名称             │ 考试      │ 创建时间   │ 学生数 │ 操作     │ │
│  ├───────────────────────────────────────────────────────────────────┤ │
│  │  期中-数学培优班      │ 期中考试  │ 2026-04-15 │ 28    │ ◉       │ │
│  │  月考-数学培优班      │ 月考      │ 2026-05-20 │ 32    │ ○       │ │
│  │  期末-数学培优班      │ 期末考试  │ 2026-06-25 │ 30    │ ○       │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │  [对比选中快照]                                                  │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  对比结果                                                               │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │  新增 (3人):  张明(进步5名)  李华(新进)  王强(新进)               │ │
│  │  退出 (1人):  陈红(退至前35)                                         │ │
│  │  保留 (25人):  张三、李四...                                        │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  [导出对比报告]                                                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**核心功能**：
- 查看所有历史快照列表（关联规则/考试/时间）
- 选择两个快照进行对比（新增/退出/保留/排名变化）
- 显示学生进退情况
- 导出对比报告（PDF/Excel）
- 删除快照

#### 3.0.9 前端路由实现示例

```typescript
// frontend/src/app/target-students/page.tsx (第一期)
'use client';

import Link from 'next/link';

export default function TargetStudentsPage() {
  return (
    <div className="container">
      <h1 className="text-2xl font-bold mb-6">目标生筛选</h1>
      
      {/* 第一期简单筛选 UI */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">选择考试</label>
            <select className="w-full border rounded p-2">
              <option>期中考试(2026春季)</option>
              <option>期末考试(2026春季)</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">筛选条件</label>
            <div className="flex gap-2">
              <select className="border rounded p-2">
                <option>年级排名前</option>
                <option>班级排名前</option>
              </select>
              <input type="number" className="border rounded p-2 w-20" placeholder="50" />
              <span className="self-center">名</span>
            </div>
          </div>
          
          <button className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700">
            开始筛选
          </button>
        </div>
      </div>
      
      {/* 跳转到高级筛选的提示 */}
      <div className="mt-8 p-4 bg-blue-50 rounded border border-blue-200">
        <p className="text-gray-700 mb-2">
          💡 需要多条件组合、规则保存、变化追踪等高级功能？
        </p>
        <Link 
          href="/target-students/advanced"
          className="text-blue-600 font-semibold hover:underline inline-block"
        >
          进入高级筛选模式 →
        </Link>
      </div>
    </div>
  );
}
```

```typescript
// frontend/src/app/target-students/advanced/page.tsx (第二期 - 新增)
'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function TargetStudentsAdvancedPage() {
  const [selectedRule, setSelectedRule] = useState<string>('');

  return (
    <div className="container">
      {/* 顶部导航 */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">目标生筛选（高级模式）</h1>
          <p className="text-gray-600 text-sm">支持多条件组合、规则保存、快照追踪</p>
        </div>
        <Link 
          href="/target-students"
          className="text-gray-600 hover:text-gray-800 flex items-center gap-2"
        >
          <span>← 返回简单筛选</span>
        </Link>
      </div>

      {/* 操作栏 */}
      <div className="bg-white p-4 rounded-lg shadow mb-6 flex gap-4">
        <button className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200">
          新建筛选
        </button>
        <div className="flex gap-2">
          <select 
            className="border rounded px-3 py-2"
            value={selectedRule}
            onChange={(e) => setSelectedRule(e.target.value)}
          >
            <option value="">加载规则...</option>
            <option value="1">数学培优班名单</option>
            <option value="2">总分前50+数学前30</option>
          </select>
        </div>
        <Link 
          href="/target-students/rules"
          className="px-4 py-2 text-blue-600 hover:underline"
        >
          管理规则 →
        </Link>
      </div>
      
      {/* 筛选条件构建器 */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold mb-4">筛选条件</h2>
        {/* FilterBuilder 组件 */}
        <div className="space-y-3">
          {/* 条件 1 */}
          <div className="flex gap-2 items-center">
            <select className="border rounded px-3 py-2">
              <option>科目: 总分</option>
              <option>科目: 数学</option>
            </select>
            <select className="border rounded px-3 py-2">
              <option>年级排名前</option>
              <option>班级排名前</option>
            </select>
            <input type="number" className="border rounded px-3 py-2 w-20" placeholder="50" />
            <span>名</span>
            <button className="text-red-500 hover:text-red-700">删除</button>
          </div>
        </div>
        <button className="mt-4 px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">
          + 添加条件
        </button>
      </div>

      {/* 开始筛选按钮 */}
      <button className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 mb-6">
        开始筛选
      </button>
      
      {/* 筛选结果 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">筛选结果: 共 28 名学生</h2>
          <Link 
            href="/target-students/tracking"
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            保存为快照 →
          </Link>
        </div>
        {/* 结果表格 */}
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2">学号</th>
              <th className="text-left py-2">姓名</th>
              <th className="text-left py-2">班级</th>
              <th className="text-left py-2">总分排名</th>
              <th className="text-left py-2">数学排名</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="py-2">24001</td>
              <td className="py-2">张三</td>
              <td className="py-2">初二(1)班</td>
              <td className="py-2">第3名</td>
              <td className="py-2">第5名</td>
            </tr>
            <tr className="border-b">
              <td className="py-2">24015</td>
              <td className="py-2">李四</td>
              <td className="py-2">初二(3)班</td>
              <td className="py-2">第12名</td>
              <td className="py-2">第8名</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

```typescript
// frontend/src/app/target-students/rules/page.tsx (新增)
'use client';

import Link from 'next/link';

export default function FilterRulesPage() {
  return (
    <div className="container">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">我的筛选规则</h1>
        <Link 
          href="/target-students/advanced"
          className="text-gray-600 hover:text-gray-800"
        >
          ← 返回高级筛选
        </Link>
      </div>

      <div className="bg-white p-6 rounded-lg shadow mb-4">
        <button className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          + 新建规则
        </button>
      </div>

      <div className="bg-white rounded-lg shadow">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left py-3 px-4">规则名称</th>
              <th className="text-left py-3 px-4">类型</th>
              <th className="text-left py-3 px-4">使用次数</th>
              <th className="text-left py-3 px-4">最后使用</th>
              <th className="text-left py-3 px-4">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="py-3 px-4">数学培优班名单</td>
              <td className="py-3 px-4"><span className="px-2 py-1 bg-blue-100 rounded text-sm">高级</span></td>
              <td className="py-3 px-4">12次</td>
              <td className="py-3 px-4">2026-03-30</td>
              <td className="py-3 px-4">
                <button className="text-blue-600 hover:underline mr-2">编辑</button>
                <button className="text-red-600 hover:underline">删除</button>
              </td>
            </tr>
            <tr className="border-b">
              <td className="py-3 px-4">总分前50+数学前30</td>
              <td className="py-3 px-4"><span className="px-2 py-1 bg-blue-100 rounded text-sm">高级</span></td>
              <td className="py-3 px-4">8次</td>
              <td className="py-3 px-4">2026-03-28</td>
              <td className="py-3 px-4">
                <button className="text-blue-600 hover:underline mr-2">编辑</button>
                <button className="text-red-600 hover:underline">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

```typescript
// frontend/src/app/target-students/tracking/page.tsx (新增)
'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function FilterTrackingPage() {
  const [selectedSnapshots, setSelectedSnapshots] = useState<number[]>([]);

  return (
    <div className="container">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">目标生变化追踪</h1>
        <Link 
          href="/target-students/advanced"
          className="text-gray-600 hover:text-gray-800"
        >
          ← 返回高级筛选
        </Link>
      </div>

      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <button className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700">
          保存当前筛选结果为快照
        </button>
      </div>

      {/* 快照列表 */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-4 border-b">
          <h2 className="font-semibold">历史快照</h2>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left py-3 px-4 w-10"></th>
              <th className="text-left py-3 px-4">快照名称</th>
              <th className="text-left py-3 px-4">考试</th>
              <th className="text-left py-3 px-4">创建时间</th>
              <th className="text-left py-3 px-4">学生数</th>
              <th className="text-left py-3 px-4">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="py-3 px-4">
                <input 
                  type="checkbox" 
                  checked={selectedSnapshots.includes(1)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedSnapshots([...selectedSnapshots, 1]);
                    } else {
                      setSelectedSnapshots(selectedSnapshots.filter(id => id !== 1));
                    }
                  }}
                />
              </td>
              <td className="py-3 px-4">期中-数学培优班</td>
              <td className="py-3 px-4">期中考试</td>
              <td className="py-3 px-4">2026-04-15</td>
              <td className="py-3 px-4">28</td>
              <td className="py-3 px-4">
                <button className="text-red-600 hover:underline">删除</button>
              </td>
            </tr>
            <tr className="border-b">
              <td className="py-3 px-4">
                <input 
                  type="checkbox" 
                  checked={selectedSnapshots.includes(2)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedSnapshots([...selectedSnapshots, 2]);
                    } else {
                      setSelectedSnapshots(selectedSnapshots.filter(id => id !== 2));
                    }
                  }}
                />
              </td>
              <td className="py-3 px-4">月考-数学培优班</td>
              <td className="py-3 px-4">月考</td>
              <td className="py-3 px-4">2026-05-20</td>
              <td className="py-3 px-4">32</td>
              <td className="py-3 px-4">
                <button className="text-red-600 hover:underline">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {selectedSnapshots.length === 2 && (
        <>
          <button className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 mb-6">
            对比选中快照
          </button>

          {/* 对比结果 */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <h2 className="font-semibold">对比结果</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-4 bg-green-50 rounded">
                <h3 className="font-semibold text-green-800 mb-2">新增 (3人)</h3>
                <p className="text-gray-700">张明(进步5名)、李华(新进)、王强(新进)</p>
              </div>
              <div className="p-4 bg-red-50 rounded">
                <h3 className="font-semibold text-red-800 mb-2">退出 (1人)</h3>
                <p className="text-gray-700">陈红(退至前35)</p>
              </div>
              <div className="p-4 bg-gray-50 rounded">
                <h3 className="font-semibold text-gray-800 mb-2">保留 (25人)</h3>
                <p className="text-gray-700">张三、李四...</p>
              </div>
            </div>
            <div className="p-4 border-t">
              <button className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                导出对比报告
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

#### 3.0.10 菜单导航调整

侧边栏菜单需要更新目标生筛选的二级菜单项：

```typescript
const menuItems = [
  {
    label: '成绩管理',
    icon: '📊',
    children: [
      { label: '成绩录入', href: '/scores' },
      { label: '成绩查询', href: '/scores/query' },
    ]
  },
  {
    label: '目标生筛选',
    icon: '🎯',
    isOpen: true,  // 默认展开
    children: [
      { label: '简单筛选', href: '/target-students' },
      { label: '高级筛选', href: '/target-students/advanced' },
      { label: '我的规则', href: '/target-students/rules' },      // 新增
      { label: '变化追踪', href: '/target-students/tracking' },  // 新增
    ]
  },
  // ... 其他菜单项
]
```

---

### 3.1 多条件组合筛选

#### 3.1.1 功能描述

允许用户通过**可视化界面**组合多个筛选条件，支持 AND/OR 逻辑。

#### 3.1.2 界面设计（原型）

```
┌─────────────────────────────────────────────────────────────┐
│  目标生筛选                                            [保存规则] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  筛选条件                                                   │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ 条件 1: [总分 ▼] [年级排名前 ▼] [50] 名    [删除]    │ │
│  │                                                         │ │
│  │ 条件 2: [数学 ▼] [年级排名前 ▼] [30] 名    [删除]    │ │
│  │                                                         │ │
│  │ 逻辑关系: ◉ AND  ○ OR                                   │ │
│  │                                                         │ │
│  │ [+ 添加条件]                                            │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  [开始筛选]                                                  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  筛选结果: 共 28 名学生符合条件                              │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ 学号   │ 姓名   │ 班级     │ 总分排名 │ 数学排名 │ ... │ │
│  ├───────────────────────────────────────────────────────┤ │
│  │ 24001 │ 张三   │ 初二(1)班│ 第3名   │ 第5名    │ ... │ │
│  │ 24015 │ 李四   │ 初二(3)班│ 第12名  │ 第8名    │ ... │ │
│  │ ...   │ ...    │ ...      │ ...     │ ...      │ ... │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  [导出Excel]  [导出PDF]  [保存筛选结果]                      │
└─────────────────────────────────────────────────────────────┘
```

#### 3.1.3 条件类型

| 条件字段 | 可选值 | 说明 |
|---------|--------|------|
| **学科** | 总分 / 语文 / 数学 / 英语 / 物理 / 化学 / 生物 / 历史 / 地理 / 政治 | 单选 |
| **排名维度** | 年级排名 / 班级排名 | 单选 |
| **排名条件** | 前N名 / 后N名 / N名到M名 | 下拉选择 |
| **数值输入** | 正整数 | 手动输入 |

#### 3.1.4 逻辑组合规则

- **AND（交集）**: 所有条件同时满足
  - 例：总分年级前50 **AND** 数学年级前30 → 总分前50名中，数学也前30的学生
  
- **OR（并集）**: 满足任一条件即可
  - 例：语文年级前10 **OR** 数学年级前10 → 语文前10 或 数学前10 的学生

#### 3.1.5 后端 API 设计

**新增 API 端点**: `POST /api/students/advanced-filter/`

**请求体示例**:
```json
{
  "exam_id": 42,
  "logic": "AND",  // 或 "OR"
  "conditions": [
    {
      "subject": "total",  // 总分
      "dimension": "grade",  // 年级
      "operator": "top_n",  // 前N名
      "value": 50
    },
    {
      "subject": "math",  // 数学
      "dimension": "grade",
      "operator": "top_n",
      "value": 30
    }
  ],
  "class_id": null  // 可选，筛选特定班级
}
```

**响应体示例**:
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
          "rank": 5
        },
        "chinese": {
          "score": 95,
          "rank": 8
        }
        // ... 其他学科
      }
    }
    // ... 更多学生
  ],
  "filter_summary": {
    "total_students_in_exam": 450,
    "filtered_count": 28,
    "filter_rate": "6.22%"
  }
}
```

---

### 3.2 条件类型扩展：学科排名

> ⚠️ **设计说明**：学科排名**不是独立的筛选入口**，而是多条件构建器（3.1节）中的一种**条件类型**。用户在高级筛选界面添加条件时，可直接在"科目"下拉框中选择总分或任意单科。

#### 3.2.1 条件类型完整定义

多条件构建器中每一行条件由以下字段组成：

| 字段 | 类型 | 可选值 | 说明 |
|------|------|--------|------|
| **科目** | 下拉选择 | 总分 / 语文 / 数学 / 英语 / 物理 / 化学 / 生物 / 历史 / 地理 / 政治 | 选"总分"即为总分排名，选学科即为单科排名 |
| **排名维度** | 下拉选择 | 年级排名 / 班级排名 | 年级维度或班级维度 |
| **排名范围** | 下拉选择 | 前N名 / 后N名 / 第N到M名 | 排名条件类型 |
| **数值** | 数字输入 | 正整数 | 排名数值，前N名填N，区间填N和M |

#### 3.2.2 界面交互（融合在多条件构建器中）

```
┌─────────────────────────────────────────────────────────────────────────┐
│  筛选条件                                                               │
├─────────────────────────────────────────────────────────────────────────┤
│  条件 1: [科目: 总分 ▼] [年级排名前 ▼] [50] 名                [删除]  │
│                                                                         │
│  条件 2: [科目: 数学 ▼] [年级排名前 ▼] [30] 名                [删除]  │
│           ↑ 学科排名直接在此选择，无需跳转独立页面                       │
│  条件 3: [科目: 语文 ▼] [班级排名前 ▼] [ 5] 名                [删除]  │
│                                                                         │
│  逻辑关系: ◉ AND  ○ OR                                                  │
│                                                                         │
│  [+ 添加条件]                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 3.2.3 典型使用场景

| 场景 | 条件配置 | 逻辑 |
|------|---------|------|
| 均衡优等生 | 总分年级前50 + 数学年级前30 | AND |
| 学科偏科生 | 数学年级前10 + 语文班级后20 | AND |
| 多科潜力生 | 物理年级前20 OR 化学年级前20 | OR |
| 科任老师选拔 | 数学年级前30（单条件即可） | - |

#### 3.2.4 后端实现要点

- 利用现有 `exam_scores` 表的 `rank_in_grade` 和 `rank_in_class` 字段
- 条件解析统一在 3.1.6 节的高级筛选服务中处理，无需独立接口
- subject 字段值映射：`total`=总分，`chinese`=语文，`math`=数学，`english`=英语，`physics`=物理，`chemistry`=化学，`biology`=生物，`history`=历史，`geography`=地理，`politics`=政治

---

### 3.3 筛选规则保存与复用

#### 3.3.1 功能描述

允许用户保存筛选规则配置，下次直接加载使用。

#### 3.3.2 数据模型设计

**新增模型**: `SavedFilterRule`

```python
# school_management/students_grades/models/filter.py

from django.db import models
from django.conf import settings

class SavedFilterRule(models.Model):
    """用户保存的筛选规则"""
    
    RULE_TYPE_CHOICES = [
        ('simple', '简单筛选'),
        ('advanced', '高级筛选'),
    ]
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='saved_filter_rules',
        verbose_name='所属用户'
    )
    
    name = models.CharField(
        max_length=100,
        verbose_name='规则名称',
        help_text='如"数学培优班名单"'
    )
    
    rule_type = models.CharField(
        max_length=20,
        choices=RULE_TYPE_CHOICES,
        default='simple',
        verbose_name='规则类型'
    )
    
    # 规则配置（JSON格式）
    rule_config = models.JSONField(
        verbose_name='规则配置',
        help_text='''
        示例:
        {
            "logic": "AND",
            "conditions": [
                {"subject": "total", "dimension": "grade", "operator": "top_n", "value": 50},
                {"subject": "math", "dimension": "grade", "operator": "top_n", "value": 30}
            ]
        }
        '''
    )
    
    # 使用统计
    usage_count = models.IntegerField(
        default=0,
        verbose_name='使用次数'
    )
    
    last_used_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='最后使用时间'
    )
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        db_table = 'saved_filter_rules'
        ordering = ['-last_used_at', '-created_at']
        verbose_name = '保存的筛选规则'
        verbose_name_plural = verbose_name
    
    def __str__(self):
        return f"{self.user.username} - {self.name}"
```

#### 3.3.3 API 设计

**1. 保存规则**: `POST /api/filter-rules/`

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

**2. 获取用户规则列表**: `GET /api/filter-rules/`

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
    // ...
  ]
}
```

**3. 加载规则详情**: `GET /api/filter-rules/{id}/`

**4. 更新规则**: `PUT /api/filter-rules/{id}/`

**5. 删除规则**: `DELETE /api/filter-rules/{id}/`

---

### 3.4 目标生变化追踪

#### 3.4.1 功能描述

基于已保存的筛选结果快照进行对比，显示目标生名单的新增、退出、保留与排名变化。

#### 3.4.2 界面设计

```
┌─────────────────────────────────────────────────────────────┐
│  目标生变化追踪                                              │
├─────────────────────────────────────────────────────────────┤
│  对比设置                                                   │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ 基准快照: [期中考试-数学培优班(2026-04-15) ▼]           │ │
│  │ 对比快照: [期末考试-数学培优班(2026-06-25) ▼]           │ │
│  │                                                         │ │
│  │ [开始对比]                                              │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  变化概览                                                   │
│  ┌──────────┬──────────┬──────────┐                         │
│  │ 新增学生 │ 保留学生 │ 退出学生 │                         │
│  │    5     │    23    │    5     │                         │
│  └──────────┴──────────┴──────────┘                         │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  详细名单                                                   │
│                                                             │
│  🟢 新增学生（5人）                                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 学号  │ 姓名 │ 班级    │ 期中排名 │ 期末排名 │ 变化   │  │
│  │ 24025 │ 王五 │ 初二(2) │ 第52名  │ 第18名  │ ↑34   │  │
│  │ 24033 │ 赵六 │ 初二(4) │ 第48名  │ 第25名  │ ↑23   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  🔵 保留学生（23人）                                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 学号  │ 姓名 │ 班级    │ 期中排名 │ 期末排名 │ 变化   │  │
│  │ 24001 │ 张三 │ 初二(1) │ 第3名   │ 第5名   │ ↓2    │  │
│  │ 24015 │ 李四 │ 初二(3) │ 第12名  │ 第8名   │ ↑4    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  🔴 退出学生（5人）                                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 学号  │ 姓名 │ 班级    │ 期中排名 │ 期末排名 │ 变化   │  │
│  │ 24028 │ 孙七 │ 初二(2) │ 第35名  │ 第58名  │ ↓23   │  │
│  │ 24041 │ 周八 │ 初二(5) │ 第42名  │ 第63名  │ ↓21   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  [导出对比报告]                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 3.4.3 数据模型设计

**新增模型**: `FilterResultSnapshot`

```python
# school_management/students_grades/models/filter.py

class FilterResultSnapshot(models.Model):
    """筛选结果快照"""
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='filter_snapshots',
        verbose_name='所属用户'
    )
    
    exam = models.ForeignKey(
        'Exam',
        on_delete=models.CASCADE,
        related_name='filter_snapshots',
        verbose_name='关联考试'
    )
    
    rule = models.ForeignKey(
        'SavedFilterRule',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='snapshots',
        verbose_name='使用的规则'
    )
    
    # 规则配置快照（防止规则被修改后历史数据丢失）
    rule_config_snapshot = models.JSONField(
        verbose_name='规则配置快照'
    )
    
    # 筛选结果快照
    result_snapshot = models.JSONField(
        verbose_name='筛选结果快照',
        help_text='''
        示例:
        {
            "student_ids": [1, 5, 12, 23, ...],
            "count": 28,
            "created_at": "2026-03-30T14:30:00Z"
        }
        '''
    )
    
    snapshot_name = models.CharField(
        max_length=100,
        verbose_name='快照名称',
        help_text='如"期中考试-数学培优班"'
    )
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    
    class Meta:
        db_table = 'filter_result_snapshots'
        ordering = ['-created_at']
        verbose_name = '筛选结果快照'
        verbose_name_plural = verbose_name
    
    def __str__(self):
        return f"{self.snapshot_name} - {self.created_at.strftime('%Y-%m-%d')}"
```

#### 3.4.4 对比算法逻辑

```python
# school_management/students_grades/services/filter_comparison.py

from typing import Dict, List, Set
from ..models import FilterResultSnapshot

class FilterComparisonService:
    """筛选结果对比服务"""
    
    @staticmethod
    def compare_snapshots(
        baseline_snapshot: FilterResultSnapshot,
        comparison_snapshot: FilterResultSnapshot
    ) -> Dict:
        """
        对比两个快照的差异
        
        返回:
        {
            "added": [新增学生ID列表],
            "removed": [退出学生ID列表],
            "retained": [保留学生ID列表],
            "rank_changes": {
                student_id: {
                    "old_rank": 35,
                    "new_rank": 18,
                    "change": 17  # 正数表示进步，负数表示退步
                }
            }
        }
        """
        baseline_ids = set(baseline_snapshot.result_snapshot['student_ids'])
        comparison_ids = set(comparison_snapshot.result_snapshot['student_ids'])
        
        added = list(comparison_ids - baseline_ids)
        removed = list(baseline_ids - comparison_ids)
        retained = list(baseline_ids & comparison_ids)
        
        # 计算保留学生的排名变化
        rank_changes = {}
        # 需要查询两次考试的排名数据
        # 实现细节见后续开发
        
        return {
            "added": added,
            "removed": removed,
            "retained": retained,
            "rank_changes": rank_changes,
            "summary": {
                "added_count": len(added),
                "removed_count": len(removed),
                "retained_count": len(retained),
                "total_baseline": len(baseline_ids),
                "total_comparison": len(comparison_ids)
            }
        }
```

#### 3.4.5 API 设计

**1. 保存筛选结果快照**: `POST /api/filter-snapshots/`

```json
{
  "exam_id": 42,
  "rule_id": 1,  // 可选
  "snapshot_name": "期中考试-数学培优班",
  "result_snapshot": {
    "student_ids": [1, 5, 12, 23, 42],
    "count": 5
  }
}
```

**2. 对比两个快照**: `POST /api/filter-snapshots/compare/`

```json
{
  "baseline_snapshot_id": 10,
  "comparison_snapshot_id": 15
}
```

**响应**:
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
    "removed": [...],
    "retained": [...]
  },
  "summary": {
    "added_count": 5,
    "removed_count": 5,
    "retained_count": 23,
    "retention_rate": "82.14%"
  }
}
```

---

## 4. 非功能需求

### 4.1 性能要求

| 指标 | 目标值 | 说明 |
|------|--------|------|
| 筛选响应时间 | < 2秒 | 1000名学生以内 |
| 规则保存时间 | < 500ms | 含数据库写入 |
| 快照对比时间 | < 1秒 | 两个快照各100学生 |
| 并发用户数 | ≥ 50 | 同时筛选不卡顿 |

### 4.2 安全要求

- 用户只能查看和使用自己保存的规则
- 快照数据归属用户，其他用户不可见
- 敏感操作（删除规则）需要二次确认

### 4.3 兼容性要求

- 前端兼容 Chrome 90+, Edge 90+, Safari 14+
- 移动端适配：支持手机浏览器查看筛选结果

---

## 5. 技术方案要点

### 5.1 后端实现

#### 5.1.1 多条件组合筛选算法

```python
# school_management/students_grades/services/advanced_filter.py

from typing import List, Dict, Set
from ..models import ExamScore, Exam

class AdvancedFilterService:
    """高级筛选服务"""
    
    @staticmethod
    def apply_filter(
        exam_id: int,
        logic: str,  # "AND" or "OR"
        conditions: List[Dict],
        class_id: int = None
    ) -> List[int]:
        """
        应用多条件筛选
        
        参数:
            exam_id: 考试ID
            logic: 逻辑关系 "AND" 或 "OR"
            conditions: 条件列表
                [
                    {"subject": "math", "dimension": "grade", "operator": "top_n", "value": 30},
                    ...
                ]
            class_id: 可选，筛选特定班级
        
        返回:
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
            final_result = set.intersection(*condition_results)
        else:  # OR
            final_result = set.union(*condition_results)
        
        # 如果指定了班级，再筛选一次
        if class_id:
            from ..models import Student
            class_student_ids = set(
                Student.objects.filter(
                    current_class_id=class_id
                ).values_list('id', flat=True)
            )
            final_result = final_result & class_student_ids
        
        return list(final_result)
    
    @staticmethod
    def _apply_single_condition(exam: Exam, condition: Dict) -> List[int]:
        """应用单个筛选条件"""
        
        subject = condition['subject']  # "total", "math", "chinese", ...
        dimension = condition['dimension']  # "grade" or "class"
        operator = condition['operator']  # "top_n", "bottom_n", "range"
        value = condition['value']
        
        # 构建查询
        queryset = ExamScore.objects.filter(exam=exam)
        
        if subject == "total":
            # 总分筛选
            rank_field = 'rank_in_grade' if dimension == 'grade' else 'rank_in_class'
        else:
            # 单科筛选
            rank_field = f'{subject}_rank_in_grade' if dimension == 'grade' else f'{subject}_rank_in_class'
        
        if operator == "top_n":
            queryset = queryset.filter(**{f"{rank_field}__lte": value})
        elif operator == "bottom_n":
            # 需要先查询总人数
            total_count = queryset.count()
            queryset = queryset.filter(**{f"{rank_field}__gte": total_count - value + 1})
        elif operator == "range":
            # N名到M名
            start, end = value  # value 是 [N, M]
            queryset = queryset.filter(**{f"{rank_field}__range": [start, end]})
        
        return list(queryset.values_list('student_id', flat=True))
```

#### 5.1.2 性能优化

- 使用 `select_related` 和 `prefetch_related` 减少 N+1 查询
- 对常用筛选字段建立数据库索引
- 考虑使用 Redis 缓存热点筛选结果

#### 5.1.3 DRF 实现约束（必须遵循）

为避免第二期落地时出现路由、权限和序列化偏差，后端实现需统一遵循以下约束：

1. 路由注册约束
  - `ListCreateAPIView` / `RetrieveUpdateDestroyAPIView` 不通过 `router.register` 注册。
  - 使用 `path()` 显式挂载，例如：
    - `path('api/filter-rules/', FilterRuleListView.as_view())`
    - `path('api/filter-rules/<int:id>/', FilterRuleDetailView.as_view())`
    - `path('api/filter-snapshots/', FilterSnapshotListView.as_view())`
    - `path('api/filter-snapshots/<int:id>/', FilterSnapshotDetailView.as_view())`

2. 删除响应约束
  - 不在 `perform_destroy()` 中返回 `Response`。
  - 若需自定义返回体，重写 `destroy()` 并在其中返回响应；`perform_destroy()` 仅负责删除动作。

3. 序列化字段映射约束
  - 快照相关序列化器中，`exam_id`、`rule_id` 必须显式声明映射，避免与模型字段错位。
  - 建议写法：
    - `exam_id = serializers.PrimaryKeyRelatedField(source='exam', queryset=Exam.objects.all(), write_only=True)`
    - `rule_id = serializers.PrimaryKeyRelatedField(source='rule', queryset=SavedFilterRule.objects.all(), required=False, allow_null=True, write_only=True)`
  - 同时返回只读展示字段：`exam_name`、`rule_name`、`student_count`。

4. 写操作权限约束
  - 所有写入型接口（`POST` / `PUT` / `PATCH` / `DELETE`）必须走统一权限分支，禁止回落为“仅登录即可写”。
  - 若采用 ViewSet + `@action`，在 `get_permissions()` 中必须覆盖所有写 action。
  - 规则与快照对象级访问必须限定为“仅本人可读写删”。

5. 验收口径
  - 路由层：无 `router.register(ListCreateAPIView)` 误用。
  - 删除接口：删除成功返回体由 `destroy()` 统一输出。
  - 序列化层：`exam_id/rule_id` 写入与 `exam_name/rule_name` 展示字段同时可用。
  - 权限层：写接口在非授权角色下稳定返回 403。

---

### 5.2 前端实现

#### 5.2.1 组件结构

```
frontend/
└── src/
  └── app/
    └── target-students/
      ├── page.tsx              # 第一期：简单筛选页面（保持不变）
      ├── advanced/             # 新增 1/3：高级筛选
      │   ├── page.tsx         # 高级筛选主页面
      │   ├── components/
      │   │   ├── FilterBuilder.tsx  # 筛选条件构建器
      │   │   ├── FilterResults.tsx  # 筛选结果展示
      │   │   ├── RuleSelector.tsx   # 规则选择器（下拉框）
      │   └── hooks/
      │       ├── useFilterRules.ts  # 规则管理 Hook
      │       └── useFilter.ts       # 筛选逻辑 Hook
      ├── rules/                # 新增 2/3：我的规则
      │   ├── page.tsx         # 规则管理主页面
      │   └── components/
      │       ├── RuleList.tsx      # 规则列表
      │       └── RuleEditor.tsx    # 规则编辑对话框（与高级筛选共用）
      └── tracking/             # 新增 3/3：变化追踪
        ├── page.tsx         # 快照管理和对比主页面
        └── components/
          ├── SnapshotList.tsx   # 快照列表
          ├── ComparisonResult.tsx # 对比结果展示
          └── ReportExporter.tsx   # 报告导出
```

#### 5.2.2 关键组件示例

**FilterBuilder.tsx** (筛选条件构建器):

```tsx
'use client';

import { useState } from 'react';
import { Button, Select, InputNumber, Radio, Space, Card } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';

interface Condition {
  id: string;
  subject: string;
  dimension: 'grade' | 'class';
  operator: 'top_n' | 'bottom_n' | 'range';
  value: number | [number, number];
}

interface FilterBuilderProps {
  onFilter: (logic: 'AND' | 'OR', conditions: Condition[]) => void;
}

export default function FilterBuilder({ onFilter }: FilterBuilderProps) {
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [logic, setLogic] = useState<'AND' | 'OR'>('AND');
  
  const addCondition = () => {
    const newCondition: Condition = {
      id: Date.now().toString(),
      subject: 'total',
      dimension: 'grade',
      operator: 'top_n',
      value: 50,
    };
    setConditions([...conditions, newCondition]);
  };
  
  const removeCondition = (id: string) => {
    setConditions(conditions.filter(c => c.id !== id));
  };
  
  const updateCondition = (id: string, updates: Partial<Condition>) => {
    setConditions(conditions.map(c => 
      c.id === id ? { ...c, ...updates } : c
    ));
  };
  
  const handleFilter = () => {
    onFilter(logic, conditions);
  };
  
  return (
    <Card title="筛选条件">
      <Space direction="vertical" style={{ width: '100%' }}>
        {conditions.map((condition) => (
          <div key={condition.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Select
              value={condition.subject}
              onChange={(v) => updateCondition(condition.id, { subject: v })}
              style={{ width: 120 }}
              options={[
                { label: '总分', value: 'total' },
                { label: '语文', value: 'chinese' },
                { label: '数学', value: 'math' },
                { label: '英语', value: 'english' },
                // ... 其他学科
              ]}
            />
            
            <Select
              value={condition.dimension}
              onChange={(v) => updateCondition(condition.id, { dimension: v })}
              style={{ width: 120 }}
              options={[
                { label: '年级排名', value: 'grade' },
                { label: '班级排名', value: 'class' },
              ]}
            />
            
            <Select
              value={condition.operator}
              onChange={(v) => updateCondition(condition.id, { operator: v })}
              style={{ width: 100 }}
              options={[
                { label: '前N名', value: 'top_n' },
                { label: '后N名', value: 'bottom_n' },
                { label: 'N-M名', value: 'range' },
              ]}
            />
            
            <InputNumber
              value={condition.value as number}
              onChange={(v) => updateCondition(condition.id, { value: v || 0 })}
              min={1}
              style={{ width: 80 }}
            />
            
            <Button
              icon={<DeleteOutlined />}
              danger
              onClick={() => removeCondition(condition.id)}
            />
          </div>
        ))}
        
        <Button icon={<PlusOutlined />} onClick={addCondition}>
          添加条件
        </Button>
        
        {conditions.length > 1 && (
          <Radio.Group value={logic} onChange={(e) => setLogic(e.target.value)}>
            <Radio value="AND">同时满足（AND）</Radio>
            <Radio value="OR">满足任一（OR）</Radio>
          </Radio.Group>
        )}
        
        <Button type="primary" onClick={handleFilter} disabled={conditions.length === 0}>
          开始筛选
        </Button>
      </Space>
    </Card>
  );
}
```

---

## 6. 测试计划

### 6.1 单元测试

| 测试项 | 测试内容 | 覆盖率目标 |
|--------|---------|-----------|
| 筛选算法 | AND/OR 逻辑正确性 | ≥ 90% |
| 条件解析 | 各种条件组合 | ≥ 85% |
| 规则保存 | CRUD 操作 | ≥ 95% |
| 快照对比 | 变化计算准确性 | ≥ 90% |

### 6.2 集成测试

| 测试场景 | 测试步骤 | 预期结果 |
|---------|---------|---------|
| 多条件筛选 | 1. 添加2个条件<br>2. 选择AND逻辑<br>3. 筛选 | 返回交集结果 |
| 规则保存与加载 | 1. 配置筛选规则<br>2. 保存<br>3. 刷新页面<br>4. 加载规则 | 规则配置正确恢复 |
| 快照对比 | 1. 创建两个快照<br>2. 对比 | 变化统计准确 |

### 6.3 性能测试

- 模拟 500 学生 × 10 科目 × 5 次考试的数据量
- 测试筛选响应时间 < 2秒
- 测试并发 50 用户筛选，无阻塞

---

## 7. 上线计划

### 7.1 开发阶段

| 阶段 | 内容 | 时间 | 负责人 |
|------|------|------|--------|
| **阶段1** | 后端模型 + API 开发 | 3天 | 后端开发 |
| **阶段2** | 前端组件开发 | 4天 | 前端开发 |
| **阶段3** | 集成测试 + Bug修复 | 2天 | 全栈开发 |
| **阶段4** | 文档编写 + 部署 | 1天 | DevOps |

### 7.2 上线前检查清单

- [ ] 所有单元测试通过
- [ ] 集成测试通过
- [ ] 性能测试达标
- [ ] 代码 Review 完成
- [ ] 文档更新完成
- [ ] 数据库迁移脚本准备就绪
- [ ] 回滚方案准备就绪

### 7.3 回滚方案

1. **数据库回滚**:
   - 保留迁移脚本 `reverse_migration.py`
   - 删除新增的两张表

2. **代码回滚**:
   - Git revert 到上线前的 commit
   - 重新部署上一版本

---

## 8. 风险评估

| 风险 | 概率 | 影响 | 应对措施 |
|------|------|------|---------|
| 筛选算法性能不达标 | 中 | 高 | 增加数据库索引、引入 Redis 缓存 |
| 用户不理解 AND/OR 逻辑 | 高 | 中 | 提供使用示例、增加操作指引 |
| 快照数据占用存储过大 | 低 | 低 | 定期清理超过 6 个月的快照 |
| 规则配置复杂度高 | 中 | 中 | 提供规则模板、简化界面 |

---

## 9. 成功指标

上线后 1 个月，评估以下指标：

| 指标 | 目标值 | 数据来源 |
|------|--------|---------|
| 平均筛选操作时间 | < 3 分钟 | 用户行为日志 |
| 保存规则使用率 | ≥ 60% | 规则调用统计 |
| 快照对比功能使用次数 | ≥ 50 次/月 | 功能调用日志 |
| 用户满意度 | ≥ 4.5/5.0 | 用户反馈问卷 |

---

## 10. 附录

### 10.1 名词解释

- **目标生**: 学校重点培养的优秀学生，通常指年级排名前一定比例的学生
- **筛选规则**: 一组筛选条件的集合，可保存复用
- **快照**: 某次筛选结果的保存版本，用于历史对比

### 10.2 参考文档

- [目标生筛选系统第一期 PRD](./目标生筛选功能设计.md)
- [Django ORM 查询优化指南](https://docs.djangoproject.com/en/5.2/topics/db/optimization/)
- [Ant Design 表单组件文档](https://ant.design/components/form-cn/)

---

**文档修订历史**:

| 版本 | 日期 | 修订人 | 修订内容 |
|------|------|--------|---------|
| v1.0 | 2026-03-31 | AI Assistant | 初始版本 |
| v1.1 | 2026-03-31 | AI Assistant | 新增 3.0 节界面架构设计，明确第一、二期分离方案 |
| v1.2 | 2026-04-01 | AI Assistant | 重构 3.2 节：学科排名不再独立，改为多条件构建器的条件类型；同步更新 US-02 描述 |
| v1.3 | 2026-04-01 | AI Assistant | 完整重构信息架构：新增独立的"我的规则"和"变化追踪"页面；新增 1.4 节明确 3 个核心新增功能；更新路由、菜单、组件结构 |
| v1.4 | 2026-04-01 | AI Assistant | 修正章节编号：3.0.6.1/3.0.6.2 改为 3.0.7/3.0.8，与高级筛选页并列；原 3.0.7/3.0.8 顺延至 3.0.9/3.0.10 |
| v1.5 | 2026-04-01 | AI Assistant | 同步现网口径：规则列表响应改为分页 results 结构；3.4 变化追踪改为“基于快照选择对比”描述 |
| v1.6 | 2026-04-01 | AI Assistant | 新增 5.1.3 DRF 实现约束：显式 path 挂载、destroy 返回规范、exam_id/rule_id 显式映射、写操作权限统一收紧 |

---

**审批签字**:

- 产品负责人: ________________  日期: ______
- 技术负责人: ________________  日期: ______
- 项目经理: ________________  日期: ______



# 去卡片化 + 自适应区块布局

把 Playground 从"卡片堆叠"改造为"密度优先的工作台"：去掉每个区块的边框/标题栏/内边距，改用极简的标签 + 分隔线；区块之间用可拖拽的分隔条调整大小，区块内部组件用 `ResizeObserver` 监听容器尺寸，实时把宽高传给图表/表格，做到拉伸时所有元素自适应。

## 视觉变化

之前（卡片化）：

```text
┌─ ╔══ reward-curve ══════════════╗ ──┐
│  ║ Mean reward per step          ║  │
│  ╠═══════════════════════════════╣  │
│  ║   [chart]                     ║  │
│  ╚═══════════════════════════════╝  │
└─────────────────────────────────────┘
```

之后（去卡片化）：

```text
reward-curve · mean reward per step               ⋮
─────────────────────────────────────────────────────
  [chart fills 100% width × current height]
─────────────────────────────────────────────────────
↕ drag to resize
```

- 没有圆角边框、没有 padding、没有阴影
- 只有一行 mono 小标题 + 一根 1px 分隔线
- 区块之间用可拖拽 splitter（横向 + 纵向）

## 三个核心改动

### 1. 新增 `ResizableBlock`（替代 `ModuleCard`）

```tsx
<ResizableBlock title="reward-curve" subtitle="Mean reward per step">
  {({ width, height }) => <RewardCurve width={width} height={height} />}
</ResizableBlock>
```

特性：
- **render-prop 传 size**：内部用 `ResizeObserver` 监听容器，把 `{width, height}` 实时传给子组件，拉伸时图表立刻 reflow
- **无边框无 padding**：仅 `border-b` 分隔标题与内容
- **collapse 按钮**：标题右侧一个小三角，折叠后只剩一行
- **垂直 resize handle**：底部一根 4px 高的可拖拽条（鼠标变 `ns-resize`）
- 高度状态写入 `localStorage`（key: `rlboard:h:${id}`），刷新保留

### 2. 区块间用 `react-resizable-panels` 做 splitter

把 metrics 三列、diagnostics 两列、以及 sections 之间的间距改成真正的 panel group：

```tsx
<PanelGroup direction="horizontal">
  <Panel defaultSize={33}><RewardCurveBlock /></Panel>
  <PanelResizeHandle />
  <Panel defaultSize={33}><RewardDistBlock /></Panel>
  <PanelResizeHandle />
  <Panel defaultSize={34}><RewardDeltaBlock /></Panel>
</PanelGroup>
```

依赖已经在 `src/components/ui/resizable.tsx` 就位，直接复用。

Sections 之间也包一个 vertical PanelGroup，让用户可以把 metrics 缩成一条，给 trajectory 让出更多空间。

### 3. 图表/表格组件接受外部 size

当前 `RewardCurve / RewardDistribution / CriticDiagnostic / TokenTable / ResponseTable` 大多固定 `height` prop。改成：

- 同时接受 `width?: number; height?: number`
- 如果传入则用传入值；否则继续 fallback 到自身默认
- 内部 SVG/recharts 用 `ResponsiveContainer` 包一层（或直接用传入 width/height）

`TrajectoryView` 已经是 grid 布局，只需把固定 `360px` 段列宽改为 panel 拖拽。

## 文件改动

**新增**
- `src/components/rlboard/ResizableBlock.tsx` — 替代 ModuleCard 的去卡片化容器（含 ResizeObserver + 折叠 + 高度持久化）

**修改**
- `src/routes/playground.tsx` — 把所有 `ModuleCard` 换成 `ResizableBlock`，metrics/diagnostics 行用 `PanelGroup` 包裹，sections 之间用 vertical `PanelGroup`
- `src/components/rlboard/RewardCurve.tsx`、`RewardDistribution.tsx`、`RewardDeltaDistribution.tsx`、`CriticDiagnostic.tsx`、`ResponseTable.tsx`、`ResponseDiff.tsx` — 接受 `width?` / `height?` props，移除内部固定高度
- `src/components/rlboard/TrajectoryView.tsx` — 左侧 segment list 用 PanelGroup 让用户拖宽
- `src/components/rlboard/index.ts` — 导出 ResizableBlock

**删除/弃用**
- `ModuleCard.tsx` 保留但不再被 playground 使用（modules 路由仍可能用到，不动）

## 兼容性

- 持久化 key 用统一前缀 `rlboard:layout:*`，避免污染
- 折叠/visibility chips 保留（顶部 toolbar 不变）
- 现有响应式断点（`lg:grid-cols-3`）由 PanelGroup 接管，移动端 fallback 成纵向堆叠


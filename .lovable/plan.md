

# 让 token 面板真正显示数值

当前问题：token 块只有颜色和文字，metric 数值（logp / KL / entropy）只藏在 hover tooltip 里 — 用户无法一眼看到具体值，也无法横向比较。色卡传达"高低"，数字传达"多少"，二者都需要。

## 解决方案：三档密度 + 显式数值

在 `TokenPager` 顶部加一个 **density / view-mode 切换**，让用户按需选择信息密度，而不是单一臃肿布局：

```text
[ Compact | Values | Table ]
```

### 1. Compact（默认 · 现状）
保留现在的紧凑彩色 chip，适合快速扫视 1–2k token 的 page。仅微调：
- 鼠标 hover 时在 token 上方弹出**常驻 popover**，显示 `#idx · token · logp · KL · entropy · reward`（多 metric 一次看全，不用切下拉）。

### 2. Values（新增 · 关键修复）
每个 token chip 下方直接渲染当前 metric 的数值，类似：

```text
┌────────┬────────┬────────┐
│ Policy │·gradient│·methods│   ← decoded token
│ -0.81  │ -0.93   │ -1.02  │   ← metric value
└────────┴────────┴────────┘
```

- 数值用 `tabular-nums` 等宽字体 + 3 位小数
- 字号 9–10px，颜色 `--muted-foreground`，避免压过 token 文本
- 自动按 metric 类型选格式：logp/KL → `.3f`，entropy → `.2f`，rank → 整数
- 默认 page size 自动降到 512（防止屏幕过载）

### 3. Table（新增 · 最高密度）
当用户要"逐 token 审计"时切到表格视图：

| # | token | logp | ref_logp | KL | entropy | reward | value |
|---|-------|------|----------|----|---------|--------|-------|
| 0 | Policy | −0.81 | −0.79 | 0.02 | 1.41 | 0.00 | 0.12 |
| 1 | ·gradient | −0.93 | −0.88 | 0.05 | 1.32 | 0.00 | 0.15 |

- 所有可用 metric 同时成列（不再需要切下拉）
- 行级 mini bar 背景：每个数值单元格用 `linear-gradient` 画出归一化条，保留色觉同时给出数字
- 虚拟滚动（复用 `@tanstack/react-virtual`）支持整 page
- 列可点击排序：快速跳到 max KL / min logp 的 token
- 行点击 → 高亮在上方 minimap 中的位置

## 额外通用增强（三个视图共享）

1. **Hover popover（替换 tooltip）**：原生 `title` 属性在颜色块上几乎不可读。改用轻量自绘 popover，多 metric 一次显示，并显示 `z-score`（这个值在分布中多极端）。
2. **Minimap 上的数值刻度**：在右上角的 `range [a, b]` 旁补一个 5 档色阶图例 + 对应数值，让色 → 值映射可解释。
3. **Token chip 自适应缩放**：当数值显示开启时，chip 宽度按"max(token width, value width)"撑开，避免错位。

## 文件改动

**修改**
- `src/components/rlboard/TokenPager.tsx` — 加 view-mode 切换 + Compact/Values/Table 分支渲染 + 色阶图例
- `src/components/rlboard/TokenInline.tsx` — 同步 Values 模式（trajectory segment 详情用得到）
- `src/components/rlboard/SegmentDetail.tsx` — 把新 view-mode 透传给内嵌的 TokenPager

**新增**
- `src/components/rlboard/TokenTable.tsx` — Table 视图（虚拟滚动 + 全 metric 列 + mini bar）
- `src/components/rlboard/TokenHoverCard.tsx` — 多 metric 悬浮卡（替代原生 title）

**不动**：worker、aggregate、schema、sample —— 纯 UI 层增强。

## 默认行为
- 首次进入：`Compact` 视图（保留熟悉感）
- Page size ≤ 512 自动建议 `Values`
- Page size ≤ 128 自动建议 `Table`
- 选择被记忆在 `useRLBoard` context，跨 segment 切换不丢失




# Agentic RL — Trajectory 分区块可视化

参考 Langfuse 的 trace/span 视图，把单条 rollout 从"一串扁平 token"重新理解为"一条 agentic 轨迹 = 若干有语义的 segment(step/turn/tool-call/think/answer)"，左侧列 trajectory 时间线，右侧展示被选中 segment 的 token 级细节(logp / KL / entropy / reward …)。

---

## 一、数据模型扩展(向后兼容)

`src/lib/rlboard/schema.ts` 新增可选字段:

```ts
export interface TrajectorySegment {
  id: string;
  kind: "user" | "assistant" | "think" | "tool_call" | "tool_result" | "observation" | "answer" | "system";
  label?: string;           // e.g. "search(...)" / "turn 2"
  start: number;            // token index inclusive
  end: number;              // token index exclusive
  tool?: string;            // tool name for tool_call
  reward?: number;          // segment-level reward (if assigned)
  metadata?: Record<string, unknown>;
}

export interface RLBoardRecord {
  // ...existing
  segments?: TrajectorySegment[];   // NEW — optional
}
```

Auto-derivation(当 jsonl 未提供 `segments`): 从 `response_tokens` 里扫描常见 chat 标记 (`<|im_start|>role`, `<think>...</think>`, `<tool_call>...</tool_call>`, `<tool_response>...</tool_response>`, `assistant` / `user` 边界) 生成 segments —— 函数 `deriveSegments(record)` 放在新文件 `src/lib/rlboard/segments.ts`。

---

## 二、新模块

### 1. `SegmentAggregates` (`src/lib/rlboard/segments.ts`)
纯函数，对每个 segment 计算:
- `mean_logp`, `mean_ref_logp`, `sum_kl`, `mean_kl`
- `mean_entropy`, `mean_value`, `sum_token_reward`
- `length` (tokens)

Web Worker 友好，只读 `Float32Array` 风格的切片。

### 2. `TrajectoryTimeline` (`src/components/rlboard/TrajectoryTimeline.tsx`)
Langfuse 风格的左侧栏:

```text
┌ trajectory ──────────────────────────────────┐
│ ▸ user          · 42 tok                     │
│ ▾ assistant     · 1 284 tok                  │
│   • think       ████░░░░  KL 0.12  H 1.4     │
│   • tool_call   █░░░░░░░  search(...)        │
│   • tool_result ██░░░░░░  230 tok            │
│   • answer      ██████░░  r +0.85  KL 0.08   │
│ ▸ user                                       │
│ ▾ assistant                                  │
│   ...                                        │
└──────────────────────────────────────────────┘
```

每行:
- 色条宽度 = segment token 长度(log-scale 可选)
- 色条颜色 = 选中 metric (KL / logp / reward / entropy) 的 segment 均值 → 复用 `heatColor`
- 右侧小徽标显示关键数值
- `kind` 用图标 + 颜色区分(think/tool/answer/user)
- 点击选中 → 驱动右侧详情
- 支持折叠(按 turn 分组)、按 kind 过滤、按 metric 排序

虚拟滚动(基于 index 窗口)保证数千 segment 也流畅。

### 3. `SegmentDetail` (`src/components/rlboard/SegmentDetail.tsx`)
右侧详情面板:
- **Header**: kind badge · token 范围 · 长度 · 关键聚合 (mean KL, Σ reward …)
- **Segment minimap**: 复用 `TokenHeatmap`,但 `range=[segment.start, segment.end]`
- **Tokens**: 复用 `TokenPager` 但 `record` 替换为 segment 视图(token 下标窗口化,内部自动分页；若 segment < pageSize 则不再分页)
- **Curves**: 复用 `TokenCurves` 限定到 segment 范围,支持多 metric 叠加(logp / ref_logp / KL / entropy)
- **Diff**: 若 segment 是 `answer` 且有 ref_response,显示局部 `ResponseDiff`

### 4. `TrajectoryView` (`src/components/rlboard/TrajectoryView.tsx`)
组合容器 —— 左右 `grid-cols-12`:
- `col-span-4`: `TrajectoryTimeline` + 顶部的 metric 选择器 / kind 过滤 chips
- `col-span-8`: `SegmentDetail`(选中的 segment)
- 顶部工具条:metric 切换、按 reward/KL 排序定位、"jump to max KL segment"

256k 性能:
- segment 均值在 `aggregate.worker.ts` 里批量算(一次性,结果缓存)
- timeline 本身是 O(segments),与 token 总数解耦
- 右侧复用已有虚拟化 TokenPager,segment 内部分页仍走现成路径

---

## 三、Playground 集成

`src/routes/playground.tsx` 新增 "Section 3b · Trajectory"(或替换现在的 Section 3):
- 当 `selected.segments` 存在或 `deriveSegments(selected)` 返回 ≥2 段时,默认展示 `TrajectoryView`
- 否则保留原 `TokenPager` 全量视图
- 顶部加一个 toggle: `[ Flat tokens | Trajectory ]`

示例数据 `sample.ts` 追加一个 agentic 样本:多 turn + think + tool_call + answer,确保默认 Sample 按钮就能看到 trajectory 视图。

---

## 四、文件变更清单

**新增**
- `src/lib/rlboard/segments.ts` — 类型、`deriveSegments`、`aggregateSegments`
- `src/components/rlboard/TrajectoryTimeline.tsx`
- `src/components/rlboard/SegmentDetail.tsx`
- `src/components/rlboard/TrajectoryView.tsx`

**修改**
- `src/lib/rlboard/schema.ts` — 加 `segments`、`TrajectorySegment`
- `src/lib/rlboard/sample.ts` — 追加 agentic 示例 record
- `src/lib/rlboard/parse.ts` — 解析 jsonl 时保留 `segments`,无则延迟 derive
- `src/components/rlboard/index.ts` — 导出新组件
- `src/routes/playground.tsx` — 接入 `TrajectoryView` + toggle

不改:`TokenPager` / `TokenHeatmap` / `TokenCurves` / `ResponseDiff` / 现有 worker —— 通过 props(range、record 切片)复用。

---

## 五、交互细节

- **左右联动**:timeline 选中 → 详情滚动到顶;详情里点 minimap → 只在 segment 内跳页;详情里的 token 悬浮高亮同步回 timeline 位置指针
- **Metric 全局**:顶部 metric 选择同时驱动 timeline 色条与右侧 curves,保持一致心智模型
- **快捷定位**:`jump to max |KL|` / `jump to min reward segment` 按钮(agentic debug 常用)
- **键盘**:`j/k` 上下切 segment,`[` / `]` 切 page

---

## 六、可选后续(不在本轮)
- 多 rollout 并排 trajectory 对比(GRPO group 视图)
- 按 tool 名聚合的统计面板
- Export 选中 segment 为独立 jsonl

确认即开始实施。


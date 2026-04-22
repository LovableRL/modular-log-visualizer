

## 目标

把 Playground 从"内置 sample / 合成数据"改成**端到端 jsonl-only 可视化**：所有数据来源唯一 = 一个 `.jsonl` 文件（每行一条 `RLBoardRecord`），没有 sample 按钮，没有合成 stress-test，开箱即用一个真实的 demo jsonl 文件。

## 现状回顾

- `src/lib/rlboard/sample.ts` — 合成数据生成器（押韵 demo + 256k 压测）
- `src/routes/playground.tsx` 默认调用 `makeSampleRecords()` 填充
- 工具栏有 3 个数据源按钮：Upload / Sample / 256k stress-test
- 没有 schema 文档面向用户暴露

## 方案

### 1. 新增 demo jsonl 文件（真实可下载的样例）
- 新建 `public/demo/rlboard-demo.jsonl`，约 60-120 行，覆盖 3-5 个 step、带 `prompt / response / reward / ref_reward / kl / tokens / token_rewards / values / logprobs / ref_logprobs`，让所有图表都能立刻看到效果
- 内容用简单押韵任务（沿用现有语义），但是写成静态 jsonl 而不是运行时生成

### 2. 改造 Playground 数据加载逻辑
- 启动时通过 `fetch("/demo/rlboard-demo.jsonl")` 读 demo 文件，走同一个 `parseJsonl()` 入口
- `source` 显示 `demo/rlboard-demo.jsonl (N records)`，明确告诉用户这是从 jsonl 加载的
- 加载中显示 skeleton；失败显示错误并提示用户上传自己的 jsonl
- 保留 Upload 按钮作为唯一的数据切换入口
- 新增 "Reload demo" 按钮（替代 Sample）和 "Download demo .jsonl" 链接

### 3. 移除合成数据相关代码
- 删除工具栏的 "Sample" 和 "256k stress-test" 按钮
- 删除 `src/lib/rlboard/sample.ts` 的 import 引用
- `sample.ts` 文件本身保留但不再被 playground 引用（其他地方如 docs 页若有引用一并清理）

### 4. 暴露 schema 让用户能对接
- 在工具栏加一个 "Schema" 按钮，点开 popover 展示一行示例 jsonl + 字段说明表格
- 字段表内容直接来自 `src/lib/rlboard/schema.ts`，包含字段名、类型、是否必填、用途（reward 曲线 / token 热力图 / critic 诊断）

### 5. 文件清单

| 操作 | 文件 |
|---|---|
| 新建 | `public/demo/rlboard-demo.jsonl` |
| 修改 | `src/routes/playground.tsx`（启动 fetch demo、删 Sample/256k 按钮、加 Schema popover、加 Download 链接） |
| 检查 | `src/routes/docs.tsx` / `src/routes/index.tsx` 是否引用 `sample.ts`，如有则改成 fetch demo jsonl |
| 保留 | `src/lib/rlboard/sample.ts`（不删，避免影响其他潜在引用，但 playground 不再用） |

## 用户体验流程

```text
打开 /playground
  ↓
自动 fetch /demo/rlboard-demo.jsonl
  ↓
解析后渲染所有图表（reward 曲线 / 分布 / KPI / token 热力图 …）
  ↓
用户可选：
  · 上传自己的 .jsonl 替换
  · 点 Reload demo 回到默认
  · 点 Schema 看字段定义
  · 点 Download 拿走 demo 当模板
```

## 不做的事

- 不引入后端 / 不连数据库（仍是纯前端 + 静态文件，符合"端到端"=一个 jsonl 全栈数据源的定义）
- 不改图表组件本身、不动 KPI / 全局 step 同步逻辑
- 不删 `sample.ts` 物理文件（最小破坏）


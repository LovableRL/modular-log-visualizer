
# RL Logging Board v2 — 模块化可视化工具改造方案

把原来「单文件 Streamlit + 紧耦合可视化」的工具，重构成 **Python 核心库 + Web 前端看板 + Skill 包** 三位一体的体系，每个可视化既能单独使用，又能拼装成完整看板，并原生支持 256k token 长序列。

---

## 一、整体架构

```
rl-logboard/
├── packages/
│   ├── rlboard-core (Python)        # 数据模型 + 加载 + 采样 + 指标
│   ├── rlboard-viz  (Python)        # 单图可视化(matplotlib/plotly),CLI
│   ├── rlboard-skill (skill 包)     # AI/脚本可调用的 visualization skill
│   └── @rlboard/react (npm-ready)   # React 组件库,每个图独立导出
└── apps/
    └── board (TanStack Start)       # 集成看板 demo + 文档 + 上传调试
```

所有层共用同一份 **JSON Schema (`RLBoardRecord`)**,前后端、Python/JS 类型一致。

---

## 二、数据 Schema(扩展兼容)

**保留**原字段:`prompt / response / response_tokens / logprobs / ref_logprobs / values / token_rewards / reward / step / ref_response / ref_reward`。

**新增可选字段**(无则降级):
- `entropy: float[]` — 每 token 熵
- `attention_entropy: float[]`
- `advantages: float[]` — GAE advantage
- `group_id: str` — GRPO/RLOO 同组 rollout 关联
- `prompt_tokens: str[]` — 让 prompt 也支持 token 级可视化
- `metadata: dict` — 任意标签(任务类型、模型、数据源)

文件层面继续支持 `rollout_samples/<run>/*.jsonl`,新增目录扫描 + watch 模式(用于训练中实时刷新)。

---

## 三、可视化模块清单(每个独立 + 可组合)

| 模块 ID | 内容 | 独立形态 | 集成形态 |
|---|---|---|---|
| `reward-curve` | reward / ref_reward 训练曲线 | ✅ | ✅ |
| `reward-distribution` | 每 step 直方图 + 与 ref 差值 | ✅ | ✅ |
| `response-table` | 按 reward / KL / advantage / length 多维排序的样本表 | ✅ | ✅ |
| `token-heatmap` | token × 指标的热力图(支持 256k) | ✅ | ✅ |
| `token-inline` | 内联染色文本(每 token 按指标着色) | ✅ | ✅ |
| `token-curves` | 单条 response 的 logprob/value/reward 多线图 | ✅ | ✅ |
| `kl-explorer` | KL/log_ratio 异常 token 钻取 | ✅ | ✅ |
| `value-vs-reward` | critic value 与 token reward 对比/MSE | ✅ | ✅ |
| `group-compare` | GRPO 同组多 rollout 对比 | ✅ | ✅ |
| `rl-vs-sft-diff` | RL 与 reference 模型的 response/reward 对比 | ✅ | ✅ |

每个模块在三种形态都有对应实现:
- **Python**: `from rlboard_viz import TokenHeatmap; TokenHeatmap(records).render()` → matplotlib/plotly figure
- **CLI/Skill**: `rlboard render token-heatmap --input data.jsonl --step 4 --output heatmap.html`
- **React**: `import { TokenHeatmap } from "@rlboard/react"` → 接 `records` props 渲染

---

## 四、256k Token 长序列方案(双管齐下)

### A. 概览层(Overview)
- **Minimap 热力条**:整条 response 压缩成一条横向热力图(下采样到屏幕宽度,保留 min/max/mean)
- **聚合分桶**:可调 bucket 大小(64/256/1k token),桶内聚合后渲染,瞬时显示全部 256k

### B. 详情层(Drill-down)
- **虚拟滚动**:基于 TanStack Virtual,只渲染视口内 token,256k 也能 60fps 滚动
- **联动**:点击 minimap 任意位置 → 详情视图跳转
- **范围选择**:框选 minimap 一段 → 详情只渲染该段并放大

### C. 性能策略
- Web Worker 中预计算分桶 + 颜色映射,主线程零阻塞
- 数据通过 Float32Array 传递,避免 JSON 巨对象
- Python 侧用 numpy 分桶,CLI 输出静态 HTML(自包含,可分享)

---

## 五、Skill 形态

发布 `rlboard` skill,提供给 AI/脚本调用:
- `rlboard.list_runs(dir)` — 列出所有训练 run
- `rlboard.load(path)` — 加载并标准化数据
- `rlboard.render(module_id, records, **opts)` — 输出 PNG/HTML/JSON
- `rlboard.report(records, modules=[...])` — 一键拼装多模块 HTML 报告(自包含,可邮件/IM 分享)

适用场景:训练完自动生成可视化报告、CI 检查异常 token、AI Agent 分析训练日志。

---

## 六、Web 看板(本次 Lovable 项目主交付)

TanStack Start 应用,作为组件库的 **showcase + 实用工具**:

- **首页**:介绍 + 模块画廊(每个可视化一张卡片,点击进入独立 demo)
- **/playground**:上传 jsonl(或选用内置示例)→ 实时渲染所有模块的完整看板
- **/modules/:id**:每个可视化的独立页(单独嵌入、查看 props、复制代码片段)
- **/docs**:数据 schema、Python 用法、Skill 用法、嵌入指南

界面风格:深色 + 数据密集型(类似 Grafana / Weights & Biases),响应式。

---

## 七、本次实施分阶段

**阶段 1(本轮)** — Web 看板 + 核心可视化模块(React 端)
1. 数据加载层(jsonl 解析、schema 校验、Web Worker 分桶)
2. 模块库 v1:reward-curve、reward-distribution、response-table、token-heatmap(含 minimap+虚拟滚动)、token-inline、token-curves
3. Playground 页(上传/示例数据 → 完整看板)
4. 模块独立页 + 内置押韵任务示例数据
5. 文档页(schema + 嵌入用法)

**阶段 2(后续轮)** — Python `rlboard-core` + `rlboard-viz` + CLI,目录 watch 模式

**阶段 3(后续轮)** — Skill 打包发布、报告生成、GRPO 组对比

---

确认即开始实施阶段 1。

/**
 * Trajectory segmentation for agentic RL rollouts.
 *
 * - `deriveSegments(rec)` scans response_tokens for common chat-template
 *   markers (Qwen/Llama/ChatML, <think>, <tool_call>, <tool_response>) and
 *   returns a list of TrajectorySegment. If the record already provides
 *   `segments`, that takes precedence.
 * - `aggregateSegments(rec, segments)` computes per-segment metric summaries
 *   (mean logp, sum kl, mean entropy, sum token reward, length).
 *
 * Pure functions — safe to call in workers.
 */

import type {
  RLBoardRecord,
  SegmentKind,
  TrajectorySegment,
  TokenMetricKey,
} from "./schema";
import { getTokenMetric, tokenCount } from "./schema";

export interface SegmentAggregate {
  length: number;
  mean_logp: number;
  mean_ref_logp: number;
  sum_kl: number;
  mean_kl: number;
  mean_entropy: number;
  mean_value: number;
  sum_token_reward: number;
}

const EMPTY_AGG: SegmentAggregate = {
  length: 0,
  mean_logp: NaN,
  mean_ref_logp: NaN,
  sum_kl: 0,
  mean_kl: NaN,
  mean_entropy: NaN,
  mean_value: NaN,
  sum_token_reward: 0,
};

function meanSlice(arr: number[] | undefined, s: number, e: number): number {
  if (!arr || e <= s) return NaN;
  let sum = 0, n = 0;
  const end = Math.min(arr.length, e);
  for (let i = s; i < end; i++) {
    const v = arr[i];
    if (Number.isFinite(v)) { sum += v; n++; }
  }
  return n === 0 ? NaN : sum / n;
}

function sumSlice(arr: number[] | undefined, s: number, e: number): number {
  if (!arr || e <= s) return 0;
  let sum = 0;
  const end = Math.min(arr.length, e);
  for (let i = s; i < end; i++) {
    const v = arr[i];
    if (Number.isFinite(v)) sum += v;
  }
  return sum;
}

export function aggregateSegment(
  rec: RLBoardRecord,
  s: number,
  e: number,
): SegmentAggregate {
  if (e <= s) return EMPTY_AGG;
  const kl = getTokenMetric(rec, "kl_per_token");
  return {
    length: e - s,
    mean_logp: meanSlice(rec.logprobs, s, e),
    mean_ref_logp: meanSlice(rec.ref_logprobs, s, e),
    sum_kl: sumSlice(kl, s, e),
    mean_kl: meanSlice(kl, s, e),
    mean_entropy: meanSlice(rec.entropy, s, e),
    mean_value: meanSlice(rec.values, s, e),
    sum_token_reward: sumSlice(rec.token_rewards, s, e),
  };
}

export function aggregateSegments(
  rec: RLBoardRecord,
  segs: TrajectorySegment[],
): Map<string, SegmentAggregate> {
  const out = new Map<string, SegmentAggregate>();
  for (const s of segs) out.set(s.id, aggregateSegment(rec, s.start, s.end));
  return out;
}

/** Pick a numeric value from an aggregate by metric — used for heat coloring. */
export function aggMetric(
  a: SegmentAggregate,
  metric: TokenMetricKey | "reward",
): number {
  switch (metric) {
    case "logprobs": return a.mean_logp;
    case "ref_logprobs": return a.mean_ref_logp;
    case "values": return a.mean_value;
    case "token_rewards": return a.sum_token_reward;
    case "advantages": return NaN; // not aggregated yet
    case "entropy": return a.mean_entropy;
    case "attention_entropy": return NaN;
    case "kl_per_token": return a.mean_kl;
    case "reward": return a.sum_token_reward;
  }
}

// ---------- Auto-derivation from response_tokens ----------

const KIND_COLORS: Record<SegmentKind, string> = {
  system: "var(--muted-foreground)",
  user: "var(--info)",
  assistant: "var(--primary)",
  think: "var(--accent)",
  tool_call: "var(--warning)",
  tool_result: "var(--success)",
  observation: "var(--success)",
  answer: "var(--primary)",
};

export function kindColor(k: SegmentKind): string {
  return KIND_COLORS[k];
}

export function kindIcon(k: SegmentKind): string {
  switch (k) {
    case "system": return "⚙";
    case "user": return "👤";
    case "assistant": return "🤖";
    case "think": return "💭";
    case "tool_call": return "🔧";
    case "tool_result": return "📥";
    case "observation": return "👁";
    case "answer": return "✓";
  }
}

/**
 * Heuristic segmentation. We join tokens into a string with index map, then
 * scan for ChatML / Qwen markers and <think>/<tool_call>/<tool_response>.
 *
 * If no markers found, returns a single "assistant" segment covering the
 * entire response.
 */
export function deriveSegments(rec: RLBoardRecord): TrajectorySegment[] {
  if (rec.segments && rec.segments.length > 0) return rec.segments;
  const tokens = rec.response_tokens;
  const total = tokenCount(rec);
  if (!tokens || tokens.length === 0 || total === 0) return [];

  // Build a sequence of (string, tokenIndex) — we look at joined runs of tokens.
  // For efficiency on 256k, we don't materialize the full text; we walk tokens
  // and scan for marker-token sequences.
  const markers: { idx: number; type: "open" | "close"; kind: SegmentKind; tool?: string; label?: string }[] = [];

  const joined = tokens.map((t) => stripBpePrefix(t));

  for (let i = 0; i < joined.length; i++) {
    const t = joined[i];
    if (!t) continue;

    // ChatML / Qwen role markers: look for "<|im_start|>" then a role token
    if (t.includes("<|im_start|>")) {
      // role often the very next non-whitespace token
      const role = peekRole(joined, i + 1);
      const kind: SegmentKind =
        role === "user" ? "user" :
        role === "system" ? "system" :
        role === "tool" ? "tool_result" :
        "assistant";
      markers.push({ idx: i, type: "open", kind, label: role ?? undefined });
    }
    if (t.includes("<|im_end|>")) {
      markers.push({ idx: i + 1, type: "close", kind: "assistant" });
    }
    // Llama-3 style headers
    if (t.includes("<|start_header_id|>")) {
      const role = peekRole(joined, i + 1);
      const kind: SegmentKind =
        role === "user" ? "user" :
        role === "system" ? "system" :
        role === "tool" ? "tool_result" :
        "assistant";
      markers.push({ idx: i, type: "open", kind, label: role ?? undefined });
    }
    if (t.includes("<|eot_id|>")) {
      markers.push({ idx: i + 1, type: "close", kind: "assistant" });
    }

    // <think>...</think>
    if (containsTag(t, "think")) {
      markers.push({ idx: i, type: "open", kind: "think" });
    }
    if (containsCloseTag(t, "think")) {
      markers.push({ idx: i + 1, type: "close", kind: "think" });
    }

    // <tool_call>...</tool_call>
    if (containsTag(t, "tool_call")) {
      const tool = sniffToolName(joined, i + 1, 30);
      markers.push({ idx: i, type: "open", kind: "tool_call", tool, label: tool });
    }
    if (containsCloseTag(t, "tool_call")) {
      markers.push({ idx: i + 1, type: "close", kind: "tool_call" });
    }

    // <tool_response>...</tool_response>
    if (containsTag(t, "tool_response") || containsTag(t, "tool_result")) {
      markers.push({ idx: i, type: "open", kind: "tool_result" });
    }
    if (containsCloseTag(t, "tool_response") || containsCloseTag(t, "tool_result")) {
      markers.push({ idx: i + 1, type: "close", kind: "tool_result" });
    }
  }

  if (markers.length === 0) {
    return [
      {
        id: "all",
        kind: "assistant",
        label: "response",
        start: 0,
        end: total,
      },
    ];
  }

  // Convert markers into segments by walking and tracking active stack.
  // Strategy: every marker (open or close) is a boundary. Between boundaries,
  // the segment kind = top of stack (or "assistant" by default).
  const boundaries = Array.from(new Set([0, total, ...markers.map((m) => m.idx)]))
    .filter((i) => i >= 0 && i <= total)
    .sort((a, b) => a - b);

  const stack: { kind: SegmentKind; tool?: string; label?: string }[] = [];
  let mIdx = 0;

  const segs: TrajectorySegment[] = [];
  for (let b = 0; b < boundaries.length - 1; b++) {
    const start = boundaries[b];
    const end = boundaries[b + 1];

    // apply all markers at `start`
    while (mIdx < markers.length && markers[mIdx].idx === start) {
      const m = markers[mIdx++];
      if (m.type === "open") {
        stack.push({ kind: m.kind, tool: m.tool, label: m.label });
      } else {
        // close: pop matching kind from stack top if present
        for (let k = stack.length - 1; k >= 0; k--) {
          if (stack[k].kind === m.kind) {
            stack.splice(k, 1);
            break;
          }
        }
      }
    }
    if (end <= start) continue;
    const top = stack[stack.length - 1] ?? { kind: "assistant" as SegmentKind };
    segs.push({
      id: `${start}-${end}-${top.kind}`,
      kind: top.kind,
      tool: top.tool,
      label: top.label,
      start,
      end,
    });
  }

  // Merge consecutive segments with the same kind+tool+label
  const merged: TrajectorySegment[] = [];
  for (const s of segs) {
    const last = merged[merged.length - 1];
    if (last && last.kind === s.kind && last.tool === s.tool && last.label === s.label) {
      last.end = s.end;
      last.id = `${last.start}-${last.end}-${last.kind}`;
    } else {
      merged.push({ ...s });
    }
  }

  // Drop zero-length, then renumber labels (turn 1, 2 …) for assistant blocks
  let turn = 0;
  for (const s of merged) {
    if (s.kind === "assistant" && !s.label) {
      turn++;
      s.label = `turn ${turn}`;
    }
  }

  return merged.filter((s) => s.end > s.start);
}

// ---- helpers ----

function stripBpePrefix(t: string): string {
  // Qwen/Llama tokens often include leading "Ġ" (space) or "▁"; ChatML markers
  // like "<|im_start|>" are usually emitted as a single token, so we keep them.
  return t.replace(/^Ġ/, "").replace(/^▁/, "");
}

function peekRole(joined: string[], from: number): string | null {
  // skip whitespace-only or empty tokens
  for (let i = from; i < Math.min(joined.length, from + 4); i++) {
    const t = joined[i].trim();
    if (!t) continue;
    if (/^(user|assistant|system|tool)$/i.test(t)) return t.toLowerCase();
    // role might be merged with the marker token
    const m = t.match(/(user|assistant|system|tool)/i);
    if (m) return m[1].toLowerCase();
    return null;
  }
  return null;
}

function containsTag(s: string, tag: string): boolean {
  return s.includes(`<${tag}>`);
}
function containsCloseTag(s: string, tag: string): boolean {
  return s.includes(`</${tag}>`);
}

function sniffToolName(joined: string[], from: number, lookahead: number): string | undefined {
  // Look for `"name": "xxx"` pattern in the next few tokens
  let buf = "";
  for (let i = from; i < Math.min(joined.length, from + lookahead); i++) {
    buf += joined[i];
    const m = buf.match(/"name"\s*:\s*"([^"]+)"/);
    if (m) return m[1];
  }
  return undefined;
}

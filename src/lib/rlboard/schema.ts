/**
 * RL Logging Board — shared data schema.
 * Backward compatible with original RLLoggingBoard jsonl format,
 * with optional extension fields (entropy, advantages, group_id, etc.).
 */

export interface RLBoardRecord {
  // identity
  step: number;
  rollout_id?: string;
  group_id?: string;

  // text
  prompt: string;
  response: string;
  ref_response?: string;

  // tokens (per-token arrays — must align in length with response_tokens)
  prompt_tokens?: string[];
  response_tokens?: string[];
  logprobs?: number[];
  ref_logprobs?: number[];
  values?: number[];
  token_rewards?: number[];
  advantages?: number[];
  entropy?: number[];
  attention_entropy?: number[];

  // scalars
  reward: number;
  ref_reward?: number;
  kl?: number;

  // agentic trajectory segments — optional; auto-derived when missing
  segments?: TrajectorySegment[];

  // freeform
  metadata?: Record<string, unknown>;
}

export type SegmentKind =
  | "system"
  | "user"
  | "assistant"
  | "think"
  | "tool_call"
  | "tool_result"
  | "observation"
  | "answer";

export interface TrajectorySegment {
  id: string;
  kind: SegmentKind;
  label?: string;
  start: number; // inclusive token index
  end: number;   // exclusive token index
  tool?: string;
  reward?: number;
  metadata?: Record<string, unknown>;
}

export type TokenMetricKey =
  | "logprobs"
  | "ref_logprobs"
  | "values"
  | "token_rewards"
  | "advantages"
  | "entropy"
  | "attention_entropy"
  | "kl_per_token";

export const TOKEN_METRIC_LABELS: Record<TokenMetricKey, string> = {
  logprobs: "log p(token)",
  ref_logprobs: "log p_ref(token)",
  values: "Value (V)",
  token_rewards: "Token reward",
  advantages: "Advantage",
  entropy: "Entropy",
  attention_entropy: "Attn entropy",
  kl_per_token: "KL (logp − logp_ref)",
};

export function getTokenMetric(
  rec: RLBoardRecord,
  metric: TokenMetricKey,
): number[] | undefined {
  if (metric === "kl_per_token") {
    if (!rec.logprobs || !rec.ref_logprobs) return undefined;
    const n = Math.min(rec.logprobs.length, rec.ref_logprobs.length);
    const out = new Array(n);
    for (let i = 0; i < n; i++) out[i] = rec.logprobs[i] - rec.ref_logprobs[i];
    return out;
  }
  return rec[metric] as number[] | undefined;
}

export function tokenCount(rec: RLBoardRecord): number {
  if (rec.response_tokens) return rec.response_tokens.length;
  return (
    rec.logprobs?.length ??
    rec.values?.length ??
    rec.token_rewards?.length ??
    0
  );
}

export function availableMetrics(rec: RLBoardRecord): TokenMetricKey[] {
  const out: TokenMetricKey[] = [];
  const keys: TokenMetricKey[] = [
    "logprobs",
    "ref_logprobs",
    "values",
    "token_rewards",
    "advantages",
    "entropy",
    "attention_entropy",
  ];
  for (const k of keys) if (rec[k as keyof RLBoardRecord]) out.push(k);
  if (rec.logprobs && rec.ref_logprobs) out.push("kl_per_token");
  return out;
}

import { useMemo } from "react";
import type { RLBoardRecord, TokenMetricKey, TrajectorySegment } from "@/lib/rlboard/schema";
import { tokenCount } from "@/lib/rlboard/schema";
import { aggregateSegment, kindColor, kindIcon } from "@/lib/rlboard/segments";
import { TokenPager } from "./TokenPager";
import { TokenCurves } from "./TokenCurves";
import { ResponseDiff } from "./ResponseDiff";

/**
 * Right pane of the trajectory view. Shows header summary + minimap +
 * pager + curves + (optional) diff for the selected segment.
 *
 * Implementation note: we build a lightweight "scoped record" by slicing
 * every per-token array to [start, end) and clearing `segments` so child
 * components fall back to flat behavior. Token text is sliced from
 * `response_tokens`, and `response` is reconstructed from those tokens.
 */
export function SegmentDetail({
  record,
  segment,
  metric,
}: {
  record: RLBoardRecord;
  segment: TrajectorySegment;
  metric: TokenMetricKey;
}) {
  const scoped = useMemo(() => sliceRecord(record, segment), [record, segment]);
  const agg = useMemo(
    () => aggregateSegment(record, segment.start, segment.end),
    [record, segment],
  );
  const len = segment.end - segment.start;
  const isAnswer = segment.kind === "answer" || segment.kind === "assistant";
  const showDiff = isAnswer && !!record.ref_response;

  return (
    <div className="flex h-full flex-col">
      {/* header */}
      <div className="border-b border-border p-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span
            className="rounded-full px-2 py-0.5 font-mono text-[11px]"
            style={{
              background: "color-mix(in oklab, " + kindColor(segment.kind) + " 22%, transparent)",
              color: "var(--foreground)",
            }}
          >
            {kindIcon(segment.kind)} {segment.kind}
          </span>
          {segment.label && (
            <span className="font-mono text-xs text-muted-foreground">{segment.label}</span>
          )}
          {segment.tool && (
            <span className="font-mono text-xs text-warning">tool · {segment.tool}</span>
          )}
          <span className="ml-auto font-mono text-[11px] text-muted-foreground">
            tokens [{segment.start.toLocaleString()}–{segment.end.toLocaleString()}) · {len.toLocaleString()}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-[11px] text-muted-foreground sm:grid-cols-4">
          <KV k="mean logp" v={agg.mean_logp} />
          <KV k="mean KL" v={agg.mean_kl} />
          <KV k="Σ KL" v={agg.sum_kl} />
          <KV k="mean H" v={agg.mean_entropy} />
          <KV k="mean V" v={agg.mean_value} />
          <KV k="Σ token reward" v={agg.sum_token_reward} />
        </div>
      </div>

      {/* body */}
      <div className="flex-1 space-y-4 overflow-auto p-3">
        {len === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Empty segment.</p>
        ) : (
          <>
            <TokenPager record={scoped} defaultPageSize={pickPageSize(len)} />
            <div className="rounded-md border border-border bg-background/40 p-3">
              <div className="mb-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                segment curves · {metric}
              </div>
              <TokenCurves record={scoped} height={220} />
            </div>
            {showDiff && (
              <div className="rounded-md border border-border bg-background/40 p-3">
                <div className="mb-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                  rl-vs-ref-text
                </div>
                <ResponseDiff record={record} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: number }) {
  return (
    <div>
      <span className="text-[10px] uppercase tracking-widest">{k}</span>{" "}
      <span className="text-foreground">{Number.isFinite(v) ? v.toFixed(3) : "—"}</span>
    </div>
  );
}

function pickPageSize(len: number): number {
  if (len <= 256) return 256;
  if (len <= 512) return 512;
  if (len <= 2048) return 1024;
  return 2048;
}

function sliceArr<T>(a: T[] | undefined, s: number, e: number): T[] | undefined {
  return a ? a.slice(s, e) : undefined;
}

function sliceRecord(rec: RLBoardRecord, seg: TrajectorySegment): RLBoardRecord {
  const s = Math.max(0, seg.start);
  const e = Math.min(tokenCount(rec), seg.end);
  const tokens = sliceArr(rec.response_tokens, s, e);
  return {
    ...rec,
    response: tokens ? tokens.join("") : rec.response.slice(0, 0),
    response_tokens: tokens,
    logprobs: sliceArr(rec.logprobs, s, e),
    ref_logprobs: sliceArr(rec.ref_logprobs, s, e),
    values: sliceArr(rec.values, s, e),
    token_rewards: sliceArr(rec.token_rewards, s, e),
    advantages: sliceArr(rec.advantages, s, e),
    entropy: sliceArr(rec.entropy, s, e),
    attention_entropy: sliceArr(rec.attention_entropy, s, e),
    segments: undefined,
    metadata: { ...(rec.metadata ?? {}), segment_kind: seg.kind, segment_id: seg.id },
  };
}

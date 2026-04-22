import { useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { RLBoardRecord, TokenMetricKey } from "@/lib/rlboard/schema";
import { TOKEN_METRIC_LABELS } from "@/lib/rlboard/schema";
import {
  aggregateSegments,
  aggMetric,
  deriveSegments,
  kindColor,
  kindIcon,
  type SegmentAggregate,
} from "@/lib/rlboard/segments";
import { heatColor, robustExtent } from "@/lib/rlboard/colors";

export interface TrajectoryTimelineProps {
  record: RLBoardRecord;
  selectedId: string | null;
  onSelect: (id: string) => void;
  metric: TokenMetricKey;
  onMetricChange: (m: TokenMetricKey) => void;
  kindFilter: Set<string>;
  onKindFilterChange: (s: Set<string>) => void;
  height?: number;
}

const SUPPORTED_METRICS: TokenMetricKey[] = [
  "kl_per_token",
  "logprobs",
  "entropy",
  "values",
  "token_rewards",
];

export function TrajectoryTimeline({
  record,
  selectedId,
  onSelect,
  metric,
  onMetricChange,
  kindFilter,
  onKindFilterChange,
}: TrajectoryTimelineProps) {
  const [showColorBy, setShowColorBy] = useState(true);
  const [showKinds, setShowKinds] = useState(true);
  const segments = useMemo(() => deriveSegments(record), [record]);
  const aggregates = useMemo(() => aggregateSegments(record, segments), [record, segments]);

  const allKinds = useMemo(
    () => Array.from(new Set(segments.map((s) => s.kind))),
    [segments],
  );

  const visibleSegments = useMemo(
    () => (kindFilter.size === 0 ? segments : segments.filter((s) => kindFilter.has(s.kind))),
    [segments, kindFilter],
  );

  const metricValues = useMemo(
    () =>
      visibleSegments
        .map((s) => aggMetric(aggregates.get(s.id)!, metric))
        .filter((v) => Number.isFinite(v)),
    [visibleSegments, aggregates, metric],
  );
  const extent = useMemo(() => robustExtent(metricValues, 0.05, 0.95), [metricValues]);

  const maxLen = useMemo(
    () => Math.max(1, ...visibleSegments.map((s) => s.end - s.start)),
    [visibleSegments],
  );

  // Quick jumps
  const jumpMaxKL = () => {
    let best: { id: string; v: number } | null = null;
    for (const s of segments) {
      const v = Math.abs(aggregates.get(s.id)?.mean_kl ?? -Infinity);
      if (Number.isFinite(v) && (!best || v > best.v)) best = { id: s.id, v };
    }
    if (best) onSelect(best.id);
  };
  const jumpMinReward = () => {
    let best: { id: string; v: number } | null = null;
    for (const s of segments) {
      const v = aggregates.get(s.id)?.sum_token_reward ?? Infinity;
      if (Number.isFinite(v) && (!best || v < best.v)) best = { id: s.id, v };
    }
    if (best) onSelect(best.id);
  };

  const toggleKind = (k: string) => {
    const next = new Set(kindFilter);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    onKindFilterChange(next);
  };

  return (
    <div className="flex h-full flex-col">
      {/* toolbar */}
      <div className="space-y-2 border-b border-border p-3">
        <div className="flex items-center gap-2 text-xs">
          <label className="flex items-center gap-1 text-muted-foreground">
            <span>color by</span>
            <select
              value={metric}
              onChange={(e) => onMetricChange(e.target.value as TokenMetricKey)}
              className="rounded border border-border bg-input px-2 py-1 font-mono text-foreground"
            >
              {SUPPORTED_METRICS.map((m) => (
                <option key={m} value={m}>
                  {TOKEN_METRIC_LABELS[m]}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={jumpMaxKL}
            className="ml-auto rounded border border-border px-2 py-1 font-mono text-[11px] hover:bg-secondary"
            title="Jump to segment with largest mean |KL|"
          >
            ↯ max KL
          </button>
          <button
            onClick={jumpMinReward}
            className="rounded border border-border px-2 py-1 font-mono text-[11px] hover:bg-secondary"
            title="Jump to segment with lowest Σ token reward"
          >
            ↓ min r
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            kinds
          </span>
          {allKinds.map((k) => {
            const active = kindFilter.size === 0 || kindFilter.has(k);
            return (
              <button
                key={k}
                onClick={() => toggleKind(k)}
                className="rounded-full border px-2 py-0.5 font-mono text-[10px] transition-colors"
                style={{
                  borderColor: active ? kindColor(k as never) : "var(--border)",
                  color: active ? "var(--foreground)" : "var(--muted-foreground)",
                  background: active
                    ? "color-mix(in oklab, " + kindColor(k as never) + " 18%, transparent)"
                    : "transparent",
                }}
              >
                {kindIcon(k as never)} {k}
              </button>
            );
          })}
          {kindFilter.size > 0 && (
            <button
              onClick={() => onKindFilterChange(new Set())}
              className="ml-1 text-[10px] text-muted-foreground underline hover:text-foreground"
            >
              all
            </button>
          )}
        </div>
      </div>

      {/* list */}
      <div className="flex-1 overflow-auto" style={{ maxHeight: height }}>
        <ul className="divide-y divide-border">
          {visibleSegments.map((s) => {
            const a = aggregates.get(s.id) ?? ({} as SegmentAggregate);
            const len = s.end - s.start;
            const widthPct = Math.max(4, (Math.log10(1 + len) / Math.log10(1 + maxLen)) * 100);
            const v = aggMetric(a, metric);
            const color = Number.isFinite(v)
              ? heatColor(v, extent[0], extent[1])
              : "var(--muted)";
            const active = s.id === selectedId;
            return (
              <li key={s.id}>
                <button
                  onClick={() => onSelect(s.id)}
                  className="block w-full px-3 py-2 text-left transition-colors hover:bg-secondary/40"
                  style={{
                    background: active
                      ? "color-mix(in oklab, var(--primary) 12%, transparent)"
                      : undefined,
                    borderLeft: `3px solid ${active ? "var(--primary)" : kindColor(s.kind)}`,
                  }}
                >
                  <div className="flex items-center gap-2 text-xs">
                    <span style={{ color: kindColor(s.kind) }}>
                      {kindIcon(s.kind)} {s.kind}
                    </span>
                    {s.label && (
                      <span className="truncate font-mono text-[11px] text-muted-foreground">
                        · {s.label}
                      </span>
                    )}
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                      {len.toLocaleString()} tok
                    </span>
                  </div>
                  <div className="mt-1 flex h-2 w-full overflow-hidden rounded-sm bg-background/60">
                    <div
                      className="h-full"
                      style={{ width: `${widthPct}%`, background: color }}
                    />
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 font-mono text-[10px] text-muted-foreground">
                    {Number.isFinite(a.mean_kl) && (
                      <span>KL {a.mean_kl.toFixed(3)}</span>
                    )}
                    {Number.isFinite(a.mean_logp) && (
                      <span>logp {a.mean_logp.toFixed(2)}</span>
                    )}
                    {Number.isFinite(a.mean_entropy) && (
                      <span>H {a.mean_entropy.toFixed(2)}</span>
                    )}
                    {a.sum_token_reward !== 0 && (
                      <span>Σr {a.sum_token_reward.toFixed(3)}</span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
          {visibleSegments.length === 0 && (
            <li className="p-4 text-center text-sm text-muted-foreground">
              No segments match the current filter.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

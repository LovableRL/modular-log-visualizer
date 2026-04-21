import { useMemo } from "react";
import type { RLBoardRecord } from "@/lib/rlboard/schema";
import { getTokenMetric, availableMetrics, TOKEN_METRIC_LABELS } from "@/lib/rlboard/schema";

/**
 * Multi-metric hover popover for a single token. Shows all available
 * metrics at once + a z-score against the page distribution so users can
 * quickly tell how extreme the value is.
 */
export function TokenHoverCard({
  record,
  index,
  rawToken,
  decoded,
  pageStats,
}: {
  record: RLBoardRecord;
  index: number;        // absolute token index in the record
  rawToken: string;
  decoded: string;
  pageStats?: Partial<Record<string, { mean: number; std: number }>>;
}) {
  const metrics = useMemo(() => availableMetrics(record), [record]);
  const rows = metrics.map((m) => {
    const arr = getTokenMetric(record, m);
    const v = arr ? arr[index] : NaN;
    const stat = pageStats?.[m];
    const z = stat && stat.std > 0 ? (v - stat.mean) / stat.std : NaN;
    return { m, label: TOKEN_METRIC_LABELS[m], v, z };
  });

  return (
    <div className="min-w-[260px] space-y-2 rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-lg">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
        <span className="font-mono text-[11px] text-muted-foreground">#{index.toLocaleString()}</span>
        <span className="truncate font-mono text-xs">{decoded || JSON.stringify(rawToken)}</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1 font-mono text-[11px]">
        <span className="text-muted-foreground">metric</span>
        <span className="text-right text-muted-foreground">value</span>
        <span className="text-right text-muted-foreground">z</span>
        {rows.map((r) => (
          <RowLine key={r.m} label={r.label} v={r.v} z={r.z} />
        ))}
      </div>
      <div className="truncate border-t border-border pt-2 font-mono text-[10px] text-muted-foreground">
        raw: {JSON.stringify(rawToken)}
      </div>
    </div>
  );
}

function RowLine({ label, v, z }: { label: string; v: number; z: number }) {
  const extreme = Number.isFinite(z) && Math.abs(z) >= 2;
  return (
    <>
      <span className="truncate">{label}</span>
      <span className="text-right tabular-nums">{Number.isFinite(v) ? v.toFixed(3) : "—"}</span>
      <span
        className="text-right tabular-nums"
        style={{ color: extreme ? "var(--destructive)" : "var(--muted-foreground)" }}
      >
        {Number.isFinite(z) ? z.toFixed(2) : "—"}
      </span>
    </>
  );
}

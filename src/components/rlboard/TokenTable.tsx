import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { RLBoardRecord, TokenMetricKey } from "@/lib/rlboard/schema";
import {
  getTokenMetric,
  availableMetrics,
  TOKEN_METRIC_LABELS,
} from "@/lib/rlboard/schema";
import { robustExtent } from "@/lib/rlboard/colors";
import { decodeTokenForDisplay } from "@/lib/rlboard/tokens";

/**
 * Dense per-token table view — every available metric becomes a column.
 *  - virtualized rows (handle full pages of 8k+)
 *  - sortable columns (click header to sort)
 *  - background mini-bar gradient per cell preserves color signal
 */
export function TokenTable({
  record,
  range,
  height = 420,
  onRowClick,
}: {
  record: RLBoardRecord;
  range: [number, number];
  height?: number;
  onRowClick?: (absoluteIndex: number) => void;
}) {
  const [start, end] = range;
  const metrics = useMemo(() => availableMetrics(record), [record]);

  // pull each metric column once
  const columns = useMemo(
    () =>
      metrics.map((m) => {
        const full = getTokenMetric(record, m) ?? [];
        const slice = full.slice(start, end);
        return { m, label: TOKEN_METRIC_LABELS[m], values: slice, extent: robustExtent(slice) };
      }),
    [record, metrics, start, end],
  );

  const tokensRaw = useMemo(
    () => record.response_tokens?.slice(start, end) ?? [],
    [record, start, end],
  );

  const [sortKey, setSortKey] = useState<TokenMetricKey | "idx">("idx");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const order = useMemo(() => {
    const n = end - start;
    const idx = Array.from({ length: n }, (_, i) => i);
    if (sortKey === "idx") return sortDir === "asc" ? idx : idx.reverse();
    const col = columns.find((c) => c.m === sortKey);
    if (!col) return idx;
    const arr = col.values;
    idx.sort((a, b) => {
      const va = arr[a];
      const vb = arr[b];
      const fa = Number.isFinite(va);
      const fb = Number.isFinite(vb);
      if (!fa && !fb) return 0;
      if (!fa) return 1;
      if (!fb) return -1;
      return sortDir === "asc" ? va - vb : vb - va;
    });
    return idx;
  }, [columns, sortKey, sortDir, end, start]);

  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: order.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 24,
    overscan: 12,
  });

  const headerClick = (k: TokenMetricKey | "idx") => {
    if (sortKey === k) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir(k === "idx" ? "asc" : "desc");
    }
  };

  const headerCell = (label: string, k: TokenMetricKey | "idx", cls = "") => {
    const active = sortKey === k;
    return (
      <button
        onClick={() => headerClick(k)}
        className={`text-left font-mono text-[10px] uppercase tracking-widest ${cls} ${
          active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {label}
        {active && <span className="ml-1">{sortDir === "asc" ? "▲" : "▼"}</span>}
      </button>
    );
  };

  // grid template: idx | token | each metric
  const gridTemplate = `64px minmax(140px,1fr) ${columns.map(() => "minmax(82px, 1fr)").join(" ")}`;

  return (
    <div className="rounded-md border border-border bg-background/40">
      <div
        className="grid items-center border-b border-border bg-background/60 px-2 py-1.5"
        style={{ gridTemplateColumns: gridTemplate, columnGap: 8 }}
      >
        {headerCell("#", "idx", "text-right")}
        {headerCell("token", "idx")}
        {columns.map((c) => (
          <div key={c.m} className="text-right">
            {headerCell(c.label, c.m, "text-right")}
          </div>
        ))}
      </div>
      <div ref={parentRef} className="overflow-auto" style={{ height }}>
        <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative", width: "100%" }}>
          {rowVirtualizer.getVirtualItems().map((vr) => {
            const localIdx = order[vr.index];
            const absoluteIdx = start + localIdx;
            const rawTok = tokensRaw[localIdx] ?? "·";
            const { text } = decodeTokenForDisplay(rawTok);
            const display = text.replace(/\n/g, "↵").replace(/ /g, "·") || "·";
            return (
              <div
                key={vr.key}
                onClick={() => onRowClick?.(absoluteIdx)}
                className="grid cursor-pointer items-center px-2 font-mono text-xs hover:bg-secondary/40"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: vr.size,
                  transform: `translateY(${vr.start}px)`,
                  gridTemplateColumns: gridTemplate,
                  columnGap: 8,
                }}
              >
                <span className="text-right text-[10px] text-muted-foreground tabular-nums">
                  {absoluteIdx.toLocaleString()}
                </span>
                <span className="truncate">{display}</span>
                {columns.map((c) => {
                  const v = c.values[localIdx];
                  const [mn, mx] = c.extent;
                  const t =
                    Number.isFinite(v) && mx > mn
                      ? Math.max(0, Math.min(1, (v - mn) / (mx - mn)))
                      : 0;
                  const pct = (t * 100).toFixed(1);
                  // Bar fills from left in the heat color, transparent rest.
                  const bg = `linear-gradient(to right, color-mix(in oklab, var(--heat-${Math.min(
                    5,
                    Math.floor(t * 6),
                  )}) 70%, transparent) ${pct}%, transparent ${pct}%)`;
                  return (
                    <span
                      key={c.m}
                      className="rounded-sm px-1 text-right tabular-nums"
                      style={{ background: bg }}
                      title={`${c.label}: ${Number.isFinite(v) ? v.toFixed(4) : "—"}`}
                    >
                      {Number.isFinite(v) ? v.toFixed(3) : "—"}
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

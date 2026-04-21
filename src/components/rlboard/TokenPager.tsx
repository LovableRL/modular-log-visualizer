import { useMemo, useState } from "react";
import type { RLBoardRecord, TokenMetricKey } from "@/lib/rlboard/schema";
import {
  getTokenMetric,
  availableMetrics,
  TOKEN_METRIC_LABELS,
  tokenCount,
} from "@/lib/rlboard/schema";
import { heatColor, robustExtent } from "@/lib/rlboard/colors";
import { isSpecialToken, decodeTokenForDisplay } from "@/lib/rlboard/tokens";
import { useRLBoard } from "@/lib/rlboard/context";
import { TokenHeatmap } from "./TokenHeatmap";
import { TokenCurves } from "./TokenCurves";

/**
 * TokenPager — the original RLLoggingBoard interaction model, modernized.
 *
 *   ┌─────────────────────────── minimap (full sequence, page highlighted) ┐
 *   ├─────────────────── pager controls (◀ page X / N ▶ · jump · size) ───┤
 *   ├──────────────── colored tokens for the current page (≤ pageSize) ───┤
 *   └─────── per-token curves for the current page ──────────────────────┘
 *
 * Why pages instead of pure virtualization:
 *   - bounded DOM (≤ pageSize nodes) keeps interactions snappy at 256k tokens
 *   - matches the mental model of the original tool — easy to share a page #
 *   - curves stay readable (pageSize points, not 262 144)
 *   - heatmap minimap still gives global context + click-to-jump
 */
export function TokenPager({
  record,
  defaultPageSize = 2048,
  showCurves = true,
}: {
  record: RLBoardRecord;
  defaultPageSize?: number;
  showCurves?: boolean;
}) {
  const total = tokenCount(record);
  const metrics = useMemo(() => availableMetrics(record), [record]);
  const [metric, setMetric] = useState<TokenMetricKey>(metrics[0] ?? "logprobs");
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const [rawPage, setRawPage] = useState(0);
  // Derive a safe page index instead of reconciling with an effect — avoids
  // the setState-in-effect loop that crashed Recharts subscribers.
  const page = Math.max(0, Math.min(rawPage, pageCount - 1));

  const start = page * pageSize;
  const end = Math.min(total, start + pageSize);
  const range: [number, number] = [start, end];

  const { hideSpecialTokens } = useRLBoard();
  const fullValues = useMemo(
    () => getTokenMetric(record, metric) ?? [],
    [record, metric],
  );
  const pageValuesRaw = useMemo(() => fullValues.slice(start, end), [fullValues, start, end]);
  const tokensRaw = record.response_tokens?.slice(start, end);
  // Apply pad/special-token filter at render time
  const { pageValues, tokens, hiddenCount } = useMemo(() => {
    if (!hideSpecialTokens || !tokensRaw) {
      return { pageValues: pageValuesRaw, tokens: tokensRaw, hiddenCount: 0 };
    }
    const v: number[] = [];
    const t: string[] = [];
    let hidden = 0;
    for (let i = 0; i < tokensRaw.length; i++) {
      if (isSpecialToken(tokensRaw[i])) { hidden++; continue; }
      v.push(pageValuesRaw[i]);
      t.push(tokensRaw[i]);
    }
    return { pageValues: v, tokens: t, hiddenCount: hidden };
  }, [pageValuesRaw, tokensRaw, hideSpecialTokens]);
  const extent = useMemo(() => robustExtent(pageValues), [pageValues]);

  const goto = (p: number) => setRawPage(Math.max(0, Math.min(pageCount - 1, p)));

  const handleMinimapRange = (r: [number, number] | null) => {
    if (!r) return;
    // jump to the page containing the start of the selected range
    goto(Math.floor(r[0] / pageSize));
  };

  return (
    <div className="space-y-3">
      {/* Minimap — full sequence with current page highlighted */}
      <div className="rounded-md border border-border bg-background/40 p-3">
        <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="font-mono uppercase tracking-widest">global minimap</span>
          <span className="font-mono">
            page {(page + 1).toLocaleString()} / {pageCount.toLocaleString()} highlighted
          </span>
        </div>
        <TokenHeatmap
          record={record}
          metric={metric}
          height={48}
          onRangeSelect={handleMinimapRange}
          highlightRange={range}
        />
      </div>

      {/* Pager controls */}
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card p-2">
        <button
          onClick={() => goto(0)}
          disabled={page === 0}
          className="rounded border border-border px-2 py-1 font-mono text-xs disabled:opacity-40 hover:bg-secondary"
          title="First page"
        >
          ⏮
        </button>
        <button
          onClick={() => goto(page - 1)}
          disabled={page === 0}
          className="rounded border border-border px-2 py-1 font-mono text-xs disabled:opacity-40 hover:bg-secondary"
        >
          ◀ prev
        </button>
        <div className="flex items-center gap-1 font-mono text-xs">
          <span className="text-muted-foreground">page</span>
          <input
            type="number"
            min={1}
            max={pageCount}
            value={page + 1}
            onChange={(e) => goto(Number(e.target.value) - 1)}
            className="w-16 rounded border border-border bg-input px-2 py-1 text-right text-foreground"
          />
          <span className="text-muted-foreground">/ {pageCount.toLocaleString()}</span>
        </div>
        <button
          onClick={() => goto(page + 1)}
          disabled={page >= pageCount - 1}
          className="rounded border border-border px-2 py-1 font-mono text-xs disabled:opacity-40 hover:bg-secondary"
        >
          next ▶
        </button>
        <button
          onClick={() => goto(pageCount - 1)}
          disabled={page >= pageCount - 1}
          className="rounded border border-border px-2 py-1 font-mono text-xs disabled:opacity-40 hover:bg-secondary"
          title="Last page"
        >
          ⏭
        </button>

        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          <label className="flex items-center gap-1">
            <span>page size</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const next = Number(e.target.value);
                // keep current token roughly in view
                const anchor = start;
                setPageSize(next);
                setRawPage(Math.floor(anchor / next));
              }}
              className="rounded border border-border bg-input px-2 py-1 font-mono text-foreground"
            >
              {[256, 512, 1024, 2048, 4096, 8192].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1">
            <span>metric</span>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as TokenMetricKey)}
              className="rounded border border-border bg-input px-2 py-1 font-mono text-foreground"
            >
              {metrics.map((m) => (
                <option key={m} value={m}>
                  {TOKEN_METRIC_LABELS[m]}
                </option>
              ))}
            </select>
          </label>
          <span className="font-mono">
            tokens {start.toLocaleString()}–{end.toLocaleString()} / {total.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Colored tokens for the current page */}
      <div className="rounded-md border border-border bg-background/40 p-3">
        <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="font-mono uppercase tracking-widest">tokens · {TOKEN_METRIC_LABELS[metric]}</span>
          <span className="font-mono">
            {hiddenCount > 0 ? <span className="mr-2 text-warning">filtered {hiddenCount} special</span> : null}
            range [{extent[0].toFixed(3)}, {extent[1].toFixed(3)}]
          </span>
        </div>
        <div className="flex flex-wrap gap-x-0 gap-y-[2px] font-mono text-xs leading-6">
          {pageValues.map((v, i) => {
            const rawTok = tokens?.[i] ?? "·";
            const { text, glue } = decodeTokenForDisplay(rawTok);
            const isNewline = rawTok === "\n" || text === "\n";
            const display = isNewline
              ? "↵"
              : text.replace(/\n/g, "↵").replace(/ /g, "·");
            return (
              <span
                key={i}
                title={`#${start + i}  ${JSON.stringify(rawTok)}  ${v.toFixed(4)}`}
                className="inline-block rounded-sm px-1 py-0.5"
                style={{
                  background: heatColor(v, extent[0], extent[1]),
                  color: "var(--background)",
                  flexBasis: isNewline ? "100%" : undefined,
                  marginLeft: glue ? 0 : 2,
                }}
              >
                {display}
              </span>
            );
          })}
          {pageValues.length === 0 && (
            <span className="text-muted-foreground">No data on this page.</span>
          )}
        </div>
      </div>

      {/* Curves for the current page only — bounded work, readable */}
      {showCurves && (
        <div className="rounded-md border border-border bg-background/40 p-3">
          <div className="mb-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            page curves
          </div>
          <TokenCurves record={record} range={range} height={220} />
        </div>
      )}
    </div>
  );
}

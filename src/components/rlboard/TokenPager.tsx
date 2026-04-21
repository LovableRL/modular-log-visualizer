import { useMemo, useState } from "react";
import * as HoverCardPrimitive from "@radix-ui/react-hover-card";
import type { RLBoardRecord, TokenMetricKey } from "@/lib/rlboard/schema";
import {
  getTokenMetric,
  availableMetrics,
  TOKEN_METRIC_LABELS,
  tokenCount,
} from "@/lib/rlboard/schema";
import { heatColor, robustExtent } from "@/lib/rlboard/colors";
import { isSpecialToken, decodeTokenForDisplay } from "@/lib/rlboard/tokens";
import { useRLBoard, type TokenViewMode } from "@/lib/rlboard/context";
import { TokenHeatmap } from "./TokenHeatmap";
import { TokenCurves } from "./TokenCurves";
import { TokenHoverCard } from "./TokenHoverCard";
import { TokenTable } from "./TokenTable";

/**
 * TokenPager — paged token explorer with three density modes:
 *   - compact : color chips only (fastest, scan many tokens)
 *   - values  : color chips + numeric value beneath each token
 *   - table   : virtualized spreadsheet with every metric as a column
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
  const page = Math.max(0, Math.min(rawPage, pageCount - 1));

  const start = page * pageSize;
  const end = Math.min(total, start + pageSize);
  const range: [number, number] = [start, end];

  const { hideSpecialTokens, tokenViewMode, setTokenViewMode } = useRLBoard();
  const fullValues = useMemo(
    () => getTokenMetric(record, metric) ?? [],
    [record, metric],
  );
  const pageValuesRaw = useMemo(() => fullValues.slice(start, end), [fullValues, start, end]);
  const tokensRaw = record.response_tokens?.slice(start, end);
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

  // Page-wide stats per metric for hover-card z-scores
  const pageStats = useMemo(() => {
    const out: Record<string, { mean: number; std: number }> = {};
    for (const m of metrics) {
      const arr = (getTokenMetric(record, m) ?? []).slice(start, end);
      let n = 0, sum = 0, sq = 0;
      for (const v of arr) {
        if (Number.isFinite(v)) { n++; sum += v; sq += v * v; }
      }
      const mean = n ? sum / n : 0;
      const variance = n ? Math.max(0, sq / n - mean * mean) : 0;
      out[m] = { mean, std: Math.sqrt(variance) };
    }
    return out;
  }, [record, metrics, start, end]);

  const goto = (p: number) => setRawPage(Math.max(0, Math.min(pageCount - 1, p)));
  const handleMinimapRange = (r: [number, number] | null) => {
    if (!r) return;
    goto(Math.floor(r[0] / pageSize));
  };

  const fmt = (v: number): string => {
    if (!Number.isFinite(v)) return "—";
    if (metric === "entropy" || metric === "attention_entropy") return v.toFixed(2);
    return v.toFixed(3);
  };

  return (
    <div className="space-y-3">
      {/* Minimap + legend */}
      <div className="rounded-md border border-border bg-background/40 p-3">
        <div className="mb-2 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
          <span className="font-mono uppercase tracking-widest">global minimap</span>
          <div className="flex items-center gap-3">
            <ColorScaleLegend min={extent[0]} max={extent[1]} />
            <span className="font-mono">
              page {(page + 1).toLocaleString()} / {pageCount.toLocaleString()}
            </span>
          </div>
        </div>
        <TokenHeatmap
          record={record}
          metric={metric}
          height={48}
          onRangeSelect={handleMinimapRange}
          highlightRange={range}
        />
      </div>

      {/* Pager + view-mode controls */}
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card p-2">
        <button onClick={() => goto(0)} disabled={page === 0}
          className="rounded border border-border px-2 py-1 font-mono text-xs disabled:opacity-40 hover:bg-secondary" title="First page">⏮</button>
        <button onClick={() => goto(page - 1)} disabled={page === 0}
          className="rounded border border-border px-2 py-1 font-mono text-xs disabled:opacity-40 hover:bg-secondary">◀ prev</button>
        <div className="flex items-center gap-1 font-mono text-xs">
          <span className="text-muted-foreground">page</span>
          <input type="number" min={1} max={pageCount} value={page + 1}
            onChange={(e) => goto(Number(e.target.value) - 1)}
            className="w-16 rounded border border-border bg-input px-2 py-1 text-right text-foreground" />
          <span className="text-muted-foreground">/ {pageCount.toLocaleString()}</span>
        </div>
        <button onClick={() => goto(page + 1)} disabled={page >= pageCount - 1}
          className="rounded border border-border px-2 py-1 font-mono text-xs disabled:opacity-40 hover:bg-secondary">next ▶</button>
        <button onClick={() => goto(pageCount - 1)} disabled={page >= pageCount - 1}
          className="rounded border border-border px-2 py-1 font-mono text-xs disabled:opacity-40 hover:bg-secondary" title="Last page">⏭</button>

        {/* View-mode segmented control */}
        <div className="ml-2 inline-flex overflow-hidden rounded border border-border font-mono text-xs">
          {(["compact", "values", "table"] as TokenViewMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setTokenViewMode(m)}
              className={`px-2 py-1 ${
                tokenViewMode === m ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          <label className="flex items-center gap-1">
            <span>page size</span>
            <select value={pageSize}
              onChange={(e) => {
                const next = Number(e.target.value);
                const anchor = start;
                setPageSize(next);
                setRawPage(Math.floor(anchor / next));
              }}
              className="rounded border border-border bg-input px-2 py-1 font-mono text-foreground">
              {[128, 256, 512, 1024, 2048, 4096, 8192].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1">
            <span>metric</span>
            <select value={metric}
              onChange={(e) => setMetric(e.target.value as TokenMetricKey)}
              className="rounded border border-border bg-input px-2 py-1 font-mono text-foreground">
              {metrics.map((m) => (
                <option key={m} value={m}>{TOKEN_METRIC_LABELS[m]}</option>
              ))}
            </select>
          </label>
          <span className="font-mono">
            tokens {start.toLocaleString()}–{end.toLocaleString()} / {total.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Body */}
      {tokenViewMode === "table" ? (
        <TokenTable record={record} range={range} />
      ) : (
        <div className="rounded-md border border-border bg-background/40 p-3">
          <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="font-mono uppercase tracking-widest">tokens · {TOKEN_METRIC_LABELS[metric]}</span>
            <span className="font-mono">
              {hiddenCount > 0 ? <span className="mr-2 text-warning">filtered {hiddenCount} special</span> : null}
              range [{extent[0].toFixed(3)}, {extent[1].toFixed(3)}]
            </span>
          </div>
          <div
            className="font-mono text-xs leading-6"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: tokenViewMode === "values" ? "6px 2px" : "2px 0",
              alignItems: "flex-start",
            }}
          >
            {pageValues.map((v, i) => {
              const rawTok = tokens?.[i] ?? "·";
              const { text, glue } = decodeTokenForDisplay(rawTok);
              const isNewline = rawTok === "\n" || text === "\n";
              const display = isNewline
                ? "↵"
                : text.replace(/\n/g, "↵").replace(/ /g, "·");
              const absoluteIdx = start + i;
              const valueText = fmt(v);
              const showValues = tokenViewMode === "values";
              return (
                <HoverCardPrimitive.Root key={i} openDelay={120} closeDelay={60}>
                  <HoverCardPrimitive.Trigger asChild>
                    <span
                      className="inline-flex flex-col items-stretch"
                      style={{
                        flexBasis: isNewline ? "100%" : undefined,
                        marginLeft: glue ? 0 : 2,
                        minWidth: showValues ? `${Math.max(display.length, valueText.length) * 7 + 8}px` : undefined,
                      }}
                    >
                      <span
                        className="rounded-sm px-1 py-0.5 text-center"
                        style={{
                          background: heatColor(v, extent[0], extent[1]),
                          color: "var(--background)",
                        }}
                      >
                        {display}
                      </span>
                      {showValues && (
                        <span className="mt-[1px] text-center text-[9px] tabular-nums text-muted-foreground">
                          {valueText}
                        </span>
                      )}
                    </span>
                  </HoverCardPrimitive.Trigger>
                  <HoverCardPrimitive.Portal>
                    <HoverCardPrimitive.Content
                      sideOffset={6}
                      className="z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
                    >
                      <TokenHoverCard
                        record={record}
                        index={absoluteIdx}
                        rawToken={rawTok}
                        decoded={display}
                        pageStats={pageStats}
                      />
                    </HoverCardPrimitive.Content>
                  </HoverCardPrimitive.Portal>
                </HoverCardPrimitive.Root>
              );
            })}
            {pageValues.length === 0 && (
              <span className="text-muted-foreground">No data on this page.</span>
            )}
          </div>
        </div>
      )}

      {/* Curves */}
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

function ColorScaleLegend({ min, max }: { min: number; max: number }) {
  const steps = 5;
  const stops = Array.from({ length: steps }, (_, i) => min + ((max - min) * i) / (steps - 1));
  return (
    <div className="flex items-center gap-1">
      <span className="font-mono tabular-nums">{min.toFixed(2)}</span>
      <div className="flex h-3 overflow-hidden rounded-sm border border-border">
        {stops.map((v, i) => (
          <div
            key={i}
            title={v.toFixed(3)}
            style={{ width: 14, background: heatColor(v, min, max) }}
          />
        ))}
      </div>
      <span className="font-mono tabular-nums">{max.toFixed(2)}</span>
    </div>
  );
}

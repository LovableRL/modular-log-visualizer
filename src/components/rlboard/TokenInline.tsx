import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { RLBoardRecord, TokenMetricKey } from "@/lib/rlboard/schema";
import { getTokenMetric, availableMetrics, TOKEN_METRIC_LABELS } from "@/lib/rlboard/schema";
import { heatColor, robustExtent } from "@/lib/rlboard/colors";
import { useOptionalPerf } from "@/lib/rlboard/perf";

/**
 * Inline colored token view. Uses tanstack-virtual row virtualization on a
 * fixed-width grid layout — handles 256k tokens smoothly.
 */
export function TokenInline({
  record,
  metric: metricProp,
  range,
  height = 360,
  tokensPerRow: tokensPerRowProp,
}: {
  record: RLBoardRecord;
  metric?: TokenMetricKey;
  range?: [number, number] | null;
  height?: number;
  tokensPerRow?: number;
}) {
  const perf = useOptionalPerf();
  const tokensPerRow = tokensPerRowProp ?? perf?.params.tokensPerRow ?? 32;
  const metrics = useMemo(() => availableMetrics(record), [record]);
  const [internalMetric, setInternalMetric] = useState<TokenMetricKey>(metrics[0] ?? "logprobs");
  const metric = metricProp ?? internalMetric;

  const fullValues = useMemo(() => getTokenMetric(record, metric) ?? [], [record, metric]);
  const fullTokens = record.response_tokens;

  const [start, end] = useMemo(() => {
    if (range) return [Math.max(0, range[0]), Math.min(fullValues.length, range[1])];
    return [0, fullValues.length];
  }, [range, fullValues.length]);

  const values = useMemo(() => fullValues.slice(start, end), [fullValues, start, end]);
  const tokens = useMemo(
    () => (fullTokens ? fullTokens.slice(start, end) : null),
    [fullTokens, start, end],
  );

  const extent = useMemo(() => robustExtent(values), [values]);
  const rowCount = Math.ceil(values.length / tokensPerRow);

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28,
    overscan: 6,
  });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Metric</span>
          <select
            className="rounded-md border border-border bg-input px-2 py-1 text-foreground"
            value={metric}
            onChange={(e) => setInternalMetric(e.target.value as TokenMetricKey)}
            disabled={!!metricProp}
          >
            {metrics.map((m) => (
              <option key={m} value={m}>{TOKEN_METRIC_LABELS[m]}</option>
            ))}
          </select>
        </div>
        <span className="font-mono">
          showing {start.toLocaleString()}–{end.toLocaleString()} / {fullValues.length.toLocaleString()} tokens
        </span>
        <span className="font-mono">
          range: [{extent[0].toFixed(3)}, {extent[1].toFixed(3)}]
        </span>
      </div>
      <div
        ref={parentRef}
        className="overflow-auto rounded-md border border-border bg-background/40 font-mono text-xs"
        style={{ height }}
      >
        <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
          {virtualizer.getVirtualItems().map((vr) => {
            const rowStart = vr.index * tokensPerRow;
            const rowEnd = Math.min(values.length, rowStart + tokensPerRow);
            const cells = [];
            for (let i = rowStart; i < rowEnd; i++) {
              const v = values[i];
              const tok = tokens?.[i] ?? "·";
              cells.push(
                <span
                  key={i}
                  title={`#${start + i}  ${tok}  ${v.toFixed(4)}`}
                  className="inline-block px-1.5 py-0.5 rounded-sm"
                  style={{ background: heatColor(v, extent[0], extent[1]), color: "var(--background)" }}
                >
                  {tok === "\n" ? "↵" : tok === " " ? "·" : tok}
                </span>,
              );
            }
            return (
              <div
                key={vr.key}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${vr.start}px)`,
                  padding: "2px 8px",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 2,
                }}
              >
                <span className="mr-2 inline-block w-12 select-none text-right text-[10px] text-muted-foreground">
                  {(start + rowStart).toLocaleString()}
                </span>
                {cells}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

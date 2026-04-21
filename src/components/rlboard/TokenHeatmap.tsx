import { useMemo, useRef, useState, useEffect } from "react";
import type { RLBoardRecord, TokenMetricKey } from "@/lib/rlboard/schema";
import { getTokenMetric, availableMetrics, TOKEN_METRIC_LABELS } from "@/lib/rlboard/schema";
import { heatBucket, robustExtent } from "@/lib/rlboard/colors";
import { useAggregatedBuckets } from "@/lib/rlboard/useAggregator";
import { useOptionalPerf } from "@/lib/rlboard/perf";

/**
 * TokenHeatmap — supports very long sequences (256k+) via:
 *   • bucket aggregation in a Web Worker (auto bucket size based on width,
 *     overridable via PerfPanel)
 *   • range selection on the minimap for drill-down
 */
export function TokenHeatmap({
  record,
  metric: metricProp,
  height = 80,
  onRangeSelect,
}: {
  record: RLBoardRecord;
  metric?: TokenMetricKey;
  height?: number;
  onRangeSelect?: (range: [number, number] | null) => void;
}) {
  const metrics = useMemo(() => availableMetrics(record), [record]);
  const [internalMetric, setInternalMetric] = useState<TokenMetricKey>(metrics[0] ?? "logprobs");
  const metric = metricProp ?? internalMetric;
  const data = useMemo(() => getTokenMetric(record, metric) ?? [], [record, metric]);
  const perf = useOptionalPerf();

  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(800);
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setW(Math.max(200, Math.floor(e.contentRect.width)));
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const targetBuckets = perf?.params.bucketsOverride ?? w;
  const { mean } = useAggregatedBuckets(data, targetBuckets);
  const extent = useMemo(() => robustExtent(Array.from(mean)), [mean]);

  // selection
  const [drag, setDrag] = useState<{ x0: number; x1: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = w;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, height);
    const heatVars = ["--heat-0", "--heat-1", "--heat-2", "--heat-3", "--heat-4", "--heat-5"];
    const computed = getComputedStyle(document.documentElement);
    const palette = heatVars.map((v) => computed.getPropertyValue(v).trim());
    const colW = w / Math.max(1, mean.length);
    for (let i = 0; i < mean.length; i++) {
      const c = palette[heatBucket(mean[i], extent[0], extent[1])] || "#444";
      ctx.fillStyle = c;
      ctx.fillRect(i * colW, 0, Math.ceil(colW + 1), height);
    }
    if (drag) {
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      const x0 = Math.min(drag.x0, drag.x1);
      const x1 = Math.max(drag.x0, drag.x1);
      ctx.fillRect(x0, 0, x1 - x0, height);
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.strokeRect(x0 + 0.5, 0.5, x1 - x0, height - 1);
    }
  }, [mean, extent, w, height, drag]);

  const tokenAt = (px: number) => {
    if (data.length === 0) return 0;
    const t = Math.max(0, Math.min(1, px / w));
    return Math.floor(t * data.length);
  };

  return (
    <div ref={wrapRef} className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
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
          <span className="font-mono">
            n={data.length.toLocaleString()} · buckets={mean.length} · {(data.length / Math.max(1, mean.length)).toFixed(1)} tok/px
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span>cold</span>
          <span className="heat-grad inline-block h-2 w-24 rounded-sm" />
          <span>hot</span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="block w-full cursor-crosshair rounded-md border border-border"
        style={{ height }}
        onMouseDown={(e) => {
          const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
          const x = e.clientX - rect.left;
          setDrag({ x0: x, x1: x });
        }}
        onMouseMove={(e) => {
          if (!drag) return;
          const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
          setDrag({ ...drag, x1: e.clientX - rect.left });
        }}
        onMouseUp={() => {
          if (!drag) return;
          const a = tokenAt(Math.min(drag.x0, drag.x1));
          const b = tokenAt(Math.max(drag.x0, drag.x1));
          if (b - a < 2) {
            onRangeSelect?.(null);
          } else {
            onRangeSelect?.([a, b]);
          }
          setDrag(null);
        }}
        onDoubleClick={() => onRangeSelect?.(null)}
      />
      <p className="text-[11px] text-muted-foreground">
        Drag to select a range · double-click to reset
      </p>
    </div>
  );
}

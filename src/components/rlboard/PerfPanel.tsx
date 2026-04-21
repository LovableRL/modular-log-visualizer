import { usePerf } from "@/lib/rlboard/perf";
import { ModuleCard } from "./ModuleCard";

/**
 * Runtime performance panel — live FPS, last/average aggregation cost,
 * worker progress for long-running buckets, and tunable visualization params.
 */
export function PerfPanel() {
  const { metrics, params, setParams } = usePerf();
  const fpsColor =
    metrics.fps >= 55
      ? "var(--success)"
      : metrics.fps >= 30
      ? "var(--warning)"
      : "var(--destructive)";
  const aggColor =
    metrics.lastAggMs < 16
      ? "var(--success)"
      : metrics.lastAggMs < 80
      ? "var(--warning)"
      : "var(--destructive)";

  const progress = metrics.workerProgress;
  const pct = progress && progress.total > 0 ? (progress.done / progress.total) * 100 : 0;

  return (
    <ModuleCard
      title="perf-panel"
      subtitle="Runtime cost & visualization tuning"
      actions={
        <span className="font-mono text-[11px] text-muted-foreground">
          {metrics.aggCount} agg ops
        </span>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        {/* Stats */}
        <div className="space-y-2 rounded-md border border-border bg-background/40 p-3">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              fps
            </span>
            <span className="font-mono text-2xl font-semibold" style={{ color: fpsColor }}>
              {metrics.fps.toFixed(0)}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full transition-all"
              style={{
                width: `${Math.min(100, (metrics.fps / 60) * 100)}%`,
                background: fpsColor,
              }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">target 60 (rAF EMA)</p>
        </div>

        <div className="space-y-2 rounded-md border border-border bg-background/40 p-3">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              last agg
            </span>
            <span className="font-mono text-2xl font-semibold" style={{ color: aggColor }}>
              {metrics.lastAggMs.toFixed(1)}
              <span className="ml-0.5 text-xs font-normal text-muted-foreground">ms</span>
            </span>
          </div>
          <p className="font-mono text-[11px] text-muted-foreground">
            avg {metrics.avgAggMs.toFixed(1)}ms · {metrics.lastTokens.toLocaleString()} tok →{" "}
            {metrics.lastBuckets.toLocaleString()} buckets
          </p>
          <p className="text-[11px] text-muted-foreground">
            {metrics.lastTokens > 0 && metrics.lastAggMs > 0
              ? `${((metrics.lastTokens / metrics.lastAggMs) * 0.001).toFixed(2)} M tok/s`
              : "—"}
          </p>
        </div>

        <div className="space-y-2 rounded-md border border-border bg-background/40 p-3">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              worker
            </span>
            <span className="font-mono text-sm">
              {progress ? `${progress.done}/${progress.total}` : "idle"}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <input
              type="checkbox"
              checked={params.useWorker}
              onChange={(e) => setParams({ useWorker: e.target.checked })}
            />
            offload to Web Worker
          </label>
        </div>
      </div>

      {/* Tunable params */}
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Tunable
          label="Heatmap buckets"
          hint="auto = canvas width in px"
          value={params.bucketsOverride ?? 0}
          min={0}
          max={4096}
          step={64}
          format={(v) => (v === 0 ? "auto" : v.toString())}
          onChange={(v) => setParams({ bucketsOverride: v === 0 ? null : v })}
        />
        <Tunable
          label="Tokens / row (inline)"
          hint="grid width of TokenInline"
          value={params.tokensPerRow}
          min={8}
          max={128}
          step={4}
          format={(v) => v.toString()}
          onChange={(v) => setParams({ tokensPerRow: v })}
        />
        <Tunable
          label="Curve max points"
          hint="downsample target for TokenCurves"
          value={params.maxCurvePoints}
          min={250}
          max={4000}
          step={50}
          format={(v) => v.toString()}
          onChange={(v) => setParams({ maxCurvePoints: v })}
        />
      </div>
    </ModuleCard>
  );
}

function Tunable({
  label,
  hint,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5 rounded-md border border-border bg-background/40 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <span className="font-mono text-sm text-foreground">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

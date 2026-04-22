import { useMemo, useState } from "react";
import type { RLBoardRecord } from "@/lib/rlboard/schema";
import { SimpleBarChart } from "./SimpleCharts";

/**
 * Histogram of (reward - ref_reward) per rollout for a chosen step.
 * Mirrors the original RLLoggingBoard "delta-reward" diagnostic — tells you
 * how much the policy is beating (or losing to) the reference at each step.
 */
export function RewardDeltaDistribution({
  records,
  step,
  height = 240,
  width,
  bins = 16,
}: {
  records: RLBoardRecord[];
  step?: number;
  height?: number;
  width?: number;
  bins?: number;
}) {
  const steps = useMemo(
    () => Array.from(new Set(records.map((r) => r.step))).sort((a, b) => a - b),
    [records],
  );
  const [internalStep, setInternalStep] = useState<number>(steps.at(-1) ?? 0);
  const activeStep = step ?? (steps.includes(internalStep) ? internalStep : steps.at(-1) ?? 0);

  const { data, mean, count } = useMemo(() => {
    const subset = records.filter(
      (r) => r.step === activeStep && typeof r.ref_reward === "number",
    );
    const deltas = subset.map((r) => r.reward - (r.ref_reward as number));
    if (deltas.length === 0) return { data: [], mean: 0, count: 0 };
    const lo = Math.min(...deltas);
    const hi = Math.max(...deltas);
    const width = (hi - lo) / bins || 1;
    const buckets = Array.from({ length: bins }, (_, i) => ({
      label: +(lo + width * (i + 0.5)).toFixed(2),
      value: 0,
    }));
    for (const v of deltas) {
      const idx = Math.min(bins - 1, Math.max(0, Math.floor((v - lo) / width)));
      buckets[idx].value++;
    }
    return {
      data: buckets,
      mean: deltas.reduce((a, b) => a + b, 0) / deltas.length,
      count: deltas.length,
    };
  }, [records, activeStep, bins]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {step === undefined && (
          <label className="flex items-center gap-2">
            <span>Step</span>
            <select
              className="rounded-md border border-border bg-input px-2 py-1 text-foreground"
              value={activeStep}
              onChange={(e) => setInternalStep(Number(e.target.value))}
            >
              {steps.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
        )}
        <span className="font-mono">
          n={count} · mean Δ={mean.toFixed(3)}
        </span>
        <span className="font-mono text-muted-foreground/80">
          (positive = policy beats reference)
        </span>
      </div>
      {data.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No ref_reward available for this step.
        </p>
      ) : (
        <SimpleBarChart data={data} height={height} width={width} />
      )}
    </div>
  );
}

import { useMemo, useState } from "react";
import type { RLBoardRecord } from "@/lib/rlboard/schema";
import { SimpleBarChart } from "./SimpleCharts";

/** Histogram of rewards for a chosen step. */
export function RewardDistribution({
  records,
  step,
  height = 240,
  bins = 16,
}: {
  records: RLBoardRecord[];
  step?: number;
  height?: number;
  bins?: number;
}) {
  const steps = useMemo(
    () => Array.from(new Set(records.map((r) => r.step))).sort((a, b) => a - b),
    [records],
  );
  const [internalStep, setInternalStep] = useState<number>(steps.at(-1) ?? 0);
  const activeStep = step ?? (steps.includes(internalStep) ? internalStep : steps.at(-1) ?? 0);

  const data = useMemo(() => {
    const subset = records.filter((r) => r.step === activeStep);
    if (subset.length === 0) return [];
    const all = subset.map((r) => r.reward);
    const min = Math.min(...all);
    const max = Math.max(...all);
    const width = (max - min) / bins || 1;
    const buckets = Array.from({ length: bins }, (_, i) => ({
      label: +(min + width * (i + 0.5)).toFixed(2),
      value: 0,
    }));
    for (const v of all) {
      const idx = Math.min(bins - 1, Math.max(0, Math.floor((v - min) / width)));
      buckets[idx].value++;
    }
    return buckets;
  }, [records, activeStep, bins]);

  return (
    <div className="space-y-2">
      {step === undefined && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
        </div>
      )}
      <SimpleBarChart data={data} height={height} />
    </div>
  );
}

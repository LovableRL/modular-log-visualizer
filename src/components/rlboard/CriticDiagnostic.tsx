import { useMemo } from "react";
import type { RLBoardRecord } from "@/lib/rlboard/schema";
import { aggregate } from "@/lib/rlboard/colors";
import { useOptionalPerf } from "@/lib/rlboard/perf";
import { SimpleLineChart } from "./SimpleCharts";

/**
 * CriticDiagnostic — overlays the critic's predicted values against the
 * realised token_rewards on the same axis and reports MSE / correlation.
 * Useful for diagnosing critic under/over-fitting in PPO-style training.
 */
export function CriticDiagnostic({
  record,
  range,
  height = 260,
  width,
  maxPoints: maxPointsProp,
}: {
  record: RLBoardRecord;
  range?: [number, number] | null;
  height?: number;
  width?: number;
  maxPoints?: number;
}) {
  const perf = useOptionalPerf();
  const maxPoints = maxPointsProp ?? perf?.params.maxCurvePoints ?? 1500;

  const { x, values, rewards, mse, corr, n } = useMemo(() => {
    const slice = (arr?: number[]) => {
      if (!arr) return undefined;
      if (range) return arr.slice(range[0], range[1]);
      return arr;
    };
    const v = slice(record.values);
    const r = slice(record.token_rewards);
    if (!v || !r || v.length === 0 || r.length === 0) {
      return { x: [], values: [], rewards: [], mse: NaN, corr: NaN, n: 0 };
    }
    const len = Math.min(v.length, r.length);
    let sumSq = 0;
    let sumV = 0, sumR = 0, sumVR = 0, sumVV = 0, sumRR = 0;
    for (let i = 0; i < len; i++) {
      const d = v[i] - r[i];
      sumSq += d * d;
      sumV += v[i];
      sumR += r[i];
      sumVR += v[i] * r[i];
      sumVV += v[i] * v[i];
      sumRR += r[i] * r[i];
    }
    const mean = (s: number) => s / len;
    const cov = mean(sumVR) - mean(sumV) * mean(sumR);
    const varV = mean(sumVV) - mean(sumV) ** 2;
    const varR = mean(sumRR) - mean(sumR) ** 2;
    const corrV = cov / (Math.sqrt(Math.max(1e-12, varV * varR)));

    const buckets = Math.min(maxPoints, len);
    const downV = aggregate(v.slice(0, len), buckets).map((b) => b.mean);
    const downR = aggregate(r.slice(0, len), buckets).map((b) => b.mean);
    const baseStart = range ? range[0] : 0;
    const step = len / buckets;
    const xs = Array.from({ length: buckets }, (_, i) => Math.round(baseStart + i * step));
    return {
      x: xs,
      values: downV,
      rewards: downR,
      mse: sumSq / len,
      corr: corrV,
      n: len,
    };
  }, [record, range, maxPoints]);

  if (!record.values || !record.token_rewards) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Record has no critic values or token_rewards.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-4 font-mono text-[11px] text-muted-foreground">
        <span>n={n.toLocaleString()}</span>
        <span>MSE(value, reward) = <span className="text-foreground">{mse.toFixed(4)}</span></span>
        <span>corr = <span className="text-foreground">{Number.isFinite(corr) ? corr.toFixed(3) : "—"}</span></span>
      </div>
      <SimpleLineChart
        height={height}
        width={width}
        xLabels={x}
        series={[
          { key: "value", label: "value (V)", color: "var(--info)", values },
          { key: "reward", label: "token_reward", color: "var(--success)", values: rewards, dashed: true },
        ]}
      />
    </div>
  );
}

import { useMemo } from "react";
import type { RLBoardRecord } from "@/lib/rlboard/schema";
import { SimpleLineChart } from "./SimpleCharts";

/** Reward Curve module — mean reward per step (vs ref_reward) with optional ±k·σ band. */
export function RewardCurve({
  records,
  height = 260,
  width,
  varianceScale = 1,
}: {
  records: RLBoardRecord[];
  height?: number;
  width?: number;
  /** Half-band width = varianceScale × stddev. 0 disables the band. */
  varianceScale?: number;
}) {
  const data = useMemo(() => {
    const byStep = new Map<number, { reward: number[]; ref: number[] }>();
    for (const r of records) {
      const e = byStep.get(r.step) ?? { reward: [], ref: [] };
      e.reward.push(r.reward);
      if (typeof r.ref_reward === "number") e.ref.push(r.ref_reward);
      byStep.set(r.step, e);
    }
    const std = (xs: number[], mean: number) =>
      xs.length < 2
        ? 0
        : Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (xs.length - 1));
    return [...byStep.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([step, v]) => {
        const rMean = v.reward.reduce((a, b) => a + b, 0) / v.reward.length;
        const refMean = v.ref.length ? v.ref.reduce((a, b) => a + b, 0) / v.ref.length : null;
        return {
          step,
          reward: rMean,
          rewardStd: std(v.reward, rMean),
          ref: refMean,
          refStd: refMean == null ? null : std(v.ref, refMean),
        };
      });
  }, [records]);

  const showBand = varianceScale > 0;

  return (
    <SimpleLineChart
      height={height}
      width={width}
      xLabels={data.map((d) => d.step)}
      series={[
        {
          key: "reward",
          label: "reward",
          color: "var(--primary)",
          values: data.map((d) => d.reward),
          band: showBand ? data.map((d) => d.rewardStd * varianceScale) : undefined,
        },
        {
          key: "ref",
          label: "ref",
          color: "var(--accent)",
          values: data.map((d) => d.ref),
          band:
            showBand
              ? data.map((d) => (d.refStd == null ? null : d.refStd * varianceScale))
              : undefined,
          dashed: true,
        },
      ]}
    />
  );
}

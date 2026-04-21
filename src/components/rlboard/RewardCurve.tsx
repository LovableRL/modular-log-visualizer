import { useMemo } from "react";
import type { RLBoardRecord } from "@/lib/rlboard/schema";
import { SimpleLineChart } from "./SimpleCharts";

/** Reward Curve module — mean reward per step (vs ref_reward when available). */
export function RewardCurve({ records, height = 260 }: { records: RLBoardRecord[]; height?: number }) {
  const data = useMemo(() => {
    const byStep = new Map<number, { reward: number[]; ref: number[] }>();
    for (const r of records) {
      const e = byStep.get(r.step) ?? { reward: [], ref: [] };
      e.reward.push(r.reward);
      if (typeof r.ref_reward === "number") e.ref.push(r.ref_reward);
      byStep.set(r.step, e);
    }
    return [...byStep.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([step, v]) => ({
        step,
        reward: v.reward.reduce((a, b) => a + b, 0) / v.reward.length,
        ref: v.ref.length ? v.ref.reduce((a, b) => a + b, 0) / v.ref.length : null,
      }));
  }, [records]);

  return (
    <SimpleLineChart
      height={height}
      xLabels={data.map((d) => d.step)}
      series={[
        { key: "reward", label: "reward", color: "var(--primary)", values: data.map((d) => d.reward) },
        { key: "ref", label: "ref", color: "var(--accent)", values: data.map((d) => d.ref), dashed: true },
      ]}
    />
  );
}

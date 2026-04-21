import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import type { RLBoardRecord } from "@/lib/rlboard/schema";

/**
 * Reward Curve module — mean reward per step (vs ref_reward when available).
 * Independent: pass `records`. Composable: drop into any layout.
 */
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
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="step" stroke="var(--muted-foreground)" fontSize={11} />
          <YAxis stroke="var(--muted-foreground)" fontSize={11} />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="reward" stroke="var(--primary)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="ref" stroke="var(--accent)" strokeWidth={2} strokeDasharray="4 4" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

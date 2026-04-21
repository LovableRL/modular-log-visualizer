import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import type { RLBoardRecord } from "@/lib/rlboard/schema";
import { aggregate } from "@/lib/rlboard/colors";
import { useOptionalPerf } from "@/lib/rlboard/perf";

/**
 * Multi-line per-token curve. For long sequences, downsamples to <=maxPoints
 * so the SVG stays responsive. Drives a comparison of logp / value / reward / adv.
 */
export function TokenCurves({
  record,
  range,
  height = 280,
  maxPoints: maxPointsProp,
}: {
  record: RLBoardRecord;
  range?: [number, number] | null;
  height?: number;
  maxPoints?: number;
}) {
  const perf = useOptionalPerf();
  const maxPoints = maxPointsProp ?? perf?.params.maxCurvePoints ?? 1500;
  const data = useMemo(() => {
    const slice = (arr?: number[]) => {
      if (!arr) return undefined;
      if (range) return arr.slice(range[0], range[1]);
      return arr;
    };
    const logp = slice(record.logprobs);
    const reflp = slice(record.ref_logprobs);
    const val = slice(record.values);
    const tr = slice(record.token_rewards);
    const adv = slice(record.advantages);
    const ent = slice(record.entropy);
    const n = Math.max(
      logp?.length ?? 0, val?.length ?? 0, tr?.length ?? 0, adv?.length ?? 0, ent?.length ?? 0,
    );
    if (n === 0) return [];
    const buckets = Math.min(maxPoints, n);
    const dn = (a?: number[]) => (a ? aggregate(a, buckets).map((b) => b.mean) : undefined);
    const aLogp = dn(logp);
    const aRef = dn(reflp);
    const aVal = dn(val);
    const aTr = dn(tr);
    const aAdv = dn(adv);
    const aEnt = dn(ent);
    const baseStart = range ? range[0] : 0;
    const step = n / buckets;
    return Array.from({ length: buckets }, (_, i) => ({
      i: Math.round(baseStart + i * step),
      logp: aLogp?.[i] ?? null,
      ref_logp: aRef?.[i] ?? null,
      value: aVal?.[i] ?? null,
      reward: aTr?.[i] ?? null,
      adv: aAdv?.[i] ?? null,
      entropy: aEnt?.[i] ?? null,
    }));
  }, [record, range, maxPoints]);

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="i" stroke="var(--muted-foreground)" fontSize={11} />
          <YAxis stroke="var(--muted-foreground)" fontSize={11} />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="logp" stroke="var(--primary)" dot={false} strokeWidth={1.5} />
          <Line type="monotone" dataKey="ref_logp" stroke="var(--accent)" dot={false} strokeWidth={1.2} strokeDasharray="3 3" />
          <Line type="monotone" dataKey="value" stroke="var(--info)" dot={false} strokeWidth={1.5} />
          <Line type="monotone" dataKey="reward" stroke="var(--success)" dot={false} strokeWidth={1.5} />
          <Line type="monotone" dataKey="adv" stroke="var(--warning)" dot={false} strokeWidth={1.2} />
          <Line type="monotone" dataKey="entropy" stroke="var(--muted-foreground)" dot={false} strokeWidth={1} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

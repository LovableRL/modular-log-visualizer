import { useMemo } from "react";
import type { RLBoardRecord } from "@/lib/rlboard/schema";
import { aggregate } from "@/lib/rlboard/colors";
import { useOptionalPerf } from "@/lib/rlboard/perf";
import { SimpleLineChart } from "./SimpleCharts";

/** Multi-line per-token curve with bounded downsampling and no Recharts runtime state. */
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
      logp?.length ?? 0,
      reflp?.length ?? 0,
      val?.length ?? 0,
      tr?.length ?? 0,
      adv?.length ?? 0,
      ent?.length ?? 0,
    );
    if (n === 0) return { x: [], logp: [], reflp: [], val: [], tr: [], adv: [], ent: [] };
    const buckets = Math.min(maxPoints, n);
    const dn = (a?: number[]) => (a ? aggregate(a, buckets).map((b) => b.mean) : []);
    const baseStart = range ? range[0] : 0;
    const step = n / buckets;
    return {
      x: Array.from({ length: buckets }, (_, i) => Math.round(baseStart + i * step)),
      logp: dn(logp),
      reflp: dn(reflp),
      val: dn(val),
      tr: dn(tr),
      adv: dn(adv),
      ent: dn(ent),
    };
  }, [record, range, maxPoints]);

  return (
    <SimpleLineChart
      height={height}
      xLabels={data.x}
      series={[
        { key: "logp", label: "logp", color: "var(--primary)", values: data.logp },
        { key: "ref", label: "ref_logp", color: "var(--accent)", values: data.reflp, dashed: true },
        { key: "value", label: "value", color: "var(--info)", values: data.val },
        { key: "reward", label: "reward", color: "var(--success)", values: data.tr },
        { key: "adv", label: "adv", color: "var(--warning)", values: data.adv },
        { key: "entropy", label: "entropy", color: "var(--muted-foreground)", values: data.ent },
      ]}
    />
  );
}

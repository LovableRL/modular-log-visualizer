import { useMemo, useState } from "react";
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
  const [probView, setProbView] = useState(false);

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
    const xform = (a: number[]) => (probView ? a.map((v) => Math.exp(v)) : a);
    const baseStart = range ? range[0] : 0;
    const step = n / buckets;
    return {
      x: Array.from({ length: buckets }, (_, i) => Math.round(baseStart + i * step)),
      logp: xform(dn(logp)),
      reflp: xform(dn(reflp)),
      val: dn(val),
      tr: dn(tr),
      adv: dn(adv),
      ent: dn(ent),
    };
  }, [record, range, maxPoints, probView]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end">
        <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <input
            type="checkbox"
            checked={probView}
            onChange={(e) => setProbView(e.target.checked)}
            className="h-3 w-3 accent-primary"
          />
          <span>show p = exp(logp) instead of logp</span>
        </label>
      </div>
      <SimpleLineChart
        height={height}
        xLabels={data.x}
        series={[
          { key: "logp", label: probView ? "p" : "logp", color: "var(--primary)", values: data.logp },
          { key: "ref", label: probView ? "p_ref" : "ref_logp", color: "var(--accent)", values: data.reflp, dashed: true },
          { key: "value", label: "value", color: "var(--info)", values: data.val },
          { key: "reward", label: "reward", color: "var(--success)", values: data.tr },
          { key: "adv", label: "adv", color: "var(--warning)", values: data.adv },
          { key: "entropy", label: "entropy", color: "var(--muted-foreground)", values: data.ent },
        ]}
      />
    </div>
  );
}

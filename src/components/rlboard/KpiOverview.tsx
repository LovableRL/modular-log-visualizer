import { useMemo } from "react";
import { type RLBoardRecord, tokenCount } from "@/lib/rlboard/schema";
import { fmtNum } from "@/lib/rlboard/format";

type Props = {
  records: RLBoardRecord[];
  step: number | null;
};

type Kpi = {
  label: string;
  value: string;
  hint?: string;
};

function mean(xs: number[]): number {
  if (xs.length === 0) return NaN;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

export function KpiOverview({ records, step }: Props) {
  const kpis = useMemo<Kpi[]>(() => {
    if (records.length === 0) {
      return [
        { label: "rollouts", value: "0" },
        { label: "mean reward", value: "—" },
        { label: "mean Δ vs ref", value: "—" },
        { label: "mean KL", value: "—" },
        { label: "mean tokens", value: "—" },
      ];
    }
    const atStep = step != null ? records.filter((r) => r.step === step) : records;
    const pool = atStep.length > 0 ? atStep : records;

    const rewards = pool.map((r) => r.reward).filter(Number.isFinite);
    const deltas = pool
      .filter((r) => typeof r.ref_reward === "number")
      .map((r) => r.reward - (r.ref_reward as number));
    const kls = pool.map((r) => r.kl).filter((x): x is number => typeof x === "number");
    const lens = pool.map((r) => tokenCount(r)).filter((n) => n > 0);

    return [
      {
        label: "rollouts",
        value: pool.length.toLocaleString(),
        hint: step != null ? `at step ${step}` : "all steps",
      },
      { label: "mean reward", value: fmtNum(mean(rewards), 3) },
      {
        label: "mean Δ vs ref",
        value: deltas.length ? fmtNum(mean(deltas), 3) : "—",
        hint: deltas.length ? `${deltas.length} paired` : "no ref_reward",
      },
      {
        label: "mean KL",
        value: kls.length ? fmtNum(mean(kls), 3) : "—",
        hint: kls.length ? `${kls.length} samples` : "no kl",
      },
      {
        label: "mean tokens",
        value: lens.length ? Math.round(mean(lens)).toLocaleString() : "—",
      },
    ];
  }, [records, step]);

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {kpis.map((k) => (
        <div
          key={k.label}
          className="rounded-md border border-border/60 bg-card/40 px-3 py-2"
        >
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {k.label}
          </div>
          <div className="mt-1 font-mono text-lg leading-none text-foreground">
            {k.value}
          </div>
          {k.hint && (
            <div className="mt-1 font-mono text-[10px] text-muted-foreground">
              {k.hint}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

import { useMemo, useState } from "react";
import type { RLBoardRecord } from "@/lib/rlboard/schema";
import { tokenCount } from "@/lib/rlboard/schema";
import { recordRun } from "@/lib/rlboard/parse";
import { cn } from "@/lib/utils";

type SortKey = "step" | "reward" | "ref_reward" | "delta" | "kl" | "length" | "advMean";

export function ResponseTable({
  records,
  selectedIndex,
  onSelect,
  height = 320,
}: {
  records: RLBoardRecord[];
  selectedIndex?: number;
  onSelect?: (idx: number) => void;
  height?: number;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("reward");
  const [asc, setAsc] = useState(false);
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const enriched = records.map((r, i) => {
      const adv = r.advantages;
      return {
        idx: i,
        step: r.step,
        rid: r.rollout_id ?? `#${i}`,
        run: recordRun(r),
        reward: r.reward,
        ref_reward: r.ref_reward ?? null,
        delta: typeof r.ref_reward === "number" ? r.reward - r.ref_reward : null,
        kl: r.kl ?? null,
        length: tokenCount(r),
        advMean: adv && adv.length ? adv.reduce((a, b) => a + b, 0) / adv.length : null,
        preview: r.response.slice(0, 80),
      };
    });
    const filtered = q
      ? enriched.filter(
          (r) =>
            r.preview.toLowerCase().includes(q.toLowerCase()) ||
            r.rid.toLowerCase().includes(q.toLowerCase()),
        )
      : enriched;
    filtered.sort((a, b) => {
      const av = (a[sortKey] ?? -Infinity) as number;
      const bv = (b[sortKey] ?? -Infinity) as number;
      return asc ? av - bv : bv - av;
    });
    return filtered;
  }, [records, sortKey, asc, q]);

  const headers: { key: SortKey; label: string }[] = [
    { key: "step", label: "Step" },
    { key: "reward", label: "Reward" },
    { key: "ref_reward", label: "Ref" },
    { key: "delta", label: "Δ" },
    { key: "kl", label: "KL" },
    { key: "advMean", label: "Adv̄" },
    { key: "length", label: "Len" },
  ];

  const multiRun = useMemo(() => new Set(rows.map((r) => r.run)).size > 1, [rows]);

  return (
    <div className="space-y-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search response or id…"
        className="w-full rounded-md border border-border bg-input px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <div className="overflow-auto rounded-md border border-border" style={{ maxHeight: height }}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-2 py-2 text-left">id</th>
              {multiRun && <th className="px-2 py-2 text-left">run</th>}
              {headers.map((h) => (
                <th
                  key={h.key}
                  className="cursor-pointer px-2 py-2 text-right hover:text-foreground"
                  onClick={() => {
                    if (sortKey === h.key) setAsc(!asc);
                    else { setSortKey(h.key); setAsc(false); }
                  }}
                >
                  {h.label}{sortKey === h.key ? (asc ? " ▲" : " ▼") : ""}
                </th>
              ))}
              <th className="px-2 py-2 text-left">preview</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.idx}
                onClick={() => onSelect?.(r.idx)}
                className={cn(
                  "cursor-pointer border-t border-border transition-colors hover:bg-secondary/60",
                  r.idx === selectedIndex && "bg-primary/10",
                )}
              >
                <td className="px-2 py-1.5 font-mono text-xs">{r.rid}</td>
                {multiRun && (
                  <td className="px-2 py-1.5 font-mono text-[10px] text-muted-foreground">{r.run}</td>
                )}
                <td className="px-2 py-1.5 text-right font-mono">{r.step}</td>
                <td className="px-2 py-1.5 text-right font-mono">{r.reward.toFixed(3)}</td>
                <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">
                  {r.ref_reward != null ? r.ref_reward.toFixed(3) : "—"}
                </td>
                <td
                  className="px-2 py-1.5 text-right font-mono"
                  style={{ color: r.delta == null ? undefined : r.delta >= 0 ? "var(--success)" : "var(--destructive)" }}
                >
                  {r.delta != null ? (r.delta >= 0 ? "+" : "") + r.delta.toFixed(3) : "—"}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">
                  {r.kl != null ? r.kl.toFixed(3) : "—"}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">
                  {r.advMean != null ? r.advMean.toFixed(3) : "—"}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">{r.length}</td>
                <td className="px-2 py-1.5 max-w-[280px] truncate text-muted-foreground">{r.preview}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

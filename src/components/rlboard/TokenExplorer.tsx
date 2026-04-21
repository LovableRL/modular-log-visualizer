import { useState } from "react";
import type { RLBoardRecord } from "@/lib/rlboard/schema";
import { TokenHeatmap } from "./TokenHeatmap";
import { TokenInline } from "./TokenInline";
import { TokenCurves } from "./TokenCurves";
import { ModuleCard } from "./ModuleCard";

/**
 * TokenExplorer — composite module showing minimap (heatmap) + drill-down
 * (inline tokens + multi-line curves), wired together with a shared range.
 */
export function TokenExplorer({ record }: { record: RLBoardRecord }) {
  const [range, setRange] = useState<[number, number] | null>(null);
  return (
    <div className="space-y-4">
      <ModuleCard
        title="token-heatmap"
        subtitle="Minimap of the full sequence — drag to drill down"
        actions={
          range ? (
            <button
              onClick={() => setRange(null)}
              className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Reset range ({range[0].toLocaleString()}–{range[1].toLocaleString()})
            </button>
          ) : null
        }
      >
        <TokenHeatmap record={record} onRangeSelect={setRange} />
      </ModuleCard>
      <div className="grid gap-4 lg:grid-cols-2">
        <ModuleCard title="token-inline" subtitle="Per-token coloring (virtualized)">
          <TokenInline record={record} range={range} />
        </ModuleCard>
        <ModuleCard title="token-curves" subtitle="logp · value · reward · advantage · entropy">
          <TokenCurves record={record} range={range} />
        </ModuleCard>
      </div>
    </div>
  );
}

import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useRLBoard } from "@/lib/rlboard/context";
import {
  RewardCurve, RewardDistribution, ResponseTable,
  TokenHeatmap, TokenInline, TokenCurves, TokenExplorer, ModuleCard,
} from "@/components/rlboard";
import { useState } from "react";

export const Route = createFileRoute("/modules/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.id} · rlboard module` },
      {
        name: "description",
        content: `Standalone demo of the ${params.id} visualization module from rlboard.`,
      },
    ],
  }),
  component: ModulePage,
  notFoundComponent: () => (
    <main className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">Unknown module</h1>
      <p className="mt-2 text-muted-foreground">That module ID is not registered.</p>
      <Link to="/" className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
        Back to module gallery
      </Link>
    </main>
  ),
});

const SNIPPETS: Record<string, string> = {
  "reward-curve": `import { RewardCurve } from "@rlboard/react";\n\n<RewardCurve records={records} />`,
  "reward-distribution": `import { RewardDistribution } from "@rlboard/react";\n\n<RewardDistribution records={records} step={12} />`,
  "response-table": `import { ResponseTable } from "@rlboard/react";\n\n<ResponseTable\n  records={records}\n  selectedIndex={i}\n  onSelect={setI}\n/>`,
  "token-heatmap": `import { TokenHeatmap } from "@rlboard/react";\n\n<TokenHeatmap record={record} onRangeSelect={setRange} />`,
  "token-inline": `import { TokenInline } from "@rlboard/react";\n\n<TokenInline record={record} range={range} />`,
  "token-curves": `import { TokenCurves } from "@rlboard/react";\n\n<TokenCurves record={record} range={range} />`,
  "token-explorer": `import { TokenExplorer } from "@rlboard/react";\n\n<TokenExplorer record={record} />`,
};

function ModulePage() {
  const { id } = Route.useParams();
  const { records, selectedIndex, setSelectedIndex } = useRLBoard();
  const [range, setRange] = useState<[number, number] | null>(null);
  const selected = records[selectedIndex] ?? records[0];
  const snippet = SNIPPETS[id];
  if (!snippet) throw notFound();

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <div>
        <Link to="/" className="font-mono text-xs text-muted-foreground hover:text-foreground">
          ← all modules
        </Link>
        <h1 className="mt-2 font-mono text-2xl font-semibold">{id}</h1>
        <p className="text-sm text-muted-foreground">
          Standalone demo · backed by the same shared sample data.
        </p>
      </div>

      <ModuleCard title="live demo" subtitle={`Using the built-in sample (${records.length} records)`}>
        {id === "reward-curve" && <RewardCurve records={records} />}
        {id === "reward-distribution" && <RewardDistribution records={records} />}
        {id === "response-table" && (
          <ResponseTable
            records={records}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
          />
        )}
        {id === "token-heatmap" && selected && (
          <TokenHeatmap record={selected} onRangeSelect={setRange} />
        )}
        {id === "token-inline" && selected && <TokenInline record={selected} range={range} />}
        {id === "token-curves" && selected && <TokenCurves record={selected} range={range} />}
        {id === "token-explorer" && selected && <TokenExplorer record={selected} />}
      </ModuleCard>

      <ModuleCard title="usage" subtitle="Drop into any React app">
        <pre className="overflow-auto rounded-md border border-border bg-background/40 p-4 font-mono text-xs">
{snippet}
        </pre>
      </ModuleCard>
    </main>
  );
}

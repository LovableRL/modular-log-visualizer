import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useRLBoard } from "@/lib/rlboard/context";
import {
  RewardCurve,
  RewardDistribution,
  ResponseTable,
  TokenPager,
  ModuleCard,
  PerfPanel,
} from "@/components/rlboard";
import { parseJsonl } from "@/lib/rlboard/parse";
import { makeSampleRecords, makeLongContextRecord } from "@/lib/rlboard/sample";
import { tokenCount } from "@/lib/rlboard/schema";

export const Route = createFileRoute("/playground")({
  head: () => ({
    meta: [
      { title: "Playground · rlboard" },
      {
        name: "description",
        content:
          "Three-pane workbench: training metrics, rollout list, and a paged token explorer that scales to 256k tokens.",
      },
    ],
  }),
  component: PlaygroundPage,
});

function PlaygroundPage() {
  const { records, setRecords, selectedIndex, setSelectedIndex, source, setSource } = useRLBoard();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPerf, setShowPerf] = useState(false);

  const onFile = async (f: File) => {
    setError(null);
    const text = await f.text();
    const { records: recs, errors } = parseJsonl(text);
    if (recs.length === 0) {
      setError(`No valid records found. ${errors[0]?.message ?? ""}`);
      return;
    }
    setRecords(recs);
    setSource(`${f.name} (${recs.length} records${errors.length ? `, ${errors.length} skipped` : ""})`);
  };

  const selected = records[selectedIndex] ?? records[0];

  return (
    <main className="mx-auto max-w-[1600px] space-y-4 px-4 py-6">
      {/* Toolbar */}
      <section className="rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold">Playground</h1>
            <p className="truncate text-xs text-muted-foreground">
              source: <span className="font-mono text-foreground">{source}</span> ·{" "}
              <span className="font-mono">{records.length}</span> records
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".jsonl,.txt,application/json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Upload .jsonl
            </button>
            <button
              onClick={() => {
                setRecords(makeSampleRecords());
                setSource("Built-in sample (rhyme task)");
                setSelectedIndex(0);
              }}
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary"
            >
              Sample
            </button>
            <button
              onClick={() => {
                setRecords([makeLongContextRecord(262144)]);
                setSource("Synthetic 256k-token rollout (BPE-style)");
                setSelectedIndex(0);
              }}
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary"
              title="Generate one synthetic 262 144-token rollout to stress-test long-context views"
            >
              256k stress-test
            </button>
            <button
              onClick={() => setShowPerf((s) => !s)}
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary"
            >
              {showPerf ? "Hide" : "Show"} perf
            </button>
          </div>
        </div>
        {error ? (
          <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </section>

      {showPerf && <PerfPanel />}

      {/* Three-pane workbench: training | rollouts | explorer */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* LEFT — training metrics */}
        <div className="space-y-4 lg:col-span-3">
          <ModuleCard title="reward-curve" subtitle="Mean reward per step">
            <RewardCurve records={records} height={200} />
          </ModuleCard>
          <ModuleCard title="reward-distribution" subtitle="Per-step histogram">
            <RewardDistribution records={records} height={200} />
          </ModuleCard>
        </div>

        {/* MIDDLE — rollout list */}
        <div className="lg:col-span-4">
          <ModuleCard
            title="response-table"
            subtitle="Click a row to inspect"
            actions={
              <span className="font-mono text-[11px] text-muted-foreground">
                #{selectedIndex} · {selected ? tokenCount(selected).toLocaleString() : 0} tok
              </span>
            }
          >
            <ResponseTable
              records={records}
              selectedIndex={selectedIndex}
              onSelect={setSelectedIndex}
              height={620}
            />
          </ModuleCard>
        </div>

        {/* RIGHT — token explorer for the selected rollout */}
        <div className="lg:col-span-5">
          {selected ? (
            <ModuleCard
              title="token-pager"
              subtitle={`#${selectedIndex} · step ${selected.step} · reward ${selected.reward.toFixed(3)}`}
              actions={
                <span className="font-mono text-[11px] text-muted-foreground">
                  {tokenCount(selected).toLocaleString()} tokens
                </span>
              }
            >
              <details className="mb-3 text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  prompt & response text
                </summary>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-background/40 p-2 font-mono text-[11px]">
                    {selected.prompt}
                  </pre>
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-background/40 p-2 font-mono text-[11px]">
                    {selected.response}
                  </pre>
                </div>
              </details>
              <TokenPager record={selected} />
            </ModuleCard>
          ) : (
            <ModuleCard title="token-pager" subtitle="Select a rollout to inspect">
              <p className="py-12 text-center text-sm text-muted-foreground">
                No rollout selected.
              </p>
            </ModuleCard>
          )}
        </div>
      </div>
    </main>
  );
}

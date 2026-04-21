import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useRLBoard } from "@/lib/rlboard/context";
import {
  RewardCurve, RewardDistribution, ResponseTable, TokenExplorer, ModuleCard, PerfPanel,
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
          "Upload your jsonl logs or use the built-in sample to explore reward curves, response tables and token-level heatmaps interactively.",
      },
    ],
  }),
  component: PlaygroundPage,
});

function PlaygroundPage() {
  const { records, setRecords, selectedIndex, setSelectedIndex, source, setSource } = useRLBoard();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

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
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Playground</h1>
            <p className="text-sm text-muted-foreground">
              Source: <span className="font-mono text-foreground">{source}</span> ·{" "}
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
              }}
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary"
            >
              Sample
            </button>
            <button
              onClick={() => {
                setRecords([makeLongContextRecord(262144)]);
                setSource("Synthetic 256k-token rollout");
              }}
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary"
              title="Generate one synthetic 262 144-token rollout to stress-test long-context views"
            >
              256k stress-test
            </button>
          </div>
        </div>
        {error ? (
          <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </section>

      <PerfPanel />

      <div className="grid gap-4 lg:grid-cols-2">
        <ModuleCard title="reward-curve" subtitle="Mean reward per step (with reference)">
          <RewardCurve records={records} />
        </ModuleCard>
        <ModuleCard title="reward-distribution" subtitle="Reward histogram for the chosen step">
          <RewardDistribution records={records} />
        </ModuleCard>
      </div>

      <ModuleCard
        title="response-table"
        subtitle="Click a row to inspect that rollout below"
        actions={
          <span className="font-mono text-xs text-muted-foreground">
            selected: #{selectedIndex} · {selected ? tokenCount(selected).toLocaleString() : 0} tokens
          </span>
        }
      >
        <ResponseTable
          records={records}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
        />
      </ModuleCard>

      {selected ? (
        <div className="space-y-4">
          <ModuleCard title="rollout" subtitle={`#${selectedIndex} — step ${selected.step} · reward ${selected.reward.toFixed(3)}`}>
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Prompt & response text
              </summary>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div>
                  <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">prompt</div>
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-background/40 p-3 font-mono text-xs">
                    {selected.prompt}
                  </pre>
                </div>
                <div>
                  <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">response</div>
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-background/40 p-3 font-mono text-xs">
                    {selected.response}
                  </pre>
                </div>
              </div>
            </details>
          </ModuleCard>
          <TokenExplorer record={selected} />
        </div>
      ) : null}
    </main>
  );
}

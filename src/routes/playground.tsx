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
          "Inspect RL training rollouts: reward curves, response table, and a paged token explorer that scales to 256k tokens.",
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
    setSelectedIndex(0);
  };

  const selected = records[selectedIndex] ?? records[0];

  return (
    <main className="mx-auto w-full max-w-[1400px] space-y-6 px-4 py-6">
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

      {/* Section 1 — Training metrics, side by side on wide screens */}
      <section>
        <SectionTitle>1 · Training metrics</SectionTitle>
        <div className="grid gap-4 md:grid-cols-2">
          <ModuleCard title="reward-curve" subtitle="Mean reward per step (vs reference)">
            <RewardCurve records={records} height={260} />
          </ModuleCard>
          <ModuleCard title="reward-distribution" subtitle="Per-step reward histogram">
            <RewardDistribution records={records} height={260} />
          </ModuleCard>
        </div>
      </section>

      {/* Section 2 — Rollout list (full width, original RLLoggingBoard style) */}
      <section>
        <SectionTitle>2 · Rollouts</SectionTitle>
        <ModuleCard
          title="response-table"
          subtitle="Click a row to load it into the token explorer below"
          actions={
            <span className="font-mono text-[11px] text-muted-foreground">
              selected #{selectedIndex} · {selected ? tokenCount(selected).toLocaleString() : 0} tokens
            </span>
          }
        >
          <ResponseTable
            records={records}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
            height={360}
          />
        </ModuleCard>
      </section>

      {/* Section 3 — Selected rollout's token explorer (full width — needs the room) */}
      <section>
        <SectionTitle>3 · Token explorer</SectionTitle>
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
            <details className="mb-4 text-sm">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                prompt &amp; response text
              </summary>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div>
                  <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    prompt
                  </div>
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-background/40 p-3 font-mono text-xs">
                    {selected.prompt}
                  </pre>
                </div>
                <div>
                  <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    response
                  </div>
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-background/40 p-3 font-mono text-xs">
                    {selected.response}
                  </pre>
                </div>
              </div>
            </details>
            <TokenPager record={selected} />
          </ModuleCard>
        ) : (
          <ModuleCard title="token-pager" subtitle="Select a rollout above">
            <p className="py-12 text-center text-sm text-muted-foreground">
              No rollout selected.
            </p>
          </ModuleCard>
        )}
      </section>
    </main>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
      {children}
    </h2>
  );
}

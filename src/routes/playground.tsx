import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useRLBoard } from "@/lib/rlboard/context";
import {
  RewardCurve,
  RewardDistribution,
  RewardDeltaDistribution,
  ResponseTable,
  TokenPager,
  ModuleCard,
  PerfPanel,
  CriticDiagnostic,
  ResponseDiff,
  TrajectoryView,
} from "@/components/rlboard";
import { parseFiles } from "@/lib/rlboard/parse";
import { makeSampleRecords, makeLongContextRecord } from "@/lib/rlboard/sample";
import { tokenCount, type RLBoardRecord } from "@/lib/rlboard/schema";
import { deriveSegments } from "@/lib/rlboard/segments";

export const Route = createFileRoute("/playground")({
  head: () => ({
    meta: [
      { title: "Playground · rlboard" },
      {
        name: "description",
        content:
          "Inspect RL training rollouts: reward curves, response table, critic diagnostic and token explorer scaling to 256k tokens.",
      },
    ],
  }),
  component: PlaygroundPage,
});

function PlaygroundPage() {
  const {
    records,
    setRecords,
    selectedIndex,
    setSelectedIndex,
    source,
    setSource,
    runs,
    activeRuns,
    toggleRun,
    setActiveRuns,
    filteredRecords,
    hideSpecialTokens,
    setHideSpecialTokens,
  } = useRLBoard();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPerf, setShowPerf] = useState(false);

  const onFiles = async (files: File[]) => {
    setError(null);
    const { records: recs, perFile } = await parseFiles(files);
    if (recs.length === 0) {
      setError(`No valid records found in ${files.length} file(s).`);
      return;
    }
    setRecords(recs);
    const summary = perFile
      .map((f) => `${f.name} (${f.count}${f.errors ? `, ${f.errors} skipped` : ""})`)
      .join(" · ");
    setSource(`${perFile.length} file${perFile.length > 1 ? "s" : ""}: ${summary}`);
    setSelectedIndex(0);
  };

  const selected = filteredRecords[selectedIndex] ?? filteredRecords[0];

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
              {filteredRecords.length !== records.length && (
                <> · <span className="font-mono">{filteredRecords.length}</span> after filter</>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".jsonl,.txt,application/json"
              multiple
              hidden
              onChange={(e) => {
                const fs = Array.from(e.target.files ?? []);
                if (fs.length) void onFiles(fs);
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Upload .jsonl (multi)
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
            <label className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm">
              <input
                type="checkbox"
                checked={hideSpecialTokens}
                onChange={(e) => setHideSpecialTokens(e.target.checked)}
                className="h-3 w-3 accent-primary"
              />
              hide &lt;pad&gt; / specials
            </label>
            <button
              onClick={() => setShowPerf((s) => !s)}
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary"
            >
              {showPerf ? "Hide" : "Show"} perf
            </button>
          </div>
        </div>

        {/* Run chips — only when more than one run is loaded */}
        {runs.length > 1 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              runs
            </span>
            {runs.map((run) => {
              const active = activeRuns.size === 0 || activeRuns.has(run);
              return (
                <button
                  key={run}
                  onClick={() => toggleRun(run)}
                  className="rounded-full border px-3 py-0.5 font-mono text-[11px] transition-colors"
                  style={{
                    borderColor: active ? "var(--primary)" : "var(--border)",
                    background: active ? "color-mix(in oklab, var(--primary) 18%, transparent)" : "transparent",
                    color: active ? "var(--foreground)" : "var(--muted-foreground)",
                  }}
                >
                  {run}
                </button>
              );
            })}
            {activeRuns.size > 0 && (
              <button
                onClick={() => setActiveRuns(new Set())}
                className="ml-2 text-[11px] text-muted-foreground underline hover:text-foreground"
              >
                clear
              </button>
            )}
          </div>
        )}

        {error ? (
          <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </section>

      {showPerf && <PerfPanel />}

      {/* Section 1 — Training metrics */}
      <section>
        <SectionTitle>1 · Training metrics</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-3">
          <ModuleCard title="reward-curve" subtitle="Mean reward per step (vs reference)">
            <RewardCurve records={filteredRecords} height={240} />
          </ModuleCard>
          <ModuleCard title="reward-distribution" subtitle="Per-step reward histogram">
            <RewardDistribution records={filteredRecords} height={240} />
          </ModuleCard>
          <ModuleCard
            title="reward − ref_reward"
            subtitle="How much the policy beats the reference"
          >
            <RewardDeltaDistribution records={filteredRecords} height={240} />
          </ModuleCard>
        </div>
      </section>

      {/* Section 2 — Rollout list */}
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
            records={filteredRecords}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
            height={360}
          />
        </ModuleCard>
      </section>

      {/* Section 3 — Selected rollout: trajectory or flat tokens */}
      <SelectedRolloutSection selected={selected} selectedIndex={selectedIndex} />

      {/* Section 4 — Critic + diff diagnostics */}
      {selected && (
        <section>
          <SectionTitle>4 · Diagnostics</SectionTitle>
          <div className="grid gap-4 lg:grid-cols-2">
            <ModuleCard
              title="critic-diagnostic"
              subtitle="value vs token_reward (lower MSE = better critic fit)"
            >
              <CriticDiagnostic record={selected} height={240} />
            </ModuleCard>
            <ModuleCard
              title="rl-vs-ref-text"
              subtitle="Word-level diff against ref_response"
            >
              <ResponseDiff record={selected} />
            </ModuleCard>
          </div>
        </section>
      )}
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

function SelectedRolloutSection({
  selected,
  selectedIndex,
}: {
  selected: RLBoardRecord | undefined;
  selectedIndex: number;
}) {
  if (!selected) {
    return (
      <section>
        <SectionTitle>3 · Trajectory</SectionTitle>
        <ModuleCard title="trajectory-view" subtitle="Select a rollout above">
          <p className="py-12 text-center text-sm text-muted-foreground">
            No rollout selected.
          </p>
        </ModuleCard>
      </section>
    );
  }

  const subtitle = `#${selectedIndex} · step ${selected.step} · reward ${selected.reward.toFixed(3)}${
    typeof selected.ref_reward === "number"
      ? ` · Δ ${(selected.reward - selected.ref_reward).toFixed(3)}`
      : ""
  }`;

  return (
    <section>
      <SectionTitle>3 · Trajectory</SectionTitle>
      <ModuleCard
        title="trajectory-view"
        subtitle={subtitle}
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
        <TrajectoryView record={selected} />
      </ModuleCard>
    </section>
  );
}

  selected,
  selectedIndex,
}: {
  selected: RLBoardRecord | undefined;
  selectedIndex: number;
}) {
  const segments = useMemo(
    () => (selected ? deriveSegments(selected) : []),
    [selected],
  );
  const hasTrajectory = segments.length >= 2;
  const [view, setView] = useState<"flat" | "trajectory">(
    hasTrajectory ? "trajectory" : "flat",
  );
  // re-default when selection changes
  const lastIdxRef = useRef(selectedIndex);
  if (lastIdxRef.current !== selectedIndex) {
    lastIdxRef.current = selectedIndex;
    // eslint-disable-next-line react-hooks/rules-of-hooks
  }

  if (!selected) {
    return (
      <section>
        <SectionTitle>3 · Token explorer</SectionTitle>
        <ModuleCard title="token-pager" subtitle="Select a rollout above">
          <p className="py-12 text-center text-sm text-muted-foreground">
            No rollout selected.
          </p>
        </ModuleCard>
      </section>
    );
  }

  const subtitle = `#${selectedIndex} · step ${selected.step} · reward ${selected.reward.toFixed(3)}${
    typeof selected.ref_reward === "number"
      ? ` · Δ ${(selected.reward - selected.ref_reward).toFixed(3)}`
      : ""
  }`;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <SectionTitle>3 · {view === "trajectory" ? "Trajectory" : "Token explorer"}</SectionTitle>
        <div className="inline-flex overflow-hidden rounded-md border border-border text-[11px] font-mono">
          <button
            onClick={() => setView("flat")}
            className="px-2 py-1 transition-colors"
            style={{
              background: view === "flat" ? "var(--secondary)" : "transparent",
              color: view === "flat" ? "var(--foreground)" : "var(--muted-foreground)",
            }}
          >
            flat tokens
          </button>
          <button
            onClick={() => setView("trajectory")}
            disabled={!hasTrajectory}
            className="px-2 py-1 transition-colors disabled:opacity-40"
            style={{
              background: view === "trajectory" ? "var(--secondary)" : "transparent",
              color: view === "trajectory" ? "var(--foreground)" : "var(--muted-foreground)",
            }}
            title={hasTrajectory ? "" : "No multi-segment structure detected"}
          >
            trajectory ({segments.length})
          </button>
        </div>
      </div>

      <ModuleCard
        title={view === "trajectory" ? "trajectory-view" : "token-pager"}
        subtitle={subtitle}
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
        {view === "trajectory" ? (
          <TrajectoryView record={selected} />
        ) : (
          <TokenPager record={selected} />
        )}
      </ModuleCard>
    </section>
  );
}

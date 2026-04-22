import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useRLBoard } from "@/lib/rlboard/context";
import {
  RewardCurve,
  RewardDistribution,
  RewardDeltaDistribution,
  ResponseTable,
  ModuleCard,
  PerfPanel,
  CriticDiagnostic,
  ResponseDiff,
  TrajectoryView,
} from "@/components/rlboard";
import { parseFiles } from "@/lib/rlboard/parse";
import { makeSampleRecords, makeLongContextRecord } from "@/lib/rlboard/sample";
import { tokenCount, type RLBoardRecord } from "@/lib/rlboard/schema";

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

  // Per-section visibility (persisted)
  const SECTIONS = [
    { id: "metrics", label: "metrics" },
    { id: "rollouts", label: "rollouts" },
    { id: "trajectory", label: "trajectory" },
    { id: "diagnostics", label: "diagnostics" },
  ] as const;
  type SectionId = (typeof SECTIONS)[number]["id"];
  const [visibleSections, setVisibleSections] = useState<Set<SectionId>>(() => {
    if (typeof window === "undefined") return new Set(SECTIONS.map((s) => s.id));
    try {
      const raw = localStorage.getItem("rlboard:sections");
      if (raw) return new Set(JSON.parse(raw) as SectionId[]);
    } catch {
      /* ignore */
    }
    return new Set(SECTIONS.map((s) => s.id));
  });
  useEffect(() => {
    try {
      localStorage.setItem("rlboard:sections", JSON.stringify(Array.from(visibleSections)));
    } catch {
      /* ignore */
    }
  }, [visibleSections]);
  const toggleSection = (id: SectionId) =>
    setVisibleSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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

        {/* Section visibility chips */}
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            sections
          </span>
          {SECTIONS.map((s) => {
            const active = visibleSections.has(s.id);
            return (
              <button
                key={s.id}
                onClick={() => toggleSection(s.id)}
                className="rounded-full border px-3 py-0.5 font-mono text-[11px] transition-colors"
                style={{
                  borderColor: active ? "var(--primary)" : "var(--border)",
                  background: active
                    ? "color-mix(in oklab, var(--primary) 18%, transparent)"
                    : "transparent",
                  color: active ? "var(--foreground)" : "var(--muted-foreground)",
                }}
                title={active ? `Hide ${s.label}` : `Show ${s.label}`}
              >
                {active ? "✓ " : "  "}
                {s.label}
              </button>
            );
          })}
          <span className="ml-2 text-[10px] text-muted-foreground">
            tip: drag bottom-right corner of any card to resize
          </span>
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

type SectionTitleProps = { children: React.ReactNode };
function SectionTitle(props: SectionTitleProps) {
  const { children } = props;
  return (
    <h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
      {children}
    </h2>
  );
}

type SelectedRolloutSectionProps = {
  selected: RLBoardRecord | undefined;
  selectedIndex: number;
};

function SelectedRolloutSection(props: SelectedRolloutSectionProps) {
  const { selected, selectedIndex } = props;
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

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useRLBoard } from "@/lib/rlboard/context";
import {
  RewardCurve,
  RewardDistribution,
  RewardDeltaDistribution,
  ResponseTable,
  ResizableBlock,
  PerfPanel,
  CriticDiagnostic,
  ResponseDiff,
  TrajectoryView,
  KpiOverview,
} from "@/components/rlboard";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Slider } from "@/components/ui/slider";
import { parseFiles, parseJsonl } from "@/lib/rlboard/parse";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { tokenCount, type RLBoardRecord } from "@/lib/rlboard/schema";

const DEMO_URL = "/demo/rlboard-demo.jsonl";

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
    steps,
    globalStep,
    setGlobalStep,
    activeStep,
    varianceScale,
    setVarianceScale,
  } = useRLBoard();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPerf, setShowPerf] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);

  const loadDemo = async () => {
    setError(null);
    setLoadingDemo(true);
    try {
      const res = await fetch(DEMO_URL, { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const { records: recs, errors } = parseJsonl(text, "demo");
      if (recs.length === 0) {
        throw new Error(`Demo file parsed 0 valid records (${errors.length} errors)`);
      }
      setRecords(recs);
      setSource(
        `demo/rlboard-demo.jsonl (${recs.length} records${errors.length ? `, ${errors.length} skipped` : ""})`,
      );
      setSelectedIndex(0);
    } catch (e) {
      setError(
        `Failed to load demo jsonl: ${(e as Error).message}. Upload your own .jsonl to continue.`,
      );
    } finally {
      setLoadingDemo(false);
    }
  };

  // Auto-load the demo file on first mount when no records are present yet.
  useEffect(() => {
    if (records.length === 0 && !loadingDemo) {
      void loadDemo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <main className="mx-auto w-full max-w-[1400px] space-y-4 px-4 py-4">
      {/* Toolbar — row 1: source + actions */}
      <section className="rounded-md border border-border bg-card/40 p-3">
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
              onClick={() => void loadDemo()}
              disabled={loadingDemo}
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary disabled:opacity-50"
              title="Re-fetch /demo/rlboard-demo.jsonl"
            >
              {loadingDemo ? "loading…" : "Reload demo"}
            </button>
            <a
              href={DEMO_URL}
              download="rlboard-demo.jsonl"
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary"
              title="Download the demo .jsonl as a template for your own training logs"
            >
              Download .jsonl
            </a>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary"
                  title="View the expected jsonl record schema"
                >
                  Schema
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[480px] max-w-[90vw] p-0">
                <SchemaPopoverBody />
              </PopoverContent>
            </Popover>
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
              className="rounded-md border border-border/60 px-2 py-1.5 text-[11px] text-muted-foreground hover:bg-secondary hover:text-foreground"
              title="Toggle performance overlay"
            >
              {showPerf ? "hide perf" : "perf"}
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
              className="rounded-md border border-border/60 px-2 py-1.5 text-[11px] text-muted-foreground hover:bg-secondary hover:text-foreground"
              title="Toggle performance overlay"
            >
              {showPerf ? "hide perf" : "perf"}
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
          <span
            className="ml-2 cursor-help font-mono text-[10px] text-muted-foreground"
            title="Drag splitters between blocks · drag the bottom edge of each block to resize its height"
          >
            (?)
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

      {/* KPI overview */}
      {records.length > 0 && <KpiOverview records={filteredRecords} step={globalStep} />}

      {/* Sync controls — global step + variance scale (themed sliders) */}
      {steps.length > 0 && (
        <section className="rounded-md border border-border/60 bg-card/30 px-3 py-3">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex min-w-[280px] flex-1 items-center gap-3">
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                step
              </span>
              <Slider
                min={steps[0]}
                max={steps[steps.length - 1]}
                step={1}
                value={[activeStep]}
                onValueChange={([v]) => {
                  const nearest = steps.reduce((p, c) =>
                    Math.abs(c - v) < Math.abs(p - v) ? c : p,
                  );
                  setGlobalStep(nearest);
                }}
                className="flex-1"
              />
              <span className="min-w-[72px] text-right font-mono text-[11px] text-foreground">
                {activeStep}
                <span className="text-muted-foreground">
                  /{steps[steps.length - 1]}
                </span>
              </span>
              {globalStep != null && (
                <button
                  onClick={() => setGlobalStep(null)}
                  className="font-mono text-[10px] text-muted-foreground underline hover:text-foreground"
                  title="Follow latest step"
                >
                  latest
                </button>
              )}
            </div>
            <div className="flex w-[260px] items-center gap-3">
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                variance
              </span>
              <Slider
                min={0}
                max={3}
                step={0.25}
                value={[varianceScale]}
                onValueChange={([v]) => setVarianceScale(v)}
                className="flex-1"
              />
              <span className="min-w-[44px] text-right font-mono text-[11px] text-foreground">
                ±{varianceScale.toFixed(2)}σ
              </span>
            </div>
          </div>
        </section>
      )}


      {showPerf && <PerfPanel />}

      {/* Section 1 — Training metrics: 3-panel horizontal splitter */}
      {visibleSections.has("metrics") && (
        <section>
          <SectionTitle>1 · Training metrics</SectionTitle>
          <ResizablePanelGroup
            direction="horizontal"
            id="rlboard-metrics"
            className="h-[300px] rounded-md border border-border/60"
          >
            <ResizablePanel defaultSize={34} minSize={18}>
              <ResizableBlock
                id="reward-curve"
                title="reward-curve"
                subtitle={`mean ± ${varianceScale.toFixed(2)}σ per step`}
                defaultHeight={260}
              >
                {({ width, height }) => (
                  <RewardCurve
                    records={filteredRecords}
                    width={width}
                    height={height}
                    varianceScale={varianceScale}
                  />
                )}
              </ResizableBlock>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={33} minSize={18}>
              <ResizableBlock
                id="reward-distribution"
                title="reward-distribution"
                subtitle="per-step histogram"
                defaultHeight={260}
              >
                {({ width, height }) => (
                  <RewardDistribution
                    records={filteredRecords}
                    step={activeStep}
                    width={width}
                    height={height}
                  />
                )}
              </ResizableBlock>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={33} minSize={18}>
              <ResizableBlock
                id="reward-delta"
                title="reward − ref_reward"
                subtitle="policy vs reference"
                defaultHeight={260}
              >
                {({ width, height }) => (
                  <RewardDeltaDistribution
                    records={filteredRecords}
                    step={activeStep}
                    width={width}
                    height={height}
                  />
                )}
              </ResizableBlock>
            </ResizablePanel>
          </ResizablePanelGroup>
        </section>
      )}

      {/* Section 2 — Rollout list */}
      {visibleSections.has("rollouts") && (
        <section>
          <SectionTitle>2 · Rollouts</SectionTitle>
          <ResizableBlock
            id="response-table"
            title="response-table"
            subtitle="click a row to load it into the trajectory below"
            defaultHeight={480}
            actions={
              <span className="font-mono text-[11px] text-muted-foreground">
                selected #{selectedIndex} ·{" "}
                {selected ? tokenCount(selected).toLocaleString() : 0} tokens
              </span>
            }
          >
            {({ height }) => (
              <ResponseTable
                records={filteredRecords}
                selectedIndex={selectedIndex}
                onSelect={setSelectedIndex}
                height={height}
              />
            )}
          </ResizableBlock>
        </section>
      )}

      {/* Section 3 — Diagnostics: 2-panel horizontal splitter */}
      {visibleSections.has("diagnostics") && selected && (
        <section>
          <SectionTitle>3 · Diagnostics</SectionTitle>
          <ResizablePanelGroup
            direction="horizontal"
            id="rlboard-diagnostics"
            className="h-[300px] rounded-md border border-border/60"
          >
            <ResizablePanel defaultSize={50} minSize={20}>
              <ResizableBlock
                id="critic-diagnostic"
                title="critic-diagnostic"
                subtitle="value vs token_reward (lower MSE = better fit)"
                defaultHeight={260}
              >
                {({ width, height }) => (
                  <CriticDiagnostic record={selected} width={width} height={height} />
                )}
              </ResizableBlock>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={50} minSize={20}>
              <ResizableBlock
                id="rl-vs-ref-text"
                title="rl-vs-ref-text"
                subtitle="word-level diff against ref_response"
                defaultHeight={260}
              >
                <ResponseDiff record={selected} />
              </ResizableBlock>
            </ResizablePanel>
          </ResizablePanelGroup>
        </section>
      )}

      {/* Section 4 — Trajectory (full-width, no card wrapper) */}
      {visibleSections.has("trajectory") && (
        <SelectedRolloutSection selected={selected} selectedIndex={selectedIndex} />
      )}
    </main>
  );
}

type SectionTitleProps = { children: React.ReactNode };
function SectionTitle(props: SectionTitleProps) {
  const { children } = props;
  return (
    <h2 className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
      <span className="inline-block h-3 w-[3px] rounded-sm bg-primary/70" />
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
        <SectionTitle>4 · Trajectory</SectionTitle>
        <p className="rounded-md border border-border bg-card py-12 text-center text-sm text-muted-foreground">
          No rollout selected.
        </p>
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
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <SectionTitle>4 · Trajectory</SectionTitle>
        <span className="font-mono text-[11px] text-muted-foreground">
          {subtitle} · {tokenCount(selected).toLocaleString()} tokens
        </span>
      </div>
      <details className="mb-3 rounded-md border border-border/60 p-3 text-sm">
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
    </section>
  );
}

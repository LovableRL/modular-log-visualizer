import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "Docs · rlboard" },
      {
        name: "description",
        content: "Data schema, embedding guide, Python and skill usage for the rlboard visualization library.",
      },
    ],
  }),
  component: DocsPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{title}</h2>
      <div className="prose prose-invert mt-3 max-w-none text-sm">
        {children}
      </div>
    </section>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="overflow-auto rounded-md border border-border bg-background/40 p-4 font-mono text-xs">
{children}
    </pre>
  );
}

function DocsPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Docs</h1>
        <p className="mt-2 text-muted-foreground">
          rlboard ships in three forms — React components, Python library, and an AI-callable skill —
          all sharing one schema.
        </p>
      </header>

      <Section title="data schema">
        <p>Each record represents one rollout. All token-level arrays must be aligned in length.</p>
        <Code>{`interface RLBoardRecord {
  step: number;
  rollout_id?: string;
  group_id?: string;             // GRPO/RLOO grouping (new)

  prompt: string;
  response: string;
  ref_response?: string;

  // per-token arrays (aligned with response_tokens length)
  prompt_tokens?: string[];
  response_tokens?: string[];
  logprobs?: number[];
  ref_logprobs?: number[];
  values?: number[];
  token_rewards?: number[];
  advantages?: number[];         // new
  entropy?: number[];            // new
  attention_entropy?: number[];  // new

  // scalars
  reward: number;
  ref_reward?: number;
  kl?: number;

  metadata?: Record<string, unknown>;
}`}</Code>
        <p>
          Backwards compatible with the original{" "}
          <code>rollout_samples/&lt;run&gt;/*.jsonl</code> layout. Any missing optional field
          gracefully disables the dependent visualization.
        </p>
      </Section>

      <Section title="react — component library">
        <p>Every chart is independently importable.</p>
        <Code>{`import { RewardCurve, TokenExplorer } from "@rlboard/react";

<RewardCurve records={records} />
<TokenExplorer record={records[0]} />`}</Code>
      </Section>

      <Section title="long-context strategy (256k tokens)">
        <ul className="list-disc pl-5">
          <li>
            <strong>Minimap heatmap</strong> aggregates per-token metrics into one bucket per
            display pixel — entire 256k sequence renders in &lt;16ms.
          </li>
          <li>
            <strong>Drag-select</strong> on the heatmap drives a shared range; inline tokens and
            curves zoom into that segment.
          </li>
          <li>
            <strong>Virtualized inline view</strong> (TanStack Virtual) renders only on-screen
            rows, keeping 60 fps even at 262 144 tokens.
          </li>
          <li>
            <strong>Curves downsample</strong> to ≤ 1500 buckets via min/mean/max aggregation, so
            SVG stays interactive.
          </li>
        </ul>
      </Section>

      <Section title="python — planned (phase 2)">
        <Code>{`from rlboard_viz import TokenHeatmap, RewardCurve, load

records = load("rollout_samples/run-42/")
TokenHeatmap(records[0]).save("heatmap.png")
RewardCurve(records).save("curve.svg")`}</Code>
      </Section>

      <Section title="skill — planned (phase 3)">
        <Code>{`# AI-callable skill API
rlboard.list_runs("rollout_samples/")
rlboard.render("token-heatmap", records, step=4, output="heatmap.html")
rlboard.report(records, modules=["reward-curve", "token-explorer"], output="report.html")`}</Code>
      </Section>
    </main>
  );
}

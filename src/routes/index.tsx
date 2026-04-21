import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "rlboard — modular RL training visualizer" },
      {
        name: "description",
        content:
          "Browse reward curves, response tables, token heatmaps and per-token curves. Each module is independently embeddable; supports 256k token sequences.",
      },
    ],
  }),
  component: HomePage,
});

const MODULES: { id: string; title: string; tag: string; desc: string }[] = [
  {
    id: "reward-curve",
    title: "Reward Curve",
    tag: "training",
    desc: "Mean reward per training step, with optional reference baseline overlay.",
  },
  {
    id: "reward-distribution",
    title: "Reward Distribution",
    tag: "training",
    desc: "Histogram of per-rollout rewards within a chosen step.",
  },
  {
    id: "response-table",
    title: "Response Table",
    tag: "rollout",
    desc: "Sortable rollout list (reward, KL, advantage, length) — feeds the explorer.",
  },
  {
    id: "token-heatmap",
    title: "Token Heatmap",
    tag: "long-context",
    desc: "Minimap of any per-token metric across the full sequence (≤ 256k tokens).",
  },
  {
    id: "token-inline",
    title: "Token Inline",
    tag: "long-context",
    desc: "Virtualized colored token grid for drill-down. 60 fps on 256k tokens.",
  },
  {
    id: "token-curves",
    title: "Token Curves",
    tag: "rollout",
    desc: "Multi-line per-token curves (logp / value / reward / adv / entropy).",
  },
  {
    id: "token-pager",
    title: "Token Pager",
    tag: "long-context",
    desc: "Original-style page navigation + minimap highlight. Bounded DOM at 256k.",
  },
  {
    id: "token-explorer",
    title: "Token Explorer",
    tag: "composite",
    desc: "Heatmap minimap + paged drill-down, linked by a shared range selection.",
  },
];

function HomePage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <section className="relative overflow-hidden rounded-2xl border border-border p-8 lg:p-12 grid-bg">
        <div className="relative z-10 max-w-3xl">
          <span className="inline-block rounded-full border border-primary/40 bg-primary/10 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-primary">
            v2 · modular · 256k tokens
          </span>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
            A modular visualizer for{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "var(--gradient-primary)" }}
            >
              RL training logs.
            </span>
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground">
            Each chart is a standalone component you can drop into any React app, an entry in a
            Python plotting library, or a script-callable skill. Backwards compatible with the
            original RLLoggingBoard jsonl format.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/playground"
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              style={{ boxShadow: "var(--shadow-glow)" }}
            >
              Open Playground →
            </Link>
            <Link
              to="/docs"
              className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary"
            >
              Read Docs
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              modules
            </h2>
            <p className="text-lg font-medium">Pick a module to embed or open it standalone.</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => (
            <Link
              key={m.id}
              to="/modules/$id"
              params={{ id: m.id }}
              className="group rounded-lg border border-border bg-card p-5 transition-all hover:border-primary/60"
              style={{ boxShadow: "var(--shadow-elegant)" }}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {m.tag}
                </span>
                <span className="text-muted-foreground transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </div>
              <h3 className="mt-2 text-lg font-semibold">{m.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{m.desc}</p>
              <code className="mt-3 inline-block rounded bg-secondary px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                {m.id}
              </code>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

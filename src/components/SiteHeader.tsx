import { Link } from "@tanstack/react-router";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span
            className="inline-block h-7 w-7 rounded-md"
            style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
          />
          <div className="leading-tight">
            <div className="font-mono text-sm font-semibold tracking-tight">rlboard</div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              RL Logging Board v2
            </div>
          </div>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {[
            { to: "/", label: "Modules" },
            { to: "/playground", label: "Playground" },
            { to: "/docs", label: "Docs" },
          ].map((l) => (
            <Link
              key={l.to}
              to={l.to}
              activeOptions={{ exact: true }}
              activeProps={{ className: "bg-secondary text-foreground" }}
              className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
          <a
            href="https://github.com/HarderThenHarder/RLLoggingBoard"
            target="_blank"
            rel="noreferrer"
            className="ml-2 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            Source ↗
          </a>
        </nav>
      </div>
    </header>
  );
}

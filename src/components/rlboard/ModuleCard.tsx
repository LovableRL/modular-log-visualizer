import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ModuleCard({
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border border-border bg-card text-card-foreground shadow-elegant overflow-hidden",
        className,
      )}
      style={{ boxShadow: "var(--shadow-elegant)" }}
    >
      <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {title}
          </h3>
          {subtitle ? (
            <p className="mt-0.5 text-sm text-foreground/80">{subtitle}</p>
          ) : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

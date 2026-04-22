import { useState, type ReactNode } from "react";
import { ChevronDown, GripHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export function ModuleCard({
  title,
  subtitle,
  actions,
  children,
  className,
  collapsible = true,
  resizable = false,
  defaultCollapsed = false,
  defaultHeight,
  minHeight = 160,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  collapsible?: boolean;
  resizable?: boolean;
  defaultCollapsed?: boolean;
  defaultHeight?: number;
  minHeight?: number;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <section
      className={cn(
        "rounded-lg border border-border bg-card text-card-foreground overflow-hidden flex flex-col",
        className,
      )}
      style={{ boxShadow: "var(--shadow-elegant)" }}
    >
      <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={() => collapsible && setCollapsed((c) => !c)}
          className={cn(
            "flex min-w-0 flex-1 items-start gap-2 text-left",
            collapsible && "cursor-pointer hover:opacity-80",
          )}
          aria-expanded={!collapsed}
        >
          {collapsible && (
            <ChevronDown
              className={cn(
                "mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
                collapsed && "-rotate-90",
              )}
            />
          )}
          <div className="min-w-0">
            <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              {title}
            </h3>
            {subtitle ? (
              <p className="mt-0.5 truncate text-sm text-foreground/80">{subtitle}</p>
            ) : null}
          </div>
        </button>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </header>
      {!collapsed && (
        <div
          className={cn("relative p-4", resizable && "overflow-auto")}
          style={
            resizable
              ? {
                  resize: "vertical",
                  height: defaultHeight,
                  minHeight,
                  maxHeight: "90vh",
                }
              : undefined
          }
        >
          {children}
          {resizable && (
            <div
              className="pointer-events-none absolute bottom-1 right-1 text-muted-foreground/40"
              aria-hidden
            >
              <GripHorizontal className="h-3 w-3" />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

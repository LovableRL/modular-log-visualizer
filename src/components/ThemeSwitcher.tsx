import { useEffect, useRef, useState } from "react";
import { Check, Palette } from "lucide-react";

export type ThemeId = "grafana" | "paper" | "solarized" | "monokai" | "nord";

type ThemeMeta = {
  id: ThemeId;
  label: string;
  hint: string;
  swatch: [string, string, string];
};

const THEMES: ThemeMeta[] = [
  {
    id: "grafana",
    label: "Grafana",
    hint: "Dark · teal/magenta · default",
    swatch: ["oklch(0.16 0.02 260)", "oklch(0.78 0.16 175)", "oklch(0.70 0.20 320)"],
  },
  {
    id: "paper",
    label: "Paper",
    hint: "Light · editorial",
    swatch: ["oklch(0.99 0.005 95)", "oklch(0.55 0.18 255)", "oklch(0.55 0.20 330)"],
  },
  {
    id: "solarized",
    label: "Solarized",
    hint: "Dark · classic blue/orange",
    swatch: ["oklch(0.22 0.03 200)", "oklch(0.72 0.16 195)", "oklch(0.70 0.18 60)"],
  },
  {
    id: "monokai",
    label: "Monokai",
    hint: "Dark · vivid green/magenta",
    swatch: ["oklch(0.20 0.015 90)", "oklch(0.78 0.22 145)", "oklch(0.72 0.26 350)"],
  },
  {
    id: "nord",
    label: "Nord",
    hint: "Dark · cool arctic",
    swatch: ["oklch(0.26 0.02 250)", "oklch(0.72 0.10 220)", "oklch(0.72 0.12 180)"],
  },
];

const LS_KEY = "rlboard:theme";

function readTheme(): ThemeId {
  if (typeof window === "undefined") return "grafana";
  try {
    const t = localStorage.getItem(LS_KEY) as ThemeId | null;
    if (t && THEMES.some((x) => x.id === t)) return t;
  } catch { /* ignore */ }
  return "grafana";
}

function applyTheme(id: ThemeId) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", id);
}

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<ThemeId>(() => readTheme());
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Apply on mount and changes
  useEffect(() => {
    applyTheme(theme);
    try { localStorage.setItem(LS_KEY, theme); } catch { /* ignore */ }
  }, [theme]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  const current = THEMES.find((t) => t.id === theme) ?? THEMES[0];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
        title="Switch theme"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Palette className="h-3.5 w-3.5" />
        <Swatch colors={current.swatch} />
        <span className="hidden sm:inline font-mono">{current.label}</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 w-60 overflow-hidden rounded-md border border-border bg-popover p-1 shadow-lg"
          style={{ boxShadow: "var(--shadow-elegant)" }}
        >
          {THEMES.map((t) => {
            const active = t.id === theme;
            return (
              <button
                key={t.id}
                role="menuitem"
                onClick={() => {
                  setTheme(t.id);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-secondary"
              >
                <Swatch colors={t.swatch} />
                <span className="flex-1">
                  <span className="block font-mono text-foreground">{t.label}</span>
                  <span className="block font-mono text-[10px] text-muted-foreground">
                    {t.hint}
                  </span>
                </span>
                {active && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Swatch({ colors }: { colors: [string, string, string] }) {
  return (
    <span
      className="inline-flex h-4 w-7 overflow-hidden rounded border border-border"
      aria-hidden
    >
      {colors.map((c, i) => (
        <span key={i} style={{ background: c, flex: 1 }} />
      ))}
    </span>
  );
}

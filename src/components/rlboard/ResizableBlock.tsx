import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

type Size = { width: number; height: number };

type Props = {
  id: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /** Initial body height in px. Persisted under `rlboard:layout:h:${id}`. */
  defaultHeight?: number;
  minHeight?: number;
  /** When true, body is hidden (only header visible). Persisted. */
  defaultCollapsed?: boolean;
  /** Render children with measured size. Falls back to plain children if not a function. */
  children: ReactNode | ((size: Size) => ReactNode);
};

const LS = (id: string) => `rlboard:layout:h:${id}`;
const LS_C = (id: string) => `rlboard:layout:c:${id}`;

function readNum(key: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : fallback;
  } catch {
    return fallback;
  }
}
function readBool(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : raw === "1";
  } catch {
    return fallback;
  }
}

/**
 * De-carded resizable block. Header is a single mono line + 1px divider.
 * Body fills 100% width, height controlled by drag handle, and exposes
 * measured {width,height} to children via render-prop.
 */
export function ResizableBlock({
  id,
  title,
  subtitle,
  actions,
  defaultHeight = 280,
  minHeight = 120,
  defaultCollapsed = false,
  children,
}: Props) {
  const [height, setHeight] = useState(() => readNum(LS(id), defaultHeight));
  const [collapsed, setCollapsed] = useState(() => readBool(LS_C(id), defaultCollapsed));
  const bodyRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  // Persist
  useEffect(() => {
    try {
      localStorage.setItem(LS(id), String(Math.round(height)));
    } catch { /* ignore */ }
  }, [id, height]);
  useEffect(() => {
    try {
      localStorage.setItem(LS_C(id), collapsed ? "1" : "0");
    } catch { /* ignore */ }
  }, [id, collapsed]);

  // Observe body size — drives child reflow on horizontal & vertical resize
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (!r) return;
      setSize({ width: Math.round(r.width), height: Math.round(r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [collapsed]);

  // Vertical drag handle
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startY: e.clientY, startH: height };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dy = e.clientY - dragRef.current.startY;
    setHeight(Math.max(minHeight, dragRef.current.startH + dy));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border/60 px-1 py-1">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground"
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        <span className="font-mono text-[11px] uppercase tracking-widest text-foreground">
          {title}
        </span>
        {subtitle && (
          <span className="truncate font-mono text-[10px] text-muted-foreground">
            · {subtitle}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">{actions}</div>
      </div>

      {!collapsed && (
        <>
          <div
            ref={bodyRef}
            className="min-h-0 w-full flex-shrink-0 overflow-hidden"
            style={{ height }}
          >
            {typeof children === "function"
              ? size.width > 0
                ? (children as (s: Size) => ReactNode)(size)
                : null
              : children}
          </div>
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="group flex h-1.5 w-full cursor-ns-resize items-center justify-center bg-transparent hover:bg-primary/20"
            title="Drag to resize"
          >
            <div className="h-px w-8 bg-border group-hover:bg-primary/60" />
          </div>
        </>
      )}
    </div>
  );
}

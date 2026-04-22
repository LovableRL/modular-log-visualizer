import { useEffect, useMemo, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { RLBoardRecord, TokenMetricKey } from "@/lib/rlboard/schema";
import { deriveSegments } from "@/lib/rlboard/segments";
import { TrajectoryTimeline } from "./TrajectoryTimeline";
import { SegmentDetail } from "./SegmentDetail";

/**
 * Two-pane trajectory view (Langfuse-style):
 *   left  → TrajectoryTimeline (segments) — collapsible
 *   right → SegmentDetail (token-level metrics for the selected segment)
 *
 * Keyboard: j/k cycle segments.
 */
export function TrajectoryView({ record }: { record: RLBoardRecord }) {
  const segments = useMemo(() => deriveSegments(record), [record]);
  const [metric, setMetric] = useState<TokenMetricKey>("kl_per_token");
  const [kindFilter, setKindFilter] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(
    segments[0]?.id ?? null,
  );
  const [leftOpen, setLeftOpen] = useState(true);

  useEffect(() => {
    if (!segments.find((s) => s.id === selectedId)) {
      setSelectedId(segments[0]?.id ?? null);
    }
  }, [segments, selectedId]);

  const visible = useMemo(
    () => (kindFilter.size === 0 ? segments : segments.filter((s) => kindFilter.has(s.kind))),
    [segments, kindFilter],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target && (e.target as HTMLElement).tagName.match(/INPUT|TEXTAREA|SELECT/)) return;
      if (e.key !== "j" && e.key !== "k") return;
      if (visible.length === 0) return;
      const i = Math.max(0, visible.findIndex((s) => s.id === selectedId));
      const next = e.key === "j" ? Math.min(visible.length - 1, i + 1) : Math.max(0, i - 1);
      setSelectedId(visible[next].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, selectedId]);

  const selected = useMemo(
    () => segments.find((s) => s.id === selectedId) ?? segments[0],
    [segments, selectedId],
  );

  if (segments.length === 0 || !selected) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No tokens to segment.
      </p>
    );
  }

  return (
    <div
      className={`grid h-full gap-0 overflow-hidden rounded-md border border-border ${
        leftOpen ? "lg:grid-cols-[minmax(260px,360px)_1fr]" : "lg:grid-cols-[40px_1fr]"
      }`}
    >
      <aside className="relative flex min-h-0 flex-col border-border lg:border-r">
        <button
          onClick={() => setLeftOpen((o) => !o)}
          className="absolute right-1 top-1 z-10 rounded border border-border bg-card p-1 text-muted-foreground hover:text-foreground"
          title={leftOpen ? "Hide segment list" : "Show segment list"}
        >
          {leftOpen ? <PanelLeftClose className="h-3 w-3" /> : <PanelLeftOpen className="h-3 w-3" />}
        </button>
        {leftOpen ? (
          <TrajectoryTimeline
            record={record}
            selectedId={selected.id}
            onSelect={setSelectedId}
            metric={metric}
            onMetricChange={setMetric}
            kindFilter={kindFilter}
            onKindFilterChange={setKindFilter}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <span className="rotate-180 font-mono text-[10px] uppercase tracking-widest text-muted-foreground [writing-mode:vertical-rl]">
              segments · {segments.length}
            </span>
          </div>
        )}
      </aside>
      <section className="min-h-0 min-w-0">
        <SegmentDetail record={record} segment={selected} metric={metric} />
      </section>
    </div>
  );
}

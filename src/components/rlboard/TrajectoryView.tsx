import { useEffect, useMemo, useState } from "react";
import type { RLBoardRecord, TokenMetricKey } from "@/lib/rlboard/schema";
import { deriveSegments } from "@/lib/rlboard/segments";
import { TrajectoryTimeline } from "./TrajectoryTimeline";
import { SegmentDetail } from "./SegmentDetail";

/**
 * Two-pane trajectory view (Langfuse-style):
 *   left  → TrajectoryTimeline (segments)
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

  // re-anchor selection when the record changes
  useEffect(() => {
    if (!segments.find((s) => s.id === selectedId)) {
      setSelectedId(segments[0]?.id ?? null);
    }
  }, [segments, selectedId]);

  const visible = useMemo(
    () => (kindFilter.size === 0 ? segments : segments.filter((s) => kindFilter.has(s.kind))),
    [segments, kindFilter],
  );

  // j/k navigation across visible segments
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
    <div className="grid gap-0 overflow-hidden rounded-md border border-border lg:grid-cols-12">
      <aside className="border-border lg:col-span-4 lg:border-r">
        <TrajectoryTimeline
          record={record}
          selectedId={selected.id}
          onSelect={setSelectedId}
          metric={metric}
          onMetricChange={setMetric}
          kindFilter={kindFilter}
          onKindFilterChange={setKindFilter}
          height={720}
        />
      </aside>
      <section className="lg:col-span-8">
        <SegmentDetail record={record} segment={selected} metric={metric} />
      </section>
    </div>
  );
}

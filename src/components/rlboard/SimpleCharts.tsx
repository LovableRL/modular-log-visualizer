import { useRef, useState, useCallback } from "react";
import { fmtNum } from "@/lib/rlboard/format";

type LineSeries = {
  key: string;
  label: string;
  color: string;
  values: Array<number | null>;
  dashed?: boolean;
  /** Optional matching ±band (e.g. std-dev) per index. Same length as values. */
  band?: Array<number | null>;
};

type BarDatum = {
  label: string | number;
  value: number;
};

const PAD = { top: 14, right: 16, bottom: 24, left: 42 };

function finite(values: Array<number | null | undefined>) {
  return values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
}

function niceTicks(min: number, max: number, count = 4) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [min || 0];
  return Array.from({ length: count }, (_, i) => min + ((max - min) * i) / (count - 1));
}

function scaleY(value: number, min: number, max: number, y0: number, h: number) {
  if (max <= min) return y0 + h / 2;
  return y0 + h - ((value - min) / (max - min)) * h;
}

function linePath(values: Array<number | null>, min: number, max: number, x0: number, y0: number, w: number, h: number) {
  const denom = Math.max(1, values.length - 1);
  let path = "";
  let open = false;
  values.forEach((v, i) => {
    if (v == null || !Number.isFinite(v)) {
      open = false;
      return;
    }
    const x = x0 + (i / denom) * w;
    const y = scaleY(v, min, max, y0, h);
    path += `${open ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)} `;
    open = true;
  });
  return path.trim();
}

function fmt(v: number) {
  return fmtNum(v, 3);
}

/** Build an SVG path for a ±band ribbon given centerline values and half-widths. */
function bandPath(
  values: Array<number | null>,
  band: Array<number | null>,
  min: number,
  max: number,
  x0: number,
  y0: number,
  w: number,
  h: number,
) {
  const denom = Math.max(1, values.length - 1);
  const top: string[] = [];
  const bot: string[] = [];
  let open = false;
  values.forEach((v, i) => {
    const b = band[i];
    if (v == null || b == null || !Number.isFinite(v) || !Number.isFinite(b)) {
      open = false;
      return;
    }
    const x = x0 + (i / denom) * w;
    const yTop = scaleY(v + b, min, max, y0, h);
    const yBot = scaleY(v - b, min, max, y0, h);
    top.push(`${open ? "L" : "M"}${x.toFixed(1)},${yTop.toFixed(1)}`);
    bot.push(`L${x.toFixed(1)},${yBot.toFixed(1)}`);
    open = true;
  });
  if (top.length === 0) return "";
  return `${top.join(" ")} ${bot.reverse().join(" ")} Z`;
}

export function SimpleLineChart({
  series,
  xLabels,
  height = 260,
  width: widthProp,
}: {
  series: LineSeries[];
  xLabels?: Array<string | number>;
  height?: number;
  width?: number;
}) {
  const width = widthProp && widthProp > 0 ? widthProp : 920;
  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const nums = finite(series.flatMap((s) => s.values));
  // Expand extent to include band edges so the ribbon stays inside the plot.
  const bandExtents: number[] = [];
  for (const s of series) {
    if (!s.band) continue;
    s.values.forEach((v, i) => {
      const b = s.band![i];
      if (v != null && b != null && Number.isFinite(v) && Number.isFinite(b)) {
        bandExtents.push(v + b, v - b);
      }
    });
  }
  const all = [...nums, ...bandExtents];
  const min = all.length ? Math.min(...all) : 0;
  const max = all.length ? Math.max(...all) : 1;
  const span = Math.max(1e-6, max - min);
  const yMin = min - span * 0.08;
  const yMax = max + span * 0.08;
  const yTicks = niceTicks(yMin, yMax);
  const firstLabel = xLabels?.[0] ?? 0;
  const n = series[0]?.values.length ?? 0;
  const lastLabel = xLabels?.[xLabels.length - 1] ?? Math.max(0, n - 1);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ idx: number; px: number } | null>(null);

  const onMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const el = wrapRef.current;
      if (!el || n === 0) return;
      const rect = el.getBoundingClientRect();
      const scale = width / rect.width;
      const xSvg = (e.clientX - rect.left) * scale;
      const xRel = Math.max(0, Math.min(plotW, xSvg - PAD.left));
      const denom = Math.max(1, n - 1);
      const idx = Math.round((xRel / plotW) * denom);
      const px = PAD.left + (idx / denom) * plotW;
      setHover({ idx, px });
    },
    [width, plotW, n],
  );

  const onLeave = useCallback(() => setHover(null), []);

  return (
    <div
      ref={wrapRef}
      className="relative w-full overflow-hidden"
      style={{ height }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" role="img">
        <rect x="0" y="0" width={width} height={height} fill="transparent" />
        {yTicks.map((t) => {
          const y = scaleY(t, yMin, yMax, PAD.top, plotH);
          return (
            <g key={t.toFixed(4)}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y} y2={y} stroke="var(--border)" strokeDasharray="3 3" />
              <text x={PAD.left - 8} y={y + 3} textAnchor="end" className="fill-muted-foreground text-[11px] font-mono">
                {t.toFixed(2)}
              </text>
            </g>
          );
        })}
        <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--border)" />
        <line x1={PAD.left} x2={width - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH} stroke="var(--border)" />
        <text x={PAD.left} y={height - 6} className="fill-muted-foreground text-[11px] font-mono">
          {firstLabel}
        </text>
        <text x={width - PAD.right} y={height - 6} textAnchor="end" className="fill-muted-foreground text-[11px] font-mono">
          {lastLabel}
        </text>
        {series.map((s) =>
          s.band ? (
            <path
              key={`${s.key}-band`}
              d={bandPath(s.values, s.band, yMin, yMax, PAD.left, PAD.top, plotW, plotH)}
              fill={s.color}
              fillOpacity={0.14}
              stroke="none"
            />
          ) : null,
        )}
        {series.map((s) => (
          <path
            key={s.key}
            d={linePath(s.values, yMin, yMax, PAD.left, PAD.top, plotW, plotH)}
            fill="none"
            stroke={s.color}
            strokeWidth={1.8}
            strokeDasharray={s.dashed ? "5 5" : undefined}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {hover && (
          <g pointerEvents="none">
            <line
              x1={hover.px}
              x2={hover.px}
              y1={PAD.top}
              y2={PAD.top + plotH}
              stroke="var(--foreground)"
              strokeOpacity={0.35}
              strokeDasharray="2 3"
              vectorEffect="non-scaling-stroke"
            />
            {series.map((s) => {
              const v = s.values[hover.idx];
              if (v == null || !Number.isFinite(v)) return null;
              const cy = scaleY(v, yMin, yMax, PAD.top, plotH);
              return (
                <circle
                  key={s.key}
                  cx={hover.px}
                  cy={cy}
                  r={3.5}
                  fill="var(--background)"
                  stroke={s.color}
                  strokeWidth={1.8}
                />
              );
            })}
          </g>
        )}
        <g transform={`translate(${PAD.left}, 8)`}>
          {series.map((s, i) => (
            <g key={s.key} transform={`translate(${i * 128}, 0)`}>
              <line x1="0" x2="18" y1="0" y2="0" stroke={s.color} strokeWidth="2" strokeDasharray={s.dashed ? "5 5" : undefined} />
              <text x="24" y="4" className="fill-muted-foreground text-[11px] font-mono">
                {s.label}
              </text>
            </g>
          ))}
        </g>
      </svg>
      {hover && (() => {
        const xLabel = xLabels?.[hover.idx] ?? hover.idx;
        const rect = wrapRef.current?.getBoundingClientRect();
        const scale = rect ? rect.width / width : 1;
        const leftPx = hover.px * scale;
        const flip = leftPx > (rect?.width ?? width) * 0.6;
        return (
          <div
            className="pointer-events-none absolute z-10 min-w-[120px] rounded-md border border-border bg-popover/95 px-2 py-1.5 font-mono text-[11px] text-popover-foreground shadow-lg backdrop-blur"
            style={{
              left: flip ? undefined : leftPx + 10,
              right: flip ? (rect?.width ?? width) - leftPx + 10 : undefined,
              top: 8,
            }}
          >
            <div className="mb-1 text-muted-foreground">x = {xLabel}</div>
            {series.map((s) => {
              const v = s.values[hover.idx];
              return (
                <div key={s.key} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2 w-2 rounded-sm"
                      style={{ background: s.color }}
                    />
                    <span className="text-muted-foreground">{s.label}</span>
                  </span>
                  <span>{v == null || !Number.isFinite(v) ? "—" : fmt(v)}</span>
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}

export function SimpleBarChart({
  data,
  height = 240,
  width: widthProp,
}: { data: BarDatum[]; height?: number; width?: number }) {
  const width = widthProp && widthProp > 0 ? widthProp : 920;
  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const max = Math.max(1, ...data.map((d) => d.value));
  const barW = data.length ? plotW / data.length : plotW;
  const yTicks = niceTicks(0, max);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const onMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const el = wrapRef.current;
      if (!el || data.length === 0) return;
      const rect = el.getBoundingClientRect();
      const scale = width / rect.width;
      const xSvg = (e.clientX - rect.left) * scale;
      const xRel = xSvg - PAD.left;
      if (xRel < 0 || xRel > plotW) {
        setHover(null);
        return;
      }
      const idx = Math.max(0, Math.min(data.length - 1, Math.floor(xRel / barW)));
      setHover(idx);
    },
    [width, plotW, barW, data.length],
  );

  return (
    <div
      ref={wrapRef}
      className="relative w-full overflow-hidden"
      style={{ height }}
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
    >
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" role="img">
        {yTicks.map((t) => {
          const y = scaleY(t, 0, max, PAD.top, plotH);
          return (
            <g key={t.toFixed(2)}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y} y2={y} stroke="var(--border)" strokeDasharray="3 3" />
              <text x={PAD.left - 8} y={y + 3} textAnchor="end" className="fill-muted-foreground text-[11px] font-mono">
                {t.toFixed(0)}
              </text>
            </g>
          );
        })}
        <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--border)" />
        <line x1={PAD.left} x2={width - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH} stroke="var(--border)" />
        {data.map((d, i) => {
          const h = (d.value / max) * plotH;
          const x = PAD.left + i * barW + 2;
          const y = PAD.top + plotH - h;
          const active = hover === i;
          return (
            <rect
              key={`${d.label}-${i}`}
              x={x}
              y={y}
              width={Math.max(1, barW - 4)}
              height={h}
              rx="2"
              fill="var(--primary)"
              opacity={hover == null || active ? 1 : 0.55}
            />
          );
        })}
        <text x={PAD.left} y={height - 6} className="fill-muted-foreground text-[11px] font-mono">
          {data[0]?.label ?? ""}
        </text>
        <text x={width - PAD.right} y={height - 6} textAnchor="end" className="fill-muted-foreground text-[11px] font-mono">
          {data[data.length - 1]?.label ?? ""}
        </text>
      </svg>
      {hover != null && data[hover] && (() => {
        const rect = wrapRef.current?.getBoundingClientRect();
        const scale = rect ? rect.width / width : 1;
        const cxSvg = PAD.left + hover * barW + barW / 2;
        const leftPx = cxSvg * scale;
        const flip = leftPx > (rect?.width ?? width) * 0.6;
        return (
          <div
            className="pointer-events-none absolute z-10 min-w-[110px] rounded-md border border-border bg-popover/95 px-2 py-1.5 font-mono text-[11px] text-popover-foreground shadow-lg backdrop-blur"
            style={{
              left: flip ? undefined : leftPx + 10,
              right: flip ? (rect?.width ?? width) - leftPx + 10 : undefined,
              top: 8,
            }}
          >
            <div className="mb-0.5 text-muted-foreground">bin {data[hover].label}</div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">count</span>
              <span>{data[hover].value}</span>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

type LineSeries = {
  key: string;
  label: string;
  color: string;
  values: Array<number | null>;
  dashed?: boolean;
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

export function SimpleLineChart({
  series,
  xLabels,
  height = 260,
}: {
  series: LineSeries[];
  xLabels?: Array<string | number>;
  height?: number;
}) {
  const width = 920;
  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const nums = finite(series.flatMap((s) => s.values));
  const min = nums.length ? Math.min(...nums) : 0;
  const max = nums.length ? Math.max(...nums) : 1;
  const span = Math.max(1e-6, max - min);
  const yMin = min - span * 0.08;
  const yMax = max + span * 0.08;
  const yTicks = niceTicks(yMin, yMax);
  const firstLabel = xLabels?.[0] ?? 0;
  const lastLabel = xLabels?.[xLabels.length - 1] ?? Math.max(0, (series[0]?.values.length ?? 1) - 1);

  return (
    <div className="w-full overflow-hidden" style={{ height }}>
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
    </div>
  );
}

export function SimpleBarChart({ data, height = 240 }: { data: BarDatum[]; height?: number }) {
  const width = 920;
  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const max = Math.max(1, ...data.map((d) => d.value));
  const barW = data.length ? plotW / data.length : plotW;
  const yTicks = niceTicks(0, max);

  return (
    <div className="w-full overflow-hidden" style={{ height }}>
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
          return <rect key={`${d.label}-${i}`} x={x} y={y} width={Math.max(1, barW - 4)} height={h} rx="2" fill="var(--primary)" />;
        })}
        <text x={PAD.left} y={height - 6} className="fill-muted-foreground text-[11px] font-mono">
          {data[0]?.label ?? ""}
        </text>
        <text x={width - PAD.right} y={height - 6} textAnchor="end" className="fill-muted-foreground text-[11px] font-mono">
          {data[data.length - 1]?.label ?? ""}
        </text>
      </svg>
    </div>
  );
}

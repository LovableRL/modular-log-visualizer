/** Map a value in [min,max] to one of the heat tokens (0..5). */
export function heatBucket(value: number, min: number, max: number): number {
  if (!isFinite(value) || max <= min) return 0;
  const t = (value - min) / (max - min);
  return Math.max(0, Math.min(5, Math.floor(t * 6)));
}

export function heatColor(value: number, min: number, max: number): string {
  return `var(--heat-${heatBucket(value, min, max)})`;
}

/** Compute robust min/max using percentiles to avoid outlier domination. */
export function robustExtent(arr: number[], lo = 0.02, hi = 0.98): [number, number] {
  if (arr.length === 0) return [0, 1];
  const sorted = [...arr].filter((v) => isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return [0, 1];
  const a = sorted[Math.floor(sorted.length * lo)];
  const b = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * hi))];
  if (a === b) return [a - 1e-6, b + 1e-6];
  return [a, b];
}

/** Aggregate an array into `buckets` buckets returning {min,max,mean} per bucket. */
export interface Bucket {
  min: number;
  max: number;
  mean: number;
  start: number;
  end: number;
}

export function aggregate(arr: number[], buckets: number): Bucket[] {
  const out: Bucket[] = [];
  if (arr.length === 0 || buckets <= 0) return out;
  const size = Math.max(1, Math.ceil(arr.length / buckets));
  for (let i = 0; i < arr.length; i += size) {
    let mn = Infinity;
    let mx = -Infinity;
    let sum = 0;
    let n = 0;
    const end = Math.min(arr.length, i + size);
    for (let j = i; j < end; j++) {
      const v = arr[j];
      if (!isFinite(v)) continue;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
      sum += v;
      n++;
    }
    out.push({
      min: n === 0 ? 0 : mn,
      max: n === 0 ? 0 : mx,
      mean: n === 0 ? 0 : sum / n,
      start: i,
      end,
    });
  }
  return out;
}

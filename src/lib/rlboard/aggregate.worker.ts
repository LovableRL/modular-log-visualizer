/// <reference lib="webworker" />
/**
 * Off-main-thread bucket aggregation. Streams progress so the UI can show
 * a worker progress bar for very long sequences (256k+).
 */
export type AggregateRequest = {
  id: string;
  type: "aggregate";
  data: Float32Array;
  buckets: number;
};

export type AggregateProgress = {
  id: string;
  type: "progress";
  done: number;
  total: number;
};

export type AggregateResult = {
  id: string;
  type: "result";
  mean: Float32Array;
  min: Float32Array;
  max: Float32Array;
  elapsedMs: number;
};

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (e: MessageEvent<AggregateRequest>) => {
  const msg = e.data;
  if (msg.type !== "aggregate") return;
  const { id, data, buckets } = msg;
  const t0 = performance.now();
  const n = data.length;
  const b = Math.max(1, Math.min(buckets, n || 1));
  const mean = new Float32Array(b);
  const min = new Float32Array(b);
  const max = new Float32Array(b);
  if (n === 0) {
    const result: AggregateResult = {
      id,
      type: "result",
      mean,
      min,
      max,
      elapsedMs: performance.now() - t0,
    };
    ctx.postMessage(result, [mean.buffer, min.buffer, max.buffer]);
    return;
  }
  const size = Math.max(1, Math.ceil(n / b));
  const progressEvery = Math.max(1, Math.floor(b / 20));
  for (let bi = 0; bi < b; bi++) {
    const s = bi * size;
    const e2 = Math.min(n, s + size);
    let mn = Infinity;
    let mx = -Infinity;
    let sum = 0;
    let cnt = 0;
    for (let j = s; j < e2; j++) {
      const v = data[j];
      if (!isFinite(v)) continue;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
      sum += v;
      cnt++;
    }
    mean[bi] = cnt === 0 ? 0 : sum / cnt;
    min[bi] = cnt === 0 ? 0 : mn;
    max[bi] = cnt === 0 ? 0 : mx;
    if (bi % progressEvery === 0) {
      const p: AggregateProgress = { id, type: "progress", done: bi, total: b };
      ctx.postMessage(p);
    }
  }
  const result: AggregateResult = {
    id,
    type: "result",
    mean,
    min,
    max,
    elapsedMs: performance.now() - t0,
  };
  ctx.postMessage(result, [mean.buffer, min.buffer, max.buffer]);
};

import { useEffect, useRef, useState } from "react";
import { aggregate } from "./colors";
import { useOptionalPerf } from "./perf";
import type { AggregateProgress, AggregateResult } from "./aggregate.worker";

export interface AggregatedBuckets {
  mean: Float32Array;
  min: Float32Array;
  max: Float32Array;
}

let _worker: Worker | null = null;
function getWorker(): Worker {
  if (_worker) return _worker;
  _worker = new Worker(new URL("./aggregate.worker.ts", import.meta.url), {
    type: "module",
  });
  return _worker;
}

/**
 * Aggregate a numeric series into N buckets. Uses a Web Worker when enabled in
 * the perf params (default), otherwise falls back to the synchronous helper.
 * Reports timing & progress to the perf panel if mounted.
 */
export function useAggregatedBuckets(
  data: number[] | Float32Array | undefined,
  buckets: number,
): AggregatedBuckets {
  const perf = useOptionalPerf();
  const useWorker = perf?.params.useWorker ?? true;
  const reqRef = useRef(0);

  const [out, setOut] = useState<AggregatedBuckets>(() => ({
    mean: new Float32Array(0),
    min: new Float32Array(0),
    max: new Float32Array(0),
  }));

  useEffect(() => {
    const n = data?.length ?? 0;
    const b = Math.max(1, Math.min(buckets, Math.max(1, n)));
    if (!data || n === 0) {
      setOut({ mean: new Float32Array(0), min: new Float32Array(0), max: new Float32Array(0) });
      perf?.reportAgg(0, 0, 0);
      perf?.reportProgress(null);
      return;
    }

    const id = String(++reqRef.current);

    // Synchronous fallback (also used for very small inputs to avoid worker overhead)
    if (!useWorker || n < 4096) {
      const t0 = performance.now();
      const arr = data instanceof Float32Array ? Array.from(data) : data;
      const bs = aggregate(arr, b);
      const mean = new Float32Array(bs.length);
      const min = new Float32Array(bs.length);
      const max = new Float32Array(bs.length);
      for (let i = 0; i < bs.length; i++) {
        mean[i] = bs[i].mean;
        min[i] = bs[i].min;
        max[i] = bs[i].max;
      }
      const ms = performance.now() - t0;
      setOut({ mean, min, max });
      perf?.reportAgg(ms, n, b);
      perf?.reportProgress(null);
      return;
    }

    // Worker path — copy into a transferable Float32Array
    const buf = new Float32Array(n);
    if (data instanceof Float32Array) buf.set(data);
    else for (let i = 0; i < n; i++) buf[i] = data[i];

    const w = getWorker();
    const onMsg = (e: MessageEvent<AggregateProgress | AggregateResult>) => {
      const m = e.data;
      if (m.id !== id) return;
      if (m.type === "progress") {
        perf?.reportProgress({ done: m.done, total: m.total });
      } else if (m.type === "result") {
        setOut({ mean: m.mean, min: m.min, max: m.max });
        perf?.reportAgg(m.elapsedMs, n, b);
        perf?.reportProgress(null);
        w.removeEventListener("message", onMsg);
      }
    };
    w.addEventListener("message", onMsg);
    perf?.reportProgress({ done: 0, total: b });
    w.postMessage({ id, type: "aggregate", data: buf, buckets: b }, [buf.buffer]);

    return () => {
      w.removeEventListener("message", onMsg);
    };
  }, [data, buckets, useWorker, perf]);

  return out;
}

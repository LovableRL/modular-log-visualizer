import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/** Runtime perf metrics + tunable visualization parameters. */
export interface PerfMetrics {
  fps: number;
  lastAggMs: number;
  avgAggMs: number;
  aggCount: number;
  workerProgress: { done: number; total: number } | null;
  lastTokens: number;
  lastBuckets: number;
}

export interface PerfParams {
  /** target buckets in the heatmap minimap (overrides canvas width) */
  bucketsOverride: number | null;
  /** tokens per row in inline view */
  tokensPerRow: number;
  /** max points in token curves */
  maxCurvePoints: number;
  /** use Web Worker for aggregation */
  useWorker: boolean;
}

interface PerfCtx {
  metrics: PerfMetrics;
  params: PerfParams;
  setParams: (p: Partial<PerfParams>) => void;
  reportAgg: (ms: number, tokens: number, buckets: number) => void;
  reportProgress: (p: { done: number; total: number } | null) => void;
}

const Ctx = createContext<PerfCtx | null>(null);

export function PerfProvider({ children }: { children: ReactNode }) {
  const [params, setParamsState] = useState<PerfParams>({
    bucketsOverride: null,
    tokensPerRow: 32,
    maxCurvePoints: 1500,
    useWorker: true,
  });
  const [fps, setFps] = useState(0);
  const [agg, setAgg] = useState({
    last: 0,
    sum: 0,
    count: 0,
    tokens: 0,
    buckets: 0,
  });
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  // FPS sampler — rAF loop, EMA smoothed
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    let last = performance.now();
    let ema = 60;
    const tick = (t: number) => {
      const dt = t - last;
      last = t;
      if (dt > 0) {
        const inst = 1000 / dt;
        ema = ema * 0.9 + inst * 0.1;
        // throttle state updates to ~5/s
        if (Math.random() < 0.08) setFps(ema);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const value = useMemo<PerfCtx>(
    () => ({
      metrics: {
        fps,
        lastAggMs: agg.last,
        avgAggMs: agg.count === 0 ? 0 : agg.sum / agg.count,
        aggCount: agg.count,
        workerProgress: progress,
        lastTokens: agg.tokens,
        lastBuckets: agg.buckets,
      },
      params,
      setParams: (p) => setParamsState((prev) => ({ ...prev, ...p })),
      reportAgg: (ms, tokens, buckets) =>
        setAgg((prev) => ({
          last: ms,
          sum: prev.sum + ms,
          count: prev.count + 1,
          tokens,
          buckets,
        })),
      reportProgress: setProgress,
    }),
    [fps, agg, progress, params],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePerf() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePerf must be used inside PerfProvider");
  return ctx;
}

/** Optional access — returns null outside provider, useful for library components. */
export function useOptionalPerf() {
  return useContext(Ctx);
}

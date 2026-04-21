import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { RLBoardRecord } from "@/lib/rlboard/schema";
import { makeSampleRecords } from "@/lib/rlboard/sample";
import { recordRun } from "@/lib/rlboard/parse";

interface DataCtx {
  records: RLBoardRecord[];
  setRecords: (r: RLBoardRecord[]) => void;
  selectedIndex: number;
  setSelectedIndex: (i: number) => void;
  steps: number[];
  runs: string[];
  activeRuns: Set<string>;
  toggleRun: (run: string) => void;
  setActiveRuns: (runs: Set<string>) => void;
  filteredRecords: RLBoardRecord[];
  source: string;
  setSource: (s: string) => void;
  hideSpecialTokens: boolean;
  setHideSpecialTokens: (v: boolean) => void;
  tokenViewMode: TokenViewMode;
  setTokenViewMode: (v: TokenViewMode) => void;
}

export type TokenViewMode = "compact" | "values" | "table";

const Ctx = createContext<DataCtx | null>(null);

export function RLBoardProvider({ children }: { children: ReactNode }) {
  const [records, setRecordsState] = useState<RLBoardRecord[]>(() => makeSampleRecords());
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [source, setSource] = useState("Built-in sample (rhyme task)");
  const [hideSpecialTokens, setHideSpecialTokens] = useState(false);
  const [tokenViewMode, setTokenViewMode] = useState<TokenViewMode>("compact");
  const [activeRuns, setActiveRuns] = useState<Set<string>>(new Set());

  const runs = useMemo(
    () => Array.from(new Set(records.map(recordRun))).sort(),
    [records],
  );

  const filteredRecords = useMemo(() => {
    if (activeRuns.size === 0) return records;
    return records.filter((r) => activeRuns.has(recordRun(r)));
  }, [records, activeRuns]);

  const steps = useMemo(
    () => Array.from(new Set(filteredRecords.map((r) => r.step))).sort((a, b) => a - b),
    [filteredRecords],
  );

  const value: DataCtx = {
    records,
    setRecords: (r) => {
      setRecordsState(r);
      setSelectedIndex(0);
      setActiveRuns(new Set());
    },
    selectedIndex,
    setSelectedIndex,
    steps,
    runs,
    activeRuns,
    toggleRun: (run) => {
      setActiveRuns((prev) => {
        const next = new Set(prev);
        if (next.has(run)) next.delete(run);
        else next.add(run);
        return next;
      });
    },
    setActiveRuns,
    filteredRecords,
    source,
    setSource,
    hideSpecialTokens,
    setHideSpecialTokens,
    tokenViewMode,
    setTokenViewMode,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRLBoard() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useRLBoard must be used inside RLBoardProvider");
  return ctx;
}

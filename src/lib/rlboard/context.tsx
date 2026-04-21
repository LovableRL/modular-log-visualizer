import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { RLBoardRecord } from "@/lib/rlboard/schema";
import { makeSampleRecords } from "@/lib/rlboard/sample";

interface DataCtx {
  records: RLBoardRecord[];
  setRecords: (r: RLBoardRecord[]) => void;
  selectedIndex: number;
  setSelectedIndex: (i: number) => void;
  steps: number[];
  source: string;
  setSource: (s: string) => void;
}

const Ctx = createContext<DataCtx | null>(null);

export function RLBoardProvider({ children }: { children: ReactNode }) {
  const [records, setRecordsState] = useState<RLBoardRecord[]>(() => makeSampleRecords());
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [source, setSource] = useState("Built-in sample (rhyme task)");
  const steps = useMemo(
    () => Array.from(new Set(records.map((r) => r.step))).sort((a, b) => a - b),
    [records],
  );
  const value: DataCtx = {
    records,
    setRecords: (r) => {
      setRecordsState(r);
      setSelectedIndex(0);
    },
    selectedIndex,
    setSelectedIndex,
    steps,
    source,
    setSource,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRLBoard() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useRLBoard must be used inside RLBoardProvider");
  return ctx;
}

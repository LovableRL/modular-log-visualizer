import type { RLBoardRecord } from "./schema";

/** Parse a JSONL string into RLBoardRecord[]. Lenient — skips invalid lines. */
export function parseJsonl(text: string): {
  records: RLBoardRecord[];
  errors: { line: number; message: string }[];
} {
  const records: RLBoardRecord[] = [];
  const errors: { line: number; message: string }[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      const obj = JSON.parse(line);
      records.push(normalize(obj));
    } catch (e) {
      errors.push({ line: i + 1, message: (e as Error).message });
    }
  }
  return { records, errors };
}

function normalize(obj: Record<string, unknown>): RLBoardRecord {
  // Map a couple of legacy field names just in case.
  const rec = { ...obj } as unknown as RLBoardRecord;
  if (rec.step === undefined && (obj as Record<string, unknown>).global_step !== undefined) {
    rec.step = (obj as Record<string, number>).global_step;
  }
  if (!rec.reward && (obj as Record<string, unknown>).total_reward !== undefined) {
    rec.reward = (obj as Record<string, number>).total_reward;
  }
  rec.step = Number(rec.step ?? 0);
  rec.reward = Number(rec.reward ?? 0);
  return rec;
}

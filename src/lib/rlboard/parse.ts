import type { RLBoardRecord } from "./schema";

export interface ParsedFile {
  records: RLBoardRecord[];
  errors: { line: number; message: string }[];
}

/** Parse a JSONL string into RLBoardRecord[]. Lenient — skips invalid lines. */
export function parseJsonl(text: string, run?: string): ParsedFile {
  const records: RLBoardRecord[] = [];
  const errors: { line: number; message: string }[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      const obj = JSON.parse(line);
      const rec = normalize(obj);
      if (run) {
        rec.metadata = { ...(rec.metadata ?? {}), run };
      }
      records.push(rec);
    } catch (e) {
      errors.push({ line: i + 1, message: (e as Error).message });
    }
  }
  return { records, errors };
}

/** Parse multiple files, tagging each record with its run name (filename minus extension). */
export async function parseFiles(files: File[]): Promise<{
  records: RLBoardRecord[];
  perFile: { name: string; count: number; errors: number }[];
}> {
  const records: RLBoardRecord[] = [];
  const perFile: { name: string; count: number; errors: number }[] = [];
  for (const f of files) {
    const text = await f.text();
    const run = f.name.replace(/\.(jsonl|txt|json)$/i, "");
    const { records: recs, errors } = parseJsonl(text, run);
    records.push(...recs);
    perFile.push({ name: f.name, count: recs.length, errors: errors.length });
  }
  return { records, perFile };
}

function normalize(obj: Record<string, unknown>): RLBoardRecord {
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

/** Extract the run name from a record (set by parseFiles, falls back to "default"). */
export function recordRun(rec: RLBoardRecord): string {
  const r = rec.metadata?.run;
  return typeof r === "string" ? r : "default";
}

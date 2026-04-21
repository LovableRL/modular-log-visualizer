import { useMemo } from "react";
import type { RLBoardRecord } from "@/lib/rlboard/schema";

/** Tiny word-level LCS diff — good enough for response/ref_response comparison. */
function diffWords(a: string, b: string) {
  const A = a.split(/(\s+)/);
  const B = b.split(/(\s+)/);
  const n = A.length, m = B.length;
  // bounded — cap at 1000 tokens per side to keep DP cheap
  const cap = 1000;
  const aw = A.slice(0, cap);
  const bw = B.slice(0, cap);
  const dp: number[][] = Array.from({ length: aw.length + 1 }, () => new Array(bw.length + 1).fill(0));
  for (let i = aw.length - 1; i >= 0; i--) {
    for (let j = bw.length - 1; j >= 0; j--) {
      dp[i][j] = aw[i] === bw[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const left: { type: "eq" | "del"; text: string }[] = [];
  const right: { type: "eq" | "add"; text: string }[] = [];
  let i = 0, j = 0;
  while (i < aw.length && j < bw.length) {
    if (aw[i] === bw[j]) {
      left.push({ type: "eq", text: aw[i] });
      right.push({ type: "eq", text: bw[j] });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      left.push({ type: "del", text: aw[i++] });
    } else {
      right.push({ type: "add", text: bw[j++] });
    }
  }
  while (i < aw.length) left.push({ type: "del", text: aw[i++] });
  while (j < bw.length) right.push({ type: "add", text: bw[j++] });
  return { left, right, truncated: n > cap || m > cap };
}

export function ResponseDiff({ record }: { record: RLBoardRecord }) {
  const ref = record.ref_response;
  const cur = record.response;
  const diff = useMemo(() => (ref ? diffWords(cur, ref) : null), [cur, ref]);

  if (!ref) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No ref_response on this rollout — diff unavailable.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <div className="grid gap-3 md:grid-cols-2">
        <Side title="RL response" tone="primary">
          {diff!.left.map((p, i) =>
            p.type === "eq" ? (
              <span key={i}>{p.text}</span>
            ) : (
              <span key={i} className="rounded-sm bg-destructive/25 text-destructive-foreground">
                {p.text}
              </span>
            ),
          )}
        </Side>
        <Side title="Ref response" tone="accent">
          {diff!.right.map((p, i) =>
            p.type === "eq" ? (
              <span key={i}>{p.text}</span>
            ) : (
              <span key={i} className="rounded-sm bg-success/25 text-foreground">
                {p.text}
              </span>
            ),
          )}
        </Side>
      </div>
      {diff!.truncated && (
        <p className="text-[11px] text-muted-foreground">
          Diff truncated at 1000 words per side for performance.
        </p>
      )}
    </div>
  );
}

function Side({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "primary" | "accent";
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        className="mb-1 font-mono text-[10px] uppercase tracking-widest"
        style={{ color: tone === "primary" ? "var(--primary)" : "var(--accent)" }}
      >
        {title}
      </div>
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-background/40 p-3 font-mono text-xs">
        {children}
      </pre>
    </div>
  );
}

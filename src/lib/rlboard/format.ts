/** SI-prefix number formatting for RL metrics that span many orders of magnitude. */
const SI_PREFIXES: Array<{ exp: number; sym: string }> = [
  { exp: 12, sym: "T" },
  { exp: 9, sym: "G" },
  { exp: 6, sym: "M" },
  { exp: 3, sym: "k" },
  { exp: 0, sym: "" },
  { exp: -3, sym: "m" },
  { exp: -6, sym: "μ" },
  { exp: -9, sym: "n" },
  { exp: -12, sym: "p" },
  { exp: -15, sym: "f" },
];

/** Format a number with SI prefix, e.g. 0.000123 -> "123μ", 1234 -> "1.23k". */
export function fmtSI(v: number, digits = 3): string {
  if (!Number.isFinite(v)) return "—";
  if (v === 0) return "0";
  const abs = Math.abs(v);
  const exp3 = Math.floor(Math.log10(abs) / 3) * 3;
  const p =
    SI_PREFIXES.find((x) => x.exp === exp3) ??
    (exp3 > 12 ? SI_PREFIXES[0] : SI_PREFIXES[SI_PREFIXES.length - 1]);
  const scaled = v / Math.pow(10, p.exp);
  const sign = scaled < 0 ? "-" : "";
  const a = Math.abs(scaled);
  const str =
    a >= 100 ? a.toFixed(Math.max(0, digits - 3))
    : a >= 10 ? a.toFixed(Math.max(0, digits - 2))
    : a.toFixed(Math.max(0, digits - 1));
  return `${sign}${str}${p.sym}`;
}

/** Standard fixed-point formatter for "normal-range" metrics like reward in [-2,2]. */
export function fmtNum(v: number | null | undefined, digits = 3): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs !== 0 && (abs < 1e-3 || abs >= 1e5)) return fmtSI(v, 3);
  if (abs >= 100) return v.toFixed(Math.max(0, digits - 2));
  if (abs >= 1) return v.toFixed(digits);
  return v.toFixed(digits + 1);
}

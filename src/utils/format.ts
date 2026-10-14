export function fmtNum(v: unknown, digits = 0): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: digits }) : "-";
}

export function fmtDate(v: unknown): string {
  if (!v) return "-";
  try { return new Date(String(v)).toLocaleString(); } catch { return "-"; }
}

export function fmtPct(v: unknown, digits = 1): string {
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toFixed(digits)}%` : "-";
}

export function fmtToFixed(v: unknown, digits = 1): string {
  return Number.isFinite(Number(v)) ? Number(v).toFixed(digits) : "-";
}

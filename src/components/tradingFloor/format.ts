/**
 * THE TRADING FLOOR — tiny presentational formatters shared by the page and its
 * sub-components. Pure string/number helpers only (no React, no theme), so every
 * component renders the SAME P&L / probability / clock formatting.
 */

/** A plain number: integers grouped, non-integers to 2dp, non-finite as "—". */
export function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(2);
}

/** A signed P&L string like "+12.4" / "−3.0" (unicode minus). */
export function signed(n: number, dp = 1): string {
  const v = Number(n.toFixed(dp));
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${sign}${Math.abs(v).toFixed(dp)}`;
}

/** A [0,1] probability rendered as an integer percent (clamped). */
export function fmtPct(frac: number, dp = 0): string {
  if (!Number.isFinite(frac)) return "—";
  const clamped = frac < 0 ? 0 : frac > 1 ? 1 : frac;
  return `${(clamped * 100).toFixed(dp)}%`;
}

/** mm:ss from remaining milliseconds (rounds up, never negative). */
export function clock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Semantic P&L tone: bull (up), bear (down), primary (flat). */
export function pnlTone(n: number): string {
  return n > 0 ? "text-bull" : n < 0 ? "text-bear" : "text-primary";
}

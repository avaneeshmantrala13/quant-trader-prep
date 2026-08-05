/**
 * `lib/games/format.ts` — tiny presentational formatters shared across the card
 * games and their engines. Pure string/number helpers only (no React, no theme)
 * so every game renders card faces and P&L the SAME way.
 */

/** A playing-card rank as its face label: 14→A, 13→K, 12→Q, 11→J, else the pip. */
export function rankLabel(rank: number): string {
  if (rank === 14) return "A";
  if (rank === 13) return "K";
  if (rank === 12) return "Q";
  if (rank === 11) return "J";
  return String(rank);
}

/**
 * A signed integer P&L string with thousands grouping and a unicode minus, e.g.
 * `+1,240` / `−3`. Zero renders as `+0`.
 */
export function signedInt(n: number): string {
  const s = n < 0 ? "−" : "+";
  return `${s}${Math.abs(n).toLocaleString()}`;
}

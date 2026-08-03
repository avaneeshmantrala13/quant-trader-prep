/**
 * THE TRADING FLOOR — the one genuinely new scoring stat (everything else is a
 * reused primitive): a Sharpe-like CONSISTENCY over per-round P&L deltas. A
 * steady grinder scores higher than a lucky boom-bust maker with the same total.
 */

/** Per-round P&L deltas from a cumulative equity curve. */
export function roundDeltas(pnlPath: number[]): number[] {
  const out: number[] = [];
  let prev = 0;
  for (const v of pnlPath) {
    out.push(v - prev);
    prev = v;
  }
  return out;
}

/**
 * Sharpe-like consistency: `mean(deltas) / sd(deltas)` (population sd). Returns
 * 0 when there are fewer than 2 rounds or the deltas are perfectly flat (sd 0
 * with zero mean); a positive-mean flat run returns `+Infinity`-free `0` guard
 * is avoided by returning the mean's sign scaled — but to keep it finite and
 * comparable we return 0 when sd is 0.
 */
export function consistency(deltas: number[]): number {
  const n = deltas.length;
  if (n < 2) return 0;
  const mean = deltas.reduce((s, x) => s + x, 0) / n;
  const variance =
    deltas.reduce((s, x) => s + (x - mean) * (x - mean), 0) / n;
  const sd = Math.sqrt(variance);
  if (sd === 0) return 0;
  return mean / sd;
}

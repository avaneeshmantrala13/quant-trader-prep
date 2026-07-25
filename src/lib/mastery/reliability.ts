/**
 * Calibration / reliability math (Murphy Brier decomposition; Dimitriadis,
 * Gneiting & Jordan 2021 — PHASE_1 §1.10 / §5). Given a topic's serve-time
 * predictions and outcomes, we bin by predicted probability and measure the
 * gap between confidence and accuracy (the "confidently wrong" signal). Phase 1
 * only computes the numbers; the reliability *diagram* UI is Phase 5.
 *
 * Phase 1 does NOT persist a full (pred,outcome) history — this operates on an
 * in-memory buffer supplied on demand (Phase 5 owns any capped log).
 */

export interface CalibrationPair {
  /** Predicted success probability at serve time (predictSuccess). */
  pred: number;
  /** Observed outcome. */
  outcome: 0 | 1;
}

export interface ReliabilityBin {
  /** Mean predicted probability in the bin (confidence). */
  conf: number;
  /** Observed fraction correct in the bin (accuracy). */
  acc: number;
  /** Number of pairs in the bin. */
  count: number;
}

function mean(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

function makeBin(slice: CalibrationPair[]): ReliabilityBin {
  return {
    conf: mean(slice.map((p) => p.pred)),
    acc: mean(slice.map((p) => p.outcome)),
    count: slice.length,
  };
}

/**
 * Equal-frequency reliability bins (default 10). Pairs are sorted by predicted
 * probability then split into ~equal contiguous chunks — but a chunk is NEVER
 * cut through a run of IDENTICAL predictions (ties stay together), so a single
 * calibrated confidence level lands in ONE bin instead of being split into
 * spuriously miscalibrated halves. A small trailing remainder is merged into
 * the last bin (the "merge sparse bins" rule).
 */
export function reliabilityBins(
  pairs: CalibrationPair[],
  nBins = 10,
): ReliabilityBin[] {
  const n = pairs.length;
  if (n === 0) return [];
  const sorted = [...pairs].sort((a, b) => a.pred - b.pred);
  const k = Math.min(nBins, n);
  const target = n / k;
  const groups: CalibrationPair[][] = [];
  let cur: CalibrationPair[] = [];
  for (let i = 0; i < n; i++) {
    cur.push(sorted[i]);
    const nextDiffers = i === n - 1 || sorted[i + 1].pred !== sorted[i].pred;
    if (cur.length >= target && nextDiffers) {
      groups.push(cur);
      cur = [];
    }
  }
  if (cur.length > 0) {
    if (groups.length > 0) groups[groups.length - 1].push(...cur);
    else groups.push(cur);
  }
  return groups.map(makeBin);
}

/**
 * Reliability gap + Brier score. `relGap = Σ_k (n_k/N)·|conf_k − acc_k|` (the
 * ECE-style calibration error); `brier = mean((pred − outcome)²)`.
 */
export function brierGap(pairs: CalibrationPair[]): {
  relGap: number;
  brier: number;
} {
  const n = pairs.length;
  if (n === 0) return { relGap: 0, brier: 0 };
  const bins = reliabilityBins(pairs);
  const relGap = bins.reduce(
    (s, bin) => s + (bin.count / n) * Math.abs(bin.conf - bin.acc),
    0,
  );
  const brier = mean(pairs.map((p) => (p.pred - p.outcome) ** 2));
  return { relGap, brier };
}

/**
 * ============================================================================
 *  CONDITIONAL PROBABILITY, GEOMETRY & GAMES — SIMULATION MODEL
 * ============================================================================
 * Pure, deterministic-given-seed functions powering the "Games" group of the
 * Simulations tab: Monty Hall, Bayes via natural frequencies, the geometric
 * dartboard (π/4 area demo), and 2×2 zero-sum mixed-strategy solving. No React
 * / DOM here — just seedable RNG draws and closed-form math, so every result is
 * reproducible and unit-testable.
 */
import { Rng } from "@/lib/rng";
import { cumulativeProportion, downsample } from "@/lib/simulations/shared";

// ============================================================================
//  Monty Hall
// ============================================================================

/**
 * Simulate the Monty Hall problem over `games` plays, returning the RUNNING win
 * proportion: `out[i]` is the fraction of the first `i + 1` games won. Three
 * doors hide one car; the player picks a door, the host opens a different
 * *losing* door, and — when `switchDoor` — the player switches to the remaining
 * unopened door. Converges to ≈2/3 when switching, ≈1/3 when staying. Length
 * equals `games`. Deterministic for a given `seed`.
 */
export function simulateMontyHall(
  switchDoor: boolean,
  games: number,
  seed: number,
): number[] {
  const rng = new Rng(seed);
  const doors = [0, 1, 2] as const;
  const n = Math.max(0, games);
  const wins: boolean[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const car = rng.int(0, 2);
    const pick = rng.int(0, 2);
    // Host opens a door that is neither the player's pick nor the car.
    const losing = doors.filter((d) => d !== pick && d !== car);
    const opened = losing.length === 1 ? losing[0] : rng.pick(losing);
    if (switchDoor) {
      const switchTo = doors.find((d) => d !== pick && d !== opened) as number;
      wins[i] = switchTo === car;
    } else {
      wins[i] = pick === car;
    }
  }
  return cumulativeProportion(wins);
}

// ============================================================================
//  Bayes via natural frequencies
// ============================================================================

/**
 * Posterior P(disease | positive test) via Bayes' rule:
 * `(sens·prior) / (sens·prior + fpr·(1 − prior))`, where `prior` is the base
 * rate, `sens` the true-positive rate, and `fpr` the false-positive rate.
 * Returns 0 when the denominator is 0 (no way to test positive).
 */
export function bayesPosterior(
  prior: number,
  sens: number,
  fpr: number,
): number {
  const num = sens * prior;
  const denom = num + fpr * (1 - prior);
  return denom > 0 ? num / denom : 0;
}

/** A 2×2 breakdown of a test population by condition and test result. */
export interface NatFreqCounts {
  total: number;
  haveAndPos: number;
  haveAndNeg: number;
  noAndPos: number;
  noAndNeg: number;
}

/**
 * Break a population of `total` (default 1000) people into the four
 * natural-frequency buckets implied by a base rate + test accuracy:
 * have-condition-&-test-positive (true positives), have-&-negative (false
 * negatives), no-condition-&-positive (false alarms) and no-&-negative (true
 * negatives). Counts are rounded to whole people and always sum to `total`.
 */
export function naturalFrequencyCounts(
  prior: number,
  sens: number,
  fpr: number,
  total = 1000,
): NatFreqCounts {
  const have = Math.round(prior * total);
  const noCond = total - have;
  const haveAndPos = Math.round(sens * have);
  const haveAndNeg = have - haveAndPos;
  const noAndPos = Math.round(fpr * noCond);
  const noAndNeg = noCond - noAndPos;
  return { total, haveAndPos, haveAndNeg, noAndPos, noAndNeg };
}

// ============================================================================
//  Geometric probability — dartboard (quarter circle, area π/4)
// ============================================================================

/** Area ratio of the quarter unit circle within the unit square: π/4. */
export const CIRCLE_AREA_RATIO = Math.PI / 4;

/** A single dart plus a display sample of throws. */
export interface DartResult {
  inside: number;
  total: number;
  proportion: number;
  points: { x: number; y: number; inside: boolean }[];
}

/**
 * Throw `darts` uniform points into the unit square [0,1]²; a dart is `inside`
 * when `x² + y² ≤ 1` (the quarter circle of area π/4). The `proportion` is
 * computed over ALL darts, but at most `maxPoints` (default 1500) sampled
 * points are returned for display. Deterministic for a given `seed`.
 */
export function simulateDartboard(
  darts: number,
  seed: number,
  maxPoints = 1500,
): DartResult {
  const rng = new Rng(seed);
  const n = Math.max(0, darts);
  const all: { x: number; y: number; inside: boolean }[] = new Array(n);
  let inside = 0;
  for (let i = 0; i < n; i++) {
    const x = rng.next();
    const y = rng.next();
    const isIn = x * x + y * y <= 1;
    if (isIn) inside++;
    all[i] = { x, y, inside: isIn };
  }
  return {
    inside,
    total: n,
    proportion: n > 0 ? inside / n : 0,
    points: downsample(all, maxPoints),
  };
}

// ============================================================================
//  2×2 zero-sum game — mixed strategy solver
// ============================================================================

/** The solution of a 2×2 zero-sum game: value + each player's mix. */
export interface GameSolution {
  value: number;
  rowStrategy: [number, number];
  colStrategy: [number, number];
  saddle: boolean;
}

/**
 * Solve a 2×2 zero-sum game with payoff matrix `A` (payoff to the ROW
 * maximizer; the COLUMN player minimizes). First look for a pure saddle point
 * (maximin === minimax) and, if found, return the pure strategies. Otherwise
 * solve the mixed-strategy equilibrium via the indifference conditions using
 * the standard 2×2 formulas.
 */
export function mixedStrategySolution(A: number[][]): GameSolution {
  const a = A[0][0];
  const b = A[0][1];
  const c = A[1][0];
  const d = A[1][1];

  // ---- Pure saddle point? ---------------------------------------------------
  const rowMin0 = Math.min(a, b);
  const rowMin1 = Math.min(c, d);
  const maximin = Math.max(rowMin0, rowMin1);
  const rowIdx = rowMin0 >= rowMin1 ? 0 : 1;

  const colMax0 = Math.max(a, c);
  const colMax1 = Math.max(b, d);
  const minimax = Math.min(colMax0, colMax1);
  const colIdx = colMax0 <= colMax1 ? 0 : 1;

  if (maximin === minimax) {
    return {
      value: maximin,
      rowStrategy: rowIdx === 0 ? [1, 0] : [0, 1],
      colStrategy: colIdx === 0 ? [1, 0] : [0, 1],
      saddle: true,
    };
  }

  // ---- Mixed strategy via indifference --------------------------------------
  // Row plays row0 w.p. p so both columns pay equally; column plays col0 w.p. q
  // so both rows pay equally. denom = a + d − b − c.
  const denom = a + d - b - c;
  const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
  const p = denom !== 0 ? clamp01((d - c) / denom) : 0.5;
  const q = denom !== 0 ? clamp01((d - b) / denom) : 0.5;
  const value = p * a + (1 - p) * c;

  return {
    value,
    rowStrategy: [p, 1 - p],
    colStrategy: [q, 1 - q],
    saddle: false,
  };
}

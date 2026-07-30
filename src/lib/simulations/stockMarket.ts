/**
 * ============================================================================
 *  STOCK MARKET — SIMULATION MODEL (biased random walk + bull/bear regimes)
 * ============================================================================
 * Pure, deterministic-given-seed functions powering the "Real-World Scenarios"
 * STOCK sims of the Simulations tab. No React / DOM here — just a seedable ±tick
 * random walk, its expected value / drift, and a 2-state Markov regime model
 * (bull/bear) whose stationary mix sets the long-run drift. Every result is
 * reproducible and unit-tested in `stockMarket.test.ts`.
 *
 * TEACHES:
 *  - Expected Value: per-step drift = tick·(2p − 1); E[final price] and the EV
 *    of each trade action follow directly.
 *  - Random walk: `simulatePricePath` is a biased ±tick walk.
 *  - Markov chains: the bull/bear regime switch is a 2-state chain; its
 *    stationary distribution (reused from `processes.ts`) weights the drift.
 */
import { Rng } from "@/lib/rng";
import { runningMean } from "@/lib/simulations/shared";
import { stationaryDistribution } from "@/lib/simulations/processes";

/** The trade the user commits to before the walk plays out. */
export type TradeAction = "buy" | "sell" | "hold";

/** Signed share position implied by an action: buy +1, sell/short −1, hold 0. */
export function positionOf(action: TradeAction): number {
  if (action === "buy") return 1;
  if (action === "sell") return -1;
  return 0;
}

/**
 * Per-step expected price change (the "drift"): `tick·(2p − 1)`.
 * Positive when up-moves are more likely (p > 0.5). This single number is the
 * EV lesson — its sign decides the correct action.
 */
export function stepDrift(p: number, tick: number): number {
  return tick * (2 * p - 1);
}

/** Expected final price after `steps` steps: `S0 + steps·drift`. */
export function expectedFinalPrice(
  S0: number,
  p: number,
  tick: number,
  steps: number,
): number {
  return S0 + Math.max(0, steps) * stepDrift(p, tick);
}

/**
 * Expected P&L of an action over `steps` steps: `position · steps · drift`.
 * Buy earns the drift, short earns its negation, hold earns 0.
 */
export function expectedActionPnL(
  action: TradeAction,
  p: number,
  tick: number,
  steps: number,
): number {
  return positionOf(action) * Math.max(0, steps) * stepDrift(p, tick);
}

/**
 * The EV-optimal action: `buy` if drift is positive, `sell` (short) if drift is
 * negative, `hold` when drift is within `tol` of zero (a fair coin — no edge).
 */
export function recommendedAction(
  p: number,
  tick: number,
  tol = 1e-9,
): TradeAction {
  const d = stepDrift(p, tick);
  if (d > tol) return "buy";
  if (d < -tol) return "sell";
  return "hold";
}

/**
 * One sample price path: a biased ±`tick` random walk of `steps` steps starting
 * at `S0`. Returns `steps + 1` prices (index 0 is `S0`). Deterministic per seed.
 */
export function simulatePricePath(
  S0: number,
  p: number,
  tick: number,
  steps: number,
  seed: number,
): number[] {
  const rng = new Rng(seed);
  const n = Math.max(0, steps);
  const path: number[] = new Array(n + 1);
  path[0] = S0;
  let price = S0;
  for (let i = 0; i < n; i++) {
    price += rng.chance(p) ? tick : -tick;
    path[i + 1] = price;
  }
  return path;
}

/**
 * Final P&L of `action` for each of `trials` independent `steps`-step walks:
 * `position · (finalPrice − S0)`. Length `trials`. Deterministic per seed. The
 * mean of these converges to `expectedActionPnL`.
 */
export function simulateFinalPnLs(
  action: TradeAction,
  S0: number,
  p: number,
  tick: number,
  steps: number,
  trials: number,
  seed: number,
): number[] {
  const rng = new Rng(seed);
  const pos = positionOf(action);
  const n = Math.max(0, trials);
  const st = Math.max(0, steps);
  const out: number[] = new Array(n);
  for (let t = 0; t < n; t++) {
    let price = S0;
    for (let i = 0; i < st; i++) price += rng.chance(p) ? tick : -tick;
    out[t] = pos * (price - S0);
  }
  return out;
}

/** Running average of a P&L series (thin wrapper over `runningMean`). */
export function runningAveragePnL(pnls: number[]): number[] {
  return runningMean(pnls);
}

/** A single histogram bucket over a range of values. */
export interface Bucket {
  /** Inclusive lower edge. */
  lo: number;
  /** Exclusive upper edge (inclusive for the final bucket). */
  hi: number;
  /** Bucket midpoint (a handy plot label / x value). */
  center: number;
  /** How many values fell in `[lo, hi)`. */
  count: number;
}

/**
 * Split `values` into `bins` equal-width buckets spanning [min, max]. Empty
 * input → `[]`; a zero-width range (all equal) → a single bucket. The top edge
 * is inclusive so the maximum value lands in the last bucket. Used to draw the
 * distribution-of-outcomes histogram.
 */
export function bucketize(values: number[], bins: number): Bucket[] {
  if (values.length === 0 || bins < 1) return [];
  let lo = values[0];
  let hi = values[0];
  for (const v of values) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (lo === hi) {
    return [{ lo, hi, center: lo, count: values.length }];
  }
  const width = (hi - lo) / bins;
  const out: Bucket[] = new Array(bins);
  for (let i = 0; i < bins; i++) {
    const bLo = lo + width * i;
    const bHi = i === bins - 1 ? hi : lo + width * (i + 1);
    out[i] = { lo: bLo, hi: bHi, center: (bLo + bHi) / 2, count: 0 };
  }
  for (const v of values) {
    let idx = Math.floor((v - lo) / width);
    if (idx >= bins) idx = bins - 1;
    if (idx < 0) idx = 0;
    out[idx].count++;
  }
  return out;
}

// ---------------------------------------------------------------------------
//  BULL / BEAR REGIMES — a 2-state Markov chain over the drift
// ---------------------------------------------------------------------------

/**
 * A 2-state market: a Bull regime (P(up) = `pBull`, typically > 0.5) and a Bear
 * regime (P(up) = `pBear`, typically < 0.5). Each step the regime stays with
 * probability `stayBull` / `stayBear`, else switches — a 2-state Markov chain.
 */
export interface RegimeModel {
  pBull: number;
  pBear: number;
  stayBull: number;
  stayBear: number;
  tick: number;
}

/** Regime index: 0 = Bull, 1 = Bear. */
export const BULL = 0;
export const BEAR = 1;

/** The row-stochastic 2×2 regime transition matrix. */
export function regimeTransition(m: RegimeModel): number[][] {
  return [
    [m.stayBull, 1 - m.stayBull],
    [1 - m.stayBear, m.stayBear],
  ];
}

/** Long-run regime mix π (reuses the shared power-iteration solver). */
export function regimeStationary(m: RegimeModel): number[] {
  return stationaryDistribution(regimeTransition(m));
}

/** Per-step drift within a regime: `tick·(2p − 1)` for that regime's p. */
export function regimeDrift(m: RegimeModel, regime: number): number {
  return stepDrift(regime === BULL ? m.pBull : m.pBear, m.tick);
}

/**
 * The stock's overall long-run drift: the regime drifts weighted by the
 * stationary mix, `π_bull·drift_bull + π_bear·drift_bear`. This is the EV the
 * price path trends along once the regime chain has mixed.
 */
export function overallDrift(m: RegimeModel): number {
  const pi = regimeStationary(m);
  return pi[BULL] * regimeDrift(m, BULL) + pi[BEAR] * regimeDrift(m, BEAR);
}

/** A regime-switching price path plus the regime at each step. */
export interface RegimePath {
  /** `steps + 1` prices (index 0 is `S0`). */
  prices: number[];
  /** The regime in force at each step (length `steps`); 0 = Bull, 1 = Bear. */
  regimes: number[];
  /** Fraction of steps spent in each regime — converges to the stationary mix. */
  occupancy: number[];
}

/**
 * Simulate a regime-switching walk: at each step the price moves ±`tick` with
 * that regime's up-probability, then the regime transitions per the chain.
 * Deterministic per seed. As `steps → ∞`, `occupancy → regimeStationary`.
 */
export function simulateRegimePath(
  m: RegimeModel,
  S0: number,
  startRegime: number,
  steps: number,
  seed: number,
): RegimePath {
  const rng = new Rng(seed);
  const n = Math.max(0, steps);
  const prices: number[] = new Array(n + 1);
  const regimes: number[] = new Array(n);
  const counts = [0, 0];
  prices[0] = S0;
  let price = S0;
  let regime = startRegime === BEAR ? BEAR : BULL;
  for (let i = 0; i < n; i++) {
    regimes[i] = regime;
    counts[regime]++;
    const pUp = regime === BULL ? m.pBull : m.pBear;
    price += rng.chance(pUp) ? m.tick : -m.tick;
    prices[i + 1] = price;
    // Transition: stay with the regime's stay-probability, else switch.
    const stay = regime === BULL ? m.stayBull : m.stayBear;
    if (!rng.chance(stay)) regime = regime === BULL ? BEAR : BULL;
  }
  const occupancy = n > 0 ? [counts[0] / n, counts[1] / n] : [0, 0];
  return { prices, regimes, occupancy };
}

/**
 * ============================================================================
 *  EXPECTED VALUE, KELLY BETTING & COUPON COLLECTOR — SIMULATION MODEL
 * ============================================================================
 * Pure, deterministic-given-seed functions powering the "Expected Value,
 * Betting & Processes" group of the Simulations tab. No React / DOM here —
 * just seedable RNG draws and closed-form expectations, so every result is
 * reproducible and unit-testable.
 */
import { Rng } from "@/lib/rng";

/** A single discrete outcome of a game: its payoff `value` and probability. */
export interface Outcome {
  value: number;
  prob: number;
}

/** Theoretical expected value `Σ value·prob`. */
export function expectedValue(outcomes: Outcome[]): number {
  let ev = 0;
  for (const o of outcomes) ev += o.value * o.prob;
  return ev;
}

/**
 * Running average of sampled payoffs over `trials` draws: `out[i]` is the mean
 * of the first `i + 1` sampled payoffs. Each draw samples an outcome by its
 * probability (assumes probs sum to ~1). Converges to `expectedValue`.
 * Length equals `trials`. Deterministic for a given `seed`.
 */
export function simulateRunningAverage(
  outcomes: Outcome[],
  trials: number,
  seed: number,
): number[] {
  const rng = new Rng(seed);
  const n = Math.max(0, trials);
  const out: number[] = new Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += sampleOutcome(outcomes, rng.next());
    out[i] = sum / (i + 1);
  }
  return out;
}

/** Pick a payoff by walking the cumulative probability with `u ∈ [0, 1)`. */
function sampleOutcome(outcomes: Outcome[], u: number): number {
  let acc = 0;
  for (const o of outcomes) {
    acc += o.prob;
    if (u < acc) return o.value;
  }
  // Fallback for floating-point drift when probs sum to slightly < 1.
  return outcomes.length > 0 ? outcomes[outcomes.length - 1].value : 0;
}

/**
 * Kelly-optimal fraction of bankroll to stake on a `p`-chance win paying
 * `b`-to-1: `(b·p − (1 − p)) / b`, clamped to `≥ 0` (never bet on a −EV edge).
 */
export function kellyFraction(p: number, b: number): number {
  const f = (b * p - (1 - p)) / b;
  return f > 0 ? f : 0;
}

/**
 * Bankroll trajectory over `rounds` bets, starting at `1.0`. Each round stakes
 * `fraction` of the current bankroll on a `p`-chance win paying `b`-to-1:
 * win → bankroll·(1 + fraction·b), lose → bankroll·(1 − fraction).
 * Returns `rounds + 1` values (including the starting bankroll).
 * Deterministic for a given `seed`.
 */
export function simulateBankroll(
  p: number,
  b: number,
  fraction: number,
  rounds: number,
  seed: number,
): number[] {
  const rng = new Rng(seed);
  const n = Math.max(0, rounds);
  const out: number[] = new Array(n + 1);
  let bankroll = 1.0;
  out[0] = bankroll;
  for (let i = 0; i < n; i++) {
    bankroll = rng.chance(p)
      ? bankroll * (1 + fraction * b)
      : bankroll * (1 - fraction);
    out[i + 1] = bankroll;
  }
  return out;
}

/** Expected number of draws to collect all `n` coupons: `n·H_n`. */
export function couponCollectorExpectation(n: number): number {
  let h = 0;
  for (let k = 1; k <= n; k++) h += 1 / k;
  return n * h;
}

/**
 * Per trial, the number of uniform-random draws (`int` in `[1, n]`) needed to
 * collect all `n` distinct coupons. Returns the array of counts, one per trial
 * (length `trials`). Deterministic for a given `seed`.
 */
export function simulateCouponCollector(
  n: number,
  trials: number,
  seed: number,
): number[] {
  const rng = new Rng(seed);
  const t = Math.max(0, trials);
  const out: number[] = new Array(t);
  for (let i = 0; i < t; i++) {
    const seen: boolean[] = new Array(n).fill(false);
    let collected = 0;
    let draws = 0;
    while (collected < n) {
      const coupon = rng.int(1, n) - 1;
      draws++;
      if (!seen[coupon]) {
        seen[coupon] = true;
        collected++;
      }
    }
    out[i] = draws;
  }
  return out;
}

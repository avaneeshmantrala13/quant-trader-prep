/**
 * ============================================================================
 *  CORE PROBABILITY — SIMULATION MODEL (coins, dice, two-dice sample space)
 * ============================================================================
 * Pure, deterministic-given-seed functions powering the "Core Probability"
 * group of the Simulations tab. No React / DOM here — just seedable RNG draws
 * and exact combinatorics, so every result is reproducible and unit-testable.
 */
import { Rng } from "@/lib/rng";
import { cumulativeProportion } from "@/lib/simulations/shared";

/**
 * Flip a coin with `P(heads) = pHeads` for `trials` flips, returning the
 * RUNNING proportion of heads: `out[i] = (#heads in flips[0..i]) / (i + 1)`.
 * Length equals `trials`. Deterministic for a given `seed`.
 */
export function simulateCoinFlips(
  pHeads: number,
  trials: number,
  seed: number,
): number[] {
  const rng = new Rng(seed);
  const flips: boolean[] = new Array(Math.max(0, trials));
  for (let i = 0; i < trials; i++) flips[i] = rng.chance(pHeads);
  return cumulativeProportion(flips);
}

/**
 * Roll a `sides`-sided die `rolls` times, returning the RUNNING proportion of
 * rolls that landed on `face` (a value in `[1, sides]`). Length equals `rolls`.
 * Deterministic for a given `seed`.
 */
export function simulateDieFaceRunning(
  sides: number,
  face: number,
  rolls: number,
  seed: number,
): number[] {
  const rng = new Rng(seed);
  const hits: boolean[] = new Array(Math.max(0, rolls));
  for (let i = 0; i < rolls; i++) hits[i] = rng.int(1, sides) === face;
  return cumulativeProportion(hits);
}

/**
 * Roll a `sides`-sided die `rolls` times, returning the count per face.
 * Result length is `sides`; index 0 holds the count for face 1, index 1 for
 * face 2, and so on. Deterministic for a given `seed`.
 */
export function dieFaceCounts(
  sides: number,
  rolls: number,
  seed: number,
): number[] {
  const rng = new Rng(seed);
  const counts: number[] = new Array(Math.max(0, sides)).fill(0);
  for (let i = 0; i < rolls; i++) {
    const face = rng.int(1, sides);
    counts[face - 1]++;
  }
  return counts;
}

/**
 * Exact distribution of the sum of two fair six-sided dice. Returns one entry
 * per possible sum (2..12) with the number of ordered (a, b) outcomes giving
 * that sum out of 36, plus the probability `count / 36`.
 */
export function twoDiceSumDistribution(): {
  sum: number;
  count: number;
  prob: number;
}[] {
  const counts: number[] = new Array(13).fill(0); // index = sum, 2..12 used
  for (let a = 1; a <= 6; a++) {
    for (let b = 1; b <= 6; b++) counts[a + b]++;
  }
  const out: { sum: number; count: number; prob: number }[] = [];
  for (let sum = 2; sum <= 12; sum++) {
    out.push({ sum, count: counts[sum], prob: counts[sum] / 36 });
  }
  return out;
}

/**
 * Count how many of the 36 equally-likely ordered outcomes `(a, b)` of two
 * fair six-sided dice satisfy `predicate`.
 */
export function twoDiceEventCount(
  predicate: (a: number, b: number) => boolean,
): number {
  let n = 0;
  for (let a = 1; a <= 6; a++) {
    for (let b = 1; b <= 6; b++) {
      if (predicate(a, b)) n++;
    }
  }
  return n;
}

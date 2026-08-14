import Fraction from "fraction.js";
import { F } from "./solvers";

/**
 * EXACT, DETERMINISTIC solvers for the "Information-theoretic & adversarial-trap"
 * brainteaser family (query-the-max, secretary/optimal-stopping, balance-scale
 * weighings, and the last-among-k symmetry trap). Same discipline as
 * `./solvers.ts` and `./techniqueSolvers.ts`: every answer is produced by a
 * closed form or an exhaustively-verifiable method (integer arithmetic, exact
 * `fraction.js` rationals, or a tiny exact search / brute force) — NEVER by
 * eyeballing. Each solver is independently re-derived and cross-checked (brute
 * force / an exact argmax) in `./infoTraps.test.ts`.
 *
 * These are TRAP puzzles: a wrong "correct answer" is worse than nothing, so the
 * three hard invariants are pinned here and asserted in the test —
 *   • query-the-max MUST be n (unqueried cards carry ZERO information),
 *   • the known-heavier weighing MUST use log base 3 (three scale outcomes),
 *   • the last-among-k symmetry probability MUST be 1/k.
 * Each solver also EXPOSES its wrong-answer traps (see the `*Traps` helpers) so
 * the generators + mock archetype can enumerate them with misconception tags to
 * power the hint ladder.
 */

/* ========================================================================== */
/*  1. Query-the-max / "must reveal all" (information lower bound = n)         */
/* ========================================================================== */

/**
 * n face-down, distinct-rank cards; each query reveals only the newly-queried
 * card's RELATIVE rank among the cards queried so far. The minimum number of
 * queries that GUARANTEES identifying the single highest card is exactly `n`:
 * an unqueried card is never observed, so its rank is entirely unconstrained by
 * the responses and an adversary can make it the true maximum — hence skipping
 * even one card breaks the guarantee, while querying all n (tracking the running
 * max) always succeeds. Exact integer.
 */
export function queryTheMaxMinQueries(n: number): number {
  if (n < 1 || !Number.isInteger(n)) throw new Error("need n ≥ 1 integer");
  return n;
}

/**
 * The COMMON WRONG ANSWERS (traps) for query-the-max, each with the misconception
 * it encodes. Every trap is STRICTLY LESS THAN n for n ≥ 2 (asserted in the
 * test), which is exactly why they are wrong — they under-count the queries.
 */
export function queryTheMaxTraps(n: number): {
  skipLast: number; // n − 1: "the last card adds no new comparison"
  binarySearch: number; // ⌈log2 n⌉: tournament / binary-search reflex
  ternarySearch: number; // ⌈log3 n⌉: ternary reflex (confusing it with weighings)
} {
  if (n < 1 || !Number.isInteger(n)) throw new Error("need n ≥ 1 integer");
  return {
    skipLast: n - 1,
    binarySearch: ceilLog(n, 2),
    ternarySearch: ceilLog(n, 3),
  };
}

/**
 * Exact ERROR RATE of the "skip one card" strategy (query n−1 cards, declare the
 * queried maximum the global max): the true maximum sits in the unqueried slot
 * with probability exactly 1/n over a uniformly-random arrangement, so the
 * strategy is wrong 1/n of the time (> 0 for every finite n) — a concrete,
 * exact witness that n−1 queries cannot GUARANTEE the max. Exact rational.
 */
export function skipOneStrategyErrorRate(n: number): Fraction {
  if (n < 1 || !Number.isInteger(n)) throw new Error("need n ≥ 1 integer");
  return F(1, n);
}

/**
 * BRUTE-FORCE ground truth for {@link skipOneStrategyErrorRate}: over ALL n!
 * arrangements of ranks 1..n, count the fraction in which the maximum (rank n)
 * occupies the UNqueried last position, so the "query the first n−1" strategy
 * misses it. Returns that exact rational (= 1/n). Used by the test for small n.
 */
export function skipOneStrategyErrorBruteForce(n: number): Fraction {
  if (n < 1 || n > 8) throw new Error("brute force only for 1 ≤ n ≤ 8");
  const perm: number[] = [];
  const used = new Array<boolean>(n + 1).fill(false);
  let total = 0;
  let miss = 0;
  const build = (pos: number) => {
    if (pos === n) {
      total += 1;
      // The strategy queries positions 0..n−2 and never sees position n−1.
      if (perm[n - 1] === n) miss += 1; // the max hid in the unqueried slot
      return;
    }
    for (let v = 1; v <= n; v++) {
      if (used[v]) continue;
      used[v] = true;
      perm[pos] = v;
      build(pos + 1);
      used[v] = false;
    }
  };
  build(0);
  return F(miss, total);
}

/* ========================================================================== */
/*  2. Secretary / optimal-stopping (observe-then-take-next-record)           */
/* ========================================================================== */

/**
 * Win probability of the threshold rule "reject the first `r` candidates, then
 * take the first later candidate that beats all seen so far" for the classic
 * secretary problem with `n` candidates in uniformly-random order:
 *   • r = 0 → 1/n (take the first candidate blindly);
 *   • r ≥ 1 → (r/n)·Σ_{i=r+1}^{n} 1/(i−1).
 * Computed in DOUBLE precision (deterministic), which is valid for ALL n — unlike
 * an exact `fraction.js` sum, whose harmonic denominators blow past 2^53 (and
 * silently corrupt) for n well under 100. The win-prob curve is unimodal with an
 * O(1/n) margin at its peak, so double precision (~1e-15 relative) resolves the
 * integer argmax unambiguously for every n we ship. For an EXACT rational
 * cross-check on small n, see {@link secretaryWinProbExact}.
 */
export function secretaryWinProb(n: number, r: number): number {
  if (n < 1 || !Number.isInteger(n)) throw new Error("need n ≥ 1 integer");
  if (r < 0 || r >= n || !Number.isInteger(r))
    throw new Error("need 0 ≤ r < n integer");
  if (r === 0) return 1 / n;
  let sum = 0;
  for (let i = r + 1; i <= n; i++) sum += 1 / (i - 1);
  return (r / n) * sum;
}

/**
 * EXACT rational win probability (same formula as {@link secretaryWinProb}), for
 * SMALL n only. `fraction.js` stores numerator/denominator as doubles, so the
 * harmonic-sum denominators overflow 2^53 for larger n; this guards n ≤ 20 where
 * the rational is provably exact and is used by the test to certify the
 * double-precision argmax against the ground truth.
 */
export function secretaryWinProbExact(n: number, r: number): Fraction {
  if (n < 1 || n > 20 || !Number.isInteger(n))
    throw new Error("exact rational only for 1 ≤ n ≤ 20");
  if (r < 0 || r >= n || !Number.isInteger(r))
    throw new Error("need 0 ≤ r < n integer");
  if (r === 0) return F(1, n);
  let sum = F(0);
  for (let i = r + 1; i <= n; i++) sum = sum.add(F(1, i - 1));
  return F(r, n).mul(sum);
}

/**
 * The optimal reject-count r* (the argmax of {@link secretaryWinProb} over
 * r ∈ [0, n−1]) and its win probability. The optimum is ≈ n/e with success
 * ≈ 1/e ≈ 37%. The argmax is computed deterministically in double precision
 * (robust for all n; the peak margin is O(1/n) ≫ double epsilon) and, for
 * n ≤ 20, is certified against the EXACT rational argmax in the test — so a
 * shipped card's reject-count answer is provably optimal. Ties break to smaller r.
 */
export function secretaryOptimalReject(n: number): { r: number; prob: number } {
  if (n < 2 || !Number.isInteger(n)) throw new Error("need n ≥ 2 integer");
  let bestR = 0;
  let bestP = secretaryWinProb(n, 0);
  for (let r = 1; r < n; r++) {
    const p = secretaryWinProb(n, r);
    if (p > bestP) {
      bestP = p;
      bestR = r;
    }
  }
  return { r: bestR, prob: bestP };
}

/** The ⌊n/e⌋ closed-form approximation to the optimal reject-count. */
export function secretaryRejectApprox(n: number): number {
  if (n < 1 || !Number.isInteger(n)) throw new Error("need n ≥ 1 integer");
  return Math.floor(n / Math.E);
}

/** The classic WRONG answer: reject the first HALF (n/2) instead of ≈ n/e. */
export function secretaryHalfTrap(n: number): number {
  return Math.floor(n / 2);
}

/* ========================================================================== */
/*  3. Balance-scale weighings (three-way information; log base 3)            */
/* ========================================================================== */

/** Smallest integer k with base^k ≥ n (i.e. ⌈log_base n⌉), computed exactly. */
function ceilLog(n: number, base: number): number {
  if (n < 1 || !Number.isInteger(n)) throw new Error("need n ≥ 1 integer");
  if (base < 2 || !Number.isInteger(base)) throw new Error("need base ≥ 2");
  let k = 0;
  let reach = 1; // base^k
  while (reach < n) {
    reach *= base;
    k += 1;
  }
  return k;
}

/**
 * Minimum balance-scale weighings to find the ONE known-HEAVIER coin among `n`
 * identical-looking coins: a balance has THREE outcomes (left-down, right-down,
 * balanced), so k weighings distinguish 3^k cases and the minimum is
 *   ⌈log3 n⌉  (the smallest k with 3^k ≥ n).
 * The classic trap is ⌈log2 n⌉ — treating the scale as a two-outcome device.
 * Exact integer. (n = 9 → 2, n = 12 → 3, n = 27 → 3.)
 */
export function minWeighingsKnownHeavier(n: number): number {
  return ceilLog(n, 3);
}

/** The two-outcome (binary) TRAP answer ⌈log2 n⌉ for the known-heavier weighing. */
export function minWeighingsBinaryTrap(n: number): number {
  return ceilLog(n, 2);
}

/**
 * Minimum weighings for the CLASSIC "one fake among `n`, unknown whether it is
 * heavier OR lighter, and you must also say WHICH" puzzle. With no spare
 * reference coin, k weighings resolve at most (3^k − 3)/2 coins, so the minimum
 * is the smallest k with (3^k − 3)/2 ≥ n. Exact integer. (n = 12 → 3, the famous
 * twelve-coin puzzle; n = 3 → 2; n = 39 → 4.)
 *
 * The trap here is using the KNOWN-heavier count ⌈log3 n⌉, which under-counts:
 * discovering the DIRECTION (heavier/lighter) costs extra information, so each
 * weighing effectively resolves fewer than 3 fresh cases.
 */
export function minWeighingsFakeUnknown(n: number): number {
  if (n < 1 || !Number.isInteger(n)) throw new Error("need n ≥ 1 integer");
  let k = 1;
  while ((3 ** k - 3) / 2 < n) k += 1;
  return k;
}

/* ========================================================================== */
/*  4. Symmetry "last among k" (the Joker-style trap; probability = 1/k)      */
/* ========================================================================== */

/**
 * By SYMMETRY, among `k` distinguished cards shuffled into a uniformly-random
 * order, any SPECIFIC one is equally likely to occupy each position, so it is
 * last with probability exactly 1/k. Exact rational. The whole point of the trap
 * is that you need NO permutation product — the answer is 1/k by symmetry alone.
 */
export function lastAmongKProb(k: number): Fraction {
  if (k < 1 || !Number.isInteger(k)) throw new Error("need k ≥ 1 integer");
  return F(1, k);
}

/**
 * BRUTE-FORCE ground truth for {@link lastAmongKProb}: over ALL k! orderings of
 * k distinct cards, the fraction in which a FIXED card lands in the last slot =
 * (k−1)!/k! = 1/k. Returns that exact rational. Used by the test for small k.
 */
export function lastAmongKBruteForce(k: number): Fraction {
  if (k < 1 || k > 8) throw new Error("brute force only for 1 ≤ k ≤ 8");
  const perm: number[] = [];
  const used = new Array<boolean>(k).fill(false);
  let total = 0;
  let last = 0;
  const build = (pos: number) => {
    if (pos === k) {
      total += 1;
      if (perm[k - 1] === 0) last += 1; // fixed card #0 is last
      return;
    }
    for (let v = 0; v < k; v++) {
      if (used[v]) continue;
      used[v] = true;
      perm[pos] = v;
      build(pos + 1);
      used[v] = false;
    }
  };
  build(0);
  return F(last, total);
}

/**
 * Expected value of a $`payout` prize that is paid iff a SPECIFIC one of `k`
 * symmetric cards is last: by symmetry the payout fires with probability 1/k, so
 * EV = payout/k. Exact rational.
 */
export function symmetryPayoutEV(payout: number, k: number): Fraction {
  if (k < 1 || !Number.isInteger(k)) throw new Error("need k ≥ 1 integer");
  return F(payout).div(F(k));
}

/**
 * The common WRONG answers (traps) for the last-among-k symmetry puzzle:
 *   • `fullPermutation` = 1/k! — treating it as ONE specific full ordering
 *     rather than just fixing the last position (the "permutation product" trap);
 *   • `pairwiseHalves`  = 1/2^(k−1) — chaining k−1 independent "loses each
 *     coin-flip" comparisons instead of using symmetry;
 *   • `coinFlip`        = 1/2 — the naive "it is last or it isn't" answer.
 * Returned as exact rationals.
 */
export function lastAmongKTraps(k: number): {
  fullPermutation: Fraction;
  pairwiseHalves: Fraction;
  coinFlip: Fraction;
} {
  if (k < 1 || !Number.isInteger(k)) throw new Error("need k ≥ 1 integer");
  // BigInt factorial so k! stays EXACT for deck-sized k (52! overflows a double).
  let fact = 1n;
  for (let i = 2n; i <= BigInt(k); i++) fact *= i;
  return {
    fullPermutation: F(1, fact),
    pairwiseHalves: F(1, 2n ** BigInt(Math.max(0, k - 1))),
    coinFlip: F(1, 2),
  };
}

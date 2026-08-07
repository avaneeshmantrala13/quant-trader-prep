import Fraction from "fraction.js";
import { F } from "./solvers";

/**
 * EXACT solvers for the NEW brainteaser technique families integrated from
 * datasets 3–8 (Modular, Simplification, Summation, Pigeonhole, Logical,
 * Symmetry). Same discipline as `./solvers.ts`: every answer is produced by an
 * exact, closed-form or exhaustively-verifiable method (integer arithmetic,
 * exact `fraction.js` rationals, or a tiny exact search), NEVER by
 * floating-point guessing. Each solver is independently re-derived and
 * cross-checked against the ORIGINAL dataset answers (used only as hidden test
 * fixtures) and, where feasible, an exhaustive brute force in
 * `./techniques.test.ts`.
 *
 * The shipped flashcards (see `./techniqueGenerators.ts` + `./levels.ts`) NEVER
 * reuse a dataset puzzle verbatim, the parametric families draw fresh
 * parameters and the hand-authored one-offs are new framings of the same
 * technique. These solvers exist so the parametric cards can be produced
 * infinitely AND verified, and so the arithmetic behind the static cards is
 * exact.
 */

/* ========================================================================== */
/*  Summation / triangular numbers (dataset 5)                                 */
/* ========================================================================== */

/** The n-th triangular number Σ_{i=1..n} i = n(n+1)/2. Exact integer. */
export function triangular(n: number): number {
  if (n < 0 || !Number.isInteger(n)) throw new Error("need n ≥ 0 integer");
  return (n * (n + 1)) / 2;
}

/**
 * Cards in an S-story house of cards. Each of the Σ = T(S) little "houses"
 * (rows S, S−1, …, 1) uses 3 cards, minus the S shared horizontal floor cards
 * between stacked rows:  cards = 3·T(S) − S = S·(3S+1)/2.
 * (S = 100 → 15050; S = 2 → 7; S = 3 → 15.) Exact integer.
 */
export function houseOfCards(stories: number): number {
  if (stories < 1 || !Number.isInteger(stories))
    throw new Error("need stories ≥ 1 integer");
  return (stories * (3 * stories + 1)) / 2;
}

/**
 * Worst-case minimum number of drops to locate the breaking floor with TWO
 * identical balls in a building of `floors` floors: the smallest N with
 * N(N+1)/2 ≥ floors (decreasing step size N, N−1, …). (floors = 100 → 14.)
 * Exact integer (monotone search, verified against the triangular bound).
 */
export function minDropsTwoBalls(floors: number): number {
  if (floors < 1 || !Number.isInteger(floors))
    throw new Error("need floors ≥ 1 integer");
  let n = 0;
  while (triangular(n) < floors) n++;
  return n;
}

/**
 * Count of a nonzero digit `d` written out across 1 … 10^k − 1 (equivalently the
 * k-digit strings 0…0 through 9…9). By the odometer argument each of the k
 * positions cycles through 0–9 equally, contributing 10^(k−1) occurrences of
 * `d`, so the total is k·10^(k−1). (d = 2, k = 4 → 4000 twos in 1…9999, which is
 * also the count in 1…10000 since 10000 has no 2.) Exact integer.
 */
export function digitCountUpToPow10(d: number, k: number): number {
  if (d < 1 || d > 9) throw new Error("need a nonzero digit 1..9");
  if (k < 1 || !Number.isInteger(k)) throw new Error("need k ≥ 1 integer");
  return k * 10 ** (k - 1);
}

/** Brute-force count of digit `d` across the integers 1..n (test ground truth). */
export function digitCountBruteForce(d: number, n: number): number {
  let count = 0;
  for (let i = 1; i <= n; i++) {
    let x = i;
    while (x > 0) {
      if (x % 10 === d) count++;
      x = Math.floor(x / 10);
    }
  }
  return count;
}

/* ========================================================================== */
/*  Pigeonhole principle (dataset 6)                                           */
/* ========================================================================== */

/**
 * Smallest number of items that GUARANTEES some box holds at least `perBox`,
 * given `boxes` boxes:  k = boxes·(perBox − 1) + 1  (the +1 past the largest
 * "one short in every box" configuration). (15 boxes, ≥ 5 in one → 61;
 * 12 months, ≥ 7 → 73; 12 zodiac signs, ≥ 2 → 13; 2 sock colors, ≥ 2 → 3.)
 */
export function minPerBoxThreshold(boxes: number, perBox: number): number {
  if (boxes < 1 || perBox < 1) throw new Error("need boxes, perBox ≥ 1");
  return boxes * (perBox - 1) + 1;
}

/** The largest count that can AVOID `perBox` in every box = boxes·(perBox−1). */
export function maxAvoidingPerBox(boxes: number, perBox: number): number {
  return boxes * (perBox - 1);
}

/**
 * Smallest draw from 1..N that GUARANTEES a complementary pair summing to N+1:
 * there are N/2 such pairs, so N/2 + 1 forces two from one pair. (N = 60 → 31.)
 * Requires N even.
 */
export function complementaryPairThreshold(N: number): number {
  if (N < 2 || N % 2 !== 0) throw new Error("need even N ≥ 2");
  return N / 2 + 1;
}

/**
 * Smallest draw from 1..N that GUARANTEES a multiple of `d`: there are
 * ⌊N/d⌋ multiples and N − ⌊N/d⌋ non-multiples, so (N − ⌊N/d⌋) + 1 forces one.
 * (N = 30, d = 3 → 21.)
 */
export function avoidMultiplesThreshold(N: number, d: number): number {
  if (N < 1 || d < 1) throw new Error("need N, d ≥ 1");
  return N - Math.floor(N / d) + 1;
}

/** The largest subset of 1..N containing NO multiple of d (test ground truth). */
export function maxSubsetNoMultiple(N: number, d: number): number {
  let count = 0;
  for (let i = 1; i <= N; i++) if (i % d !== 0) count++;
  return count;
}

/* ========================================================================== */
/*  Number theory (dataset 7, parametric)                                     */
/* ========================================================================== */

/**
 * Trailing zeros of n! = Σ_{i≥1} ⌊n / 5^i⌋ (each factor of 5 pairs with an
 * abundant 2 to make a 10). (n = 100 → 20 + 4 = 24.) Exact integer.
 */
export function trailingZerosFactorial(n: number): number {
  if (n < 0 || !Number.isInteger(n)) throw new Error("need n ≥ 0 integer");
  let count = 0;
  let pow = 5;
  while (pow <= n) {
    count += Math.floor(n / pow);
    pow *= 5;
  }
  return count;
}

/** Brute-force factors of 5 in n! by summing v5(k) for k=1..n (test truth). */
export function trailingZerosBruteForce(n: number): number {
  let count = 0;
  for (let k = 1; k <= n; k++) {
    let x = k;
    while (x % 5 === 0) {
      count++;
      x /= 5;
    }
  }
  return count;
}

/**
 * The SMALLEST positive integer whose decimal digits multiply to `product`
 * (product ≥ 1). Greedy: peel off the largest single-digit factors 9→2 (fewest
 * digits), then sort the digits ascending (smallest leading digit). Returns the
 * number as a string (it can exceed Number.MAX_SAFE_INTEGER), or `null` when the
 * product has a prime factor > 7 and is therefore unreachable by single digits.
 * (96 → "268"; 10000 → "255558"; 1 → "1".)
 */
export function smallestNumberWithDigitProduct(product: number): string | null {
  if (product < 1 || !Number.isInteger(product))
    throw new Error("need product ≥ 1 integer");
  if (product === 1) return "1";
  const digits: number[] = [];
  let p = product;
  for (let d = 9; d >= 2; d--) {
    while (p % d === 0) {
      digits.push(d);
      p /= d;
    }
  }
  if (p !== 1) return null; // leftover prime factor > 9 (e.g. 11, 13, …)
  digits.sort((a, b) => a - b);
  return digits.join("");
}

/** Brute-force smallest number with digit product P by scanning 1.. (test truth). */
export function smallestDigitProductBruteForce(
  product: number,
  cap = 2_000_000,
): string | null {
  for (let i = 1; i <= cap; i++) {
    let x = i;
    let prod = 1;
    while (x > 0) {
      prod *= x % 10;
      x = Math.floor(x / 10);
    }
    if (prod === product) return String(i);
  }
  return null;
}

/**
 * Minimum number of one-per-denomination weights, all powers of two
 * {1, 2, 4, 8, …}, placed on a single pan to weigh EVERY integer mass 1..N:
 * the number of binary digits of N = ⌊log₂ N⌋ + 1 (since 1,2,…,2^(b−1) cover
 * 1..2^b − 1 ≥ N). (N = 35 → 6, covering 1..63.) Exact integer.
 */
export function minBinaryWeights(N: number): number {
  if (N < 1 || !Number.isInteger(N)) throw new Error("need N ≥ 1 integer");
  let bits = 0;
  let reach = 0; // 2^bits − 1
  while (reach < N) {
    bits++;
    reach = 2 ** bits - 1;
  }
  return bits;
}

/**
 * Turning direction of the last cog in a chain of `n` meshed gears when the
 * first is turned clockwise: adjacent meshed gears spin oppositely, so gear n
 * matches gear 1 iff n is ODD. Returns "clockwise" / "counterclockwise".
 */
export function lastCogDirection(n: number): "clockwise" | "counterclockwise" {
  if (n < 1 || !Number.isInteger(n)) throw new Error("need n ≥ 1 integer");
  return n % 2 === 1 ? "clockwise" : "counterclockwise";
}

/* ========================================================================== */
/*  Modular checksum, prisoners' hats (dataset 3)                             */
/* ========================================================================== */

/**
 * n prisoners in a line, each wearing one of `colors` hat colors. The rearmost
 * prisoner announces the modular checksum (Σ of the colors he sees, mod
 * `colors`) as a color; every prisoner ahead then subtracts what they see and
 * what has already been said to recover their own color with CERTAINTY. So
 * n − 1 are saved for sure, and the rearmost prisoner, who sacrifices himself
 * to broadcast one shared checksum symbol, guesses his own hat correctly with
 * probability exactly 1/colors. Exact (integer + rational).
 */
export function modularHats(
  n: number,
  colors: number,
): { savedForCertain: number; backSurvival: Fraction } {
  if (n < 2 || !Number.isInteger(n)) throw new Error("need n ≥ 2 integer");
  if (colors < 2 || !Number.isInteger(colors))
    throw new Error("need colors ≥ 2 integer");
  return { savedForCertain: n - 1, backSurvival: F(1, colors) };
}

/* ========================================================================== */
/*  Subtraction / "count to the target" game (dataset 7, LG17)                 */
/* ========================================================================== */

/**
 * Two players alternate raising a running total that starts at 0; on your turn
 * you add an integer from 1 to `maxStep`, and whoever hits EXACTLY `target`
 * wins. This is a subtraction game: the winning ("N-position") totals are those
 * ≡ target (mod maxStep+1). The first player wins iff target mod (maxStep+1) ≠ 0,
 * and their winning opening is to make the running total equal target mod
 * (maxStep+1); if that residue is 0 the second player wins with the mirror
 * strategy (always restoring the total to a multiple of maxStep+1).
 */
export function firstToTargetGame(
  target: number,
  maxStep: number,
): { firstPlayerWins: boolean; firstMove: number | null; period: number } {
  if (target < 1 || !Number.isInteger(target))
    throw new Error("need target ≥ 1 integer");
  if (maxStep < 1 || !Number.isInteger(maxStep))
    throw new Error("need maxStep ≥ 1 integer");
  const period = maxStep + 1;
  const r = target % period;
  return {
    firstPlayerWins: r !== 0,
    firstMove: r !== 0 ? r : null,
    period,
  };
}

/**
 * Exhaustive game-theoretic ground truth for `firstToTargetGame`: retrograde
 * analysis over totals 0..target, `win[t]` = true iff the player TO MOVE at
 * running total t can force a win. Used by the test to confirm the closed form.
 */
export function firstToTargetBruteForce(
  target: number,
  maxStep: number,
): { firstPlayerWins: boolean; firstMove: number | null } {
  const win: boolean[] = new Array(target + 1).fill(false);
  // Work downward from the target: at total t the mover picks a step s∈[1,maxStep].
  for (let t = target - 1; t >= 0; t--) {
    let can = false;
    let move: number | null = null;
    for (let s = 1; s <= maxStep && t + s <= target; s++) {
      const next = t + s;
      // Reaching the target is an immediate win; otherwise you win if the
      // opponent (to move at `next`) is in a losing position.
      if (next === target || !win[next]) {
        can = true;
        move = s;
        break;
      }
    }
    win[t] = can;
    if (t === 0) {
      return { firstPlayerWins: can, firstMove: can ? move : null };
    }
  }
  return { firstPlayerWins: false, firstMove: null };
}

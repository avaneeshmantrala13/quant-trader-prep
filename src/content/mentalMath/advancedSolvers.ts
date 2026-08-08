/**
 * Exact, PURE verifiers for the ADVANCED mental-arithmetic subtopics ingested
 * from the math-questions / mental-math source banks (Cluster C):
 *   • squares & near-square products via the difference-of-squares identity
 *     (a−k)(a+k) = a² − k²,
 *   • closed-form series sums (triangular Σi, the "sum of the first n odds" = n²,
 *     and a general consecutive-integer range Σ_{lo..hi}),
 *   • digit-counting (how many digit CHARACTERS are used to write 1..N).
 *
 * Each function COMPUTES its answer directly (integer arithmetic, never a
 * hardcoded table), so every generated variant is correct-by-construction. The
 * generators in `./generators.ts` call these to obtain the ground truth; the
 * fixtures in `./advancedSolvers.test.ts` pin the closed forms against an
 * independent brute-force loop.
 */

/* -------------------------------------------------------------------------- */
/*  Squares & near-square products (difference of squares)                     */
/* -------------------------------------------------------------------------- */

/** Exact product (center − k)·(center + k) = center² − k². */
export function diffOfSquaresProduct(center: number, k: number): number {
  return center * center - k * k;
}

/** Exact n². (Used for the "square a round-ish number" drill.) */
export function square(n: number): number {
  return n * n;
}

/* -------------------------------------------------------------------------- */
/*  Series sums (closed forms)                                                  */
/* -------------------------------------------------------------------------- */

/** The n-th triangular number Σ_{i=1..n} i = n(n+1)/2. Exact integer. */
export function triangular(n: number): number {
  return (n * (n + 1)) / 2;
}

/** Sum of the first n odd numbers 1 + 3 + … + (2n−1) = n². Exact integer. */
export function sumOfFirstOdds(n: number): number {
  return n * n;
}

/** Sum of the first n even numbers 2 + 4 + … + 2n = n(n+1). Exact integer. */
export function sumOfFirstEvens(n: number): number {
  return n * (n + 1);
}

/** Sum of every integer from `lo` to `hi` inclusive = (hi−lo+1)(lo+hi)/2. */
export function rangeSum(lo: number, hi: number): number {
  return ((hi - lo + 1) * (lo + hi)) / 2;
}

/* -------------------------------------------------------------------------- */
/*  Digit counting                                                             */
/* -------------------------------------------------------------------------- */

/** Number of decimal digits of a positive integer n (n ≥ 1). */
export function digitCount(n: number): number {
  return String(n).length;
}

/**
 * Total number of digit CHARACTERS used to write every integer from 1 to N
 * (e.g. numbering the pages of an N-page book). Closed form: sum over each digit
 * length band d of d·(count of d-digit numbers ≤ N). Verified against a direct
 * Σ digitCount(i) loop in the tests.
 */
export function totalDigitsToNumber(N: number): number {
  let total = 0;
  let low = 1; // smallest d-digit number
  let d = 1;
  while (low <= N) {
    const high = low * 10 - 1; // largest d-digit number
    const upper = Math.min(high, N);
    total += d * (upper - low + 1);
    low *= 10;
    d += 1;
  }
  return total;
}

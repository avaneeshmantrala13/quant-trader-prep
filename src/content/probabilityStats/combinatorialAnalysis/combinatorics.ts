import Fraction from "fraction.js";

/**
 * Exact combinatorics core for the Probability & Statistics → **Combinatorial
 * Analysis** subcategory (the counting-heavy set: choose-k ratios, hypergeometric
 * draws, poker hands, binomial coin/dice counting, stars-&-bars + inclusion-
 * exclusion, lattice-path counting, arrangements, and the multiplication
 * principle). Almost every answer in this subcategory is EXACT, so the whole
 * pipeline is built on exact integer / rational arithmetic:
 *
 *   • integer COUNTS use `bigint` (so C(52,10), C(260,3), multinomials, and the
 *     19^{310} overbooked-flight numerators never overflow a JS `number`), and
 *   • probabilities are exact `fraction.js` rationals (v5, which is BigInt-backed)
 *     built directly from bigint numerator/denominator pairs via `fracBig`.
 *
 * Floats appear ONLY where a target is genuinely transcendental / not required
 * exact (the big binomial tail of the overbooked-flight problem, computed in
 * log-space to high precision). Everything else is exact.
 */

/* ========================================================================== */
/*  Fraction helpers                                                           */
/* ========================================================================== */

/** Fraction constructor (number | bigint | string args), mirroring the sibling solvers. */
export const F = (n: number | string | bigint, d?: number | bigint): Fraction =>
  d === undefined ? new Fraction(n as never) : new Fraction(n as never, d);

/** Build an exact Fraction from a bigint numerator/denominator (no precision loss). */
export function fracBig(num: bigint, den: bigint): Fraction {
  return new Fraction(num, den);
}

/** Canonical "a/b" fraction text (no mixed numbers). */
export function fracText(f: Fraction): string {
  return f.toFraction(false);
}

/** Fixed-dp decimal text for a Fraction or number. */
export function decText(f: Fraction | number, dp: number): string {
  const v = typeof f === "number" ? f : f.valueOf();
  return v.toFixed(dp);
}

/** Smallest decimal places d (≤ cap) making f·10^d an exact integer, else cap. */
export function exactDecimals(f: Fraction, cap = 6): number {
  for (let d = 0; d <= cap; d++) {
    if (Number(f.mul(10 ** d).d) === 1) return d;
  }
  return cap;
}

/** Decimals for a numeric probability answer (exact if terminating within cap, else cap). */
export function numDp(f: Fraction, min = 2, cap = 4): number {
  return Math.max(min, exactDecimals(f, cap));
}

/* ========================================================================== */
/*  Exact integer combinatorics (bigint)                                       */
/* ========================================================================== */

/** Exact factorial n! as a bigint (n ≥ 0). */
export function factorialBig(n: number): bigint {
  let f = 1n;
  for (let i = 2n; i <= BigInt(n); i++) f *= i;
  return f;
}

/**
 * Exact binomial coefficient C(n, k) as a bigint. Safe for the large values this
 * subcategory needs. C(52,10) ≈ 1.6e10, C(260,3), C(310,k), etc., with no
 * intermediate overflow (the running product divides exactly at every step).
 */
export function chooseBig(n: number, k: number): bigint {
  if (k < 0 || k > n || n < 0) return 0n;
  k = Math.min(k, n - k);
  let num = 1n;
  let den = 1n;
  for (let i = 0; i < k; i++) {
    num *= BigInt(n - i);
    den *= BigInt(i + 1);
  }
  return num / den;
}

/** C(n, k) as a JS number (only call when the result is known < 2^53). */
export function choose(n: number, k: number): number {
  return Number(chooseBig(n, k));
}

/**
 * Exact multinomial coefficient (Σparts)! / ∏(partᵢ!) as a bigint, the number
 * of distinct arrangements of a multiset (e.g. lattice paths in 3-D: E/N/U moves).
 */
export function multinomialBig(parts: number[]): bigint {
  const total = parts.reduce((a, b) => a + b, 0);
  let res = factorialBig(total);
  for (const p of parts) res /= factorialBig(p);
  return res;
}

/** Falling factorial n·(n−1)·…·(n−k+1) as a bigint (ordered draws / permutations P(n,k)). */
export function fallingBig(n: number, k: number): bigint {
  let res = 1n;
  for (let i = 0; i < k; i++) res *= BigInt(n - i);
  return res;
}

/** Integer power base^exp as a bigint (exact; base, exp ≥ 0). */
export function powBig(base: number, exp: number): bigint {
  return BigInt(base) ** BigInt(exp);
}

/* ========================================================================== */
/*  Exact rational probability helpers                                         */
/* ========================================================================== */

/** Exact hypergeometric-style ratio favorable/total as a reduced Fraction. */
export function ratioBig(favorable: bigint, total: bigint): Fraction {
  return fracBig(favorable, total);
}

/** Exact binomial pmf P(X = k), X ~ Bin(n, p), p rational (exact Fraction). */
export function binomPMF(n: number, p: Fraction, k: number): Fraction {
  const q = F(1).sub(p);
  return F(chooseBig(n, k).toString())
    .mul(p.pow(k) as Fraction)
    .mul(q.pow(n - k) as Fraction);
}

/** Exact lower binomial tail P(X ≤ k). */
export function binomTailLE(n: number, p: Fraction, k: number): Fraction {
  let s = F(0);
  for (let j = 0; j <= k; j++) s = s.add(binomPMF(n, p, j));
  return s;
}

/** Exact upper binomial tail P(X ≥ k) = 1 − P(X ≤ k−1). */
export function binomTailGE(n: number, p: Fraction, k: number): Fraction {
  return F(1).sub(binomTailLE(n, p, k - 1));
}

/**
 * High-precision binomial lower tail P(X ≤ k), X ~ Bin(n, p), computed in
 * LOG-space (log-gamma binomial coefficients + log probabilities) to avoid the
 * overflow/underflow of exact-rational arithmetic on n in the hundreds. Used for
 * the overbooked-flight tail (n = 310) where the answer is only needed to ~3 dp.
 */
export function binomTailLEFloat(n: number, p: number, k: number): number {
  const logChoose = (nn: number, kk: number): number =>
    logGamma(nn + 1) - logGamma(kk + 1) - logGamma(nn - kk + 1);
  const lp = Math.log(p);
  const lq = Math.log(1 - p);
  let sum = 0;
  for (let j = 0; j <= k; j++) {
    sum += Math.exp(logChoose(n, j) + j * lp + (n - j) * lq);
  }
  return sum;
}

/** Lanczos log-gamma (abs error < 1e-10), for the log-space binomial tail. */
export function logGamma(x: number): number {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  }
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

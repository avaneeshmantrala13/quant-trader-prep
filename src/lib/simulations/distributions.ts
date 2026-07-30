/**
 * ============================================================================
 *  DISTRIBUTIONS & THE CENTRAL LIMIT THEOREM — SIMULATION MODEL
 * ============================================================================
 * Pure, deterministic-given-seed math powering the "Distributions & the CLT"
 * group of the Simulations tab: the binomial distribution, the emergence of the
 * bell curve from averages (CLT), and the distribution of order statistics
 * (min / max / median) of iid uniforms. No React / DOM here — just seedable RNG
 * draws and exact combinatorics / special functions, so every result is
 * reproducible and unit-testable in `distributions.test.ts`.
 */
import { Rng } from "@/lib/rng";
import { mean } from "@/lib/simulations/shared";

/* ===========================================================================
 *  BINOMIAL DISTRIBUTION
 * ======================================================================== */

/**
 * Exact binomial pmf `P(X = k)` for `k = 0..n` with `X ~ Binomial(n, p)`.
 * Returns an array of length `n + 1`. Computed in log-space with an incremental
 * `log C(n, k)` recurrence so it stays numerically stable for large `n`.
 */
export function binomialPmf(n: number, p: number): number[] {
  const out: number[] = new Array(Math.max(0, n + 1)).fill(0);
  if (n < 0) return out;
  if (p <= 0) {
    out[0] = 1;
    return out;
  }
  if (p >= 1) {
    out[n] = 1;
    return out;
  }
  const logP = Math.log(p);
  const logQ = Math.log(1 - p);
  let logCk = 0; // log C(n, 0) = 0
  for (let k = 0; k <= n; k++) {
    if (k > 0) logCk += Math.log((n - k + 1) / k);
    out[k] = Math.exp(logCk + k * logP + (n - k) * logQ);
  }
  return out;
}

/**
 * Simulate `samples` draws of `X ~ Binomial(n, p)` — each draw runs `n`
 * independent Bernoulli(p) trials and tallies the number of successes — and
 * return the empirical PROPORTIONS `counts[k] / samples` for `k = 0..n`
 * (length `n + 1`). Deterministic for a given `seed`.
 */
export function simulateBinomialCounts(
  n: number,
  p: number,
  samples: number,
  seed: number,
): number[] {
  const rng = new Rng(seed);
  const counts: number[] = new Array(Math.max(0, n + 1)).fill(0);
  for (let s = 0; s < samples; s++) {
    let k = 0;
    for (let i = 0; i < n; i++) if (rng.chance(p)) k++;
    counts[k]++;
  }
  return counts.map((c) => (samples > 0 ? c / samples : 0));
}

/* ===========================================================================
 *  CENTRAL LIMIT THEOREM — sampling sources & sample means
 * ======================================================================== */

/**
 * The kinds of "lumpy" source distribution the CLT demo can average over.
 * - `uniform`   → U(0, 1)              (its `param` is ignored)
 * - `bernoulli` → 1 with probability `param`, else 0
 * - `dice`      → uniform integer in `1..param`
 */
export type SourceKind = "uniform" | "bernoulli" | "dice";

/** Theoretical mean E[X] of a source distribution. */
export function sourceMean(kind: SourceKind, param: number): number {
  switch (kind) {
    case "uniform":
      return 0.5;
    case "bernoulli":
      return param;
    case "dice":
      return (param + 1) / 2;
  }
}

/** Theoretical variance Var(X) of a source distribution. */
export function sourceVariance(kind: SourceKind, param: number): number {
  switch (kind) {
    case "uniform":
      return 1 / 12;
    case "bernoulli":
      return param * (1 - param);
    case "dice":
      // Var of a discrete uniform on 1..m is (m^2 - 1) / 12.
      return (param * param - 1) / 12;
  }
}

/** Draw a single value from a source distribution using `rng`. */
export function sampleFromSource(
  kind: SourceKind,
  param: number,
  rng: Rng,
): number {
  switch (kind) {
    case "uniform":
      return rng.next();
    case "bernoulli":
      return rng.chance(param) ? 1 : 0;
    case "dice":
      return rng.int(1, param);
  }
}

/**
 * Simulate `numSamples` sample means, each the average of `sampleSize` iid
 * draws from the given source. Deterministic for a given `seed`. As
 * `sampleSize` grows the returned values cluster ever more tightly into a
 * normal bell around `sourceMean(kind, param)` — the Central Limit Theorem.
 */
export function simulateSampleMeans(
  kind: SourceKind,
  param: number,
  sampleSize: number,
  numSamples: number,
  seed: number,
): number[] {
  const rng = new Rng(seed);
  const out: number[] = new Array(Math.max(0, numSamples));
  for (let s = 0; s < numSamples; s++) {
    const draws: number[] = new Array(Math.max(0, sampleSize));
    for (let i = 0; i < sampleSize; i++) {
      draws[i] = sampleFromSource(kind, param, rng);
    }
    out[s] = mean(draws);
  }
  return out;
}

/** Normal (Gaussian) probability density at `x` for N(mu, sigma^2). */
export function normalPdf(x: number, mu: number, sigma: number): number {
  if (sigma <= 0) return 0;
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
}

/**
 * Bin `values` into `bins` equal-width bins across `domain = [lo, hi]` and
 * return each bin's center plus `prop` = the FRACTION of all values landing in
 * that bin (`countInBin / values.length`). NOTE: `prop` is a fraction, not a
 * probability density, so it sums to ~1 across bins when every value lies in
 * the domain (values outside `[lo, hi]` are dropped, lowering the sum). The
 * right edge is inclusive so `hi` lands in the last bin.
 */
export function histogramProportions(
  values: number[],
  bins: number,
  domain: [number, number],
): { center: number; prop: number }[] {
  const [lo, hi] = domain;
  const out: { center: number; prop: number }[] = [];
  if (bins <= 0 || hi <= lo) return out;
  const width = (hi - lo) / bins;
  const counts: number[] = new Array(bins).fill(0);
  for (const v of values) {
    if (v < lo || v > hi) continue;
    let idx = Math.floor((v - lo) / width);
    if (idx >= bins) idx = bins - 1; // inclusive right edge
    if (idx >= 0 && idx < bins) counts[idx]++;
  }
  const total = values.length > 0 ? values.length : 1;
  for (let i = 0; i < bins; i++) {
    out.push({ center: lo + width * (i + 0.5), prop: counts[i] / total });
  }
  return out;
}

/* ===========================================================================
 *  ORDER STATISTICS of n iid Uniform(0, 1)
 * ======================================================================== */

/** Log-gamma via the Lanczos approximation (g = 7). Accurate to ~1e-10. */
function lgamma(z: number): number {
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) {
    // Reflection formula for the left half-plane.
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
  }
  z -= 1;
  let x = c[0];
  const g = 7;
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/**
 * Beta(a, b) probability density at `x` (support `[0, 1]`), evaluated in
 * log-space via `lgamma`. Returns 0 outside the support.
 */
export function betaPdf(x: number, a: number, b: number): number {
  if (x < 0 || x > 1) return 0;
  const logBeta = lgamma(a) + lgamma(b) - lgamma(a + b);
  if (x === 0) return a < 1 ? Infinity : a === 1 ? Math.exp(-logBeta) : 0;
  if (x === 1) return b < 1 ? Infinity : b === 1 ? Math.exp(-logBeta) : 0;
  return Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - logBeta);
}

/** Which order statistic of the n uniforms to study. */
export type OrderStatisticKind = "min" | "max" | "median";

/**
 * The 1-based rank of the "median" order statistic for a sample of size `n`:
 * `(n + 1) / 2` when `n` is odd, `n / 2` when `n` is even. Equal to
 * `floor((n + 1) / 2)` in both cases.
 */
function medianRank(n: number): number {
  return Math.floor((n + 1) / 2);
}

/**
 * Theoretical pdf of the requested order statistic of `n` iid Uniform(0, 1):
 *   min:    n·(1 − x)^(n−1)          [X_(1) ~ Beta(1, n)]
 *   max:    n·x^(n−1)                [X_(n) ~ Beta(n, 1)]
 *   median: Beta(k, n − k + 1) pdf,  k = medianRank(n)
 */
export function orderStatisticPdf(
  kind: OrderStatisticKind,
  n: number,
  x: number,
): number {
  if (x < 0 || x > 1) return 0;
  switch (kind) {
    case "min":
      return n * Math.pow(1 - x, n - 1);
    case "max":
      return n * Math.pow(x, n - 1);
    case "median": {
      const k = medianRank(n);
      return betaPdf(x, k, n - k + 1);
    }
  }
}

/**
 * Theoretical mean of the requested order statistic of `n` iid Uniform(0, 1):
 *   min: 1/(n+1), max: n/(n+1), median: 0.5 (exact for odd n, approx for even).
 */
export function orderStatisticMean(
  kind: OrderStatisticKind,
  n: number,
): number {
  switch (kind) {
    case "min":
      return 1 / (n + 1);
    case "max":
      return n / (n + 1);
    case "median":
      return 0.5;
  }
}

/**
 * Simulate `samples` values of the requested order statistic, each computed
 * from a fresh batch of `n` iid Uniform(0, 1) draws. Deterministic for a given
 * `seed`.
 */
export function simulateOrderStatistic(
  kind: OrderStatisticKind,
  n: number,
  samples: number,
  seed: number,
): number[] {
  const rng = new Rng(seed);
  const out: number[] = new Array(Math.max(0, samples));
  const k = medianRank(n);
  for (let s = 0; s < samples; s++) {
    if (kind === "min") {
      let m = Infinity;
      for (let i = 0; i < n; i++) {
        const u = rng.next();
        if (u < m) m = u;
      }
      out[s] = m;
    } else if (kind === "max") {
      let m = -Infinity;
      for (let i = 0; i < n; i++) {
        const u = rng.next();
        if (u > m) m = u;
      }
      out[s] = m;
    } else {
      const arr: number[] = new Array(n);
      for (let i = 0; i < n; i++) arr[i] = rng.next();
      arr.sort((a, b) => a - b);
      out[s] = arr[k - 1];
    }
  }
  return out;
}

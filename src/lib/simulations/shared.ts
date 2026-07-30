/**
 * ============================================================================
 *  SIMULATIONS — SHARED STATISTICS & PLOTTING HELPERS
 * ============================================================================
 * Pure, dependency-light numeric utilities shared by every simulation group.
 * No React, no DOM, no RNG — just deterministic math so results are trivially
 * unit-testable and reusable across the coin / dice / CLT / Kelly / … sims.
 *
 * These signatures are a contract other workers rely on; do not change them.
 */

/**
 * Cumulative running mean: `out[i] = mean(xs[0..i])`.
 * Empty input → `[]`. Computed in one pass with a running sum.
 */
export function runningMean(xs: number[]): number[] {
  const out: number[] = new Array(xs.length);
  let sum = 0;
  for (let i = 0; i < xs.length; i++) {
    sum += xs[i];
    out[i] = sum / (i + 1);
  }
  return out;
}

/**
 * Cumulative proportion of `true`: `out[i] = (#true in s[0..i]) / (i + 1)`.
 * Empty input → `[]`.
 */
export function cumulativeProportion(successes: boolean[]): number[] {
  const out: number[] = new Array(successes.length);
  let hits = 0;
  for (let i = 0; i < successes.length; i++) {
    if (successes[i]) hits++;
    out[i] = hits / (i + 1);
  }
  return out;
}

/** Arithmetic mean (0 for empty). */
export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let sum = 0;
  for (const x of xs) sum += x;
  return sum / xs.length;
}

/**
 * Population variance (divides by N), i.e. `mean((x - mean)^2)`.
 * Returns 0 for empty or single-element inputs.
 */
export function variance(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  let sum = 0;
  for (const x of xs) {
    const d = x - m;
    sum += d * d;
  }
  return sum / xs.length;
}

/**
 * Evenly downsample an array to at most `maxPoints` items, ALWAYS keeping the
 * first and last element. Used to plot long (10k-point) convergence series
 * without shipping every point to the SVG.
 *
 * If the array already has `<= maxPoints` elements it is returned as-is
 * (a copy). `maxPoints < 2` collapses to just the endpoints (or fewer).
 */
export function downsample<T>(xs: T[], maxPoints: number): T[] {
  const n = xs.length;
  if (n <= maxPoints) return xs.slice();
  if (maxPoints <= 1) return n > 0 ? [xs[0]] : [];
  if (maxPoints === 2) return [xs[0], xs[n - 1]];

  const out: T[] = new Array(maxPoints);
  // Map i ∈ [0, maxPoints-1] onto index ∈ [0, n-1] linearly; endpoints exact.
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.round((i * (n - 1)) / (maxPoints - 1));
    out[i] = xs[idx];
  }
  return out;
}

/** `[0, 1, ..., n-1]`. Non-positive `n` → `[]`. */
export function range(n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(i);
  return out;
}

/**
 * `n` evenly spaced values from `a` to `b` inclusive (requires `n >= 2`).
 * `n === 2` → `[a, b]`. Both endpoints are exact.
 */
export function linspace(a: number, b: number, n: number): number[] {
  if (n < 2) return n === 1 ? [a] : [];
  const out: number[] = new Array(n);
  const step = (b - a) / (n - 1);
  for (let i = 0; i < n; i++) out[i] = a + step * i;
  out[n - 1] = b; // guard against floating-point drift on the last point
  return out;
}

/**
 * Count occurrences of each integer value in `[0..maxValue]`.
 * Returns an array of length `maxValue + 1`; values outside the range are
 * ignored. Non-integer inputs are floored.
 */
export function integerHistogram(values: number[], maxValue: number): number[] {
  const out: number[] = new Array(Math.max(0, maxValue + 1)).fill(0);
  for (const v of values) {
    const k = Math.floor(v);
    if (k >= 0 && k <= maxValue) out[k]++;
  }
  return out;
}

/** Round to `d` decimals (numeric result). */
export function roundTo(x: number, d: number): number {
  const f = 10 ** d;
  return Math.round(x * f) / f;
}

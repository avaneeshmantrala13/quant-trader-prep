import { normalCdf } from "../coreSolvers";

/**
 * Solvers for the Probability & Statistics → **Brownian Motion** subcategory
 * (Bucket 1, advanced; UT M362M; interview-relevant *intuition* per the gap
 * analysis — drift + variance scaling, √t, independent increments).
 *
 * A Brownian motion with drift μ and volatility σ started at x₀ has
 * X_t ~ N(x₀ + μt, σ²t). Everything here is that one fact: the mean grows
 * LINEARLY (x₀+μt) while the standard deviation grows like √t (σ√t) — the
 * signature "√t scaling". Distribution probabilities reuse the shared `normalCdf`
 * (Φ) at a stated precision, matching the CLT / Normal families.
 */

/** Standard deviation of X_t = σ·√t (the √t scaling). */
export function bmStd(sigma: number, t: number): number {
  return sigma * Math.sqrt(t);
}

/** Variance of X_t = σ²·t (grows linearly in time). */
export function bmVar(sigma: number, t: number): number {
  return sigma * sigma * t;
}

/** Mean of X_t = x₀ + μ·t (drift is linear in time). */
export function bmMean(x0: number, mu: number, t: number): number {
  return x0 + mu * t;
}

/** P(X_t ≤ x) = Φ((x − (x₀+μt))/(σ√t)) for a BM with drift. Float via normalCdf. */
export function bmBelow(
  x0: number,
  mu: number,
  sigma: number,
  t: number,
  x: number,
): number {
  return normalCdf((x - bmMean(x0, mu, t)) / bmStd(sigma, t));
}

/**
 * Standard deviation of an INCREMENT over a window of length Δt = σ√Δt.
 * Increments are independent and stationary, so the increment's law depends only
 * on the window length, not on where it starts.
 */
export function bmIncrementStd(sigma: number, dt: number): number {
  return sigma * Math.sqrt(dt);
}

import Fraction from "fraction.js";
import { F, normalCdf } from "../coreSolvers";

/**
 * Solvers for the Probability & Statistics → **Continuous Distributions**
 * subcategory (Bucket 1, UT M362K ch. 5): teaching continuous RVs via PDFs/CDFs
 * and INTEGRATION, consolidating the continuous Uniform, Exponential, and Normal.
 *
 * The density-integration and Uniform families are exact rationals (`fraction.js`);
 * the Exponential tails (`e^{−λt}`) and Normal `Φ(z)` are genuinely
 * transcendental and computed as `number` to a stated precision, reusing the
 * shared `normalCdf` from `../coreSolvers.ts` (same convention as the CLT levels).
 */

/* ----------------------------- density integration ------------------------ */

/**
 * Normalising constant c for a power density f(x) = c·xⁿ on [0, L]:
 * ∫₀ᴸ c·xⁿ dx = c·L^{n+1}/(n+1) = 1 ⇒ c = (n+1)/L^{n+1}. Exact.
 */
export function densityNormConst(n: number, L: number): Fraction {
  return F(n + 1, L ** (n + 1));
}

/**
 * P(a ≤ X ≤ b) for the normalised power density f(x)=c·xⁿ on [0,L]:
 * ∫ₐᵇ c·xⁿ dx = (b^{n+1} − a^{n+1})/L^{n+1}. Exact.
 */
export function densityProb(n: number, L: number, a: number, b: number): Fraction {
  return F(b ** (n + 1) - a ** (n + 1), L ** (n + 1));
}

/**
 * E[X] for the normalised power density f(x)=c·xⁿ on [0,L]:
 * ∫₀ᴸ x·c·xⁿ dx = c·L^{n+2}/(n+2) = (n+1)/(n+2)·L. Exact.
 */
export function densityMean(n: number, L: number): Fraction {
  return F((n + 1) * L, n + 2);
}

/* --------------------------------- uniform -------------------------------- */

/** P(a ≤ X ≤ b) for X ~ U(L, U) with [a,b] ⊆ [L,U] = (b − a)/(U − L). Exact. */
export function uniformProb(L: number, U: number, a: number, b: number): Fraction {
  return F(b - a, U - L);
}

/** Variance of U(L, U) = (U − L)²/12. Exact. */
export function uniformVar(L: number, U: number): Fraction {
  return F((U - L) ** 2, 12);
}

/* ------------------------------ exponential ------------------------------- */

/** Upper tail P(X > t) = e^{−λt} for X ~ Exp(λ) (float). */
export function expTail(lambda: number, t: number): number {
  return Math.exp(-lambda * t);
}

/** CDF P(X ≤ t) = 1 − e^{−λt} for X ~ Exp(λ) (float). */
export function expCdf(lambda: number, t: number): number {
  return 1 - Math.exp(-lambda * t);
}

/**
 * Memorylessness: P(X > s + t | X > s) = P(X > t) = e^{−λt}, independent of s
 * (the defining property of the exponential). Float.
 */
export function expMemoryless(lambda: number, t: number): number {
  return Math.exp(-lambda * t);
}

/**
 * The minimum of independent exponentials Exp(λᵢ) is Exp(Σλᵢ), so
 * E[min] = 1/Σλᵢ. For n iid Exp(λ), E[min] = 1/(nλ). Float (rational).
 */
export function expMinMean(rates: number[]): number {
  return 1 / rates.reduce((a, r) => a + r, 0);
}

/** P(min of independent Exp(λᵢ) exceeds t) = e^{−(Σλᵢ)·t}. Float. */
export function expMinTail(rates: number[], t: number): number {
  return Math.exp(-rates.reduce((a, r) => a + r, 0) * t);
}

/* --------------------------------- normal --------------------------------- */

/** Standardised score z = (x − μ)/σ. */
export function zScore(mu: number, sigma: number, x: number): number {
  return (x - mu) / sigma;
}

/** P(X ≤ x) = Φ((x − μ)/σ) for X ~ N(μ, σ²) (float via normalCdf). */
export function normalBelow(mu: number, sigma: number, x: number): number {
  return normalCdf(zScore(mu, sigma, x));
}

/** P(a ≤ X ≤ b) = Φ(z_b) − Φ(z_a) for X ~ N(μ, σ²) (float). */
export function normalBetween(mu: number, sigma: number, a: number, b: number): number {
  return normalCdf(zScore(mu, sigma, b)) - normalCdf(zScore(mu, sigma, a));
}

/** P(μ − kσ ≤ X ≤ μ + kσ) = 2Φ(k) − 1, the symmetric-interval mass. Float. */
export function normalSymmetric(k: number): number {
  return 2 * normalCdf(k) - 1;
}

import Fraction from "fraction.js";
import { F } from "../coreSolvers";

/**
 * Exact solvers for the **Gamma distribution** (Bucket 2, "Extra Relevant
 * Knowledge"; UT M362K 5.6 — academic for interviews). Using the (shape k, rate
 * λ) parameterisation: mean = k/λ, variance = k/λ². A Gamma(k, λ) is the sum of k
 * iid Exp(λ), i.e. the waiting time until the k-th arrival of a rate-λ Poisson
 * process — the fact that ties Gamma to the Poisson/Exponential families. All
 * exact rationals.
 */

/** Mean of Gamma(shape k, rate λ) = k/λ. */
export function gammaMean(k: number, lambda: number): Fraction {
  return F(k, lambda);
}

/** Variance of Gamma(shape k, rate λ) = k/λ². */
export function gammaVar(k: number, lambda: number): Fraction {
  return F(k, lambda * lambda);
}

/** E[time to the k-th arrival] for a rate-λ Poisson process = k/λ (sum of k Exp(λ)). */
export function gammaSumExpMean(k: number, lambda: number): Fraction {
  return F(k, lambda);
}

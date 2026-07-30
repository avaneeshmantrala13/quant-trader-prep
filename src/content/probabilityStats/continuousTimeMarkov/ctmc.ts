import Fraction from "fraction.js";
import { F } from "../coreSolvers";

/**
 * Exact solvers for **continuous-time Markov chains** and light queueing (Bucket
 * 2 "Extra Relevant Knowledge"; UT M362M / Ross IPM — academic for interviews).
 *
 *   • Holding time in a state is Exp(total out-rate), so E[hold] = 1/Σrates.
 *   • A 2-state CTMC with 0→1 rate λ and 1→0 rate μ has stationary
 *     π₀ = μ/(λ+μ), π₁ = λ/(λ+μ) (flow balance λπ₀ = μπ₁).
 *   • M/M/1 queue (arrival λ < service μ): utilisation ρ=λ/μ, mean number in
 *     system L = ρ/(1−ρ) = λ/(μ−λ), mean number waiting Lq = ρ²/(1−ρ).
 * All exact rationals.
 */

/** Expected holding time in a state = 1/(sum of out-rates). */
export function holdingTime(rates: number[]): Fraction {
  return F(1, rates.reduce((a, r) => a + r, 0));
}

/** Stationary π₀ = μ/(λ+μ) for a 2-state CTMC (state 0 leaves at rate λ). */
export function ctmcTwoStateStationary(lambda: number, mu: number): Fraction {
  return F(mu, lambda + mu);
}

/** M/M/1 mean number in system L = λ/(μ−λ) = ρ/(1−ρ). */
export function mm1MeanInSystem(lambda: number, mu: number): Fraction {
  return F(lambda, mu - lambda);
}

/** M/M/1 utilisation ρ = λ/μ. */
export function mm1Utilisation(lambda: number, mu: number): Fraction {
  return F(lambda, mu);
}

/** M/M/1 mean number WAITING Lq = ρ²/(1−ρ) = λ²/(μ(μ−λ)). */
export function mm1MeanWaiting(lambda: number, mu: number): Fraction {
  return F(lambda * lambda, mu * (mu - lambda));
}

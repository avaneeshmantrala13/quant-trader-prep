import Fraction from "fraction.js";
import { F, solveLinearFraction } from "./markov";

/**
 * Exact solver for **stationary / limiting distributions** of a discrete-time
 * Markov chain (Bucket 1, UT M362M core; interview genre "long-run fraction of
 * time / steady state"). Solves πP = π with Σπ = 1 over the rationals via the
 * shared `solveLinearFraction` (same Gaussian elimination the first-step-analysis
 * families use), so every answer is EXACT.
 */

/**
 * Stationary distribution π (row vector) of an n-state chain with rational
 * transition matrix `P` (row-stochastic). Solves the balance equations
 * Σ_i π_i P_{ij} = π_j for j = 0…n−2, plus the normalisation Σ_i π_i = 1.
 */
export function stationaryDistribution(P: Fraction[][]): Fraction[] {
  const n = P.length;
  const A: Fraction[][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => F(0)),
  );
  const b: Fraction[] = Array.from({ length: n }, () => F(0));
  // Balance equations for columns j = 0…n−2:  Σ_i π_i P_{ij} − π_j = 0.
  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < n; i++) {
      A[j][i] = P[i][j].sub(i === j ? F(1) : F(0));
    }
    b[j] = F(0);
  }
  // Normalisation: Σ_i π_i = 1.
  for (let i = 0; i < n; i++) A[n - 1][i] = F(1);
  b[n - 1] = F(1);
  return solveLinearFraction(A, b);
}

/** Closed-form stationary π₀ = b/(a+b) for a 2-state chain P=[[1−a,a],[b,1−b]]. */
export function twoStateStationary(a: Fraction, b: Fraction): [Fraction, Fraction] {
  const p0 = b.div(a.add(b));
  return [p0, F(1).sub(p0)];
}

/** Long-run average reward Σ π_i r_i under the stationary distribution. */
export function longRunReward(pi: Fraction[], rewards: number[]): Fraction {
  return pi.reduce((acc, p, i) => acc.add(p.mul(rewards[i])), F(0));
}

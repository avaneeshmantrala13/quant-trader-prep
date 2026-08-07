import Fraction from "fraction.js";
import { F } from "../coreSolvers";

/**
 * Exact solvers for **branching processes** (Galton–Watson). Bucket 2 "Extra
 * Relevant Knowledge" (UT M362M core; academic for interviews).
 *
 * Offspring distribution is over {0,1,2} with counts (a,b,c) out of D (so
 * p₀=a/D, p₁=b/D, p₂=c/D). Two exact facts:
 *   • E[Zₙ] = μⁿ where μ = p₁ + 2p₂ is the mean offspring (start Z₀=1).
 *   • Extinction probability = smallest root of s = G(s) in [0,1]. For this
 *     quadratic PGF one root is always s=1; the other is p₀/p₂, so extinction =
 *     min(1, p₀/p₂). Certain (=1) iff μ ≤ 1 (subcritical/critical), which is
 *     exactly p₂ ≤ p₀.
 */

/** Mean offspring μ = p₁ + 2p₂ = (b + 2c)/D. */
export function offspringMean(b: number, c: number, D: number): Fraction {
  return F(b + 2 * c, D);
}

/** Expected population after n generations (Z₀=1): E[Zₙ] = μⁿ. */
export function expectedGenN(mu: Fraction, n: number): Fraction {
  return mu.pow(n) as Fraction;
}

/**
 * Extinction probability = min(1, p₀/p₂) for the quadratic offspring PGF.
 * (a,c) are the counts of 0- and 2-offspring outcomes.
 */
export function extinctionProb(a: number, c: number): Fraction {
  const ratio = F(a, c);
  return ratio.valueOf() >= 1 ? F(1) : ratio;
}

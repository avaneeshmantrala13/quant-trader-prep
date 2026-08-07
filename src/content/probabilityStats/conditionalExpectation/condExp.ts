import Fraction from "fraction.js";
import { F } from "../coreSolvers";

/**
 * Exact solvers for **Conditional Expectation & the Tower Rule** (UT M362M ch. 1
 * / M362K expectation; the E[X|Y], law-of-total-expectation, and law-of-total-
 * variance toolkit). All exact rationals via `fraction.js`, every value here is
 * a finite sum/product of rationals, so nothing is transcendental.
 *
 *   • E[X | Y=y] from a joint pmf table: Σ_i xᵢ·w(i,y) / Σ_i w(i,y).
 *   • Law of total expectation (mixture): E[X] = Σ_k P(Y=k)·E[X|Y=k].
 *   • Tower rule from a joint table: E[X] = E[E[X|Y]] = Σ_ij xᵢ·w(i,j) / T.
 *   • Random sum (Wald): E[S] = E[N]·E[X].
 *   • Law of total variance for a random sum (N ⟂ iid Xᵢ):
 *     Var(S) = E[N]·Var(X) + Var(N)·E[X]².
 *
 * NONE of these are copied source questions, the generators author fresh items;
 * this file is the independent verifier the tests re-derive against.
 */

/** Sum of every weight in an integer weight table. */
export function tableTotal(weights: number[][]): number {
  return weights.reduce((a, row) => a + row.reduce((b, w) => b + w, 0), 0);
}

/**
 * E[X | Y = yⱼ] from a joint pmf given as an integer weight table
 * (`weights[i][j] ∝ P(X=xᵢ, Y=yⱼ)`). Conditioning renormalises to the column:
 * E[X|Y=yⱼ] = Σ_i xᵢ·w(i,j) / Σ_i w(i,j). Exact rational.
 */
export function condMeanGivenY(
  weights: number[][],
  xVals: number[],
  col: number,
): Fraction {
  let num = F(0);
  let den = 0;
  for (let i = 0; i < weights.length; i++) {
    num = num.add(F(xVals[i] * weights[i][col]));
    den += weights[i][col];
  }
  return num.div(den);
}

/**
 * Law of total expectation for a discrete mixture: E[X] = Σ_k p(k)·m(k), where
 * `probs` (must sum to 1) is P(Y=k) and `means` is E[X|Y=k]. Exact rational.
 */
export function mixtureExpectation(
  probs: Fraction[],
  means: Fraction[],
): Fraction {
  let s = F(0);
  for (let k = 0; k < probs.length; k++) s = s.add(probs[k].mul(means[k]));
  return s;
}

/**
 * The overall mean recovered by the TOWER RULE from a joint weight table:
 * E[X] = E[E[X|Y]] = Σ_ij xᵢ·w(i,j) / T (identical to the X-marginal mean, which
 * is exactly the point of iterated expectation). Exact rational.
 */
export function towerMeanFromTable(
  weights: number[][],
  xVals: number[],
): Fraction {
  const T = tableTotal(weights);
  let num = F(0);
  for (let i = 0; i < weights.length; i++)
    for (let j = 0; j < weights[i].length; j++)
      num = num.add(F(xVals[i] * weights[i][j]));
  return num.div(T);
}

/** Random sum (Wald's identity): E[S] = E[N]·E[X]. Exact rational. */
export function randomSumMean(EN: Fraction, EX: Fraction): Fraction {
  return EN.mul(EX);
}

/**
 * Law of total variance for a random sum S = Σ_{i=1}^N Xᵢ with N independent of
 * the iid Xᵢ: Var(S) = E[N]·Var(X) + Var(N)·E[X]². Exact rational.
 */
export function randomSumVar(
  EN: Fraction,
  VN: Fraction,
  EX: Fraction,
  VX: Fraction,
): Fraction {
  return EN.mul(VX).add(VN.mul(EX.pow(2) as Fraction));
}

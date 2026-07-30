import Fraction from "fraction.js";
import { F } from "../coreSolvers";

/**
 * Exact solvers for **jointly continuous random variables** and transformations
 * (Bucket 2 "Extra Relevant Knowledge"; UT M362K chs. 6–7 — academic for
 * interviews). All exact rationals.
 *
 *   • Normalising a joint density f(x,y)=c·xy on [0,A]×[0,B]:
 *     ∫∫ c·xy = c·(A²/2)(B²/2) = 1 ⇒ c = 4/(A²B²).
 *   • Its marginal mean E[X] = 2A/3 (the density leans toward A).
 *   • Uniform on the unit square: P(X+Y ≤ s) = s²/2 for 0 ≤ s ≤ 1 (a triangle).
 *   • Transformation via the CDF method: X~U(0,1), Y=X² ⇒ P(Y ≤ c) = √c.
 */

/** c for f(x,y)=c·xy on [0,A]×[0,B]: c = 4/(A²B²). */
export function jointNormConst(A: number, B: number): Fraction {
  return F(4, A * A * B * B);
}

/** Marginal mean E[X] for f(x,y)=c·xy on [0,A]×[0,B] = 2A/3. */
export function jointMeanX(A: number): Fraction {
  return F(2 * A, 3);
}

/** P(X+Y ≤ s) for (X,Y) uniform on the unit square, 0 ≤ s ≤ 1 = s²/2 (triangle). */
export function sumBelowUnitSquare(sNum: number, sDen: number): Fraction {
  return F(sNum * sNum, 2 * sDen * sDen);
}

/** CDF-method transform: X~U(0,1), Y=X² ⇒ P(Y ≤ p²) = p. (Pass p = √c as num/den.) */
export function transformSqrtCDF(pNum: number, pDen: number): Fraction {
  return F(pNum, pDen);
}

import Fraction from "fraction.js";
import { F } from "../coreSolvers";

/**
 * Exact solvers for **jointly continuous random variables** and transformations
 * (the `probability::Joint Distributions` topic; UT M362K chs. 6–7, academic
 * for interviews). All exact rationals.
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

/* ========================================================================== */
/*  DISCRETE joint pmf tables (marginals, conditionals, independence, covariance) */
/* ========================================================================== */

/** Sum of every weight in an integer joint-pmf table. */
export function tableTotal(weights: number[][]): number {
  return weights.reduce((a, row) => a + row.reduce((b, w) => b + w, 0), 0);
}

/** Marginal P(X = xᵢ) = (row total)/(grand total) from a joint weight table. */
export function marginalX(weights: number[][], row: number): Fraction {
  const rowSum = weights[row].reduce((a, w) => a + w, 0);
  return F(rowSum, tableTotal(weights));
}

/** Marginal P(Y = yⱼ) = (column total)/(grand total). */
export function marginalY(weights: number[][], col: number): Fraction {
  let colSum = 0;
  for (const r of weights) colSum += r[col];
  return F(colSum, tableTotal(weights));
}

/** Conditional P(X = xᵢ | Y = yⱼ) = w(i,j) / Σ_i w(i,j) (renormalise to the column). */
export function condProbXgivenY(
  weights: number[][],
  row: number,
  col: number,
): Fraction {
  let colSum = 0;
  for (const r of weights) colSum += r[col];
  return F(weights[row][col], colSum);
}

/**
 * The joint probability P(X=x, Y=y) that WOULD hold if X and Y were independent:
 * the product of the marginals P(X=x)·P(Y=y). (Compared against the real joint
 * entry to test the independence definition.)
 */
export function independentJointProb(
  weights: number[][],
  row: number,
  col: number,
): Fraction {
  return marginalX(weights, row).mul(marginalY(weights, col));
}

/**
 * Covariance Cov(X,Y) = E[XY] − E[X]E[Y] from a joint weight table with value
 * vectors `xVals`, `yVals`. Exact rational (may be negative).
 */
export function covarianceFromTable(
  weights: number[][],
  xVals: number[],
  yVals: number[],
): Fraction {
  const T = tableTotal(weights);
  let EXY = F(0);
  let EX = F(0);
  let EY = F(0);
  for (let i = 0; i < weights.length; i++)
    for (let j = 0; j < weights[i].length; j++) {
      const p = F(weights[i][j], T);
      EXY = EXY.add(p.mul(xVals[i] * yVals[j]));
      EX = EX.add(p.mul(xVals[i]));
      EY = EY.add(p.mul(yVals[j]));
    }
  return EXY.sub(EX.mul(EY));
}

/**
 * Non-uniform continuous density f(x,y) = x + y on the unit square (already
 * normalised, since ∫∫(x+y) = 1). The rectangle probability
 * P(X ≤ a, Y ≤ b) = ∫₀^a∫₀^b (x+y) dy dx = (a·b·(a+b))/2. Exact rational for
 * rational a, b in [0,1].
 */
export function sumDensityRectProb(
  aNum: number,
  aDen: number,
  bNum: number,
  bDen: number,
): Fraction {
  const a = F(aNum, aDen);
  const b = F(bNum, bDen);
  return a.mul(b).mul(a.add(b)).div(2);
}

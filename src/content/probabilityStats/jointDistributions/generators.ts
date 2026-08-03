import type { Rng } from "@/lib/rng";
import type { Difficulty, NumericQuestion } from "@/types/content";
import { MISCONCEPTION } from "@/lib/tutor/misconception";
import { F, decText, fracText } from "../coreSolvers";
import { numDp, numericErrors } from "../coreScaffold";
import {
  condProbXgivenY,
  covarianceFromTable,
  independentJointProb,
  jointMeanX,
  jointNormConst,
  marginalX,
  marginalY,
  sumBelowUnitSquare,
  sumDensityRectProb,
  tableTotal,
  transformSqrtCDF,
} from "./joint";

/**
 * Numeric generators for **jointly continuous RVs + transformations** (Bucket 2).
 * Exact rationals from `./joint.ts`; NAMED-misconception distractors (uniform
 * constant vs product density; area of square vs triangle; forgetting the
 * transform or squaring instead of rooting).
 */

// (A,B) with A·B ≠ 4 so the uniform-constant distractor never equals the answer.
const AB_POOL: [number, number][] = [
  [2, 3],
  [3, 2],
  [3, 3],
  [2, 5],
  [3, 4],
];

/** Normalising constant c = 4/(A²B²) for f(x,y)=c·xy. */
export function buildJointNormInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const [A, B] = rng.pick(AB_POOL);
  const value = jointNormConst(A, B);
  const dp = numDp(value, 2, 4);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(1, A * B),
    `1/(AB) = ${fracText(F(1, A * B))} is the constant density of a UNIFORM on the rectangle. Here f = c·xy grows in both variables, so c = 4/(A²B²).`,
  );
  push(
    F(2, A * A * B * B),
    `2/(A²B²) = ${fracText(F(2, A * A * B * B))} keeps only one ½ from the double integral. Each of ∫x dx and ∫y dy contributes a ½, giving 4/(A²B²).`,
  );
  push(
    F(1, A * A * B * B),
    `1/(A²B²) = ${fracText(F(1, A * A * B * B))} drops the factor 4 from the two ½'s.`,
  );

  const prompt =
    `A joint density is f(x,y) = c·x·y on the rectangle [0,${A}]×[0,${B}] (and 0 elsewhere). ` +
    `What value of c makes it a valid density? (Round to ${dp} decimals.)`;
  const explanation =
    `Require ∫₀^${A}∫₀^${B} c·xy dy dx = c·(${A}²/2)(${B}²/2) = 1, so c = 4/(A²B²) = 4/(${A * A}·${B * B}) = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-joint-norm-${A}-${B}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Joint density normalisation c=4/(A²B²)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Joint · normalisation",
    },
  };
}

/** Marginal mean E[X] = 2A/3 for f(x,y)=c·xy on [0,A]×[0,B]. */
export function buildJointMeanInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const [A, B] = rng.pick(AB_POOL);
  const value = jointMeanX(A);
  const dp = numDp(value, 2, 4);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(A, 2),
    `A/2 = ${fracText(F(A, 2))} is the mean of a UNIFORM on [0,A]. Here the marginal f_X(x) ∝ x, so the mean is pulled up to 2A/3.`,
  );
  push(
    F(A),
    `A = ${A} is the maximum of X, not its mean.`,
  );
  push(
    F(A, 3),
    `A/3 = ${fracText(F(A, 3))} is E[X] for a density falling like (A−x); a RISING density xⁿ gives 2A/3.`,
  );

  const prompt =
    `A joint density f(x,y) = c·x·y on [0,${A}]×[0,${B}] (properly normalised). What is E[X]? (Round to ${dp} decimals.)`;
  const explanation =
    `The marginal is f_X(x) = ∫₀^${B} c·xy dy ∝ x on [0,${A}], so E[X] = 2A/3 = 2·${A}/3 = ${fracText(value)} ≈ ${decText(value, dp)}. ` +
    `(Independence factorises the density; the y-integral just contributes a constant.)`;

  return {
    answer,
    numeric: {
      id: `gen-joint-mean-${A}-${B}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Marginal mean of a product density = 2A/3",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Joint · marginal mean",
    },
  };
}

const S_POOL: [number, number][] = [
  [1, 2],
  [2, 3],
  [3, 4],
  [1, 3],
  [2, 5],
];

/** P(X+Y ≤ s) for uniform on the unit square = s²/2 (a triangle). */
export function buildJointSumInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const [sn, sd] = rng.pick(S_POOL);
  const value = sumBelowUnitSquare(sn, sd);
  const s = F(sn, sd);
  const dp = numDp(value, 2, 4);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    s,
    `${fracText(s)} = s is a 1-D length. In two dimensions the event {X+Y ≤ s} is a TRIANGLE of area s²/2.`,
  );
  push(
    F(sn * sn, sd * sd),
    `s² = ${fracText(F(sn * sn, sd * sd))} is the area of a SQUARE of side s. The region below the line X+Y=s is the lower triangle, area s²/2.`,
  );
  push(
    F(1).sub(value),
    `${fracText(F(1).sub(value))} = 1 − s²/2 is the complement P(X+Y > s).`,
  );

  const prompt =
    `Two independent readings X and Y are each Uniform(0, 1). ` +
    `What is the probability that their combined total X + Y comes out at most ${fracText(s)}? (Round to ${dp} decimals.)`;
  const explanation =
    `On the unit square, {X+Y ≤ s} is a right triangle with legs s, so its area (= probability) is s²/2 = (${fracText(s)})²/2 = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-joint-sum-${sn}_${sd}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "P(X+Y≤s) on the unit square = s²/2",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Joint · sum region",
    },
  };
}

// p = √c so the answer is exact; p ≠ 1/2 so the 1−p distractor never collides.
const P_POOL: [number, number][] = [
  [2, 5],
  [3, 10],
  [3, 5],
  [1, 5],
  [4, 5],
  [3, 4],
  [1, 4],
];

/** Transformation (CDF method): X~U(0,1), Y=X² ⇒ P(Y ≤ c) = √c. */
export function buildTransformInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const [pn, pd] = rng.pick(P_POOL);
  const p = transformSqrtCDF(pn, pd); // answer = √c
  const c = F(pn * pn, pd * pd); // c = p²
  const cSq = F(pn * pn * pn * pn, pd * pd * pd * pd); // c²
  const dp = numDp(p, 2, 4);
  const answer = Number(decText(p, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    c,
    `${fracText(c)} = c forgets the transform: that would be P(X ≤ c). We need P(X² ≤ c) = P(X ≤ √c) = √c.`,
  );
  push(
    cSq,
    `${fracText(cSq)} = c² SQUARES instead of rooting. Since Y=X², solving X²≤c takes a square ROOT.`,
  );
  push(
    F(1).sub(p),
    `${fracText(F(1).sub(p))} = 1 − √c is the complement P(Y > c).`,
  );

  const prompt =
    `X is Uniform(0,1) and Y = X². What is P(Y ≤ ${decText(c, numDp(c, 2, 4))})? (Round to ${dp} decimals.)`;
  const explanation =
    `CDF method: P(Y ≤ c) = P(X² ≤ c) = P(X ≤ √c) = √c (since X∈[0,1]). Here √c = ${fracText(p)} ≈ ${decText(p, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-joint-transform-${pn}_${pd}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Transformation via CDF method: P(X²≤c)=√c",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Joint · transformation of RV",
    },
  };
}

export const genJointNorm = (rng: Rng): NumericQuestion =>
  buildJointNormInstance(rng, "hard").numeric;
export const genJointMean = (rng: Rng): NumericQuestion =>
  buildJointMeanInstance(rng, "hard").numeric;
export const genJointSum = (rng: Rng): NumericQuestion =>
  buildJointSumInstance(rng, "medium").numeric;
export const genTransform = (rng: Rng): NumericQuestion =>
  buildTransformInstance(rng, "hard").numeric;

/* ========================================================================== */
/*  DISCRETE joint pmf tables (marginals, conditionals, independence, covariance) */
/* ========================================================================== */

/** Curated NON-independent 2×2 joint tables (rows X, cols Y) with value vectors. */
const DISCRETE_TABLES: { w: number[][]; xVals: number[]; yVals: number[] }[] = [
  { w: [[2, 1], [1, 3]], xVals: [1, 2], yVals: [1, 2] },
  { w: [[3, 1], [2, 4]], xVals: [0, 2], yVals: [1, 3] },
  { w: [[1, 3], [4, 2]], xVals: [1, 3], yVals: [0, 2] },
  { w: [[4, 2], [1, 3]], xVals: [2, 4], yVals: [1, 2] },
  { w: [[2, 4], [3, 1]], xVals: [0, 1], yVals: [2, 4] },
];

/** Render a 2×2 joint table as equally-likely counts out of N. */
function renderDiscrete(
  w: number[][],
  xVals: number[],
  yVals: number[],
): { text: string; total: number } {
  const total = tableTotal(w);
  const cells: string[] = [];
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < 2; j++)
      cells.push(`(X=${xVals[i]}, Y=${yVals[j]}) → ${w[i][j]}`);
  return { text: cells.join("; "), total };
}

/** Marginal P(X = xᵢ) from a joint table. */
export function buildJointMarginalInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const { w, xVals, yVals } = rng.pick(DISCRETE_TABLES);
  const row = rng.int(0, 1);
  const value = marginalX(w, row);
  const dp = numDp(value, 2, 4);
  const answer = Number(decText(value, dp));
  const { text, total } = renderDiscrete(w, xVals, yVals);
  const rowSum = w[row].reduce((a, c) => a + c, 0);

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(w[row][0], total),
    `${fracText(F(w[row][0], total))} is only the single cell P(X=${xVals[row]}, Y=${yVals[0]}). The marginal SUMS across all Y: (${rowSum})/${total}.`,
  );
  push(
    marginalY(w, row),
    `${fracText(marginalY(w, row))} is P(Y=${yVals[row]}) — the wrong variable's marginal. Sum along the X=${xVals[row]} ROW, not the column.`,
  );
  push(
    condProbXgivenY(w, row, 0),
    `${fracText(condProbXgivenY(w, row, 0))} is the CONDITIONAL P(X=${xVals[row]}|Y=${yVals[0]}); the marginal doesn't condition on Y.`,
  );

  const prompt =
    `A pair (X, Y) is drawn. Out of N = ${total} equally-likely outcomes, the counts are: ${text}. ` +
    `What is the marginal probability P(X = ${xVals[row]})? (Round to ${dp} decimals.)`;
  const explanation =
    `Sum the joint pmf across all Y: P(X=${xVals[row]}) = Σ_y P(X=${xVals[row]}, Y=y) = ${rowSum}/${total} = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-joint-marg-${w.flat().join("")}-${row}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Marginal = sum the joint pmf over the other variable",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Joint · marginal pmf",
    },
  };
}

/** Conditional P(X = xᵢ | Y = yⱼ) from a joint table. */
export function buildJointConditionalInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const { w, xVals, yVals } = rng.pick(DISCRETE_TABLES);
  const row = rng.int(0, 1);
  const col = rng.int(0, 1);
  const value = condProbXgivenY(w, row, col);
  const dp = numDp(value, 2, 4);
  const answer = Number(decText(value, dp));
  const { text, total } = renderDiscrete(w, xVals, yVals);
  const colSum = w[0][col] + w[1][col];

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(w[row][col], total),
    `${fracText(F(w[row][col], total))} is the JOINT P(X=${xVals[row]}, Y=${yVals[col]}) = ${w[row][col]}/${total}. Conditioning renormalises by P(Y=${yVals[col]}), dividing by the column total ${colSum}.`,
  );
  push(
    marginalX(w, row),
    `${fracText(marginalX(w, row))} is the unconditional marginal P(X=${xVals[row]}); the condition Y=${yVals[col]} changes the denominator.`,
  );
  push(
    condProbXgivenY(w, 1 - row, col),
    `${fracText(condProbXgivenY(w, 1 - row, col))} is P(X=${xVals[1 - row]}|Y=${yVals[col]}) — the other X value in the same column.`,
  );

  const prompt =
    `A pair (X, Y) is drawn. Out of N = ${total} equally-likely outcomes, the counts are: ${text}. ` +
    `What is the conditional probability P(X = ${xVals[row]} | Y = ${yVals[col]})? (Round to ${dp} decimals.)`;
  const explanation =
    `Restrict to Y=${yVals[col]} (column total ${colSum}) and renormalise: P(X=${xVals[row]}|Y=${yVals[col]}) = ${w[row][col]}/${colSum} = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-joint-cond-${w.flat().join("")}-${row}-${col}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Conditional pmf renormalises to the conditioning column",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Joint · conditional pmf",
    },
  };
}

/** If X, Y were independent, P(X=x, Y=y) = P(X=x)·P(Y=y). */
export function buildJointIndependenceInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const { w, xVals, yVals } = rng.pick(DISCRETE_TABLES);
  const row = rng.int(0, 1);
  const col = rng.int(0, 1);
  const value = independentJointProb(w, row, col);
  const dp = numDp(value, 2, 4);
  const answer = Number(decText(value, dp));
  const { text, total } = renderDiscrete(w, xVals, yVals);

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(w[row][col], total),
    `${fracText(F(w[row][col], total))} is the ACTUAL joint P(X=${xVals[row]}, Y=${yVals[col]}); the question asks what it WOULD be under independence — the product of the marginals.`,
  );
  push(
    marginalX(w, row),
    `${fracText(marginalX(w, row))} is only P(X=${xVals[row]}); independence MULTIPLIES it by P(Y=${yVals[col]}).`,
  );
  push(
    marginalX(w, row).add(marginalY(w, col)),
    `${fracText(marginalX(w, row).add(marginalY(w, col)))} ADDS the marginals; independence multiplies them.`,
    MISCONCEPTION.andMeansAdd,
  );

  const prompt =
    `A pair (X, Y) is drawn. Out of N = ${total} equally-likely outcomes, the counts are: ${text}. ` +
    `If X and Y were INDEPENDENT, what would P(X = ${xVals[row]}, Y = ${yVals[col]}) equal? (Round to ${dp} decimals.)`;
  const explanation =
    `Under independence the joint factorises: P(X=${xVals[row]}, Y=${yVals[col]}) = P(X=${xVals[row]})·P(Y=${yVals[col]}) = ${fracText(marginalX(w, row))}·${fracText(marginalY(w, col))} = ${fracText(value)} ≈ ${decText(value, dp)}. ` +
    `(The real joint differs, so these X, Y are NOT independent.)`;

  return {
    answer,
    numeric: {
      id: `gen-joint-indep-${w.flat().join("")}-${row}-${col}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Independence ⇒ joint = product of marginals",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Joint · independence",
    },
  };
}

/** Covariance Cov(X,Y) = E[XY] − E[X]E[Y] from a joint table. */
export function buildJointCovarianceInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const { w, xVals, yVals } = rng.pick(DISCRETE_TABLES);
  const value = covarianceFromTable(w, xVals, yVals);
  const dp = numDp(value, 2, 4);
  const answer = Number(decText(value, dp));
  const { text, total } = renderDiscrete(w, xVals, yVals);

  // E[XY], E[X], E[Y] for the distractors.
  let EXY = F(0);
  let EX = F(0);
  let EY = F(0);
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < 2; j++) {
      const p = F(w[i][j], total);
      EXY = EXY.add(p.mul(xVals[i] * yVals[j]));
      EX = EX.add(p.mul(xVals[i]));
      EY = EY.add(p.mul(yVals[j]));
    }

  const { errors, push } = numericErrors(answer, dp);
  push(
    EXY,
    `${decText(EXY, dp)} is E[XY] alone. Covariance SUBTRACTS the product of the means: Cov = E[XY] − E[X]E[Y].`,
  );
  push(
    EX.mul(EY),
    `${decText(EX.mul(EY), dp)} is E[X]E[Y]; that is what you subtract FROM E[XY], not the answer.`,
  );
  push(
    EXY.add(EX.mul(EY)),
    `${decText(EXY.add(EX.mul(EY)), dp)} ADDS E[X]E[Y] instead of subtracting it.`,
  );

  const prompt =
    `A pair (X, Y) is drawn. Out of N = ${total} equally-likely outcomes, the counts are: ${text}. ` +
    `What is Cov(X, Y)? (Round to ${dp} decimals.)`;
  const explanation =
    `Cov(X,Y) = E[XY] − E[X]E[Y] = ${fracText(EXY)} − (${fracText(EX)})(${fracText(EY)}) = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-joint-cov-${w.flat().join("")}-${xVals.join("")}-${yVals.join("")}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Covariance Cov(X,Y)=E[XY]−E[X]E[Y]",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Joint · covariance from pmf",
    },
  };
}

// (a,b) each in (0,1) with a+b ≠ 2 (guaranteed since <2) so the uniform-area
// distractor a·b never collides with the answer a·b·(a+b)/2.
const RECT_POOL: [number, number][] = [
  [1, 2],
  [1, 3],
  [2, 3],
  [1, 4],
  [3, 4],
  [2, 5],
];

/** P(X ≤ a, Y ≤ b) for the non-uniform density f(x,y)=x+y on the unit square. */
export function buildSumDensityRectInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const [an, ad] = rng.pick(RECT_POOL);
  let [bn, bd] = rng.pick(RECT_POOL);
  // Keep a and b distinct fractions for variety (not required for correctness).
  let guard = 0;
  while (an * bd === bn * ad && guard++ < 8) [bn, bd] = rng.pick(RECT_POOL);
  const a = F(an, ad);
  const b = F(bn, bd);
  const value = sumDensityRectProb(an, ad, bn, bd);
  const dp = numDp(value, 2, 4);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    a.mul(b),
    `${fracText(a.mul(b))} = a·b is the probability for a UNIFORM density. Here f=x+y grows across the square, so integrate: P = a·b·(a+b)/2.`,
  );
  push(
    a.mul(b).mul(a.add(b)),
    `${fracText(a.mul(b).mul(a.add(b)))} = a·b·(a+b) forgets the ½ from integrating x+y.`,
  );
  push(
    a.add(b).div(2),
    `${fracText(a.add(b).div(2))} = (a+b)/2 treats a two-dimensional integral as a one-dimensional average.`,
  );

  const prompt =
    `Jointly continuous (X, Y) have density f(x,y) = x + y on the unit square [0,1]×[0,1] (and 0 elsewhere). ` +
    `What is P(X ≤ ${fracText(a)}, Y ≤ ${fracText(b)})? (Round to ${dp} decimals.)`;
  const explanation =
    `P(X≤a, Y≤b) = ∫₀^a∫₀^b (x+y) dy dx = a·b·(a+b)/2 = ${fracText(a)}·${fracText(b)}·(${fracText(a.add(b))})/2 = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-joint-rect-${an}_${ad}-${bn}_${bd}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Region probability for f=x+y: P(X≤a,Y≤b)=ab(a+b)/2",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Joint · non-uniform region",
    },
  };
}

export const genJointMarginal = (rng: Rng): NumericQuestion =>
  buildJointMarginalInstance(rng, "medium").numeric;
export const genJointConditional = (rng: Rng): NumericQuestion =>
  buildJointConditionalInstance(rng, "medium").numeric;
export const genJointIndependence = (rng: Rng): NumericQuestion =>
  buildJointIndependenceInstance(rng, "medium").numeric;
export const genJointCovariance = (rng: Rng): NumericQuestion =>
  buildJointCovarianceInstance(rng, "hard").numeric;
export const genSumDensityRect = (rng: Rng): NumericQuestion =>
  buildSumDensityRectInstance(rng, "hard").numeric;

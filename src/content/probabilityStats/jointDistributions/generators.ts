import type { Rng } from "@/lib/rng";
import type { Difficulty, NumericQuestion } from "@/types/content";
import { F, decText, fracText } from "../coreSolvers";
import { numDp, numericErrors } from "../coreScaffold";
import {
  jointMeanX,
  jointNormConst,
  sumBelowUnitSquare,
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

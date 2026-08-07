import type { Rng } from "@/lib/rng";
import type { Difficulty, Question } from "@/types/content";
import { F, fracText } from "../coreSolvers";
import { type Choice, assembleChoices } from "../coreScaffold";

/**
 * Quiz generators for **Moment Generating Functions** (Bucket 2, "Extra Relevant
 * Knowledge"; UT M362K 5.6/7, academic for interviews). Conceptual/derivation
 * content, so MC with NAMED misconception distractors (E[X]=M'(0) not M(0); the
 * variance needs M''(0)−M'(0)²; MGF of a sum is the PRODUCT of MGFs).
 */

/** E[X] = M'(0) for an exponential with MGF M(t)=λ/(λ−t): mean = 1/λ. */
export function buildMgfMeanInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  const lambda = rng.pick([2, 3, 4, 5]);
  const mean = F(1, lambda);
  const variance = F(1, lambda * lambda);

  const correct: Choice = {
    text: fracText(mean),
    rationale: `Correct. E[X] = M'(0). Differentiating M(t)=λ/(λ−t) gives M'(t)=λ/(λ−t)², so M'(0)=1/λ = ${fracText(mean)}.`,
  };
  const distractors: Choice[] = [
    {
      text: "1",
      rationale: `M(0)=1 for EVERY MGF, you evaluated the MGF instead of its derivative. E[X]=M'(0), not M(0).`,
    },
    {
      text: fracText(variance),
      rationale: `${fracText(variance)} = 1/λ² is the VARIANCE (M''(0)−M'(0)²), not the mean.`,
    },
    {
      text: String(lambda),
      rationale: `λ = ${lambda} is the RATE. The exponential's mean is 1/λ, its reciprocal.`,
    },
  ];

  const prompt =
    `A random variable X has moment generating function M(t) = ${lambda}/(${lambda} − t) (for t < ${lambda}). What is E[X]?`;
  const explanation =
    `The MGF method: E[X] = M'(0). Here M(t)=λ/(λ−t) is the Exp(λ) MGF; M'(t)=λ/(λ−t)² so M'(0)=1/λ = ${fracText(mean)}.`;

  return {
    answer: fracText(mean),
    question: {
      id: `gen-mgf-mean-${lambda}`,
      prompt,
      explanation,
      difficulty,
      concept: "MGF method: E[X]=M'(0)",
      source: "MGF · mean from M'(0)",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

/** Var(X)=M''(0)−M'(0)² for Exp(λ): 2/λ² − 1/λ² = 1/λ². */
export function buildMgfVarInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  const lambda = rng.pick([3, 5]);
  const variance = F(1, lambda * lambda);
  const secondMoment = F(2, lambda * lambda); // M''(0)=E[X²]
  const mean = F(1, lambda);

  const correct: Choice = {
    text: fracText(variance),
    rationale: `Correct. Var = M''(0) − M'(0)². For Exp(λ), M''(0)=2/λ² and M'(0)=1/λ, so Var = 2/λ² − 1/λ² = 1/λ² = ${fracText(variance)}.`,
  };
  const distractors: Choice[] = [
    {
      text: fracText(secondMoment),
      rationale: `${fracText(secondMoment)} = M''(0) = E[X²] is the SECOND MOMENT. You must subtract (E[X])² = 1/λ² to get the variance.`,
    },
    {
      text: fracText(mean),
      rationale: `${fracText(mean)} = 1/λ is the MEAN (M'(0)), not the variance.`,
    },
    {
      text: fracText(F(1, 2 * lambda * lambda)),
      rationale: `${fracText(F(1, 2 * lambda * lambda))} halves the second moment; the correct combination is M''(0) − M'(0)².`,
    },
  ];

  const prompt =
    `X has MGF M(t) = ${lambda}/(${lambda} − t). Using the MGF, what is Var(X)?`;
  const explanation =
    `Var(X) = M''(0) − (M'(0))². For Exp(λ): M'(0)=1/λ, M''(0)=2/λ², so Var = 2/λ² − 1/λ² = 1/λ² = ${fracText(variance)}.`;

  return {
    answer: fracText(variance),
    question: {
      id: `gen-mgf-var-${lambda}`,
      prompt,
      explanation,
      difficulty,
      concept: "MGF method: Var=M''(0)−M'(0)²",
      source: "MGF · variance from second moment",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

const MGF_TABLE = [
  { name: "Poisson", mgf: "e^{λ(e^t − 1)}" },
  { name: "Normal", mgf: "e^{μt + σ²t²/2}" },
  { name: "Exponential", mgf: "λ/(λ − t)" },
  { name: "Bernoulli", mgf: "1 − p + p·e^t" },
];

/** Identify the distribution from its MGF form. */
export function buildMgfIdentifyInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  const idx = rng.int(0, MGF_TABLE.length - 1);
  const target = MGF_TABLE[idx];

  const correct: Choice = {
    text: target.name,
    rationale: `Correct, ${target.mgf} is the ${target.name} MGF.`,
  };
  const distractors: Choice[] = MGF_TABLE.filter((_, i) => i !== idx).map((d) => ({
    text: d.name,
    rationale: `The ${d.name} MGF is ${d.mgf}, a different form.`,
  }));

  const prompt = `Which distribution has moment generating function M(t) = ${target.mgf}?`;
  const explanation =
    `Matching standard MGFs: ${target.mgf} is the ${target.name} distribution's MGF. ` +
    `The uniqueness theorem says the MGF (where it exists) determines the distribution.`;

  return {
    answer: target.name,
    question: {
      id: `gen-mgf-id-${idx}`,
      prompt,
      explanation,
      difficulty,
      concept: "MGF uniquely identifies a distribution",
      source: "MGF · identify distribution",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

/** MGF of a sum of independent RVs is the PRODUCT of their MGFs. */
export function buildMgfSumInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  const correct: Choice = {
    text: "M(t)²",
    rationale: `Correct, for independent X, Y the MGF of X+Y is M_X(t)·M_Y(t); iid ⇒ M(t)·M(t) = M(t)².`,
  };
  const distractors: Choice[] = [
    {
      text: "2·M(t)",
      rationale: `2M(t) would be the MGF of 2·(a single X) scaled additively, wrong. MGFs of INDEPENDENT sums MULTIPLY: M(t)².`,
    },
    {
      text: "M(2t)",
      rationale: `M(2t) is the MGF of 2X (scaling the variable), not of X+Y (an independent sum), which gives M(t)².`,
    },
    {
      text: "M(t)",
      rationale: `M(t) is the MGF of a single X. Adding an independent copy multiplies the MGFs: M(t)².`,
    },
  ];

  const prompt =
    `X and Y are independent and identically distributed, each with moment generating function M(t). What is the MGF of X + Y?`;
  const explanation =
    `For independent variables the MGF of a sum is the PRODUCT of the MGFs: M_{X+Y}(t) = M_X(t)·M_Y(t) = M(t)². ` +
    `This 'product of MGFs' is exactly why the MGF method makes convolutions easy.`;

  return {
    answer: "M(t)²",
    question: {
      id: `gen-mgf-sum`,
      prompt,
      explanation,
      difficulty,
      concept: "MGF of an independent sum = product of MGFs",
      source: "MGF · sum method",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

export const genMgfMean = (rng: Rng): Question =>
  buildMgfMeanInstance(rng, "medium").question;
export const genMgfVar = (rng: Rng): Question =>
  buildMgfVarInstance(rng, "hard").question;
export const genMgfIdentify = (rng: Rng): Question =>
  buildMgfIdentifyInstance(rng, "medium").question;
export const genMgfSum = (rng: Rng): Question =>
  buildMgfSumInstance(rng, "medium").question;

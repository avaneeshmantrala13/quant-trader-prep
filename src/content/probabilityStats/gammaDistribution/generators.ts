import type { Rng } from "@/lib/rng";
import type { Difficulty, NumericQuestion } from "@/types/content";
import { F, decText, fracText } from "../coreSolvers";
import { numDp, numericErrors } from "../coreScaffold";
import { gammaMean, gammaSumExpMean, gammaVar } from "./gamma";

/**
 * Numeric generators for the **Gamma distribution** (Bucket 2). Exact rationals
 * from `./gamma.ts`; distractors are NAMED misconceptions (single-exponential
 * confusion, mean-vs-variance, multiplying vs dividing by λ).
 */

const GAMMA_THEME = [
  { thing: "the total time for k independent tasks (min)", rate: "λ" },
  { thing: "the wait for the k-th arrival (s)", rate: "λ" },
  { thing: "the combined lifetime of k components (yr)", rate: "λ" },
];

/** Mean of Gamma(k, λ) = k/λ. */
export function buildGammaMeanInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(GAMMA_THEME);
  const k = rng.pick([2, 3, 4]);
  const lambda = rng.pick([2, 3, 4, 5]);
  const value = gammaMean(k, lambda);
  const dp = numDp(value, 2, 4);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(1, lambda),
    `1/λ = ${fracText(F(1, lambda))} is the mean of a SINGLE Exp(λ). A Gamma(k,λ) sums k of them, so its mean is k/λ.`,
  );
  push(
    F(k * lambda),
    `kλ = ${k * lambda} multiplies by λ; the mean DIVIDES by the rate: k/λ.`,
  );
  push(
    gammaVar(k, lambda),
    `${fracText(gammaVar(k, lambda))} = k/λ² is the VARIANCE, not the mean.`,
  );

  const prompt =
    `A Gamma(shape k=${k}, rate λ=${lambda}) models ${th.thing}. What is its MEAN? (Round to ${dp} decimals.)`;
  const explanation =
    `Gamma(k,λ) is a sum of k iid Exp(λ), so its mean is k·(1/λ) = k/λ = ${k}/${lambda} = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-gamma-mean-${k}-${lambda}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Gamma mean k/λ",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Gamma · mean",
    },
  };
}

/** Variance of Gamma(k, λ) = k/λ². */
export function buildGammaVarInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(GAMMA_THEME);
  const k = rng.pick([2, 3, 4]);
  const lambda = rng.pick([2, 3, 4, 5]);
  const value = gammaVar(k, lambda);
  const dp = numDp(value, 2, 4);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    gammaMean(k, lambda),
    `${fracText(gammaMean(k, lambda))} = k/λ is the MEAN. The variance carries λ²: k/λ².`,
  );
  push(
    F(1, lambda * lambda),
    `1/λ² = ${fracText(F(1, lambda * lambda))} is a single Exp(λ)'s variance; summing k of them gives k/λ².`,
  );
  push(
    F(k * k, lambda * lambda),
    `k²/λ² = ${fracText(F(k * k, lambda * lambda))} squares k. Variances of independent sums ADD, so it is k/λ², linear in k.`,
  );

  const prompt =
    `A Gamma(shape k=${k}, rate λ=${lambda}) models ${th.thing}. What is its VARIANCE? (Round to ${dp} decimals.)`;
  const explanation =
    `Gamma(k,λ) = sum of k iid Exp(λ); variances add, so Var = k·(1/λ²) = k/λ² = ${k}/${lambda * lambda} = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-gamma-var-${k}-${lambda}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Gamma variance k/λ²",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Gamma · variance",
    },
  };
}

/** E[time to k-th Poisson arrival] = k/λ (Gamma as sum of exponentials). */
export function buildGammaSumExpInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const k = rng.pick([2, 3, 4, 5]);
  const lambda = rng.pick([2, 3, 4]);
  const value = gammaSumExpMean(k, lambda);
  const dp = numDp(value, 2, 4);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(1, lambda),
    `1/λ = ${fracText(F(1, lambda))} is the wait for ONE arrival. The k-th arrival waits k times as long on average: k/λ.`,
  );
  push(
    F(1, k * lambda),
    `1/(kλ) = ${fracText(F(1, k * lambda))} is the expected time to the FIRST of k competing streams (a minimum), not the k-th arrival of one stream.`,
  );
  push(
    gammaVar(k, lambda),
    `${fracText(gammaVar(k, lambda))} = k/λ² is a variance, not an expected time.`,
  );

  const prompt =
    `Events arrive as a rate-λ = ${lambda} Poisson process. What is the expected time until the ${k}-th arrival? (Round to ${dp} decimals.)`;
  const explanation =
    `Inter-arrival times are iid Exp(λ), so the time to the ${k}-th arrival is Gamma(${k}, λ) with mean k/λ = ${k}/${lambda} = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-gamma-sumexp-${k}-${lambda}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Gamma = sum of exponentials (time to k-th arrival)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Gamma · time to k-th arrival",
    },
  };
}

export const genGammaMean = (rng: Rng): NumericQuestion =>
  buildGammaMeanInstance(rng, "medium").numeric;
export const genGammaVar = (rng: Rng): NumericQuestion =>
  buildGammaVarInstance(rng, "hard").numeric;
export const genGammaSumExp = (rng: Rng): NumericQuestion =>
  buildGammaSumExpInstance(rng, "medium").numeric;

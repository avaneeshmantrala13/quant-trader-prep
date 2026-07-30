import type { Rng } from "@/lib/rng";
import type { Difficulty, NumericQuestion } from "@/types/content";
import { F, decText, fracText } from "../coreSolvers";
import { numDp, numericErrors } from "../coreScaffold";
import { expectedGenN, extinctionProb, offspringMean } from "./branching";

/**
 * Numeric generators for **branching processes** (Bucket 2). Exact rationals
 * from `./branching.ts`; distractors are NAMED misconceptions (linear-vs-power
 * growth; extinction = childless prob or the inverted ratio).
 */

// (a,b,c,D): offspring 0/1/2 counts out of D, all SUPERCRITICAL (c>a ⇒ μ>1).
const OFFSPRING_POOL: [number, number, number, number][] = [
  [1, 1, 2, 4],
  [1, 2, 2, 5],
  [1, 0, 2, 3],
  [2, 1, 3, 6],
  [1, 1, 3, 5],
  [3, 2, 5, 10],
];

const THEME = [
  { who: "each organism", pop: "population" },
  { who: "each infected node", pop: "outbreak" },
  { who: "each particle", pop: "cascade" },
];

/** E[Zₙ] = μⁿ. Traps: linear n·μ, single generation μ, and forgetting the ×2 on two-offspring. */
export function buildBranchingMeanInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(THEME);
  const [a, b, c, D] = rng.pick(OFFSPRING_POOL);
  const n = rng.pick([2, 3]);
  const mu = offspringMean(b, c, D);
  const value = expectedGenN(mu, n);
  const dp = numDp(value, 2, 4);
  const answer = Number(decText(value, dp));

  const wrongMu = F(b + c, D); // forgot the factor 2 on the two-offspring outcome
  const { errors, push } = numericErrors(answer, dp);
  push(
    mu.mul(n),
    `n·μ = ${fracText(mu.mul(n))} scales linearly; the population grows GEOMETRICALLY, so E[Zₙ] = μⁿ.`,
  );
  push(
    mu,
    `μ = ${fracText(mu)} is E[Z₁] (one generation). After ${n} generations it compounds to μ^${n}.`,
  );
  push(
    expectedGenN(wrongMu, n),
    `Using μ = (p₁+p₂) = ${fracText(wrongMu)} forgets that a "2 offspring" outcome contributes 2 to the mean. μ = p₁ + 2p₂.`,
  );

  const prompt =
    `In a branching ${th.pop}, ${th.who} independently leaves 0, 1, or 2 offspring with probabilities ${fracText(F(a, D))}, ${fracText(F(b, D))}, ${fracText(F(c, D))}. ` +
    `Starting from 1 individual, what is the expected size after ${n} generations? (Round to ${dp} decimals.)`;
  const explanation =
    `Mean offspring μ = p₁ + 2p₂ = ${fracText(mu)}. Expected size compounds: E[Zₙ] = μⁿ = (${fracText(mu)})^${n} = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-branching-mean-${a}${b}${c}${D}-${n}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Branching: E[Zₙ]=μⁿ",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Branching · expected size",
    },
  };
}

/** Extinction probability = p₀/p₂ (supercritical). Traps: childless prob p₀, 1/μ, inverted ratio. */
export function buildExtinctionInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(THEME);
  const [a, b, c, D] = rng.pick(OFFSPRING_POOL);
  const mu = offspringMean(b, c, D);
  const value = extinctionProb(a, c); // = a/c (supercritical)
  const dp = numDp(value, 2, 4);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(a, D),
    `p₀ = ${fracText(F(a, D))} is the chance ONE individual has no children — not the eventual extinction probability, which is the smallest root of s=G(s): p₀/p₂.`,
  );
  push(
    F(1).div(mu),
    `1/μ = ${fracText(F(1).div(mu))} is a common guess but wrong; the extinction probability solves s = G(s), giving p₀/p₂.`,
  );
  push(
    F(c, a),
    `p₂/p₀ = ${fracText(F(c, a))} inverts the ratio (and exceeds 1). Extinction = p₀/p₂.`,
  );

  const prompt =
    `In a branching ${th.pop}, ${th.who} independently leaves 0, 1, or 2 offspring with probabilities ${fracText(F(a, D))}, ${fracText(F(b, D))}, ${fracText(F(c, D))} (mean μ = ${fracText(mu)} > 1). ` +
    `Starting from 1 individual, what is the probability the ${th.pop} eventually goes extinct? (Round to ${dp} decimals.)`;
  const explanation =
    `Extinction q solves q = G(q) = p₀ + p₁q + p₂q². One root is q=1; the smallest root in [0,1] is p₀/p₂ = ${fracText(F(a, D))}/${fracText(F(c, D))} = ${fracText(value)} ≈ ${decText(value, dp)}. ` +
    `Since μ > 1 (supercritical) extinction is < 1.`;

  return {
    answer,
    numeric: {
      id: `gen-branching-ext-${a}${b}${c}${D}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Branching extinction = smallest root of s=G(s) = p₀/p₂",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Branching · extinction probability",
    },
  };
}

export const genBranchingMean = (rng: Rng): NumericQuestion =>
  buildBranchingMeanInstance(rng, "hard").numeric;
export const genExtinction = (rng: Rng): NumericQuestion =>
  buildExtinctionInstance(rng, "hard").numeric;

import type { Rng } from "@/lib/rng";
import type { Difficulty, Question } from "@/types/content";
import { F, fracText } from "../coreSolvers";
import { type Choice, assembleChoices } from "../coreScaffold";

/**
 * Quiz generators for the **formal limit theorems**. Chebyshev's inequality, the
 * Law of Large Numbers, and the Central Limit Theorem statements/conditions
 * (Bucket 2 "Extra Relevant Knowledge"; UT M362K ch. 8). Conceptual/theorem
 * content ⇒ multiple-choice with NAMED misconception distractors (Chebyshev's a²
 * vs a; LLN-vs-CLT confusion; the "data must be normal / n<30" CLT myths).
 */

// (varV = σ², a threshold). We require a > σ² (not just a² > σ²) so that the
// "forgot to square" distractor σ²/a is itself a VALID probability (≤ 1) and
// stays genuinely tricky. That leaves the a²/σ² inversion as the SINGLE, and
// deliberately-taught, out-of-range (> 1) trap, never letting the correct
// answer be the only in-range option.
const CHEB_POOL: [number, number][] = [
  [1, 2],
  [1, 3],
  [2, 3],
  [2, 4],
  [3, 4],
  [3, 5],
  [4, 5],
];

/** Chebyshev upper bound P(|X−μ| ≥ a) ≤ σ²/a². */
export function buildChebyshevInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  const [v, a] = rng.pick(CHEB_POOL);
  const value = F(v, a * a);

  const correct: Choice = {
    text: fracText(value),
    rationale: `Correct. Chebyshev: P(|X−μ| ≥ a) ≤ σ²/a² = ${v}/${a * a} = ${fracText(value)}.`,
  };
  const distractors: Choice[] = [
    {
      text: fracText(F(v, a)),
      rationale: `σ²/a = ${fracText(F(v, a))} forgot to SQUARE the threshold. Chebyshev divides the variance by a², not a.`,
    },
    {
      text: fracText(F(a * a, v)),
      rationale: `a²/σ² = ${fracText(F(a * a, v))} inverts the ratio (and exceeds 1). The bound is σ²/a².`,
    },
    {
      text: "1",
      rationale: `1 is the trivial "no information" bound. Because a² > σ², Chebyshev gives a nontrivial bound σ²/a² < 1.`,
    },
  ];

  const prompt =
    `A random variable X has mean μ and variance σ² = ${v}. Using Chebyshev's inequality, what is the best upper bound on P(|X − μ| ≥ ${a})?`;
  const explanation =
    `Chebyshev's inequality: P(|X − μ| ≥ a) ≤ σ²/a² = ${v}/${a}² = ${fracText(value)}. It needs only the variance, so it is loose but distribution-free.`;

  return {
    answer: fracText(value),
    question: {
      id: `gen-chebyshev-${v}-${a}`,
      prompt,
      explanation,
      difficulty,
      concept: "Chebyshev's inequality σ²/a²",
      source: "Limit theorems · Chebyshev",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

/** CLT statement: the standardised sample mean converges in distribution to N(0,1). */
export function buildCltStatementInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  const correct: Choice = {
    text: "The standardised sum/mean converges in distribution to N(0,1)",
    rationale: `Correct, the CLT says (S_n − nμ)/(σ√n) → N(0,1) in distribution, regardless of the original shape (given finite variance).`,
  };
  const distractors: Choice[] = [
    {
      text: "The sample mean converges to the true mean μ",
      rationale: `That is the LAW OF LARGE NUMBERS, not the CLT. The CLT describes the FLUCTUATIONS around μ, not the convergence to μ.`,
    },
    {
      text: "The individual observations become normally distributed",
      rationale: `The CLT is about the SUM/mean, not the raw data, the observations keep their own distribution.`,
    },
    {
      text: "The variance of the sum goes to 0",
      rationale: `Var(S_n) = nσ² actually GROWS; it is the standardised sum (divided by √n·σ) whose distribution stabilises to N(0,1).`,
    },
  ];

  const prompt =
    `For n iid random variables with finite mean μ and variance σ², what does the Central Limit Theorem assert as n → ∞?`;
  const explanation =
    `The CLT: (S_n − nμ)/(σ√n) converges in DISTRIBUTION to a standard Normal, for ANY underlying distribution with finite variance. It is a statement about the shape of the standardised sum, not about the data or about convergence to μ.`;

  return {
    answer: correct.text,
    question: {
      id: `gen-clt-statement-${rng.int(0, 1)}`,
      prompt,
      explanation,
      difficulty,
      concept: "CLT statement (convergence in distribution)",
      source: "Limit theorems · CLT statement",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

/** LLN statement: the sample mean converges to μ. */
export function buildLlnStatementInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  const correct: Choice = {
    text: "The sample mean converges to the true mean μ",
    rationale: `Correct, the LLN says the average of n iid observations converges to μ as n grows.`,
  };
  const distractors: Choice[] = [
    {
      text: "The standardised sum converges to a Normal",
      rationale: `That is the CENTRAL LIMIT THEOREM. The LLN is about the mean settling to μ, not its bell-shaped fluctuations.`,
    },
    {
      text: "Each individual observation approaches μ",
      rationale: `Individual observations keep their full variability; it is their AVERAGE that converges to μ.`,
    },
    {
      text: "The variance of each observation converges to μ",
      rationale: `The LLN concerns the sample MEAN, not the variance; mixing mean and variance is the error.`,
    },
  ];

  const prompt = `What does the Law of Large Numbers assert for the average of n iid observations as n → ∞?`;
  const explanation =
    `The LLN: the sample mean X̄_n → μ (the population mean) as n → ∞. It justifies "long-run averages equal expectations", distinct from the CLT, which describes the DISTRIBUTION of the fluctuations.`;

  return {
    answer: correct.text,
    question: {
      id: `gen-lln-statement-${rng.int(0, 1)}`,
      prompt,
      explanation,
      difficulty,
      concept: "LLN statement (mean → μ)",
      source: "Limit theorems · LLN statement",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

/** CLT conditions: finite variance + iid (the myths: normal data, n<30, zero mean). */
export function buildCltConditionInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  const correct: Choice = {
    text: "The variables are iid with finite variance",
    rationale: `Correct, the classical CLT needs independence, identical distribution, and a FINITE variance; the shape is otherwise unrestricted.`,
  };
  const distractors: Choice[] = [
    {
      text: "The underlying distribution must itself be Normal",
      rationale: `No, the power of the CLT is that ANY finite-variance distribution works; if the data were already Normal there'd be nothing to prove.`,
    },
    {
      text: "The sample size must be less than 30",
      rationale: `Backwards, n ≥ 30 is a rough rule of thumb for the approximation to be GOOD; the theorem is a large-n limit.`,
    },
    {
      text: "The mean must be exactly 0",
      rationale: `The mean can be anything; standardising subtracts μ, so a nonzero mean is fine.`,
    },
  ];

  const prompt = `Which condition is required for the classical Central Limit Theorem to apply?`;
  const explanation =
    `The classical CLT requires iid variables with FINITE variance. It does NOT require the data to be Normal, a small sample, or a zero mean, those are common myths.`;

  return {
    answer: correct.text,
    question: {
      id: `gen-clt-condition-${rng.int(0, 1)}`,
      prompt,
      explanation,
      difficulty,
      concept: "CLT conditions (iid, finite variance)",
      source: "Limit theorems · CLT conditions",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

export const genChebyshev = (rng: Rng): Question =>
  buildChebyshevInstance(rng, "medium").question;
export const genCltStatement = (rng: Rng): Question =>
  buildCltStatementInstance(rng, "hard").question;
export const genLlnStatement = (rng: Rng): Question =>
  buildLlnStatementInstance(rng, "medium").question;
export const genCltCondition = (rng: Rng): Question =>
  buildCltConditionInstance(rng, "hard").question;

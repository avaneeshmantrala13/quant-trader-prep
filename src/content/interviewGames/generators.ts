import type { Rng } from "@/lib/rng";
import type {
  Difficulty,
  NumericQuestion,
  NumericQuestionGenerator,
  Question,
  QuestionGenerator,
} from "@/types/content";
import { assemble, fmt, round } from "../shared";
import { mixNumericGenerators, mixQuestionGenerators } from "../mixFamilies";
import { numDp, numericErrors } from "../probabilityStats/coreScaffold";
import { decText } from "../probabilityStats/coreSolvers";
import { F } from "./tradingSolvers";

/**
 * EV / market-making decision-game generators. These mirror the genres asked at
 * SIG/Citadel/Jane Street: optimal-stopping re-roll games and fair-value
 * pricing. Answers are exact closed forms; distractors encode the classic
 * decision errors (ignoring option value, mean vs max confusion). Kelly
 * bet-sizing moved to the exact Betting & Sizing subcategory (Probability/Math).
 */

const D = (n: number) => fmt(round(n, 4), 4);

/** Die roll with ONE optional re-roll — the canonical E=4.25 optimal-stopping game. */
function genReRollDie(rng: Rng): Question {
  const N = rng.pick([6, 8, 10, 12] as const);
  const e1 = (N + 1) / 2; // EV of a single roll
  // Optimal rule: keep first roll x iff x >= e1, else re-roll (expected e1).
  let sumMax = 0;
  for (let x = 1; x <= N; x++) sumMax += Math.max(x, e1);
  const ev = sumMax / N;

  // Distractor 1: ignore the option value entirely (just a single roll).
  const noOption = e1;
  // Distractor 2: over-optimistic — assume you always land in the "keep" set.
  const keepVals: number[] = [];
  for (let x = 1; x <= N; x++) if (x >= e1) keepVals.push(x);
  const overOptimistic =
    keepVals.reduce((a, b) => a + b, 0) / keepVals.length;
  // Distractor 3: only re-roll the single worst outcome (suboptimal threshold).
  let sumWorstOnly = e1; // re-roll x=1 → e1
  for (let x = 2; x <= N; x++) sumWorstOnly += x;
  const worstOnly = sumWorstOnly / N;

  return assemble(rng, {
    id: `ig-reroll-${N}`,
    prompt: `You roll a fair ${N}-sided die and may either keep the result or re-roll exactly once (you must keep the second roll). Playing optimally, what is the expected value of your final result?`,
    correct: D(ev),
    distractors: [D(noOption), D(overOptimistic), D(worstOnly)],
    explanation: `Keep the first roll when it beats the EV of a fresh roll, ${D(e1)}; otherwise re-roll. EV = (1/${N})·Σ max(x, ${D(e1)}) = ${D(ev)}. (For a standard 6-sided die this is the classic 4.25.)`,
    difficulty: "hard",
    concept: "Optimal stopping / option value",
    distractorRationaleByValue: {
      [D(noOption)]: "Ignored the re-roll option — just the EV of one roll.",
      [D(overOptimistic)]: "Averaged only the outcomes you'd keep, assuming you never land in the re-roll region.",
      [D(worstOnly)]: "Used a suboptimal threshold (only re-rolled the single worst outcome).",
    },
    source: "Citadel die-roll re-roll game (E=4.25)",
  });
}

/** Fair value of a uniformly random card/number draw (market-making prerequisite). */
function genFairValue(rng: Rng): Question {
  const N = rng.pick([10, 20, 50, 100] as const);
  const ev = (N + 1) / 2;
  return assemble(rng, {
    id: `ig-fair-${N}`,
    prompt: `A card is drawn uniformly at random from cards numbered 1 to ${N}, and pays its face value in dollars. If you had to name a single fair price (its expected value), what is it?`,
    correct: `$${D(ev)}`,
    distractors: [`$${D(N / 2)}`, `$${D(N)}`, `$${D((N - 1) / 2)}`],
    explanation: `EV of a uniform draw on 1..${N} is (1 + ${N}) / 2 = $${D(ev)}. A market maker would quote a tight two-sided spread around this.`,
    difficulty: "medium",
    concept: "Fair value / expectation of a uniform",
    distractorRationaleByValue: {
      [`$${D(N / 2)}`]: "Used N/2 — forgot the +1 (endpoints run 1..N, not 0..N).",
      [`$${D(N)}`]: "Named the maximum payout instead of the average.",
      [`$${D((N - 1) / 2)}`]: "Off-by-one on the average of an inclusive range.",
    },
    source: "Fair-value pricing (market making)",
  });
}

export const EV_GENERATORS: Record<string, QuestionGenerator> = {
  genReRollDie,
  genFairValue,
};

export const mixEV = (pool: QuestionGenerator[]): QuestionGenerator =>
  mixQuestionGenerators(pool);

/* ========================================================================== */
/*  FREE-RESPONSE (numeric) forms — the MCQ→free conversion of ig-3.           */
/*  Same exact closed-form solvers as the quiz generators above; every wrong   */
/*  value is a re-derived, NAMED misconception carrying a machine-readable      */
/*  `misconception` tag + an answer-withholding rung-1 coaching sentence.       */
/*  These are kept OUT of `EV_GENERATORS` (which the shared registry test       */
/*  iterates as quiz-only, asserting `q.choices.length === 4`).                 */
/* ========================================================================== */

/**
 * FREE-RESPONSE form of the die re-roll optimal-stopping game. Optimal rule:
 * keep the first roll x iff x ≥ e1 = (N+1)/2 (the EV of a fresh roll), else
 * re-roll (worth e1). EV = (1/N)·Σ max(x, e1). All arithmetic is done in HALVES
 * (e1 is a half-integer) so the value is exact. The learner types the EV as a
 * fraction or decimal (graded by `gradeFreeResponse`).
 */
export function buildReRollDieNumericInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const N = rng.pick([6, 8, 10, 12] as const);
  // Work in HALVES: 2·e1 = N+1, 2·max(x, e1) = max(2x, N+1) — stays exact.
  let sumMax2 = 0;
  for (let x = 1; x <= N; x++) sumMax2 += Math.max(2 * x, N + 1);
  const valueF = F(sumMax2, 2 * N);
  const dp = numDp(valueF);
  const answer = Number(decText(valueF, dp));

  // Genuine error modes (ranked), mined from the quiz distractor taxonomy.
  const noOption = F(N + 1, 2); // ignored the option → single-roll EV
  const e1Text = decText(noOption, numDp(noOption));
  const keepVals: number[] = [];
  for (let x = 1; x <= N; x++) if (2 * x >= N + 1) keepVals.push(x);
  const keepOnly = F(
    keepVals.reduce((a, b) => a + b, 0),
    keepVals.length,
  );
  let worst2 = N + 1; // re-roll ONLY x=1 (→ e1); keep every other face
  for (let x = 2; x <= N; x++) worst2 += 2 * x;
  const worstOnly = F(worst2, 2 * N);
  let inv2 = 0; // BACKWARDS rule: keep low rolls, re-roll high ones
  for (let x = 1; x <= N; x++) inv2 += 2 * x <= N + 1 ? 2 * x : N + 1;
  const inverted = F(inv2, 2 * N);

  const { errors, push } = numericErrors(answer, dp);
  push(
    noOption,
    `That's the EV of a SINGLE roll — you dropped the value of the re-roll option. If you may discard a bad first roll for a fresh draw, should your final value be higher or lower than one plain roll?`,
    "ignored_option_value",
  );
  push(
    keepOnly,
    `You averaged only the rolls you would KEEP, as if you never re-roll. But when the first roll falls below the fresh-roll mean you DO re-roll — what value should those turns contribute?`,
    "keep_region_only",
  );
  push(
    worstOnly,
    `Close — but you only re-rolled the single worst face. Compare EVERY face to the EV of a fresh roll: shouldn't every face below that mean be re-rolled, not just the lowest one?`,
    "suboptimal_threshold",
  );
  push(
    inverted,
    `It looks like you kept the LOW rolls and re-rolled the high ones. Which rolls are worth keeping — the ones above the fresh-roll average, or the ones below it?`,
    "inverted_stopping_rule",
  );

  const prompt =
    `You roll a fair ${N}-sided die and may either keep the result or re-roll exactly once (you must keep the second roll). ` +
    `Playing optimally, what is the expected value of your final result? (Enter a fraction or decimal.) Round to the nearest thousandth.`;
  const explanation =
    `Keep the first roll when it beats the EV of a fresh roll, (${N}+1)/2 = ${e1Text}; otherwise re-roll (worth that mean). ` +
    `EV = (1/${N})·Σ max(x, ${e1Text}) = ${decText(valueF, dp)}. (For a standard 6-sided die this is the classic 4.25.)`;

  return {
    answer,
    numeric: {
      id: `ig-reroll-num-${N}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Optimal stopping / option value",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Citadel die-roll re-roll game (E=4.25)",
    },
  };
}

/**
 * FREE-RESPONSE form of uniform fair-value pricing: the fair price of a draw
 * paying its face value on {1,…,N} is its expectation (1 + N)/2. Same solver as
 * the quiz `genFairValue`; the three genuine slips (N/2, the max, and the
 * inclusive off-by-one) become a tagged parametric error-mode catalog.
 */
export function buildFairValueNumericInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const N = rng.pick([10, 20, 50, 100] as const);
  const evF = F(N + 1, 2);
  const dp = numDp(evF);
  const answer = Number(decText(evF, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(N, 2),
    `So close — you used N/2. But the faces start at 1, not 0, so the average sits a half-step above N/2. Which direction does starting the count at 1 push the mean?`,
    "forgot_plus_one",
  );
  push(
    F(N),
    `That's the LARGEST possible draw, not the typical one. A fair price is the average payoff — is an average the biggest value, or somewhere in the middle of the range?`,
    "max_not_mean",
  );
  push(
    F(N - 1, 2),
    `Off by one on an inclusive range — you averaged as if the top face were ${N - 1}. Both 1 and ${N} are genuinely possible draws, so should the top endpoint be dropped?`,
    "off_by_one_inclusive",
  );

  const prompt =
    `A card is drawn uniformly at random from cards numbered 1 to ${N}, paying its face value in dollars. ` +
    `What single fair price (its expected value) should you quote? (Enter a fraction or decimal.) Round to the nearest thousandth.`;
  const explanation =
    `The EV of a uniform draw on 1..${N} is (1 + ${N})/2 = ${decText(evF, dp)}. ` +
    `A market maker quotes a tight two-sided spread around this fair value.`;

  return {
    answer,
    numeric: {
      id: `ig-fair-num-${N}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Fair value / expectation of a uniform",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Fair-value pricing (market making)",
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  Numeric adapters + registry (SEPARATE from EV_GENERATORS).                 */
/* -------------------------------------------------------------------------- */

export const genReRollDieNumeric = (rng: Rng): NumericQuestion =>
  buildReRollDieNumericInstance(rng, "hard").numeric;
export const genFairValueNumeric = (rng: Rng): NumericQuestion =>
  buildFairValueNumericInstance(rng, "medium").numeric;

/** Numeric (free-response) EV generators — the MCQ→free conversion of ig-3.
 *  Deliberately NOT part of `EV_GENERATORS` so the quiz-only shared registry
 *  test (`src/content/generators.test.ts`) stays green. */
export const EV_NUMERIC_GENERATORS: Record<string, NumericQuestionGenerator> = {
  genReRollDieNumeric,
  genFairValueNumeric,
};

/** Combine several numeric EV generators into one family-tagged mixer. */
export const mixEVNumeric = (
  pool: NumericQuestionGenerator[],
): NumericQuestionGenerator => mixNumericGenerators(pool);

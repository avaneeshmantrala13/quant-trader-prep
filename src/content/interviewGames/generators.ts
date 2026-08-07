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
import { cap, numDp, numericErrors } from "../probabilityStats/coreScaffold";
import { decText, exactDecimals } from "../probabilityStats/coreSolvers";
import { F } from "./tradingSolvers";

/**
 * EV / market-making decision-game generators. These mirror the genres asked at
 * SIG/Citadel/Jane Street: optimal-stopping re-roll games and fair-value
 * pricing. Answers are exact closed forms; distractors encode the classic
 * decision errors (ignoring option value, mean vs max confusion). Kelly
 * bet-sizing moved to the exact Betting & Sizing subcategory (Probability/Math).
 */

const D = (n: number) => fmt(round(n, 4), 4);

/** Die roll with ONE optional re-roll, the canonical E=4.25 optimal-stopping game. */
function genReRollDie(rng: Rng): Question {
  const N = rng.pick([6, 8, 10, 12] as const);
  const e1 = (N + 1) / 2; // EV of a single roll
  // Optimal rule: keep first roll x iff x >= e1, else re-roll (expected e1).
  let sumMax = 0;
  for (let x = 1; x <= N; x++) sumMax += Math.max(x, e1);
  const ev = sumMax / N;

  // Distractor 1: ignore the option value entirely (just a single roll).
  const noOption = e1;
  // Distractor 2: over-optimistic, assume you always land in the "keep" set.
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
      [D(noOption)]: "Ignored the re-roll option, just the EV of one roll.",
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
      [`$${D(N / 2)}`]: "Used N/2, forgot the +1 (endpoints run 1..N, not 0..N).",
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
/*  FREE-RESPONSE (numeric) forms, the MCQ→free conversion of ig-3.           */
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
  // Work in HALVES: 2·e1 = N+1, 2·max(x, e1) = max(2x, N+1), stays exact.
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
    `That's the EV of a SINGLE roll, you dropped the value of the re-roll option. If you may discard a bad first roll for a fresh draw, should your final value be higher or lower than one plain roll?`,
    "ignored_option_value",
  );
  push(
    keepOnly,
    `You averaged only the rolls you would KEEP, as if you never re-roll. But when the first roll falls below the fresh-roll mean you DO re-roll, what value should those turns contribute?`,
    "keep_region_only",
  );
  push(
    worstOnly,
    `Close, but you only re-rolled the single worst face. Compare EVERY face to the EV of a fresh roll: shouldn't every face below that mean be re-rolled, not just the lowest one?`,
    "suboptimal_threshold",
  );
  push(
    inverted,
    `It looks like you kept the LOW rolls and re-rolled the high ones. Which rolls are worth keeping, the ones above the fresh-roll average, or the ones below it?`,
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
    `So close, you used N/2. But the faces start at 1, not 0, so the average sits a half-step above N/2. Which direction does starting the count at 1 push the mean?`,
    "forgot_plus_one",
  );
  push(
    F(N),
    `That's the LARGEST possible draw, not the typical one. A fair price is the average payoff, is an average the biggest value, or somewhere in the middle of the range?`,
    "max_not_mean",
  );
  push(
    F(N - 1, 2),
    `Off by one on an inclusive range, you averaged as if the top face were ${N - 1}. Both 1 and ${N} are genuinely possible draws, so should the top endpoint be dropped?`,
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

/** Numeric (free-response) EV generators, the MCQ→free conversion of ig-3.
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

/* ========================================================================== */
/*  ig-1 "Pricing Fair Value" — parametric numeric families.                   */
/*                                                                             */
/*  The former hand-authored static pool (a coin-bet EV, the mode of a         */
/*  two-dice sum, and the EXPECTED MAXIMUM of dice) is now three exact         */
/*  closed-form generators. Each carries a worked, step-by-step `explanation`   */
/*  (multiple sentences) so the tutor's rung-3 worked-sibling builder          */
/*  (`@/lib/tutor/workedSibling`) can render a real, DIFFERENT-numbers sibling  */
/*  with ordered steps + its own answer — the fix for the "no worked example"  */
/*  rung-3 bug on the expected-maximum item. Distractors are re-derived, NAMED  */
/*  misconceptions guaranteed distinct and ≠ the answer.                       */
/* ========================================================================== */

/**
 * EV of a single fair-coin bet: win $W on heads, lose $L on tails ⇒ (W−L)/2.
 * Genuine slips: netting the payoffs without the ½ weight, dropping the loss
 * sign, and summing the raw magnitudes.
 */
export function buildCoinBetEvNumericInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  // Opposite parity (odd win, even loss) ⇒ W−L is odd ⇒ the EV is a half-integer
  // like 2.5. That keeps the answer OFF the integer payoff tokens the coaching
  // must cite (so a wrong-value nudge can never accidentally spell the answer).
  const W = rng.pick([7, 9, 11, 13, 15] as const);
  const L = rng.pick([2, 4, 6] as const);
  const evF = F(W - L, 2);
  const dp = Math.max(0, exactDecimals(evF, 4));
  const answer = Number(decText(evF, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    W - L,
    `You netted the payoffs (${W} − ${L}) but never weighted them by how often each side happens. On a fair coin, what chance does each outcome carry, and how should that scale each payoff?`,
    "summed_payouts_no_weight",
  );
  push(
    F(W + L, 2),
    `You averaged (${W} + ${L}) over the two sides, but tails LOSES $${L}. What sign should the losing payoff carry before you average?`,
    "dropped_loss_sign",
  );
  push(
    W + L,
    `That adds the raw sizes ${W} and ${L} with no probabilities and no loss sign. Every expected-value term needs both a chance and a signed payoff — which did you drop?`,
    "summed_magnitudes",
  );

  const prompt =
    `A fair coin is flipped once. You win $${W} on heads and lose $${L} on tails. ` +
    `What is the expected value of playing? (Enter a fraction or decimal.)`;
  const explanation =
    `Weight each signed payoff by its ½ chance. ` +
    `EV = ½·(+${W}) + ½·(−${L}) = (${W} − ${L})/2 = ${decText(evF, dp)}. ` +
    `A positive expected value means the bet is worth taking (sizing aside).`;

  return {
    answer,
    numeric: {
      id: `ig-coinbet-${W}-${L}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Expected value of a bet",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "EV of a coin bet",
    },
  };
}

/**
 * The single MOST-LIKELY total of two fair d-sided dice: the central sum d+1
 * (achieved d ways, the peak of a symmetric triangular distribution). Slips:
 * the near-peak totals d and d+2, and the least-likely minimum 2.
 */
export function buildDiceSumModeNumericInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const d = rng.pick([6, 8, 10, 12] as const);
  const mode = d + 1; // central sum, always an integer
  const dp = 0;
  const answer = mode;

  const { errors, push } = numericErrors(answer, dp);
  push(
    d,
    `${d} sits one step below the peak — it occurs ${d - 1} ways, just short of the top. Which single central total has the MOST combinations of all?`,
    "near_peak_below",
  );
  push(
    d + 2,
    `${d + 2} mirrors ${d} and shares its count, one shy of the summit. On which central sum do the dice combinations pile up the most?`,
    "near_peak_above",
  );
  push(
    2,
    `A total of 2 happens only one way (1-1) — the LEAST likely, not the most. Re-read the prompt: which sum should the combinations favour most?`,
    "min_not_mode",
  );

  const prompt =
    `Two fair ${d}-sided dice are rolled and summed. ` +
    `Which total is the single MOST likely? (Enter a fraction or decimal.)`;
  const explanation =
    `Count the ways to make each total. ` +
    `The number of combinations rises to a single peak at the central total ${d} + 1 = ${mode} (made ${d} ways), then falls off symmetrically toward the extremes. ` +
    `So the most likely total — the mode — is ${mode}.`;

  return {
    answer,
    numeric: {
      id: `ig-dicemode-${d}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Discrete distribution mode",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Sum of two dice",
    },
  };
}

/**
 * EXPECTED MAXIMUM of `k` iid fair d-sided dice (an order statistic).
 *
 * P(max ≤ m) = (m/d)ᵏ, so P(max = m) = (mᵏ − (m−1)ᵏ)/dᵏ and
 *   E[max] = Σ_{m=1}^{d} m·(mᵏ − (m−1)ᵏ)/dᵏ,
 * an exact rational with integer numerator over dᵏ. Genuine slips: the
 * single-die mean (d+1)/2, the largest face d, and the expected MINIMUM
 * (d+1) − E[max] (min/max confusion). This is the family that lights up the
 * rung-3 worked sibling for the "expected value of the LARGER of two dice" item.
 */
export function buildExpMaxDiceNumericInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const d = rng.pick([4, 6, 8, 10, 12, 20] as const);
  const k = rng.pick([2, 3] as const);
  const dk = d ** k;

  let num = 0;
  for (let m = 1; m <= d; m++) num += m * (m ** k - (m - 1) ** k);
  const evF = F(num, dk);
  const dp = Math.max(2, exactDecimals(evF, 4)); // a mean → show ≥ 2 decimals
  const answer = Number(decText(evF, dp));

  const singleMean = F(d + 1, 2); // mean of ONE die
  // E[min] = (d+1) − E[max] by the max↔min reflection m ↦ d+1−m.
  const expMin = F((d + 1) * dk - num, dk);

  const { errors, push } = numericErrors(answer, dp);
  push(
    singleMean,
    `That's the mean of a SINGLE die, (${d}+1)/2. The maximum of ${k} rolls is pulled UPWARD — should the average of the largest of ${k} dice sit above or below one die's mean?`,
    "single_die_mean",
  );
  push(
    d,
    `${d} is the LARGEST value the maximum can reach, not its average. The ${k} dice rarely all hit the top, so where should the probability-weighted mean land?`,
    "max_not_mean",
  );
  push(
    expMin,
    `That's the expected MINIMUM — the reflection of the maximum below the single-die mean. You were asked for the LARGEST of the ${k} rolls, which sits ABOVE that mean, not below it.`,
    "min_not_max",
  );

  const kWord = k === 2 ? "two" : "three";
  const prompt =
    `${cap(kWord)} fair ${d}-sided dice are rolled. ` +
    `What is the expected value of the LARGEST of the ${kWord} (the maximum)? ` +
    `(Enter a fraction or decimal.) Round to ${dp} decimal places.`;
  const explanation =
    `First get the max's distribution: P(max ≤ m) = (m/${d})^${k}, so P(max = m) = (m^${k} − (m−1)^${k})/${d}^${k}. ` +
    `Then weight each value by its probability: E[max] = Σ_{m=1}^{${d}} m·(m^${k} − (m−1)^${k})/${d}^${k} = ${num}/${dk} = ${decText(evF, dp)}. ` +
    `This lands ABOVE a single die's mean (${d}+1)/2 = ${decText(singleMean, exactDecimals(singleMean, 4))}, exactly as a maximum should.`;

  return {
    answer,
    numeric: {
      id: `ig-max-dice-${d}-${k}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Order statistics / expected maximum",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Expected maximum of dice (order statistics)",
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  Numeric adapters + registry for the ig-1 "Pricing Fair Value" families.    */
/* -------------------------------------------------------------------------- */

export const genCoinBetEvNumeric = (rng: Rng): NumericQuestion =>
  buildCoinBetEvNumericInstance(rng, "easy").numeric;
export const genDiceSumModeNumeric = (rng: Rng): NumericQuestion =>
  buildDiceSumModeNumericInstance(rng, "easy").numeric;
export const genExpMaxDiceNumeric = (rng: Rng): NumericQuestion =>
  buildExpMaxDiceNumericInstance(rng, "hard").numeric;

/**
 * Numeric (free-response) generators backing ig-1 "Pricing Fair Value". Kept
 * SEPARATE from `EV_NUMERIC_GENERATORS` (the ig-3 conversion) and from
 * `EV_GENERATORS` (quiz-only) so the shared registry tests stay green.
 */
export const EV_BASICS_NUMERIC_GENERATORS: Record<
  string,
  NumericQuestionGenerator
> = {
  genCoinBetEvNumeric,
  genDiceSumModeNumeric,
  genExpMaxDiceNumeric,
};

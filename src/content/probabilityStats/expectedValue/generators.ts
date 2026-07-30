import type { Rng } from "@/lib/rng";
import type {
  Difficulty,
  Flashcard,
  NumericQuestion,
  NumericQuestionGenerator,
  Question,
  QuestionGenerator,
} from "@/types/content";
import type FractionType from "fraction.js";
import {
  F,
  allSameCoinsProb,
  convertAllEV,
  couponCollectorAll,
  couponCollectorPartial,
  decText,
  dieMean,
  dieSecondMoment,
  dieVariance,
  exactDecimals,
  expectedDistinctAfterDraws,
  expectedRecords,
  expectedTrialsPairSame,
  firstMarkerSpacingEV,
  fracText,
  geometricMemorylessTotal,
  geometricSumEV,
  harmonic,
  higherWhenDifferEV,
  maxOfDiceEV,
  meetWithinProb,
  negBinomialEV,
  oneRerollFeeEV,
  oneRerollUniformEV,
  overlapProbTwoWindows,
  twoDiceMatchProb,
  uniformOrderStatEV,
  waldEV,
} from "./ev";
import { mixNumericGenerators, mixQuestionGenerators } from "../../mixFamilies";
import { MISCONCEPTION } from "@/lib/tutor/misconception";

/**
 * Parametric generators + per-family misconception taxonomy for the
 * Probability & Statistics → Expected Value subcategory.
 *
 * Expected Value is a CLUSTER of ~25 solution-method families, not a single
 * repeating formula, so the generators are grouped by family. Every scalar is
 * produced by the exact rational solver in `./ev.ts`; every distractor
 * (`quiz` choices / `numeric` commonErrors) is a re-derived, NAMED
 * misconception, guaranteed distinct and ≠ the answer.
 *
 * Mode per family (see `./levels.ts` for the justification):
 *   • `numeric`   — families whose answer is a clean, exact scalar the learner
 *                   should compute (optimal-stopping game values, geometric /
 *                   recursion waits, indicator/linearity counts, conditional
 *                   expectation & geometric-probability areas).
 *   • `quiz`      — families where NAMING the mistake is the teaching point
 *                   (the 1/36 dice-match trap, CLT variance addition, Wald's
 *                   wrong count, walk duration i·N vs i(N−i)).
 *   • `flashcard` — divergent-EV sentinels ("infinite / diverges", trap = a
 *                   tempting finite sum) and coin-simulation PROCEDURES
 *                   (reveal the procedure/formula, not a graded scalar).
 *
 * NONE of the 85 source-dataset questions are user-facing — they live only in
 * `./expectedValue.test.ts` as hidden fixtures; all playable items here are
 * freshly generated with different names/numbers.
 */

/* ========================================================================== */
/*  Shared helpers                                                             */
/* ========================================================================== */

interface Choice {
  text: string;
  rationale: string;
}

/**
 * Assemble + shuffle MC choices so the answer position never leaks. Distractors
 * whose text collides with the correct answer or an earlier option are dropped
 * (keeps `choices` distinct, as `levels.test.ts` enforces); at most 4 options.
 */
function assembleChoices(
  rng: Rng,
  correct: Choice,
  distractors: Choice[],
): Pick<Question, "choices" | "correctIndex" | "distractorRationale"> {
  const chosen: Choice[] = [correct];
  const seen = new Set<string>([correct.text]);
  for (const d of distractors) {
    if (seen.has(d.text)) continue;
    seen.add(d.text);
    chosen.push(d);
    if (chosen.length >= 4) break;
  }
  const order = rng.shuffle(chosen.map((_, i) => i));
  const shuffled = order.map((i) => chosen[i]);
  return {
    choices: shuffled.map((c) => c.text),
    correctIndex: order.indexOf(0),
    distractorRationale: shuffled.map((c) => c.rationale),
  };
}

/**
 * Deduping accumulator for `numeric` commonErrors (rounded to `dp`, ≠ answer).
 *
 * `push` accepts an OPTIONAL machine-readable `misconception` tag (PHASE_1/2
 * error-mode catalogs): when supplied it is carried onto the `commonErrors`
 * entry so the mastery layer folds `misconceptionKey(topicKey, tag)` and the
 * hint ladder keys rung-1 coaching / the confront strategy off it. Omitting it
 * stays fully back-compatible (the existing numeric families do so, falling back
 * to the deterministic `err:<value>` key).
 */
function numericErrors(
  answer: number,
  dp: number,
): {
  errors: { value: number; feedback: string; misconception?: string }[];
  push: (
    raw: FractionType | number,
    feedback: string,
    misconception?: string,
  ) => void;
} {
  const f = 10 ** dp;
  const seen = new Set<number>([Math.round(answer * f)]);
  const errors: { value: number; feedback: string; misconception?: string }[] =
    [];
  const push = (
    raw: FractionType | number,
    feedback: string,
    misconception?: string,
  ) => {
    const v = typeof raw === "number" ? raw : raw.valueOf();
    if (!Number.isFinite(v)) return;
    const rounded = Math.round(v * f) / f;
    const k = Math.round(rounded * f);
    if (seen.has(k)) return;
    seen.add(k);
    errors.push({
      value: rounded,
      feedback,
      ...(misconception ? { misconception } : {}),
    });
  };
  return { errors, push };
}

/** Number of decimals to grade a numeric answer at (exact if terminating). */
function gradeDp(f: FractionType, cap = 3): number {
  return exactDecimals(f, cap);
}

/** Combine several Question generators into one that picks per call. */
export const mixQuiz = (pool: QuestionGenerator[]): QuestionGenerator =>
  mixQuestionGenerators(pool);

/** Combine several numeric generators into one that picks per call. */
export const mixNumeric = (
  pool: NumericQuestionGenerator[],
): NumericQuestionGenerator => mixNumericGenerators(pool);

const money = (f: FractionType, dp: number) => `$${decText(f, dp)}`;

/* ========================================================================== */
/* ==========================  NUMERIC FAMILIES  ============================= */
/* ========================================================================== */

/* -------------------------------------------------------------------------- */
/*  LEVEL 1 — Optimal stopping / reroll games  (numeric)                       */
/* -------------------------------------------------------------------------- */

const REROLL_SCENARIOS = [
  { die: "an", item: "electronic die", who: "the house" },
  { die: "a", item: "casino die", who: "the dealer" },
  { die: "a", item: "prize die", who: "the carnival" },
];

/** Fair dN, roll once, keep or take a (possibly fee'd) mandatory second roll. */
export function buildOneRerollInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const N = rng.pick([6, 9, 12, 16, 20]);
  const fee = rng.pick([0, 0, 1, 3]);
  const value = oneRerollFeeEV(N, F(fee));
  const dp = gradeDp(value, 3);
  const answer = Number(decText(value, dp));
  const sc = rng.pick(REROLL_SCENARIOS);
  const mean = dieMean(N);
  const rerollValue = mean.sub(F(fee));

  const { errors, push } = numericErrors(answer, dp);
  push(
    mean,
    `You reported the plain average of one roll, ${fracText(mean)}. But you get to KEEP a good first roll and only reroll a bad one — the option to stop is worth extra.`,
  );
  push(
    rerollValue,
    `That's the value of choosing to reroll (${fracText(mean)} − ${fee}). It's the fallback, not the game value — you only take it when your first roll is below it.`,
  );
  push(
    F(N),
    `That's the maximum face. You don't always get the top face — you keep the first roll only when it beats the reroll's value.`,
  );

  const feeText =
    fee === 0
      ? "surrender it for one forced re-roll and be paid that instead"
      : `hand back ${money(F(fee), 0)} for one forced re-roll and be paid that roll less the ${money(F(fee), 0)} charge`;

  const prompt =
    `A single fair ${N}-sided die decides a game. After your first roll you may lock in that many dollars, or ${feeText}. ` +
    `With optimal strategy, what is this game worth in expected ${fee === 0 ? "payout" : "net payout"}? (Round to ${dp} decimals.)`;

  const explanation =
    `The reroll is worth ${fracText(mean)}${fee ? ` − ${fee} = ${fracText(rerollValue)}` : ""} (a fresh d${N} averages ${fracText(mean)}${fee ? `, minus the ${fee} fee` : ""}). ` +
    `Keep your first roll v iff v ≥ ${decText(rerollValue, 2)}; otherwise reroll. Averaging max(v, ${decText(rerollValue, 2)}) over the ${N} equally-likely faces gives ` +
    `E = ${fracText(value)} ≈ ${decText(value, dp)}. The option to stop on a high roll is what lifts the value above the plain average.`;

  return {
    answer,
    numeric: {
      id: `ev-reroll-${N}-${fee}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Optimal stopping (one reroll)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: `Expected Value · Optimal stopping · ${sc.who}`,
    },
  };
}

/** Continuous one-reroll: voucher ~ Uniform(0, M); keep or one fresh draw. E = 5M/8. */
export function buildContinuousRerollInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const M = rng.pick([96, 120, 160, 240, 320]);
  const value = oneRerollUniformEV(F(M));
  const dp = gradeDp(value, 3);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(M, 2),
    `That's the plain mean of a single draw (M/2). But you can keep a high first draw and reroll a low one, so the value beats the mean.`,
  );
  push(
    F(M),
    `That's the maximum possible voucher. You can't guarantee the top of the range.`,
  );
  push(
    F(3 * M, 4),
    `That's the mean of only the upper half (E[V | V ≥ M/2] = 3M/4). You forgot the half of the time you reroll into a fresh mean-M/2 draw.`,
  );

  const prompt =
    `A kiosk hands you a gift card loaded with a Uniform(0, ${money(F(M), 0)}) dollar amount. You can accept the card you're shown, or tear it up and draw exactly one replacement that you must then accept. ` +
    `Acting optimally, what is the expected value of the card you leave with? (Round to ${dp} decimals.)`;

  const explanation =
    `A fresh voucher averages ${money(F(M, 2), 0)}, so keep the first voucher v iff v ≥ ${money(F(M, 2), 0)}. ` +
    `E = ½·(mean of the low half = ${money(F(M, 4), 0)}) + ½·(E[V | V ≥ ${money(F(M, 2), 0)}] = ${money(F(3 * M, 4), 0)}) = ${money(value, dp)}, i.e. 5M/8.`;

  return {
    answer,
    numeric: {
      id: `ev-voucher-${M}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Optimal stopping (continuous one reroll)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Expected Value · Optimal stopping (continuous)",
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  LEVEL 2 — Geometric, negative-binomial & first-step recursion  (numeric)   */
/* -------------------------------------------------------------------------- */

/** E[rolls to the r-th target face] on a fair dN = r·N (negative binomial). */
export function buildNegBinomialInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const N = rng.pick([8, 10, 12, 20]);
  const r = rng.pick([1, 1, 2, 3]);
  const value = negBinomialEV(r, F(1, N));
  const answer = value.valueOf();

  const { errors, push } = numericErrors(answer, 0);
  push(
    F(N),
    `That's the wait for the FIRST target (1/p = ${N}). You need the ${ordinal(r)}, which is r geometric waits: r·${N}.`,
  );
  push(
    F(1, N),
    `That's the per-roll probability p = 1/${N}, not the expected number of rolls, which is 1/p summed r times.`,
  );
  push(
    value.sub(F(r)),
    `You counted only the FAILURES before each success (r·(1/p − 1)). The wait 1/p per success COUNTS the successful roll too.`,
  );

  const ord = ordinal(r);
  const prompt =
    `A fair ${N}-sided die is rolled again and again. On average, how many rolls pass before one chosen target face has turned up ${r === 1 ? "once" : `${r} separate times`}?`;

  const explanation =
    `Each appearance of the target face is a geometric wait with p = 1/${N}, so it averages ${N} rolls. ` +
    `Reaching the ${ord} appearance is the sum of ${r} independent such waits: E = ${r}·${N} = ${answer} (negative binomial mean r/p).`;

  return {
    answer,
    numeric: {
      id: `ev-negbin-${N}-${r}`,
      prompt,
      answer,
      difficulty,
      concept: "Geometric / negative binomial (r/p)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Expected Value · Geometric / negative binomial",
    },
  };
}

/** E[rolls to see the SAME face twice in a row] on a fair dN = (1+p)/p² = N²+N. */
export function buildPairSameInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const N = rng.pick([5, 9, 10, 12]);
  const value = expectedTrialsPairSame(F(1, N)); // = N² + N
  const answer = value.valueOf();

  const { errors, push } = numericErrors(answer, 0);
  push(
    F(N * N),
    `That's 1/p² = ${N}² — the wait for a SPECIFIC ordered pair. A same-face pair also needs one extra wait to roll the first of the two matching faces, giving (1+p)/p² = ${N}²+${N}.`,
  );
  push(
    F(2 * N),
    `You doubled the single geometric wait (2·${N}). Two-in-a-row is far longer because a mismatch restarts the second slot.`,
  );
  push(
    F(N),
    `That's the wait for a single target face (1/p). Matching the PREVIOUS face twice in a row is quadratically longer.`,
  );

  const prompt =
    `A fair ${N}-faced die is tossed over and over until some face immediately repeats itself — the same number showing on two back-to-back tosses. On average, how many tosses does that take?`;

  const explanation =
    `Let E be the wait. First roll (anything) costs 1; then with p = 1/${N} the next roll matches and you stop, else you restart with the new face: ` +
    `E = 1 + (1 − p)/p · ... which closes to (1 + p)/p² = ${N}² + ${N} = ${answer}. (Self-overlap makes this longer than a fixed ordered pair, 1/p² = ${N * N}.)`;

  return {
    answer,
    numeric: {
      id: `ev-pairsame-${N}`,
      prompt,
      answer,
      difficulty,
      concept: "First-step recursion (two in a row, general p)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Expected Value · First-step recursion",
    },
  };
}

/** Geometric memorylessness: given m failures already, E[total trials] = m + 1/p. */
export function buildMemorylessInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const N = rng.pick([8, 10, 12, 20]);
  const m = rng.pick([2, 3, 4, 5, 8]);
  const value = geometricMemorylessTotal(F(1, N), m); // m + N
  const answer = value.valueOf();

  const { errors, push } = numericErrors(answer, 0);
  push(
    F(N),
    `That's the remaining wait 1/p = ${N}. Memorylessness says the remaining wait is UNCHANGED — but the question asks for the TOTAL count from the start, so add the ${m} rolls already made.`,
  );
  push(
    F(m),
    `That's just the ${m} rolls already taken; you still expect a fresh geometric wait of ${N} more.`,
  );
  push(
    F(N).sub(F(m)),
    `You SUBTRACTED the elapsed rolls, as if waiting already gets you "closer". The geometric distribution is memoryless: the remaining wait stays 1/p = ${N} regardless.`,
  );

  const prompt =
    `A fair ${N}-sided die is rolled until a particular chosen face turns up. If that face has yet to show across the first ${m} rolls, how many rolls in total — counting the ones already made — should you expect before it finally lands?`;

  const explanation =
    `The geometric distribution is memoryless: after ${m} failures the remaining wait is still a fresh 1/p = ${N} rolls. ` +
    `The total from the start is therefore ${m} + ${N} = ${answer}. The classic slip is reporting ${N} and forgetting to add the ${m} rolls already made.`;

  return {
    answer,
    numeric: {
      id: `ev-memoryless-${N}-${m}`,
      prompt,
      answer,
      difficulty,
      concept: "Geometric memorylessness (m + 1/p)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Expected Value · Geometric memorylessness",
    },
  };
}

/** First-step running sum: roll dN, add face; faces ≤ t continue, > t stop. */
export function buildRunningSumInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const N = rng.pick([6, 8, 10]);
  const t = rng.int(2, N - 2); // stop when face > t
  const p = F(N - t, N); // P(stop) each roll
  const mean = dieMean(N);
  const value = waldEV(F(1).div(p), mean); // E[rolls]·E[face]
  const dp = gradeDp(value, 3);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    mean,
    `That's the average of a single roll. The game pays the SUM of all rolls, and you roll ${fracText(F(1).div(p))} times on average — multiply.`,
  );
  push(
    F(1).div(p),
    `That's the expected NUMBER of rolls (1/p), not the expected sum. Multiply by the average face value ${fracText(mean)} (Wald's identity).`,
  );
  push(
    F(1).div(p).sub(F(1)).mul(mean),
    `You used (E[N] − 1) rolls — undercounting by one. Every roll, including the final stopping roll, contributes to the sum.`,
  );

  const prompt =
    `You roll a fair ${N}-sided die repeatedly, adding up the face values, and stop as soon as a roll shows a value greater than ${t}. ` +
    `What is the expected total sum of all your rolls? (Round to ${dp} decimals.)`;

  const explanation =
    `Each roll stops the game with probability p = ${fracText(p)}, so the expected number of rolls is 1/p = ${fracText(F(1).div(p))}. ` +
    `Each roll averages ${fracText(mean)}. By Wald's identity E[sum] = E[#rolls]·E[face] = ${fracText(F(1).div(p))}·${fracText(mean)} = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `ev-runsum-${N}-${t}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "First-step recursion / Wald (running sum)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Expected Value · First-step recursion",
    },
  };
}

/** Geometric-sum carnival game: pay `perRound` in expectation, continue w.p. c. */
export function buildGeometricSumInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const N = rng.pick([6, 10, 12]);
  const perRound = dieMean(N); // paid the die face each round
  const cont = rng.pick([F(1, 3), F(1, 2), F(2, 5), F(3, 5)]);
  const value = geometricSumEV(perRound, cont);
  const dp = gradeDp(value, 3);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    perRound,
    `That's one round's payout. The game continues with probability ${fracText(cont)}, so you play 1/(1−${fracText(cont)}) rounds on average — scale up.`,
  );
  push(
    perRound.mul(cont),
    `You multiplied by the continue probability instead of dividing by (1 − continue). Total EV = perRound / (1 − pContinue).`,
  );
  push(
    perRound.div(cont),
    `You divided by the continue probability. It should be divided by (1 − pContinue), the per-round STOP probability.`,
  );

  const prompt =
    `Every round of an arcade machine rolls a fair ${N}-sided die and adds its face value (about ${fracText(perRound)}) to your winnings. After each round a mechanism lets play continue with probability ${fracText(cont)}; otherwise you cash out. ` +
    `What total do you expect to win? (Round to ${dp} decimals.)`;

  const explanation =
    `Expected rounds = 1/(1 − ${fracText(cont)}) = ${fracText(F(1).div(F(1).sub(cont)))}. Each round pays ${fracText(perRound)}, so total EV = perRound/(1 − pContinue) = ${fracText(perRound)}/${fracText(F(1).sub(cont))} = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `ev-geomsum-${N}-${fracText(cont).replace("/", "_")}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Geometric sum (perRound / (1 − pContinue))",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Expected Value · Geometric sum",
    },
  };
}

/** "Convert all": N slots, one converted per hit; E[draws to convert all r] = N·H_r. */
export function buildConvertAllInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const N = rng.pick([3, 4, 5, 6]);
  const r = N; // start all-unconverted for a clean N·H_N story
  const value = convertAllEV(N, r);
  const dp = gradeDp(value, 3);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(N),
    `That's just N draws. Each successive conversion gets harder (a smaller target set), so the waits are ${N}/${N} + ${N}/${N - 1} + … + ${N}/1.`,
  );
  push(
    F(N * r),
    `You used N geometric waits of length N each (N·r). But only the LAST conversion has probability 1/N; earlier ones are easier.`,
  );
  push(
    harmonic(r),
    `That's the harmonic number H_${r} alone. Each wait is N/(remaining), so multiply by N: E = N·H_${r}.`,
  );

  const prompt =
    `An urn holds ${N} orbs, all initially the wrong color. Each turn you pick one orb uniformly at random and recolor it to the target color (already-correct orbs can be re-picked and stay correct). ` +
    `What is the expected number of turns until all ${N} orbs are the target color? (Round to ${dp} decimals.)`;

  const explanation =
    `When k orbs are still wrong, the chance a turn fixes a new one is k/${N}, a geometric wait of ${N}/k. ` +
    `Summing as k goes ${N}→1: E = ${N}·(1/1 + 1/2 + … + 1/${N}) = ${N}·H_${N} = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `ev-convertall-${N}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Sum of geometrics with shrinking success set (N·H_r)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Expected Value · Coupon-collector variant",
    },
  };
}

/** "Other than K": roll dN until face ≠ K; paid that face. E = mean of the other faces. */
export function buildOtherThanInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const N = rng.pick([8, 10, 12]);
  const excluded = rng.int(1, N);
  // Mean of {1..N} \ {excluded}.
  let sum = 0;
  for (let k = 1; k <= N; k++) if (k !== excluded) sum += k;
  const value = F(sum, N - 1);
  const dp = gradeDp(value, 3);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    dieMean(N),
    `That's the mean of ALL ${N} faces. The paying roll is conditioned on being ≠ ${excluded}, so it's uniform over the OTHER ${N - 1} faces.`,
  );
  push(
    F(sum, N),
    `You summed the ${N - 1} paying faces but divided by ${N} instead of ${N - 1}. Given "not ${excluded}", there are only ${N - 1} equally-likely outcomes.`,
  );

  const prompt =
    `A wheel numbered 1 to ${N} is spun repeatedly; any spin that lands on ${excluded} doesn't count and you spin again, and the first spin that avoids ${excluded} pays you its number in dollars. ` +
    `What is the fair price of one play? (Round to ${dp} decimals.)`;

  const explanation =
    `Rolls of ${excluded} just restart the game, so the paying roll is uniform over the other ${N - 1} faces. ` +
    `Its mean is (${sum})/${N - 1} = ${fracText(value)} ≈ ${decText(value, dp)}. (A memoryless wait doesn't change the conditional distribution of the paying roll.)`;

  return {
    answer,
    numeric: {
      id: `ev-otherthan-${N}-${excluded}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Conditional uniform mean",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Expected Value · EV of a wager",
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  LEVEL 3 — Indicators & linearity of expectation  (numeric)                 */
/* -------------------------------------------------------------------------- */

/** Coupon collector: expected COST to collect all n coupons at `cost` each. */
export function buildCouponInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const n = rng.pick([4, 5, 8, 10, 12]);
  const cost = rng.pick([2, 3, 4]);
  const boxes = couponCollectorAll(n); // n·H_n
  const value = boxes.mul(F(cost));
  const dp = gradeDp(value, 3);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(n * cost),
    `That's n boxes at ${money(F(cost), 0)} — as if each new coupon took exactly one box. Later coupons are rarer, so E[boxes] = n·H_n, not n.`,
  );
  push(
    couponCollectorPartial(n, n - 1).mul(F(cost)),
    `You dropped the final coupon's term. The LAST coupon has probability 1/n, so it alone costs n boxes on average — the single biggest term.`,
  );
  push(
    boxes,
    `That's the expected number of BOXES (${fracText(boxes)}); the question asks for the total COST, so multiply by ${money(F(cost), 0)}.`,
  );

  const prompt =
    `A trading-card line has ${n} distinct cards, and every ${money(F(cost), 0)} pack contains one card chosen uniformly at random. ` +
    `What total amount should you expect to spend on packs before you own all ${n} distinct cards? (Round to ${dp} decimals.)`;

  const explanation =
    `With k distinct coupons held, the wait for a new one is geometric with mean ${n}/(${n}−k). ` +
    `Summing: E[boxes] = ${n}·(1/${n} + 1/${n - 1} + … + 1/1) = ${n}·H_${n} = ${fracText(boxes)}. Cost = ${fracText(boxes)}·${money(F(cost), 0)} = ${money(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `ev-coupon-${n}-${cost}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Coupon collector (n·H_n)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Expected Value · Coupon collector",
    },
  };
}

/** Distinct types seen after m draws from n types: n·(1 − ((n−1)/n)^m). */
export function buildDistinctInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const n = rng.pick([5, 6, 8, 12]);
  const m = rng.int(3, n + 2);
  const value = expectedDistinctAfterDraws(n, m);
  const dp = gradeDp(value, 3);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(Math.min(m, n)),
    `That assumes every draw is a NEW type (min(m, n)). Repeats are likely, so the expected distinct count is strictly below that.`,
  );
  push(
    F(n),
    `That's all ${n} types. With only ${m} draws you won't usually see them all.`,
  );
  push(
    F(m).mul(F(1, n)).mul(F(n)),
    `You used E = m (m draws × 1 each) — ignoring collisions. Use indicators: each type is present w.p. 1 − ((n−1)/n)^m.`,
  );

  const prompt =
    `Each spin of a prize wheel stops on one of ${n} equally likely symbols, independently across spins. After ${m} spins, ` +
    `how many DIFFERENT symbols should you expect to have seen? (Round to ${dp} decimals.)`;

  const explanation =
    `By indicators + linearity, each color appears with probability 1 − ((${n}−1)/${n})^${m}. ` +
    `Summing over ${n} colors: E = ${n}·(1 − (${n - 1}/${n})^${m}) = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `ev-distinct-${n}-${m}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Indicators + linearity (distinct count)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Expected Value · Indicators & linearity",
    },
  };
}

/** Expected number of records (running maxima) among n distinct values = H_n. */
export function buildRecordsInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const n = rng.pick([5, 6, 7, 9, 11]);
  const value = expectedRecords(n); // H_n
  const dp = gradeDp(value, 3);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(n),
    `That's all ${n} items. Only the running maxima count; item k is a record w.p. 1/k, so E = H_${n}, far below ${n}.`,
  );
  push(
    F(1),
    `Only the first item is a GUARANTEED record; the rest are records with probability 1/k. Add them: 1 + 1/2 + … + 1/${n}.`,
  );
  push(
    F(n, 2),
    `Half of ${n} is a guess. The exact count is the harmonic number H_${n} = Σ 1/k.`,
  );

  const prompt =
    `You read off ${n} distinct random numbers one at a time. You shout "record!" each time the current number beats every number read before it. ` +
    `How many times should you expect to shout? (Round to ${dp} decimals.)`;

  const explanation =
    `Plant k is a running maximum iff it's the tallest of the first k — probability 1/k (all orders equally likely). ` +
    `By linearity E = 1 + 1/2 + … + 1/${n} = H_${n} = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `ev-records-${n}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Records / harmonic sum (H_n)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Expected Value · Records / harmonic",
    },
  };
}

/** Empty boxes: K balls into B boxes; E[empty] = B·((B−1)/B)^K. */
export function buildEmptyBoxesInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const B = rng.pick([5, 6, 8, 10, 20]);
  const K = rng.int(B, 2 * B);
  const value = F(B).mul(F(B - 1, B).pow(K));
  const dp = gradeDp(value, 3);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(Math.max(B - K, 0)),
    `That's B − K, as if each ball filled a distinct box. Balls collide, so many boxes get 2+ and others stay empty; use P(empty) = ((B−1)/B)^K.`,
  );
  push(
    F(B).mul(F(1, B).pow(K)),
    `You used P(box empty) = (1/B)^K (the chance ALL balls hit one box), instead of ((B−1)/B)^K (the chance a ball MISSES this box, every time).`,
  );

  const prompt =
    `Each of ${K} letters is dropped at random into one of ${B} pigeonholes, independently and uniformly. ` +
    `Once all ${K} are placed, how many pigeonholes do you expect to be left empty? (Round to ${dp} decimals.)`;

  const explanation =
    `A given box is missed by one ball w.p. (${B}−1)/${B}, and by all ${K} balls w.p. (${B - 1}/${B})^${K}. ` +
    `By linearity over ${B} boxes: E[empty] = ${B}·(${B - 1}/${B})^${K} = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `ev-emptyboxes-${B}-${K}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Indicators + linearity (empty boxes)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Expected Value · Indicators & linearity",
    },
  };
}

/** First-marker spacing: E[cards to the first of c markers in a deck of D] = (D+1)/(c+1). */
export function buildFirstMarkerInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const D = rng.pick([40, 48, 52, 30]);
  const c = rng.pick([2, 3, 4, 5]);
  const value = firstMarkerSpacingEV(D, c); // (D+1)/(c+1)
  const dp = gradeDp(value, 3);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(D - c, c + 1),
    `That's the expected size of one GAP between markers, (D−c)/(c+1). You still have to turn the marker itself, so add 1: (D+1)/(c+1).`,
  );
  push(
    F(D, c),
    `You split D cards into c blocks (D/c). The c markers create c+1 gaps, and you must add the marker you land on.`,
  );

  const prompt =
    `A shuffled deck of ${D} cards contains ${c} special "marker" cards. You turn cards one at a time. ` +
    `What is the expected number of cards turned over to reach the FIRST marker? (Round to ${dp} decimals.)`;

  const explanation =
    `The ${c} markers split the ${D - c} non-markers into ${c + 1} equal expected gaps of (${D}−${c})/(${c}+1) each. ` +
    `Reaching the first marker means crossing one gap and turning the marker: E = (${D}−${c})/(${c}+1) + 1 = (${D}+1)/(${c}+1) = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `ev-firstmarker-${D}-${c}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Symmetric spacings ((D+1)/(c+1))",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Expected Value · Symmetry / spacings",
    },
  };
}

/** Warming spells: find n so E[#increasing windows of length w] = target = 2. */
export function buildWarmingSpellsInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const w = rng.pick([4, 5]);
  const target = rng.pick([2, 3]);
  const factorial = fact(w);
  const n = target * factorial + (w - 1); // (n − (w−1))/w! = target
  const answer = n;

  const { errors, push } = numericErrors(answer, 0);
  push(
    F(target * factorial),
    `You solved (n)/w! = target and forgot the boundary. There are n − (w−1) windows of length ${w}, so n = target·${w}! + (${w}−1).`,
  );
  push(
    F(target * factorial + w),
    `Off by one on the window count: a length-${w} window starting at day i needs days up to i+${w}−1, giving n − ${w - 1} windows, not n − ${w}.`,
  );

  const prompt =
    `A stock's daily closing prices over n days are i.i.d. draws from a continuous distribution. Call it a "rally" when ${w} closes in a row each beat the one before (positions i, i+1, …, i+${w - 1}). ` +
    `For which n does the expected number of rallies come out to exactly ${target}?`;

  const explanation =
    `Any ${w} specific readings are strictly increasing w.p. 1/${w}! = 1/${factorial}. There are n − ${w - 1} length-${w} windows, so ` +
    `E = (n − ${w - 1})/${factorial}. Setting (n − ${w - 1})/${factorial} = ${target} gives n = ${target}·${factorial} + ${w - 1} = ${answer}.`;

  return {
    answer,
    numeric: {
      id: `ev-warming-${w}-${target}`,
      prompt,
      answer,
      difficulty,
      concept: "Indicators over overlapping windows (solve for n)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Expected Value · Indicators & linearity",
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  LEVEL 7 — Conditional expectation & geometric probability  (numeric)       */
/* -------------------------------------------------------------------------- */

/** Faster-sixes conditional geometric: E[A | A < B] = 1/(1 − q²), q = 1 − p. */
export function buildConditionalGeoInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const M = rng.pick([2, 4, 5, 6]); // p = 1/M
  const p = F(1, M);
  const q = F(1).sub(p);
  const value = F(1).div(F(1).sub(q.pow(2))); // 1/(1 − q²)
  const dp = gradeDp(value, 3);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(1).div(p),
    `That's the UNconditional geometric mean 1/p = ${fracText(F(1).div(p))}. Conditioning on "A finished first" makes A's count smaller than average.`,
  );
  push(
    F(1).div(F(1).sub(q)),
    `That's 1/(1 − q) = 1/p again. The conditioning uses 1 − q² (both players' first-round survival), not 1 − q.`,
  );

  const prompt =
    `Amara and Bilal each toss their own biased coin, landing heads with probability ${fracText(p)} on any toss, and each keeps tossing until they get their first heads (independently of each other). ` +
    `Conditioned on Amara reaching heads in strictly fewer tosses than Bilal, how many tosses did Amara make on average? (Round to ${dp} decimals.)`;

  const explanation =
    `With q = 1 − p = ${fracText(q)}: P(A < B) = pq/(1 − q²) and E[A·1{A<B}] = pq/(1 − q²)². Dividing, ` +
    `E[A | A < B] = 1/(1 − q²) = ${fracText(value)} ≈ ${decText(value, dp)}. Winning the race shortens A's expected count below the plain 1/p = ${fracText(F(1).div(p))}.`;

  return {
    answer,
    numeric: {
      id: `ev-condgeo-${M}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Conditional expectation of a geometric race",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Expected Value · Conditional expectation / geometric",
    },
  };
}

/** Overlap of two uniform-start windows over a horizon D. */
export function buildOverlapInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const D = rng.pick([20, 24, 30, 40]);
  const a = rng.int(6, Math.floor(D / 2));
  const b = rng.int(6, Math.floor(D / 2));
  const value = overlapProbTwoWindows(F(D), F(a), F(b));
  const dp = gradeDp(value, 3);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(a + b, D),
    `You added the two durations over the horizon ((a+b)/D). Overlap is a 2-D area question on the D×D square, not a 1-D ratio.`,
  );
  push(
    F(1).sub(F(D - a, D).mul(F(D - b, D))),
    `You multiplied the two "no-slack" probabilities as if the non-overlap regions were independent. They're two triangles: P = 1 − ((D−a)² + (D−b)²)/(2D²).`,
  );

  const prompt =
    `Two events each start at a uniformly random time in [0, ${D}] days (independently). The first lasts ${a} days, the second lasts ${b} days. ` +
    `What is the probability their active windows overlap at some point? (Round to ${dp} decimals.)`;

  const explanation =
    `Plot the two start times in a ${D}×${D} square. They MISS if one finishes before the other starts — two right triangles of legs (${D}−${a}) and (${D}−${b}). ` +
    `P(overlap) = 1 − ((${D}−${a})² + (${D}−${b})²)/(2·${D}²) = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `ev-overlap-${D}-${a}-${b}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Geometric probability (area / overlap)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Expected Value · Geometric probability (area)",
    },
  };
}

/** Meet-within: X,Y ~ Uniform(0,L); P(|X−Y| ≤ t) = 1 − ((L−t)/L)². */
export function buildMeetWithinInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const L = rng.pick([30, 60, 20, 15]);
  const t = rng.int(3, Math.floor(L / 2));
  const value = meetWithinProb(F(L), F(t));
  const dp = gradeDp(value, 3);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(t, L),
    `That's the 1-D guess t/L. The event |X−Y| ≤ t is a diagonal BAND in the L×L square; its area is 1 − ((L−t)/L)².`,
  );
  push(
    F(2 * t, L),
    `You used 2t/L (band width over L). The correct area subtracts the two corner triangles: 1 − ((L−t)/L)².`,
  );
  push(
    F(t, L).pow(2),
    `That's (t/L)² — the area of a small square, not the diagonal band. The band's complement is two triangles of leg (L−t).`,
  );

  const prompt =
    `Two friends each arrive at a uniformly random time within a ${L}-minute window (independently) and wait ${t} minutes for the other. ` +
    `What is the probability they meet? (Round to ${dp} decimals.)`;

  const explanation =
    `They meet iff |X − Y| ≤ ${t}. On the ${L}×${L} square of arrival times, the "miss" region is two triangles of leg (${L}−${t}), area (${L}−${t})². ` +
    `So P(meet) = 1 − ((${L}−${t})/${L})² = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `ev-meet-${L}-${t}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Geometric probability (meeting problem)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Expected Value · Geometric probability (area)",
    },
  };
}

/** E[max of `d` fair dN] via P(max ≥ k). */
export function buildMaxDiceInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const N = rng.pick([6, 8, 10]);
  const d = rng.pick([2, 3]);
  const value = maxOfDiceEV(N, d);
  const dp = gradeDp(value, 3);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    dieMean(N),
    `That's the mean of ONE die, ${fracText(dieMean(N))}. The maximum of ${d} dice is biased upward — strictly above a single die's mean.`,
  );
  push(
    F(N),
    `That's the top face ${N}. You only get the max face when every die is high; on average the max is below ${N}.`,
  );

  const prompt =
    `You roll ${d} fair ${N}-sided dice and keep the HIGHEST value shown. ` +
    `What is the expected value of that maximum? (Round to ${dp} decimals.)`;

  const explanation =
    `Use the tail sum E[max] = Σ_{k=1}^{${N}} P(max ≥ k) = Σ_{k=1}^{${N}} (1 − ((k−1)/${N})^${d}) = ${fracText(value)} ≈ ${decText(value, dp)}. ` +
    `Taking the best of ${d} rolls beats a single die's mean of ${fracText(dieMean(N))}.`;

  return {
    answer,
    numeric: {
      id: `ev-maxdice-${N}-${d}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Order statistics (max of dice)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Expected Value · Order statistics",
    },
  };
}

/** E[k-th smallest of n i.i.d. Uniform(0,1)] = k/(n+1). */
export function buildUniformSpacingInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const n = rng.pick([3, 4, 5, 7, 9]);
  const k = rng.int(1, n);
  const value = uniformOrderStatEV(k, n); // k/(n+1)
  const dp = gradeDp(value, 3);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(k, n),
    `That's k/n — dividing by the number of points. The n points create n+1 equal expected gaps, so the k-th is at k/(n+1).`,
  );
  push(
    F(k - 1, n),
    `Off by one in the numerator. The k-th smallest sits at k/(n+1), not (k−1)/n.`,
  );

  const prompt =
    `${n} points are dropped independently and uniformly on the interval [0, 1]. ` +
    `What is the expected position of the ${ordinal(k)}-smallest point? (Round to ${dp} decimals.)`;

  const explanation =
    `The ${n} points split [0, 1] into ${n + 1} gaps whose expected lengths are all equal to 1/(${n}+1). ` +
    `The ${ordinal(k)}-smallest point sits after ${k} such gaps: E = ${k}/(${n}+1) = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `ev-unifspacing-${n}-${k}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Continuous order statistics (k/(n+1))",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Expected Value · Order statistics / spacings",
    },
  };
}

/* ========================================================================== */
/* ============================  QUIZ FAMILIES  ============================== */
/* ========================================================================== */

/* -------------------------------------------------------------------------- */
/*  LEVEL 4 — Elementary & combinatorial probability  (quiz)                   */
/* -------------------------------------------------------------------------- */

/** THE 1/N vs 1/N² trap: P(second roll matches the first) = 1/N. */
export function buildTwoDiceMatchInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  const N = rng.pick([4, 8, 10, 12, 20]);
  const correctF = twoDiceMatchProb(N); // 1/N
  const answer = fracText(correctF);

  const correct: Choice = {
    text: fracText(correctF),
    rationale: `Correct — the first roll can be anything; the second matches it with probability 1/${N}.`,
  };
  const distractors: Choice[] = [
    {
      text: fracText(F(1, N * N)),
      rationale: `The classic 1/${N}² trap: you fixed BOTH dice to a specific value. But the first roll is free — only the second needs to match, so it's 1/${N}.`,
    },
    {
      text: fracText(F(2, N)),
      rationale: `You doubled the probability. There's exactly one matching face out of ${N}, giving 1/${N}.`,
    },
    {
      text: fracText(F(1, N - 1)),
      rationale: `You divided by ${N}−1 (the "other" faces). All ${N} faces are possible for the second roll, so it's 1/${N}.`,
    },
  ];

  const prompt =
    `A fair ${N}-sided die is thrown, and then thrown a second time. How likely is it that the two throws come up as the SAME number?`;
  const explanation =
    `The first roll sets the target — any value works. The second roll then matches it with probability 1/${N}. ` +
    `The tempting 1/${N}² is the probability of a SPECIFIC pair (e.g. two 3s); here we don't care WHICH value repeats, so the answer is 1/${N}.`;

  return {
    answer,
    question: {
      id: `ev-match-${N}`,
      prompt,
      explanation,
      difficulty,
      concept: "Elementary probability (1/N vs 1/N² trap)",
      source: "Expected Value · Elementary probability",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

/** P(second roll DIFFERS from the first) = (N−1)/N (complement). */
export function buildDifferInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  const N = rng.pick([4, 8, 10, 12, 20]);
  const correctF = F(N - 1, N);
  const answer = fracText(correctF);

  const correct: Choice = {
    text: fracText(correctF),
    rationale: `Correct — P(match) = 1/${N}, so P(differ) = 1 − 1/${N} = ${N - 1}/${N}.`,
  };
  const distractors: Choice[] = [
    {
      text: fracText(F(1, N)),
      rationale: `That's P(the rolls MATCH). The question asks for the complement, differ: 1 − 1/${N}.`,
    },
    {
      text: fracText(F(N - 1, N * N)),
      rationale: `You counted (${N}−1) favorable pairs over ${N}² ordered pairs but the first roll is free — divide the ${N}−1 "different" second-roll faces by ${N}.`,
    },
    {
      text: fracText(F(1, 2)),
      rationale: `A coin-flip guess. There are ${N}−1 differing faces out of ${N}, which is ${N - 1}/${N}, not ½.`,
    },
  ];

  const prompt =
    `A fair ${N}-sided die is thrown a first and a second time. How likely are the two results to disagree — that is, to be unequal?`;
  const explanation =
    `Easiest via the complement: the rolls match w.p. 1/${N}, so they differ w.p. 1 − 1/${N} = ${N - 1}/${N}.`;

  return {
    answer,
    question: {
      id: `ev-differ-${N}`,
      prompt,
      explanation,
      difficulty,
      concept: "Complement (differ = 1 − match)",
      source: "Expected Value · Elementary probability",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

/** P(n fair coin flips all show the same face) = 1/2^(n−1). */
export function buildAllSameCoinsInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  const n = rng.pick([2, 4, 5, 6]);
  const correctF = allSameCoinsProb(n); // 1/2^(n-1)
  const answer = fracText(correctF);

  const correct: Choice = {
    text: fracText(correctF),
    rationale: `Correct — there are 2 all-same sequences (all-H, all-T) out of 2^${n}, so 2/2^${n} = 1/2^${n - 1}.`,
  };
  const distractors: Choice[] = [
    {
      text: fracText(F(1, 2 ** n)),
      rationale: `You counted only ONE all-same sequence. There are TWO (all heads AND all tails), so double it: 1/2^${n - 1}.`,
    },
    {
      text: fracText(F(1, 2)),
      rationale: `That's the chance a single flip is heads. All ${n} flips agreeing is much rarer: 1/2^${n - 1}.`,
    },
    {
      text: fracText(F(1, 2 ** (n + 1))),
      rationale: `Too small — you over-counted the flips. Only ${n}−1 "extra" flips must match the first, giving 1/2^${n - 1}.`,
    },
  ];

  const prompt =
    `A fair coin is tossed ${n} times in a row. What is the chance that every toss lands on the same side — either all heads or all tails?`;
  const explanation =
    `Fix the first flip; the remaining ${n - 1} must all match it: (1/2)^${n - 1}. Equivalently, 2 favorable sequences (all-H, all-T) out of 2^${n} = 1/2^${n - 1}.`;

  return {
    answer,
    question: {
      id: `ev-allsame-${n}`,
      prompt,
      explanation,
      difficulty,
      concept: "Elementary probability (all-same coins)",
      source: "Expected Value · Elementary probability",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

/** Three-dice payoff EV: all-same +a, exactly-two-same +b, all-different −c. */
export function buildThreeDicePayoffInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  const a = rng.pick([11, 13, 15, 20]);
  const b = rng.pick([8, 11, 13]);
  const c = rng.pick([3, 5, 6]);
  // Counts out of 216 (three d6): all same 6, exactly two same 90, all diff 120.
  const ev = F(6 * a + 90 * b - 120 * c, 216);
  const dp = 2;
  const answer = decText(ev, dp);

  const unweighted = F(a + b - c, 3);
  const positiveOnly = F(6 * a + 90 * b, 216);

  const correct: Choice = {
    text: decText(ev, dp),
    rationale: `Correct — weight by P(all same)=6/216, P(two same)=90/216, P(all diff)=120/216: (6·${a}+90·${b}−120·${c})/216.`,
  };
  const distractors: Choice[] = [
    {
      text: decText(unweighted, dp),
      rationale: `You averaged the three payoffs equally. The outcomes are NOT equally likely — "exactly two same" (90/216) dominates.`,
    },
    {
      text: decText(positiveOnly, dp),
      rationale: `You ignored the all-different LOSS. The −${c} outcome happens 120/216 of the time and must be subtracted.`,
    },
    {
      text: decText(F(a), dp),
      rationale: `That's the best-case payoff (all three same). It only happens 6/216 of the time, so the expected value is far lower.`,
    },
  ];

  const prompt =
    `Three fair dice are tossed together. A triple (all three equal) pays $${a}; exactly one matching pair pays $${b}; three distinct faces costs you $${c}. ` +
    `What is the expected result of a single toss (to ${dp} decimals)?`;
  const explanation =
    `Out of 216 outcomes: all same = 6, exactly two same = 90, all different = 120. ` +
    `E = (6·${a} + 90·${b} − 120·${c})/216 = ${fracText(ev)} ≈ ${decText(ev, dp)}.`;

  return {
    answer,
    question: {
      id: `ev-3dice-${a}-${b}-${c}`,
      prompt,
      explanation,
      difficulty,
      concept: "EV over dice outcomes (weight by probability)",
      source: "Expected Value · EV of a wager",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

/** E[higher of two dN if they differ, else 0]. */
export function buildHigherDifferInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  const N = rng.pick([8, 10, 12]);
  const ev = higherWhenDifferEV(N);
  const dp = 2;
  const answer = decText(ev, dp);
  const fullMax = maxOfDiceEV(N, 2); // E[max] without the "else 0"

  const correct: Choice = {
    text: decText(ev, dp),
    rationale: `Correct — sum max(x,y) over the ${N}²−${N} unequal ordered pairs, divide by ${N}²: ${fracText(ev)}.`,
  };
  const distractors: Choice[] = [
    {
      text: decText(fullMax, dp),
      rationale: `That's E[max of two dice] WITHOUT the "else 0" rule. Ties pay 0 here, which pulls the expectation down.`,
    },
    {
      text: decText(dieMean(N), dp),
      rationale: `That's a single die's mean, ${fracText(dieMean(N))}. Paying the HIGHER of two rolls skews the payoff upward (before the tie penalty).`,
    },
    {
      text: decText(F(N), dp),
      rationale: `That's the top face. You rarely roll the maximum, and ties pay nothing.`,
    },
  ];

  const prompt =
    `A fair ${N}-sided die is thrown two times. When the two faces are unequal you win the larger of them in dollars; if they tie you win nothing. ` +
    `What is the expected amount won (to ${dp} decimals)?`;
  const explanation =
    `Over all ${N}² ordered pairs, sum the higher value on the ${N}²−${N} unequal pairs (equal pairs contribute 0) and divide by ${N}²: ` +
    `E = ${fracText(ev)} ≈ ${decText(ev, dp)}. Dropping the "else 0" would overstate it as E[max] = ${decText(fullMax, dp)}.`;

  return {
    answer,
    question: {
      id: `ev-higherdiffer-${N}`,
      prompt,
      explanation,
      difficulty,
      concept: "Conditional EV over max of two dice",
      source: "Expected Value · Conditional expectation",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  LEVEL 5 — Distributions, variance & CLT  (quiz)                            */
/* -------------------------------------------------------------------------- */

/** E[H·(n−H)] for H ~ Binomial(n, ½) = n(n−1)/4. */
export function buildHeadsTimesTailsInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  const n = rng.pick([16, 24, 36, 60]);
  const correct = F(n * (n - 1), 4); // integer
  const answer = String(correct.valueOf());

  const naiveProduct = F(n * n, 4); // E[H]·E[T] = (n/2)²
  const correctC: Choice = {
    text: String(correct.valueOf()),
    rationale: `Correct — E[H(n−H)] = nE[H] − E[H²] = ${n}·${n / 2} − ${n * n / 4 + n / 4} = n(n−1)/4.`,
  };
  const distractors: Choice[] = [
    {
      text: String(naiveProduct.valueOf()),
      rationale: `You used E[H]·E[T] = (n/2)². But E[H·T] ≠ E[H]·E[T] — H and T are perfectly dependent (T = n − H), so you must use E[H²] = Var + mean².`,
    },
    {
      text: String(F(n * (n - 1), 2).valueOf()),
      rationale: `Off by a factor of 2 — you forgot to divide the pair count correctly. The variance of a fair binomial is n/4, giving n(n−1)/4.`,
    },
    {
      text: String(F(n * n, 2).valueOf()),
      rationale: `That's n²/2, far too large. The product of heads and tails maxes near n²/4 and averages n(n−1)/4.`,
    },
  ];

  const prompt =
    `A jar holds ${n} fair coins. You shake it, tip every coin out at once, and your score is the count of heads multiplied by the count of tails. On average, what score should you expect?`;
  const explanation =
    `Let H be the head count, so tails = ${n} − H and the product is H(${n} − H) = ${n}H − H². ` +
    `E[H] = ${n / 2}, Var(H) = ${n}/4, so E[H²] = Var + mean² = ${n / 4} + ${(n / 2) ** 2} = ${n * n / 4 + n / 4}. ` +
    `E = ${n}·${n / 2} − ${n * n / 4 + n / 4} = ${correct.valueOf()} = n(n−1)/4.`;

  return {
    answer,
    question: {
      id: `ev-headstails-${n}`,
      prompt,
      explanation,
      difficulty,
      concept: "Variance / E[X²] (dependent product)",
      source: "Expected Value · Variance / E[X²]",
      ...assembleChoices(rng, correctC, distractors),
    },
  };
}

/** E[X²] of a fair dN = (N+1)(2N+1)/6. */
export function buildSecondMomentInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  const N = rng.pick([4, 6, 8, 10, 12]);
  const ev = dieSecondMoment(N);
  const dp = 2;
  const answer = decText(ev, dp);

  const meanSq = dieMean(N).pow(2); // (E[X])²
  const correct: Choice = {
    text: decText(ev, dp),
    rationale: `Correct — E[X²] = (N+1)(2N+1)/6 = ${fracText(ev)}.`,
  };
  const distractors: Choice[] = [
    {
      text: decText(meanSq, dp),
      rationale: `You squared the MEAN, (E[X])² = ${fracText(meanSq)}. E[X²] = Var(X) + (E[X])² is strictly larger.`,
    },
    {
      text: decText(dieVariance(N), dp),
      rationale: `That's Var(X) = ${fracText(dieVariance(N))}. E[X²] is Var PLUS the squared mean, not the variance alone.`,
    },
    {
      text: decText(dieMean(N), dp),
      rationale: `That's E[X] = ${fracText(dieMean(N))}, the first moment. You want the SECOND moment E[X²].`,
    },
  ];

  const prompt = `A fair ${N}-sided die shows X. What is E[X²] (to ${dp} decimals)?`;
  const explanation =
    `Directly, E[X²] = (1² + 2² + … + ${N}²)/${N} = (N+1)(2N+1)/6 = ${fracText(ev)} ≈ ${decText(ev, dp)}. ` +
    `Note E[X²] = Var(X) + (E[X])² = ${fracText(dieVariance(N))} + ${fracText(meanSq)}.`;

  return {
    answer,
    question: {
      id: `ev-2ndmoment-${N}`,
      prompt,
      explanation,
      difficulty,
      concept: "Second moment E[X²]",
      source: "Expected Value · Variance / E[X²]",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

/** E[X²] of an Exponential(λ) = 2/λ². */
export function buildExpMomentInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  const lambda = rng.pick([2, 3, 4, 5]);
  const ev = F(2, lambda * lambda);
  const dp = 3;
  const answer = decText(ev, dp);

  const correct: Choice = {
    text: decText(ev, dp),
    rationale: `Correct — for Exp(λ), E[X²] = 2/λ² = 2/${lambda * lambda}.`,
  };
  const distractors: Choice[] = [
    {
      text: decText(F(1, lambda * lambda), dp),
      rationale: `That's (E[X])² = 1/λ². You forgot the factor 2: E[X²] = Var + mean² = 1/λ² + 1/λ² = 2/λ².`,
    },
    {
      text: decText(F(1, lambda), dp),
      rationale: `That's the MEAN 1/λ. The second moment E[X²] = 2/λ² is different.`,
    },
    {
      text: decText(F(2, lambda), dp),
      rationale: `That's 2/λ. The exponent on λ should be 2: E[X²] = 2/λ².`,
    },
  ];

  const prompt = `Let X ~ Exponential(rate λ = ${lambda}). What is E[X²] (to ${dp} decimals)?`;
  const explanation =
    `For an exponential, E[X] = 1/λ and Var(X) = 1/λ², so E[X²] = Var + mean² = 1/λ² + 1/λ² = 2/λ² = 2/${lambda * lambda} = ${decText(ev, dp)}.`;

  return {
    answer,
    question: {
      id: `ev-expmoment-${lambda}`,
      prompt,
      explanation,
      difficulty,
      concept: "Moments of the exponential (2/λ²)",
      source: "Expected Value · Continuous distribution moments",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

/** E[sum of k i.i.d. Uniform(0, L)] = kL/2 (linearity). */
export function buildSumUniformsInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  const k = rng.pick([2, 3, 4]);
  const L = rng.pick([1, 2, 6, 10]);
  const ev = F(k * L, 2);
  const dp = 2;
  const answer = decText(ev, dp);

  const correct: Choice = {
    text: decText(ev, dp),
    rationale: `Correct — each U(0,${L}) has mean ${L}/2; by linearity the sum of ${k} has mean ${k}·${L}/2.`,
  };
  const distractors: Choice[] = [
    {
      text: decText(F(L, 2), dp),
      rationale: `That's the mean of ONE uniform. You forgot to multiply by the ${k} independent draws.`,
    },
    {
      text: decText(F(k * L), dp),
      rationale: `That's k·L — you forgot each uniform averages L/2, not L.`,
    },
    {
      text: decText(F(L), dp),
      rationale: `That's the max of a single draw. The sum of ${k} draws averages ${k}·${L}/2.`,
    },
  ];

  const prompt =
    `You add up ${k} independent Uniform(0, ${L}) random values. What is the expected value of the sum (to ${dp} decimals)?`;
  const explanation =
    `Linearity of expectation: E[sum] = ${k}·E[U] = ${k}·(${L}/2) = ${fracText(ev)} = ${decText(ev, dp)}. (The exact shape of the convolution is irrelevant to the mean.)`;

  return {
    answer,
    question: {
      id: `ev-sumunif-${k}-${L}`,
      prompt,
      explanation,
      difficulty,
      concept: "Continuous convolution / linearity (kL/2)",
      source: "Expected Value · Continuous convolution",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

/** CLT variance addition: Var(D − H) = Var(D) + Var(H) for independent D, H. */
export function buildCltVarianceInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  const { coins, dice, N } = rng.pick([
    { coins: 300, dice: 50, N: 6 },
    { coins: 400, dice: 60, N: 6 },
    { coins: 200, dice: 48, N: 6 },
    { coins: 100, dice: 36, N: 6 },
  ]);
  const varH = F(coins, 4); // Var(Bin(coins, ½)) = coins/4
  const varD = F(dice).mul(dieVariance(N)); // dice · (N²−1)/12
  const total = varD.add(varH);
  const dp = 2;
  const answer = decText(total, dp);

  const correct: Choice = {
    text: decText(total, dp),
    rationale: `Correct — variance ADDS for independent sums, even for a difference: Var(D−H) = Var(D) + Var(H).`,
  };
  const distractors: Choice[] = [
    {
      text: decText(varD.sub(varH).abs(), dp),
      rationale: `You SUBTRACTED the variances because the quantity is a difference. Variance always adds for independent terms: Var(D−H) = Var(D)+Var(H).`,
    },
    {
      text: decText(varD, dp),
      rationale: `That's only the dice variance. You must also add the coin-total variance ${fracText(varH)}.`,
    },
    {
      text: decText(varH, dp),
      rationale: `That's only the coin variance. Add the dice-total variance ${fracText(varD)} too.`,
    },
  ];

  const prompt =
    `A pile of ${coins} fair coins each scores 1 point per head, and ${dice} fair six-sided dice each score their face value. ` +
    `Writing D for the dice score and H for the coin score, and planning a normal (CLT) approximation to D − H, compute Var(D − H) (to ${dp} decimals).`;
  const explanation =
    `Var(H) = ${coins}·(½·½) = ${fracText(varH)}. Var(one die) = (6²−1)/12 = ${fracText(dieVariance(N))}, so Var(D) = ${dice}·${fracText(dieVariance(N))} = ${fracText(varD)}. ` +
    `For INDEPENDENT variables variance adds — including for a difference — so Var(D − H) = ${fracText(varD)} + ${fracText(varH)} = ${fracText(total)} ≈ ${decText(total, dp)}.`;

  return {
    answer,
    question: {
      id: `ev-cltvar-${coins}-${dice}`,
      prompt,
      explanation,
      difficulty,
      concept: "CLT / variance addition",
      source: "Expected Value · Normal approximation / CLT",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  LEVEL 6 — Martingales & random walks  (quiz)                               */
/* -------------------------------------------------------------------------- */

/** Symmetric ±1 walk from i in [0, N]: P(reach N before 0) = i/N. */
export function buildWalkReachInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  const N = rng.pick([10, 20, 50, 100]);
  const i = rng.int(Math.floor(N / 4), Math.floor((3 * N) / 4));
  const correctF = F(i, N);
  const dp = 2;
  const answer = decText(correctF, dp);

  const correct: Choice = {
    text: decText(correctF, dp),
    rationale: `Correct — for a fair walk, P(hit N before 0) = i/N = ${i}/${N} (the martingale/gambler's-ruin result).`,
  };
  const distractors: Choice[] = [
    {
      text: decText(F(N - i, N), dp),
      rationale: `That's P(hit 0 first) = (N−i)/N. The question asks for reaching N, which is i/N.`,
    },
    {
      text: decText(F(1, 2), dp),
      rationale: `A symmetry guess. The walk is fair per step, but starting closer to one end skews the hitting probability to i/N.`,
    },
    {
      text: decText(F(i, N - i), dp),
      rationale: `That's the ODDS i:(N−i) written as a ratio, not a probability. Normalize by the total distance N: i/N.`,
    },
  ];

  const prompt =
    `A token does a symmetric ±1 random walk, starting ${i} steps from one wall and ${N - i} steps from the other (walls at 0 and ${N}). ` +
    `What is the probability it reaches the FAR wall (position ${N}) before returning to 0? (to ${dp} decimals)`;
  const explanation =
    `Position is a martingale, so by optional stopping E[final] = start: P·${N} + (1−P)·0 = ${i}, giving P = ${i}/${N} = ${decText(correctF, dp)}.`;

  return {
    answer,
    question: {
      id: `ev-walkreach-${N}-${i}`,
      prompt,
      explanation,
      difficulty,
      concept: "Martingale / gambler's ruin (reach probability i/N)",
      source: "Expected Value · Martingales / random walks",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

/** Expected duration of a symmetric walk from i in [0, N] = i(N−i). */
export function buildWalkDurationInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  const N = rng.pick([10, 20, 50, 100]);
  const i = rng.int(Math.floor(N / 4), Math.floor((3 * N) / 4));
  const correctN = i * (N - i);
  const answer = String(correctN);

  const correct: Choice = {
    text: String(correctN),
    rationale: `Correct — expected steps to absorption = i·(N−i) = ${i}·${N - i} = ${correctN} (from the martingale Y²−t).`,
  };
  const distractors: Choice[] = [
    {
      text: String(i * N),
      rationale: `You used i·N, dropping the −i. The correct duration is i·(N−i) — steps needed to travel to EITHER wall.`,
    },
    {
      text: String((N - i) * (N - i)),
      rationale: `That's (N−i)² — one distance squared. The symmetric answer is the PRODUCT of the two distances, i·(N−i).`,
    },
    {
      text: String(N),
      rationale: `That's just the width. Expected duration grows quadratically: i·(N−i).`,
    },
  ];

  const prompt =
    `A token does a symmetric ±1 random walk between walls at 0 and ${N}, starting ${i} steps from the low wall. ` +
    `What is the expected number of steps until it hits EITHER wall?`;
  const explanation =
    `Y_t² − t is a martingale, so E[duration] = E[Y_end²] = P·(${N - i})² + (1−P)·${i}² with P = ${i}/${N}. ` +
    `This simplifies to i·(N−i) = ${i}·${N - i} = ${correctN}. The common trap i·N drops the −i term.`;

  return {
    answer,
    question: {
      id: `ev-walkdur-${N}-${i}`,
      prompt,
      explanation,
      difficulty,
      concept: "Optional stopping / walk duration (i(N−i))",
      source: "Expected Value · Martingales / random walks",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

/** Wald: roll dN until same face as previous; pay the sum. E = (1+N)·(N+1)/2. */
export function buildWaldInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  const N = rng.pick([6, 8, 10, 12]);
  const count = F(1 + N); // 1 + 1/p, p = 1/N
  const mean = dieMean(N);
  const ev = waldEV(count, mean);
  const dp = 2;
  const answer = decText(ev, dp);

  const correct: Choice = {
    text: decText(ev, dp),
    rationale: `Correct — E[rolls] = 1 + ${N} = ${1 + N}, mean face ${fracText(mean)}; Wald: E[sum] = ${1 + N}·${fracText(mean)}.`,
  };
  const distractors: Choice[] = [
    {
      text: decText(waldEV(F(N), mean), dp),
      rationale: `You used E[rolls] = ${N} (=1/p). But the FIRST roll can't match anything, so it's 1 + 1/p = ${1 + N} rolls.`,
    },
    {
      text: decText(mean, dp),
      rationale: `That's the average of ONE roll. The game pays the SUM of all rolls — multiply by the expected count via Wald.`,
    },
    {
      text: decText(F(N).mul(F(N)), dp),
      rationale: `You multiplied count by ${N} rather than the mean face ${fracText(mean)}. Wald uses E[value per term], not the number of faces.`,
    },
  ];

  const prompt =
    `You roll a fair ${N}-sided die until a roll matches the immediately preceding roll; the game ends and pays the SUM of every roll made. ` +
    `What is the expected payout (to ${dp} decimals)?`;
  const explanation =
    `The number of rolls is 1 (the first) plus a geometric wait to match it: E[rolls] = 1 + ${N} = ${1 + N}. Each roll averages ${fracText(mean)}. ` +
    `By Wald's identity E[sum] = E[rolls]·E[face] = ${1 + N}·${fracText(mean)} = ${fracText(ev)} ≈ ${decText(ev, dp)}.`;

  return {
    answer,
    question: {
      id: `ev-wald-${N}`,
      prompt,
      explanation,
      difficulty,
      concept: "Wald's identity (E[N]·E[X])",
      source: "Expected Value · Wald's identity",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

/** Martingale doubling: bankroll 2^k − 1, min bet 1; EV of the fair game = 0. */
export function buildMartingaleDoublingInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  const k = rng.pick([5, 6, 8, 9]);
  const bankroll = 2 ** k - 1;
  const answer = "0";

  const correct: Choice = {
    text: "0",
    rationale: `Correct — a fair coin makes every bet zero-EV, and no betting SYSTEM changes that: E = 0.`,
  };
  const distractors: Choice[] = [
    {
      text: "1",
      rationale: `You counted only the WIN path (+$1 with prob ${2 ** k - 1}/${2 ** k}) and ignored the ruin: (1/${2 ** k})·(−${bankroll}) exactly cancels it.`,
    },
    {
      text: String(-bankroll),
      rationale: `That's the loss on the ruin path only (prob 1/${2 ** k}). Weight it against the ${2 ** k - 1}/${2 ** k} chance of +$1 — they sum to 0.`,
    },
    {
      text: String(bankroll),
      rationale: `That's the whole bankroll as if guaranteed profit. Doubling can't beat a fair game; the expected value is 0.`,
    },
  ];

  const prompt =
    `Playing a fair-coin wager, you follow a doubling scheme: after every loss you double the next stake, and you quit the instant you are ahead or run out of money. Your bankroll is $${bankroll} with a $1 opening bet ` +
    `(enough to survive ${k} losses in a row). What is the expected value of this scheme?`;
  const explanation =
    `You either win before ${k} losses (net +$1, probability ${2 ** k - 1}/${2 ** k}) or lose ${k} in a row (net −$${bankroll}, probability 1/${2 ** k}). ` +
    `E = (${2 ** k - 1}/${2 ** k})·(+1) + (1/${2 ** k})·(−${bankroll}) = 0. No staking system beats a fair game.`;

  return {
    answer,
    question: {
      id: `ev-martingale-${k}`,
      prompt,
      explanation,
      difficulty,
      concept: "Martingale betting (fair game EV = 0)",
      source: "Expected Value · Martingale betting",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

/* ========================================================================== */
/* ===============  MCQ → FREE-RESPONSE CONVERSIONS (numeric)  =============== */
/* ========================================================================== */

/**
 * PHASE_2 conversions of the two most clearly-NUMERIC former quiz levels
 * (ev-1 Dice & Coin Foundations, ev-5 Distributions/Variance/CLT) to graded
 * free-response. Each mirrors the geo-1 pattern exactly: the SAME exact solver
 * as the MCQ, a parametric error-mode catalog carrying a machine-readable
 * `misconception` tag + an answer-withholding rung-1 coaching sentence, and a
 * complete rung-5 explanation. The original quiz builders/adapters are kept
 * unchanged (still exported + covered by the round-trip tests). ev-7 (Random
 * Walks & Martingales) stays `quiz`: its martingale-doubling family (EV = 0,
 * "no staking system beats a fair game") and the i·N-vs-i(N−i) duration trap
 * are NAMING-the-misconception teaching points, so the subcategory keeps a quiz
 * level (plus the ev-8 flashcards) alongside the numeric ones.
 */

/* -------------------------------------------------------------------------- */
/*  LEVEL 1 — Dice & coin foundations (numeric conversions)                    */
/* -------------------------------------------------------------------------- */

/** FREE-RESPONSE form of the 1/N vs 1/N² dice-match trap. Answer = 1/N. */
export function buildTwoDiceMatchNumericInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const N = rng.pick([4, 8, 10, 12, 20]);
  const value = twoDiceMatchProb(N); // 1/N
  const dp = gradeDp(value, 4);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(1, N * N),
    `Close — that's the chance of a SPECIFIC ordered pair, as if BOTH dice were pinned to one value. But the first roll here is free; only the second has to match it. So should you fix both faces, or just the second?`,
    "specified_both_faces",
  );
  push(
    F(2, N),
    `You doubled the matching chance. Of the ${N} equally-likely faces the SECOND roll can show, how many actually equal the first?`,
    "doubled_match_prob",
  );
  push(
    F(1, N - 1),
    `You divided by ${N}−1. Is the second roll forbidden from landing on the first roll's face? How many faces are really in its sample space?`,
    "excluded_first_face",
  );

  const prompt =
    `A fair ${N}-sided die is thrown, and then thrown a second time. How likely is it that the two throws come up as the SAME number? (Enter a fraction or decimal.) Round to the nearest thousandth.`;
  const explanation =
    `The first roll sets the target — any value works. The second roll then matches it with probability 1/${N} = ${fracText(value)} ≈ ${decText(value, dp)}. ` +
    `The tempting 1/${N}² is the probability of a SPECIFIC pair (e.g. two 3s); here we don't care WHICH value repeats, so the answer is 1/${N}.`;

  return {
    answer,
    numeric: {
      id: `ev-matchnum-${N}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Elementary probability (1/N vs 1/N² trap)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Expected Value · Elementary probability",
    },
  };
}

/** FREE-RESPONSE form of P(second roll DIFFERS) = (N−1)/N (complement). */
export function buildDifferNumericInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const N = rng.pick([4, 8, 10, 12, 20]);
  const value = F(N - 1, N);
  const dp = gradeDp(value, 4);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(1, N),
    `That's the chance the two rolls MATCH. The question asks for the OPPOSITE — that they differ. What do you do to a probability to get its complement?`,
    MISCONCEPTION.complementConfusion,
  );
  push(
    F(N - 1, N * N),
    `You put the ${N}−1 differing faces over ${N}² ordered pairs. But the first roll is free — over how many equally-likely faces does the SECOND roll range?`,
    "first_roll_not_free",
  );
  push(
    F(1, 2),
    `A 50/50 guess. Of the ${N} faces the second roll could show, how many actually differ from the first?`,
    "even_odds_guess",
  );

  const prompt =
    `A fair ${N}-sided die is thrown a first and a second time. How likely are the two results to disagree — that is, to be unequal? (Enter a fraction or decimal.) Round to the nearest thousandth.`;
  const explanation =
    `Easiest via the complement: the rolls match with probability 1/${N}, so they differ with probability 1 − 1/${N} = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `ev-differnum-${N}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Complement (differ = 1 − match)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Expected Value · Elementary probability",
    },
  };
}

/** FREE-RESPONSE form of P(n fair flips all agree) = 1/2^(n−1). */
export function buildAllSameCoinsNumericInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const n = rng.pick([2, 4, 5, 6]);
  const value = allSameCoinsProb(n); // 1/2^(n-1)
  const dp = gradeDp(value, 4);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(1, 2 ** n),
    `You counted only ONE all-same sequence. How many ways can ALL ${n} flips agree — is it just all-heads, or all-tails too?`,
    "single_all_same_run",
  );
  push(
    F(1, 2),
    `That's the chance a SINGLE flip is heads. Getting all ${n} flips to agree is far rarer — what has to happen on each flip after the first?`,
    "single_flip_prob",
  );
  push(
    F(1, 2 ** (n + 1)),
    `Too small — you charged for an extra flip. Once the first flip lands, how many of the remaining flips must match it?`,
    "overcounted_flips",
  );

  const prompt =
    `A fair coin is tossed ${n} times in a row. What is the chance that every toss lands on the same side — either all heads or all tails? (Enter a fraction or decimal.)`;
  const explanation =
    `Fix the first flip; the remaining ${n - 1} must all match it: (1/2)^${n - 1}. Equivalently, 2 favorable sequences (all-H, all-T) out of 2^${n} = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `ev-allsamenum-${n}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Elementary probability (all-same coins)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Expected Value · Elementary probability",
    },
  };
}

/** FREE-RESPONSE form of the three-dice payoff EV (weight by probability). */
export function buildThreeDicePayoffNumericInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const a = rng.pick([11, 13, 15, 20]);
  const b = rng.pick([8, 11, 13]);
  const c = rng.pick([3, 5, 6]);
  // Counts out of 216 (three d6): all same 6, exactly two same 90, all diff 120.
  const value = F(6 * a + 90 * b - 120 * c, 216);
  const dp = gradeDp(value, 2);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(a + b - c, 3),
    `You averaged the three payoffs equally. Are "all same", "exactly two same", and "all different" equally likely on three dice — or does one dominate?`,
    MISCONCEPTION.equalWeightMixture,
  );
  push(
    F(6 * a + 90 * b, 216),
    `You summed only the winning outcomes. What happens 120/216 of the time, and does it add to or subtract from the total?`,
    "ignored_loss_branch",
  );
  push(
    F(a),
    `That's the best-case payoff (all three equal). How often do three dice actually all match — and should the rare jackpot set the whole expectation?`,
    "best_case_only",
  );

  const prompt =
    `Three fair dice are tossed together. A triple (all three equal) pays $${a}; exactly one matching pair pays $${b}; three distinct faces costs you $${c}. ` +
    `What is the expected result of a single toss? (Enter a fraction or decimal.) Round to the nearest thousandth.`;
  const explanation =
    `Out of 216 outcomes: all same = 6, exactly two same = 90, all different = 120. ` +
    `E = (6·${a} + 90·${b} − 120·${c})/216 = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `ev-3dicenum-${a}-${b}-${c}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "EV over dice outcomes (weight by probability)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Expected Value · EV of a wager",
    },
  };
}

/** FREE-RESPONSE form of E[higher of two dN if they differ, else 0]. */
export function buildHigherDifferNumericInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const N = rng.pick([8, 10, 12]);
  const value = higherWhenDifferEV(N);
  const dp = gradeDp(value, 2);
  const answer = Number(decText(value, dp));
  const fullMax = maxOfDiceEV(N, 2); // E[max] without the "else 0"

  const { errors, push } = numericErrors(answer, dp);
  push(
    fullMax,
    `That's E[max of two dice] WITHOUT the "else 0" rule. What do the tied rolls pay here, and which way does that push the average?`,
    "ignored_tie_zero",
  );
  push(
    dieMean(N),
    `That's a single die's mean. Paying the HIGHER of two rolls skews the payoff which way relative to one die (before the tie penalty)?`,
    "single_die_mean",
  );
  push(
    F(N),
    `That's the top face. How often do you actually roll the maximum, and do the ties pay anything?`,
    "top_face_only",
  );

  const prompt =
    `A fair ${N}-sided die is thrown two times. When the two faces are unequal you win the larger of them in dollars; if they tie you win nothing. ` +
    `What is the expected amount won? (Enter a fraction or decimal.) Round to the nearest thousandth.`;
  const explanation =
    `Over all ${N}² ordered pairs, sum the higher value on the ${N}²−${N} unequal pairs (equal pairs contribute 0) and divide by ${N}²: ` +
    `E = ${fracText(value)} ≈ ${decText(value, dp)}. Dropping the "else 0" would overstate it as E[max] = ${decText(fullMax, dp)}.`;

  return {
    answer,
    numeric: {
      id: `ev-higherdiffernum-${N}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Conditional EV over max of two dice",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Expected Value · Conditional expectation",
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  LEVEL 5 — Distributions, variance & CLT (numeric conversions)              */
/* -------------------------------------------------------------------------- */

/** FREE-RESPONSE form of E[X²] of a fair dN = (N+1)(2N+1)/6. */
export function buildSecondMomentNumericInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const N = rng.pick([4, 6, 8, 10, 12]);
  const value = dieSecondMoment(N);
  const dp = gradeDp(value, 2);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    dieMean(N).pow(2),
    `You squared the MEAN, (E[X])². Recall E[X²] = Var(X) + (E[X])² — is E[X²] bigger or smaller than the mean squared?`,
    "mean_squared_not_second_moment",
  );
  push(
    dieVariance(N),
    `That's Var(X). E[X²] is the variance PLUS something — what term did you leave out?`,
    "variance_not_second_moment",
  );
  push(
    dieMean(N),
    `That's E[X], the FIRST moment. Which power of X are you actually averaging here?`,
    "first_moment_not_second",
  );

  const prompt =
    `A fair ${N}-sided die shows X. What is E[X²]? (Enter a fraction or decimal.) Round to the nearest thousandth.`;
  const explanation =
    `Directly, E[X²] = (1² + 2² + … + ${N}²)/${N} = (N+1)(2N+1)/6 = ${fracText(value)} ≈ ${decText(value, dp)}. ` +
    `Note E[X²] = Var(X) + (E[X])² = ${fracText(dieVariance(N))} + ${fracText(dieMean(N).pow(2))}.`;

  return {
    answer,
    numeric: {
      id: `ev-2ndmomentnum-${N}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Second moment E[X²]",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Expected Value · Variance / E[X²]",
    },
  };
}

/** FREE-RESPONSE form of E[H·(n−H)] for H ~ Binomial(n, ½) = n(n−1)/4. */
export function buildHeadsTimesTailsNumericInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const n = rng.pick([16, 24, 36, 60]);
  const value = F(n * (n - 1), 4); // integer
  const dp = gradeDp(value, 0);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(n * n, 4),
    `You used E[H]·E[T] = (n/2)². But H and T are perfectly dependent (T = n − H) — can you split E[H·T] into E[H]·E[T] when they're linked?`,
    "product_of_means_dependent",
  );
  push(
    F(n * (n - 1), 2),
    `Off by a factor of 2. A fair binomial's variance is n/4, not n/2 — where did the extra factor creep in?`,
    "off_by_factor_two",
  );
  push(
    F(n * n, 2),
    `That's n²/2, far too large. The head×tail product can't exceed about n²/4 — what's its long-run average?`,
    "overscaled_product",
  );

  const prompt =
    `A jar holds ${n} fair coins. You shake it, tip every coin out at once, and your score is the count of heads multiplied by the count of tails. On average, what score should you expect? (Enter a fraction or decimal.)`;
  const explanation =
    `Let H be the head count, so tails = ${n} − H and the product is H(${n} − H) = ${n}H − H². ` +
    `E[H] = ${n / 2}, Var(H) = ${n}/4, so E[H²] = Var + mean² = ${n / 4} + ${(n / 2) ** 2} = ${(n * n) / 4 + n / 4}. ` +
    `E = ${n}·${n / 2} − ${(n * n) / 4 + n / 4} = ${value.valueOf()} = n(n−1)/4.`;

  return {
    answer,
    numeric: {
      id: `ev-headstailsnum-${n}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Variance / E[X²] (dependent product)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Expected Value · Variance / E[X²]",
    },
  };
}

/** FREE-RESPONSE form of E[X²] of an Exponential(λ) = 2/λ². */
export function buildExpMomentNumericInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const lambda = rng.pick([2, 3, 4, 5]);
  const value = F(2, lambda * lambda);
  const dp = gradeDp(value, 3);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(1, lambda * lambda),
    `That's (E[X])² = 1/λ². E[X²] = Var + mean² and for an exponential Var = 1/λ² too — so what factor is missing?`,
    "forgot_factor_two_exp",
  );
  push(
    F(1, lambda),
    `That's the MEAN 1/λ, the first moment. Which power of X are you averaging for the second moment?`,
    "mean_not_second_moment_exp",
  );
  push(
    F(2, lambda),
    `Right numerator, wrong power on λ. For a rate λ, what power does the second moment put on λ?`,
    "wrong_lambda_power",
  );

  const prompt =
    `Let X ~ Exponential(rate λ = ${lambda}). What is E[X²]? (Enter a fraction or decimal.) Round to the nearest thousandth.`;
  const explanation =
    `For an exponential, E[X] = 1/λ and Var(X) = 1/λ², so E[X²] = Var + mean² = 1/λ² + 1/λ² = 2/λ² = 2/${lambda * lambda} = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `ev-expmomentnum-${lambda}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Moments of the exponential (2/λ²)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Expected Value · Continuous distribution moments",
    },
  };
}

/** FREE-RESPONSE form of E[sum of k i.i.d. Uniform(0, L)] = kL/2 (linearity). */
export function buildSumUniformsNumericInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const k = rng.pick([2, 3, 4]);
  const L = rng.pick([1, 2, 6, 10]);
  const value = F(k * L, 2);
  const dp = gradeDp(value, 2);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(L, 2),
    `That's the mean of ONE uniform. How many independent draws are you summing here?`,
    "forgot_multiply_by_count",
  );
  push(
    F(k * L),
    `You treated each uniform's mean as ${L}. Over the interval [0, ${L}], what is a single draw's average?`,
    "uniform_mean_is_full_L",
  );
  push(
    F(L),
    `That's the top of one draw's range. The SUM of ${k} draws averages what, using linearity?`,
    "single_draw_value",
  );

  const prompt =
    `You add up ${k} independent Uniform(0, ${L}) random values. What is the expected value of the sum? (Enter a fraction or decimal.)`;
  const explanation =
    `Linearity of expectation: E[sum] = ${k}·E[U] = ${k}·(${L}/2) = ${fracText(value)} ≈ ${decText(value, dp)}. (The exact shape of the convolution is irrelevant to the mean.)`;

  return {
    answer,
    numeric: {
      id: `ev-sumunifnum-${k}-${L}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Continuous convolution / linearity (kL/2)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Expected Value · Continuous convolution",
    },
  };
}

/** FREE-RESPONSE form of Var(D − H) = Var(D) + Var(H) for independent D, H. */
export function buildCltVarianceNumericInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const { coins, dice, N } = rng.pick([
    { coins: 300, dice: 50, N: 6 },
    { coins: 400, dice: 60, N: 6 },
    { coins: 200, dice: 48, N: 6 },
    { coins: 100, dice: 36, N: 6 },
  ]);
  const varH = F(coins, 4); // Var(Bin(coins, ½)) = coins/4
  const varD = F(dice).mul(dieVariance(N)); // dice · (N²−1)/12
  const value = varD.add(varH);
  const dp = gradeDp(value, 2);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    varD.sub(varH).abs(),
    `You SUBTRACTED the variances because the quantity is a difference. For INDEPENDENT terms, what does variance always do — even for D − H?`,
    "subtracted_variances",
  );
  push(
    varD,
    `That's only the dice variance. Does the coin total contribute any variance to D − H?`,
    "one_variance_only",
  );
  push(
    varH,
    `That's only the coin variance. Does the dice total contribute any variance to D − H?`,
    "other_variance_only",
  );

  const prompt =
    `A pile of ${coins} fair coins each scores 1 point per head, and ${dice} fair six-sided dice each score their face value. ` +
    `Writing D for the dice score and H for the coin score, and planning a normal (CLT) approximation to D − H, compute Var(D − H). (Enter a fraction or decimal.) Round to the nearest thousandth.`;
  const explanation =
    `Var(H) = ${coins}·(½·½) = ${fracText(varH)}. Var(one die) = (6²−1)/12 = ${fracText(dieVariance(N))}, so Var(D) = ${dice}·${fracText(dieVariance(N))} = ${fracText(varD)}. ` +
    `For INDEPENDENT variables variance adds — including for a difference — so Var(D − H) = ${fracText(varD)} + ${fracText(varH)} = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `ev-cltvarnum-${coins}-${dice}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "CLT / variance addition",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Expected Value · Normal approximation / CLT",
    },
  };
}

/* ========================================================================== */
/* ==========================  FLASHCARD FAMILY  ============================= */
/* ========================================================================== */

/* -------------------------------------------------------------------------- */
/*  LEVEL 8 — Divergent EV sentinels & coin-simulation procedures (flashcard)  */
/* -------------------------------------------------------------------------- */

/**
 * Special-case families the pipeline MUST NOT grade as a scalar:
 *   • Divergent EV (St.-Petersburg-type): the answer is "infinite / diverges";
 *     the tempting finite sum (a convergent doubling-prize analog) is the trap.
 *   • Coin-simulation PROCEDURES / formulas (Von Neumann extractor, dyadic
 *     maps, rejection sampling, irrational binary expansion): the answer is a
 *     procedure or formula, not a number to grade.
 * All are freshly-worded scenarios — no verbatim source-dataset text.
 */
export const expectedValueFlashcards: Flashcard[] = [
  {
    id: "ev-fc-divergent-triple",
    prompt:
      "A spinner is split into a 'go' zone (probability 1/3) and a 'stop' zone (probability 2/3). You keep spinning until the first 'stop'; if it lands on spin number n, you collect 3ⁿ dollars. What is the fair price to play this game once?",
    answer:
      "The expected value is INFINITE (the series diverges) — there is no finite fair price.",
    explanation:
      "Stopping on spin n has probability (1/3)^(n−1)·(2/3), and it pays 3ⁿ. Each term contributes 3ⁿ·(1/3)^(n−1)·(2/3) = 3·(2/3) = 2 dollars — a constant. So E = 2 + 2 + 2 + … diverges to +∞. The trap is to treat the shrinking probabilities as if they beat the growing prize: they don't, because prize×probability stays ≥ a positive constant. Contrast a DOUBLING prize 2ⁿ with the same continuation: then each term is 2ⁿ·(1/3)^(n−1)·(2/3) = (2/3)·(2/3)^(n−1), a geometric series summing to a FINITE $2 — that finite number is exactly the tempting wrong answer here. Whenever prize growth × survival probability has ratio ≥ 1, the EV is infinite.",
    difficulty: "medium",
    concept: "Divergent EV (St. Petersburg type)",
    source: "Expected Value · Divergent EV",
  },
  {
    id: "ev-fc-divergent-wheel",
    prompt:
      "Each morning k (k = 1, 2, 3, …) a raffle prints k + 3 tickets and you hold exactly one, so you win that morning with probability 1/(k + 3). You enter every morning until your first win. Let W be the morning of that first win. What is E[W]?",
    answer:
      "E[W] is INFINITE — you win with probability 1, but the expected waiting time diverges.",
    explanation:
      "Use the tail-sum formula E[W] = Σ_{n≥0} P(W > n). Surviving (no win) through morning n has probability (3/4)·(4/5)·…·((n+3)/(n+4)) = 3/(n+4) by telescoping, so P(W > n) = 3/(n+4). Then E[W] = Σ_{n≥0} 3/(n+4), a tail of the harmonic series, which diverges. So although P(W < ∞) = 1 (the product of miss-probabilities → 0, meaning you WILL win eventually), the MEAN wait is infinite. The lesson: 'wins almost surely' and 'finite expected time' are different — a heavy 1/n tail makes the mean blow up even when the event is certain.",
    difficulty: "hard",
    concept: "Divergent EV (harmonic tail)",
    source: "Expected Value · Divergent EV",
  },
  {
    id: "ev-fc-vonneumann",
    prompt:
      "A coin you were handed is bent, so it lands heads with some unknown probability p (0 < p < 1). Using only this coin, how can you reach an unbiased yes/no verdict (each with probability ½), and how many flips will that take on average?",
    answer:
      "Von Neumann trick: flip in pairs; HT → 'yes', TH → 'no', and HH or TT → throw the pair away and repeat. Expected flips = 1/(p(1−p)) (equal to 4 when p = ½).",
    explanation:
      "HT and TH are equally likely — P(HT) = p(1−p) = P(TH) — for ANY bias p, so mapping them to the two verdicts is exactly fair; HH/TT are thrown away and you retry. Each round uses 2 flips and succeeds (produces a verdict) with probability 2p(1−p), so the expected number of rounds is 1/(2p(1−p)) and the expected number of flips is 2/(2p(1−p)) = 1/(p(1−p)). This is a PROCEDURE-plus-formula answer, not a single number — the flip count depends on p (minimized at p = ½, where it is 4).",
    difficulty: "medium",
    concept: "Simulating fairness (Von Neumann extractor)",
    source: "Expected Value · Simulating probabilities with a coin",
  },
  {
    id: "ev-fc-dyadic",
    prompt:
      "You have only a fair coin but need to trigger a rare event with probability exactly 5/16 (otherwise nothing happens). Give a flipping scheme that hits this probability on the nose, and explain why it is exact.",
    answer:
      "Flip the fair coin 4 times (2⁴ = 16 equally-likely sequences); pick any 5 of the sequences to mean 'trigger' and let the remaining 11 mean 'nothing'. That gives probability exactly 5/16.",
    explanation:
      "Four fair flips give 2⁴ = 16 equally-likely length-4 sequences, each with probability 1/16. Assigning exactly 5 of them to 'trigger' yields P(trigger) = 5/16 and the remaining 11 give 11/16 — exact, because 5/16 is dyadic (denominator a power of 2). The same recipe handles any k/2ⁿ target: flip n times and label k of the 2ⁿ outcomes as success. The deliverable is the mapping/procedure, not a graded scalar.",
    difficulty: "easy",
    concept: "Fair coin → dyadic probability",
    source: "Expected Value · Simulating probabilities with a coin",
  },
  {
    id: "ev-fc-rejection",
    prompt:
      "You hold only a fair coin but must make an event occur with probability exactly 2/7. Describe a rejection-sampling scheme using the coin, and work out the expected number of flips until it first fires.",
    answer:
      "2/7 isn't dyadic: flip 3 times (8 sequences), keep 7 and discard 1; within the kept 7, label 2 as 'fire', 5 as 'no'. Expected flips until a fire = 12.",
    explanation:
      "Three fair flips give 8 equally-likely outcomes. Reserve 7 of them as a 'valid round' (discard-and-retry on the 1 leftover); inside a valid round, 2 of the 7 mean 'fire', matching 2/7. Per round of 3 flips, P(fire) = 2/8 = 1/4, so by the geometric distribution the expected number of ROUNDS to a fire is 4, and expected FLIPS = 3·4 = 12. This routes as the construction plus the derived count, not a bare number to grade — the construction is the point.",
    difficulty: "medium",
    concept: "Rejection sampling with a fair coin",
    source: "Expected Value · Simulating probabilities with a coin",
  },
  {
    id: "ev-fc-irrational",
    prompt:
      "Suppose you must make an event occur with an irrational probability — say 1/√2 — using nothing but a fair coin. How would you do it, and what can you say about the number of flips it might require?",
    answer:
      "Write the target in binary, 1/√2 = 0.b₁b₂b₃…₂, and generate bits by flipping: compare the flipped bitstream to the target's bits (Knuth–Yao), stopping as soon as the comparison is decided. It halts with probability 1, but there is NO finite upper bound on the number of flips.",
    explanation:
      "Each fair flip is one bit of a uniform random real U ∈ [0,1). Output 'success' iff U < 1/√2. You reveal bits of U one at a time and compare to the binary expansion of 1/√2: at the first position where they differ you know whether U < target or not and stop. Since the target is irrational its expansion never terminates, so no fixed number of flips always suffices — but the probability of still being undecided after m bits is 2^(−m) → 0, so the procedure terminates almost surely (expected flips is finite, ~2, but unbounded worst case). The deliverable is the procedure and this halting argument, not a single scalar.",
    difficulty: "hard",
    concept: "Simulating an irrational probability (binary expansion)",
    source: "Expected Value · Simulating probabilities with a coin",
  },
];

/* ========================================================================== */
/*  Small arithmetic helpers                                                   */
/* ========================================================================== */

function fact(n: number): number {
  let f = 1;
  for (let k = 2; k <= n; k++) f *= k;
  return f;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/* ========================================================================== */
/*  Named generators (adapters used by the levels + verification tests)        */
/* ========================================================================== */

// Level 1 — Optimal stopping (numeric)
export const genOneReroll = (rng: Rng): NumericQuestion =>
  buildOneRerollInstance(rng, "easy").numeric;
export const genContinuousReroll = (rng: Rng): NumericQuestion =>
  buildContinuousRerollInstance(rng, "medium").numeric;

// Level 2 — Geometric / recursion (numeric)
export const genNegBinomial = (rng: Rng): NumericQuestion =>
  buildNegBinomialInstance(rng, "easy").numeric;
export const genPairSame = (rng: Rng): NumericQuestion =>
  buildPairSameInstance(rng, "medium").numeric;
export const genMemoryless = (rng: Rng): NumericQuestion =>
  buildMemorylessInstance(rng, "easy").numeric;
export const genRunningSum = (rng: Rng): NumericQuestion =>
  buildRunningSumInstance(rng, "medium").numeric;
export const genGeometricSum = (rng: Rng): NumericQuestion =>
  buildGeometricSumInstance(rng, "medium").numeric;
export const genConvertAll = (rng: Rng): NumericQuestion =>
  buildConvertAllInstance(rng, "medium").numeric;
export const genOtherThan = (rng: Rng): NumericQuestion =>
  buildOtherThanInstance(rng, "easy").numeric;

// Level 3 — Indicators & linearity (numeric)
export const genCoupon = (rng: Rng): NumericQuestion =>
  buildCouponInstance(rng, "easy").numeric;
export const genDistinct = (rng: Rng): NumericQuestion =>
  buildDistinctInstance(rng, "medium").numeric;
export const genRecords = (rng: Rng): NumericQuestion =>
  buildRecordsInstance(rng, "easy").numeric;
export const genEmptyBoxes = (rng: Rng): NumericQuestion =>
  buildEmptyBoxesInstance(rng, "medium").numeric;
export const genFirstMarker = (rng: Rng): NumericQuestion =>
  buildFirstMarkerInstance(rng, "easy").numeric;
export const genWarmingSpells = (rng: Rng): NumericQuestion =>
  buildWarmingSpellsInstance(rng, "hard").numeric;

// Level 4 — Elementary & combinatorial (quiz)
export const genTwoDiceMatch = (rng: Rng): Question =>
  buildTwoDiceMatchInstance(rng, "easy").question;
export const genDiffer = (rng: Rng): Question =>
  buildDifferInstance(rng, "easy").question;
export const genAllSameCoins = (rng: Rng): Question =>
  buildAllSameCoinsInstance(rng, "easy").question;
export const genThreeDicePayoff = (rng: Rng): Question =>
  buildThreeDicePayoffInstance(rng, "medium").question;
export const genHigherDiffer = (rng: Rng): Question =>
  buildHigherDifferInstance(rng, "medium").question;

// Level 5 — Distributions, variance & CLT (quiz)
export const genHeadsTimesTails = (rng: Rng): Question =>
  buildHeadsTimesTailsInstance(rng, "medium").question;
export const genSecondMoment = (rng: Rng): Question =>
  buildSecondMomentInstance(rng, "medium").question;
export const genExpMoment = (rng: Rng): Question =>
  buildExpMomentInstance(rng, "medium").question;
export const genSumUniforms = (rng: Rng): Question =>
  buildSumUniformsInstance(rng, "medium").question;
export const genCltVariance = (rng: Rng): Question =>
  buildCltVarianceInstance(rng, "hard").question;

// Level 6 — Martingales & random walks (quiz)
export const genWalkReach = (rng: Rng): Question =>
  buildWalkReachInstance(rng, "medium").question;
export const genWalkDuration = (rng: Rng): Question =>
  buildWalkDurationInstance(rng, "hard").question;
export const genWald = (rng: Rng): Question =>
  buildWaldInstance(rng, "medium").question;
export const genMartingaleDoubling = (rng: Rng): Question =>
  buildMartingaleDoublingInstance(rng, "medium").question;

// Level 7 — Conditional expectation & geometric probability (numeric)
export const genConditionalGeo = (rng: Rng): NumericQuestion =>
  buildConditionalGeoInstance(rng, "hard").numeric;
export const genOverlap = (rng: Rng): NumericQuestion =>
  buildOverlapInstance(rng, "medium").numeric;
export const genMeetWithin = (rng: Rng): NumericQuestion =>
  buildMeetWithinInstance(rng, "medium").numeric;
export const genMaxDice = (rng: Rng): NumericQuestion =>
  buildMaxDiceInstance(rng, "medium").numeric;
export const genUniformSpacing = (rng: Rng): NumericQuestion =>
  buildUniformSpacingInstance(rng, "medium").numeric;

// Level 1 — Dice & coin foundations (numeric, MCQ→free-response conversions)
export const genTwoDiceMatchNumeric = (rng: Rng): NumericQuestion =>
  buildTwoDiceMatchNumericInstance(rng, "easy").numeric;
export const genDifferNumeric = (rng: Rng): NumericQuestion =>
  buildDifferNumericInstance(rng, "easy").numeric;
export const genAllSameCoinsNumeric = (rng: Rng): NumericQuestion =>
  buildAllSameCoinsNumericInstance(rng, "easy").numeric;
export const genThreeDicePayoffNumeric = (rng: Rng): NumericQuestion =>
  buildThreeDicePayoffNumericInstance(rng, "medium").numeric;
export const genHigherDifferNumeric = (rng: Rng): NumericQuestion =>
  buildHigherDifferNumericInstance(rng, "medium").numeric;

// Level 5 — Distributions, variance & CLT (numeric, MCQ→free-response conversions)
export const genSecondMomentNumeric = (rng: Rng): NumericQuestion =>
  buildSecondMomentNumericInstance(rng, "medium").numeric;
export const genHeadsTimesTailsNumeric = (rng: Rng): NumericQuestion =>
  buildHeadsTimesTailsNumericInstance(rng, "medium").numeric;
export const genExpMomentNumeric = (rng: Rng): NumericQuestion =>
  buildExpMomentNumericInstance(rng, "medium").numeric;
export const genSumUniformsNumeric = (rng: Rng): NumericQuestion =>
  buildSumUniformsNumericInstance(rng, "medium").numeric;
export const genCltVarianceNumeric = (rng: Rng): NumericQuestion =>
  buildCltVarianceNumericInstance(rng, "hard").numeric;

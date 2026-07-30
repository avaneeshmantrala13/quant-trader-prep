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
  bayesPosterior,
  bayesInversion,
  bertrandGreenProb,
  bothGivenAtLeastOne,
  allOnGivenAtLeastOne,
  decText,
  diceSumFaceProb,
  exactDecimals,
  fracText,
  lawTotalProb,
  raceProb,
  rrFixedFirstSurvives,
  rrRespunSecondSurvives,
  rrTwoConsecutiveDecision,
  rrTwoRandomDecision,
  secondMoverFirstTossGivenWin,
  tableAboveThresholdProb,
  tieBreakerProb,
  uniformConditional,
} from "./cp";
import { mixNumericGenerators, mixQuestionGenerators } from "../../mixFamilies";
import { MISCONCEPTION } from "@/lib/tutor/misconception";

/**
 * Parametric generators + per-family misconception taxonomy for the
 * Probability & Statistics → Conditional Probability subcategory.
 *
 * Conditional Probability is a CLUSTER of solution-method families, not one
 * template, so generators are grouped by family. Every scalar is produced by the
 * exact rational solver in `./cp.ts`; every distractor (`quiz` choices /
 * `numeric` commonErrors) is a re-derived, NAMED misconception, guaranteed
 * distinct and ≠ the answer.
 *
 * Mode per family (see `./levels.ts`):
 *   • `quiz`      — where NAMING the misconception teaches: reduced-sample-space
 *                   (reversed conditional / ordered-vs-unordered / faces-not-
 *                   objects), Bayes (base-rate neglect / likelihood-as-posterior),
 *                   and the Russian-Roulette decisions.
 *   • `numeric`   — where a clean probability is the point: law of total
 *                   probability, continuous conditioning, and race conditioning.
 *   • `flashcard` — the framing paradoxes whose answer is two-part or a
 *                   decision + probability (Child's Gender, Monty Hall, Bertrand,
 *                   Vacant Room) — never scalar-graded.
 *
 * NONE of the 45 source-dataset questions are user-facing — they live only in
 * `./conditionalProbability.test.ts` as hidden fixtures; every playable item is
 * freshly generated with different names/numbers/framing.
 */

/* ========================================================================== */
/*  Shared helpers                                                             */
/* ========================================================================== */

interface Choice {
  text: string;
  rationale: string;
  /**
   * OPTIONAL machine-readable misconception TAG for this distractor (Phase 2 —
   * COORDINATION §6.2 / §2.4). Kept parallel to `choices` in the emitted
   * `Question.misconceptions`, shuffled in lockstep so the tag always tracks its
   * choice. Drives the hint-ladder confront mapping (`CONFRONT_BY_TAG`). The
   * correct choice carries no tag (empty string placeholder).
   */
  misconception?: string;
}

/**
 * Assemble + shuffle MC choices so the answer position never leaks. Distractors
 * colliding with the correct answer or an earlier option are dropped (choices
 * stay distinct, as `levels.test.ts` enforces); at most 4 options. When any
 * choice carries a misconception tag, a parallel (shuffled) `misconceptions`
 * array is emitted; otherwise the field is omitted so untagged families stay
 * byte-identical.
 */
function assembleChoices(
  rng: Rng,
  correct: Choice,
  distractors: Choice[],
): Pick<Question, "choices" | "correctIndex" | "distractorRationale"> & {
  misconceptions?: string[];
} {
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
  const hasTags = shuffled.some((c) => c.misconception);
  return {
    choices: shuffled.map((c) => c.text),
    correctIndex: order.indexOf(0),
    distractorRationale: shuffled.map((c) => c.rationale),
    ...(hasTags
      ? { misconceptions: shuffled.map((c) => c.misconception ?? "") }
      : {}),
  };
}

/** Deduping accumulator for `numeric` commonErrors (rounded to `dp`, ≠ answer). */
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
    errors.push({ value: rounded, feedback, ...(misconception ? { misconception } : {}) });
  };
  return { errors, push };
}

/** Number of decimals to grade a probability at (exact if terminating, cap 4). */
function gradeDp(f: FractionType, cap = 4): number {
  return Math.max(2, exactDecimals(f, cap));
}

/** Combine several Question generators into one that picks per call (family-tagged). */
export const mixQuiz = (pool: QuestionGenerator[]): QuestionGenerator =>
  mixQuestionGenerators(pool);

/** Combine several numeric generators into one that picks per call (family-tagged). */
export const mixNumeric = (
  pool: NumericQuestionGenerator[],
): NumericQuestionGenerator => mixNumericGenerators(pool);

/* ========================================================================== */
/* =======================  LEVEL 1 — REDUCED SAMPLE SPACE  ================== */
/* ==========================  (quiz — name the mistake)  ==================== */
/* ========================================================================== */

// Scenario entities are deliberately DISTINCT from the source banks (which use
// cafes Downtown/Harbor/Airport/Campus, properties Maple/Oak/Pine/Cedar, and
// regions North/South/East/West) so no proper nouns or metrics are reused.
const TABLE_SCENARIOS = [
  { unit: "food truck", metric: "monthly sales", cols: ["Taco", "Ramen", "Waffle", "Gyro"], rows: ["Jan", "Feb", "Mar", "Apr"] },
  { unit: "boutique", metric: "weekly takings", cols: ["Rose", "Ivy", "Fern", "Lily"], rows: ["Wk1", "Wk2", "Wk3", "Wk4"] },
  { unit: "franchise", metric: "half-year earnings", cols: ["Rigel", "Vega", "Orion", "Lyra"], rows: ["H1", "H2", "H3", "H4"] },
];

/**
 * Reduced-sample-space over a 4×4 money table: one cell is drawn, told it
 * exceeds a threshold; P(it is in the target column). The canonical distractor
 * is the REVERSED conditional: P(above | target) =
 * favorable/4 instead of P(target | above) = favorable/total.
 */
export function buildTableInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  const sc = rng.pick(TABLE_SCENARIOS);
  // Thresholds shifted off the source banks' 40/60/70/80k round numbers.
  const threshold = rng.pick([15, 25, 35, 45, 55]) * 1000;
  // Choose, per column, how many of its 4 cells clear the threshold (≥1 total).
  let aboveCounts: number[];
  let guard = 0;
  do {
    aboveCounts = sc.cols.map(() => rng.int(1, 4));
    guard++;
  } while (guard < 50 && aboveCounts.reduce((a, b) => a + b, 0) < 4);
  const targetCol = rng.int(0, 3);
  // Build a concrete grid consistent with those counts (values around threshold).
  const grid: number[][] = sc.rows.map(() => sc.cols.map(() => 0));
  aboveCounts.forEach((cnt, c) => {
    const rowsAbove = rng.shuffle([0, 1, 2, 3]).slice(0, cnt);
    for (let rIdx = 0; rIdx < 4; rIdx++) {
      const delta = rng.int(1, 9) * 100;
      grid[rIdx][c] = rowsAbove.includes(rIdx) ? threshold + delta : threshold - delta;
    }
  });
  const total = aboveCounts.reduce((a, b) => a + b, 0);
  const favorable = aboveCounts[targetCol];
  const correctF = tableAboveThresholdProb(grid, threshold, targetCol);

  const correct: Choice = {
    text: fracText(correctF),
    rationale: `Correct — of the ${total} figures above ${threshold.toLocaleString("en-US")}, ${favorable} are ${sc.cols[targetCol]}: P = ${favorable}/${total}.`,
  };
  const distractors: Choice[] = [
    {
      text: fracText(F(favorable, 4)),
      rationale: `The REVERSED conditional: ${favorable}/4 is P(above | ${sc.cols[targetCol]}) — the chance a ${sc.cols[targetCol]} figure is high — not the asked P(${sc.cols[targetCol]} | above), which divides by the ${total} survivors.`,
      misconception: MISCONCEPTION.reversedConditional,
    },
    {
      text: fracText(F(favorable, 16)),
      rationale: `You divided by all 16 cells, forgetting the conditioning. Being told the figure is above ${threshold.toLocaleString("en-US")} shrinks the pool to the ${total} that qualify.`,
    },
    {
      text: fracText(F(total, 16)),
      rationale: `That's P(above ${threshold.toLocaleString("en-US")}) overall (${total}/16), not the probability it belongs to ${sc.cols[targetCol]}.`,
    },
  ];

  const prompt =
    `A 4×4 grid records the ${sc.metric} of four ${sc.unit}s (${sc.cols.join(", ")}) over four periods. ` +
    `One of the 16 entries is picked uniformly at random, and you learn it tops ${threshold.toLocaleString("en-US")} dollars — ${total} of the entries clear that bar, and ${favorable} of those come from ${sc.cols[targetCol]}. ` +
    `What is the probability the chosen entry belongs to ${sc.cols[targetCol]}?`;
  const explanation =
    `Conditioning shrinks the sample space to the ${total} above-threshold figures (P(A|B) = #(A∩B)/#B). ` +
    `${sc.cols[targetCol]} accounts for ${favorable} of them, so P = ${favorable}/${total} = ${fracText(correctF)}. ` +
    `The tempting ${favorable}/4 is the REVERSED conditional P(above | ${sc.cols[targetCol]}).`;

  return {
    answer: fracText(correctF),
    question: {
      id: `cp-table-${favorable}-${total}`,
      prompt,
      explanation,
      difficulty,
      concept: "Reduced sample space (reversed-conditional trap)",
      source: "Conditional Probability · Reduced sample space",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

/** Two fair dN, told at least one is a k → P(both k) = 1/(2N−1) (Boy-or-Girl). */
export function buildBothInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  const N = rng.pick([4, 6, 8, 10, 12]);
  const face = rng.int(1, N);
  const correctF = bothGivenAtLeastOne(N); // 1/(2N−1)

  const correct: Choice = {
    text: fracText(correctF),
    rationale: `Correct — ${2 * N - 1} ordered pairs contain a ${face}; only (${face},${face}) has two, so 1/${2 * N - 1}.`,
  };
  const distractors: Choice[] = [
    {
      text: fracText(F(1, N)),
      rationale: `The naive answer: treating the "other" die as free (1/${N}). But "at least one is a ${face}" already rules out the ${2 * N - 1} no-${face} pairs and keeps the (${face},x)/(x,${face}) overlap in one pool — the denominator is ${2 * N - 1}, not ${N}.`,
    },
    {
      text: fracText(F(1, N * N)),
      rationale: `That's the unconditional P(both ${face}) = 1/${N}². The information "at least one ${face}" raises it to 1/${2 * N - 1}.`,
    },
    {
      text: fracText(F(2, 2 * N - 1)),
      rationale: `You counted (${face},${face}) twice among the ${2 * N - 1} survivors. It is a single ordered pair, so the numerator is 1.`,
    },
  ];

  const prompt =
    `Two fair ${N}-sided dice are rolled where you cannot see them, and an honest referee reveals only that a ${face} appeared on at least one of the two. ` +
    `Given that, what is the probability that ${face} came up on BOTH dice?`;
  const explanation =
    `Enumerate the ordered pairs that contain a ${face}: (${face},1…${N}) together with (1…${N},${face}) — ${2 * N - 1} distinct pairs in all. ` +
    `Just one of them, (${face},${face}), has two, so P = 1/${2 * N - 1} = ${fracText(correctF)}. The trap 1/${N} overlooks that the conditioning pools the two overlapping single-${face} pairs.`;

  return {
    answer: fracText(correctF),
    question: {
      id: `cp-both-${N}`,
      prompt,
      explanation,
      difficulty,
      concept: "Reduced sample space (Boy-or-Girl / at-least-one)",
      source: "Conditional Probability · Reduced sample space",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

/** Two fair dN, told the sum is s → P(at least one die shows `face`). Ordered. */
export function buildGivenSumInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  // Non-standard dice (8/10/12-sided) keep this off the classic two-d6 / sum-7
  // source scenario while preserving the ordered-pairs sub-skill.
  const N = rng.pick([8, 10, 12]);
  // Pick a sum with several ordered representations, and a face inside it.
  const s = rng.int(4, N + 2);
  const pairs: [number, number][] = [];
  for (let a = 1; a <= N; a++)
    for (let b = 1; b <= N; b++) if (a + b === s) pairs.push([a, b]);
  const faces = Array.from(new Set(pairs.flat()));
  const face = rng.pick(faces);
  const survivors = pairs.length;
  const favorable = pairs.filter(([a, b]) => a === face || b === face).length;
  const correctF = diceSumFaceProb(N, s, face);

  const correct: Choice = {
    text: fracText(correctF),
    rationale: `Correct — ${survivors} ordered pairs sum to ${s}; ${favorable} of them contain a ${face}: ${favorable}/${survivors}.`,
  };
  const distractors: Choice[] = [
    {
      text: fracText(F(favorable, 2 * survivors)),
      rationale: `You halved by treating the pairs as UNORDERED. The sample space of two distinct dice is ordered — there are ${survivors} ordered survivors, not ${survivors / 2}.`,
      misconception: MISCONCEPTION.orderedVsUnordered,
    },
    {
      text: fracText(F(1, survivors)),
      rationale: `You counted only ONE pair with a ${face}. There are ${favorable} such ordered pairs among the ${survivors} that sum to ${s}.`,
    },
    {
      text: fracText(F(favorable, N * N)),
      rationale: `You divided by all ${N}² outcomes, ignoring the conditioning on "sum = ${s}", which keeps only ${survivors} pairs.`,
    },
  ];

  const prompt =
    `A pair of fair ${N}-faced dice is tossed behind a screen; all you learn is that the two faces add up to exactly ${s}. ` +
    `Given only that, how likely is it that a ${face} turns up on at least one of the two dice?`;
  const explanation =
    `Keep only the outcomes consistent with the total: the ordered pairs adding to ${s} number ${survivors}. ` +
    `Of those, ${favorable} include a ${face}, so the conditional probability is ${favorable}/${survivors} = ${fracText(correctF)}. ` +
    `Collapsing (a,b) and (b,a) into one unordered pair is the classic miscount that wrongly halves the survivor count.`;

  return {
    answer: fracText(correctF),
    question: {
      id: `cp-givensum-${N}-${s}-${face}`,
      prompt,
      explanation,
      difficulty,
      concept: "Reduced sample space (ordered pairs)",
      source: "Conditional Probability · Reduced sample space",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

/** Bertrand's box: green up-face seen → P(hidden face green) = 2g/(2g+m). */
export function buildBertrandInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  const g = rng.pick([1, 2]);
  // Drop m = 2g, the single case where the correct answer collapses onto the
  // ½-intuition distractor and leaves only two options.
  const m = rng.pick([1, 2, 3].filter((x) => x !== 2 * g));
  const correctF = bertrandGreenProb(g, m); // 2g/(2g+m)
  const naive = F(g, g + m); // P(all-red disc | ...) by OBJECTS

  const correct: Choice = {
    text: fracText(correctF),
    rationale: `Correct — count FACES: ${2 * g} red faces sit on all-red chips (red backs) and ${m} on two-tone chips (white backs): ${2 * g}/${2 * g + m}.`,
  };
  const distractors: Choice[] = [
    {
      text: fracText(naive),
      rationale: `The naive answer counts CHIPS not faces: ${g}/(${g}+${m}). But an all-red chip flashes red twice as often, so a red sighting is evidence for it — weight by faces: ${2 * g}/${2 * g + m}.`,
      misconception: MISCONCEPTION.facesNotObjects,
    },
    {
      text: fracText(F(1, 2)),
      rationale: `The "must be 50/50" hunch. Seeing a red face is not neutral evidence — the all-red chips surface red more often, pushing the posterior above ½.`,
    },
    {
      text: fracText(F(m, 2 * g + m)),
      rationale: `That's the complement — P(the concealed side is WHITE) among the red-up faces. The question asks for a red underside.`,
    },
  ];

  const prompt =
    `A tin contains ${g} chip(s) coloured red on BOTH faces and ${m} chip(s) red on one face and white on the other. ` +
    `You shake out a single chip and it settles red-side up. How likely is it that its concealed underside is red as well?`;
  const explanation =
    `Condition on FACES rather than chips. There are ${2 * g} red faces belonging to all-red chips (their undersides are red) and ${m} red faces on two-tone chips (undersides white). ` +
    `Given a red face on top, P(underside also red) = ${2 * g}/${2 * g + m} = ${fracText(correctF)} — well above the naive ${fracText(naive)}.`;

  return {
    answer: fracText(correctF),
    question: {
      id: `cp-bertrand-${g}-${m}`,
      prompt,
      explanation,
      difficulty,
      concept: "Bertrand's box (condition on faces, not objects)",
      source: "Conditional Probability · Conditional counting",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

/** n items each on w.p. ½, at least one on → P(all on) = 1/(2ⁿ−1). */
export function buildAllOnInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  const n = rng.pick([3, 4, 5, 6]);
  const correctF = allOnGivenAtLeastOne(n); // 1/(2ⁿ−1)

  const correct: Choice = {
    text: fracText(correctF),
    rationale: `Correct — P(all on)/P(≥1 on) = (1/2^${n})/(1 − 1/2^${n}) = 1/(2^${n} − 1) = 1/${2 ** n - 1}.`,
  };
  const distractors: Choice[] = [
    {
      text: fracText(F(1, 2 ** n)),
      rationale: `That's the UNconditional P(all on) = 1/2^${n}. Conditioning on "at least one on" removes the all-off outcome, raising it to 1/(2^${n} − 1).`,
    },
    {
      text: fracText(F(1, n)),
      rationale: `You guessed 1/${n} by count of items. The events are joint over 2^${n} configurations: 1/(2^${n} − 1).`,
    },
    {
      text: fracText(F(1, 2 ** n + 1)),
      rationale: `Off by the sign of the correction — conditioning DROPS the impossible all-off case, so divide by 2^${n} − 1, not 2^${n} + 1.`,
    },
  ];

  const prompt =
    `A cluster of ${n} servers each boots up successfully, independently, with probability ½. A health check reports that at least one of them came online. ` +
    `What is the probability that EVERY one of the ${n} servers is online?`;
  const explanation =
    `Let A = all online (⊆ B), B = at least one online. P(A) = (1/2)^${n} = 1/${2 ** n}, P(B) = 1 − 1/${2 ** n} = ${2 ** n - 1}/${2 ** n}. ` +
    `P(A|B) = (1/${2 ** n})/(${2 ** n - 1}/${2 ** n}) = 1/${2 ** n - 1} = ${fracText(correctF)} (general n: 1/(2ⁿ−1)).`;

  return {
    answer: fracText(correctF),
    question: {
      id: `cp-allon-${n}`,
      prompt,
      explanation,
      difficulty,
      concept: "Conditional probability with complement (1/(2ⁿ−1))",
      source: "Conditional Probability · Reduced sample space",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

/* ========================================================================== */
/* ===========================  LEVEL 2 — BAYES  ============================ */
/* ==========================  (quiz — name the mistake)  ==================== */
/* ========================================================================== */

/** Classic test/disease Bayes: prevalence, sensitivity, false-positive → P(D|+). */
export function buildBayesTestInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  const prevPct = rng.pick([1, 2, 5, 10, 20]);
  const sensPct = rng.pick([80, 90, 95, 99]);
  const fprPct = rng.pick([5, 10, 20, 30]);
  const prev = F(prevPct, 100);
  const sens = F(sensPct, 100);
  const fpr = F(fprPct, 100);
  const correctF = bayesPosterior([prev, F(1).sub(prev)], [sens, fpr], 0);
  const dp = gradeDp(correctF, 4);
  const answer = decText(correctF, dp);

  const correct: Choice = {
    text: decText(correctF, dp),
    rationale: `Correct — posterior = prior·sens / (prior·sens + (1−prior)·fpr) = ${sensPct}%·${prevPct}% / total.`,
  };
  const distractors: Choice[] = [
    {
      text: decText(sens, dp),
      rationale: `BASE-RATE NEGLECT: you reported the test's sensitivity P(+ | disease) = ${sensPct}% as if it were the posterior P(disease | +). With a ${prevPct}% base rate, most positives are false positives.`,
      misconception: MISCONCEPTION.baseRateNeglect,
    },
    {
      text: decText(F(1).sub(fpr), dp),
      rationale: `That's the test's specificity (1 − false-positive rate). The asked posterior weights the rare true positives against the common false positives.`,
    },
    {
      text: decText(prev.mul(sens), dp),
      rationale: `That's the JOINT P(disease AND +) = prior·sensitivity — you forgot to normalise by the total probability of a positive test.`,
    },
  ];

  const prompt =
    `A condition affects ${prevPct}% of a population. A screening test flags ${sensPct}% of people who have it, but also flags ${fprPct}% of people who don't. ` +
    `A random person tests positive. What is the probability they actually have the condition? (Round to ${dp} decimals.)`;
  const explanation =
    `Bayes: P(D|+) = P(+|D)P(D) / [P(+|D)P(D) + P(+|¬D)P(¬D)] = (${sensPct/100})(${prevPct/100}) / [(${sensPct/100})(${prevPct/100}) + (${fprPct/100})(${(100-prevPct)/100})] = ${decText(correctF, dp)}. ` +
    `Reporting the ${sensPct}% sensitivity as the answer is textbook base-rate neglect.`;

  return {
    answer,
    question: {
      id: `cp-bayestest-${prevPct}-${sensPct}-${fprPct}`,
      prompt,
      explanation,
      difficulty,
      concept: "Bayes' theorem (base-rate neglect)",
      source: "Conditional Probability · Bayes' theorem",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

/** Which-die Bayes: pick a fair d`N1` or d`N2` at random, roll value r → P(d N1). */
export function buildWhichDieInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  // Larger dice (no d4/d6 pairing) keep this off the classic d4-vs-d6 source.
  const [N1, N2] = rng.shuffle([6, 8, 10, 12, 20]).slice(0, 2).sort((a, b) => a - b);
  const r = rng.int(1, N1); // a value both dice can show
  const correctF = bayesPosterior([F(1, 2), F(1, 2)], [F(1, N1), F(1, N2)], 0); // = N2/(N1+N2)

  const correct: Choice = {
    text: fracText(correctF),
    rationale: `Correct — equal priors, likelihoods 1/${N1} and 1/${N2}: posterior = (1/${N1})/(1/${N1}+1/${N2}) = ${N2}/${N1 + N2}.`,
  };
  const distractors: Choice[] = [
    {
      text: fracText(F(1, N1)),
      rationale: `You reported the LIKELIHOOD P(roll ${r} | d${N1}) = 1/${N1} as the posterior. Bayes flips and normalises this.`,
      misconception: MISCONCEPTION.likelihoodAsPosterior,
    },
    {
      text: fracText(F(1, 2)),
      rationale: `That's the PRIOR (each die equally likely). Rolling a ${r} is evidence — the smaller die makes low rolls more likely, so the posterior tilts to it.`,
    },
    {
      text: fracText(F(N1, N1 + N2)),
      rationale: `You swapped the numerator: this is what the posterior for the LARGER die would be. The smaller d${N1} has the higher likelihood, so its posterior uses ${N2} on top.`,
    },
  ];

  const prompt =
    `Two dice lie on the table — one with ${N1} faces, the other with ${N2} faces. A friend secretly chooses one of them uniformly at random, rolls it out of sight, and announces the outcome is ${r}. ` +
    `How probable is it that the die actually rolled was the ${N1}-faced one?`;
  const explanation =
    `Equal priors of ½. The likelihoods are P(${r}|${N1}-faced) = 1/${N1} and P(${r}|${N2}-faced) = 1/${N2}. ` +
    `Bayes gives P(${N1}-faced|${r}) = (½·1/${N1})/(½·1/${N1} + ½·1/${N2}) = ${N2}/${N1 + N2} = ${fracText(correctF)}. The die with fewer faces makes any single result more likely, so the evidence tilts toward it.`;

  return {
    answer: fracText(correctF),
    question: {
      id: `cp-die-${N1}-${N2}-${r}`,
      prompt,
      explanation,
      difficulty,
      concept: "Bayes' theorem (likelihood ≠ posterior)",
      source: "Conditional Probability · Bayes' theorem",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

/** Cheer-for-a-loser Bayes: pick 1 of 3 competitors uniformly, it loses → P(target). */
export function buildCheerLoserInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  const d = rng.pick([10, 16, 20]);
  // Three win-probabilities a/d, b/d, c/d summing to ≤ d (they need not sum to d).
  // Exclude the two source win-probability multisets so we never reproduce the
  // "Racing Cars" (7/10,2/10,1/10) or "Athletic Cats" (12/16,3/16,1/16) tuples.
  const isSourceTuple = (dd: number, x: number, y: number, z: number) => {
    const key = [x, y, z].sort((p, q) => p - q).join(",");
    return (dd === 10 && key === "1,2,7") || (dd === 16 && key === "1,3,12");
  };
  const uniform = [F(1, 3), F(1, 3), F(1, 3)];
  let a = 0, b = 0, c = 0, target = 0;
  let wins: FractionType[] = [];
  let losses: FractionType[] = [];
  let correctF = F(0);
  let winW = F(0);
  let guard = 0;
  let picked = false;
  do {
    a = rng.int(1, d - 2);
    b = rng.int(1, d - 1 - a);
    c = rng.int(1, d - a - b);
    target = rng.int(0, 2);
    wins = [F(a, d), F(b, d), F(c, d)];
    losses = wins.map((w) => F(1).sub(w));
    correctF = bayesPosterior(uniform, losses, target);
    winW = bayesPosterior(uniform, wins, target);
    guard++;
    // Require all four candidate options (answer, prior ⅓, win-weighted,
    // un-normalised likelihood) to be DISTINCT so the item always ships four
    // misconception-grounded choices — never a degenerate 2-option quiz.
    const cand = new Set(
      [correctF, F(1, 3), winW, losses[target]].map((f) => fracText(f)),
    );
    picked =
      a !== b &&
      b !== c &&
      a !== c &&
      a + b + c <= d &&
      !isSourceTuple(d, a, b, c) &&
      cand.size >= 4;
  } while (guard < 160 && !picked);
  const names = ["the Falcons", "the Otters", "the Bison"];

  const correct: Choice = {
    text: fracText(correctF),
    rationale: `Correct — posterior ∝ P(loss). ${names[target]} loses w.p. ${fracText(losses[target])}; normalise by the three loss-probabilities.`,
  };
  const distractors: Choice[] = [
    {
      text: fracText(F(1, 3)),
      rationale: `That's the PRIOR (you picked one of three at random). The fact it LOST is evidence — the more likely winners are now less likely to be your pick.`,
    },
    {
      text: fracText(bayesPosterior([F(1, 3), F(1, 3), F(1, 3)], wins, target)),
      rationale: `You weighted by WIN probability instead of loss. Given your pick lost, favour the competitor with the higher LOSS probability.`,
    },
    {
      text: fracText(losses[target]),
      rationale: `That's the likelihood P(loss | ${names[target]}) = ${fracText(losses[target])}, un-normalised. Divide by the total loss probability across all three.`,
    },
  ];

  const prompt =
    `Three teams — ${names.join(", ")} — carry chances of ${fracText(wins[0])}, ${fracText(wins[1])}, and ${fracText(wins[2])} of prevailing in their respective upcoming matches. ` +
    `You throw your support behind one of them chosen at random, and that team then goes on to LOSE. How probable is it that the side you had chosen was ${names[target]}?`;
  const explanation =
    `Equal priors of ⅓. Reweight by the LOSS likelihood 1 − win: ${losses.map(fracText).join(", ")}. ` +
    `P(${names[target]} | your team lost) = ${fracText(losses[target])}/(${losses.map(fracText).join(" + ")}) = ${fracText(correctF)}. A loss is evidence AGAINST the strongest teams, lifting the underdogs' posteriors.`;

  return {
    answer: fracText(correctF),
    question: {
      id: `cp-loser-${d}-${a}-${b}-${c}-${target}`,
      prompt,
      explanation,
      difficulty,
      concept: "Bayes' theorem (cheer-for-a-loser)",
      source: "Conditional Probability · Bayes' theorem",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

/** Inversion Bayes: given P(A), P(B), P(B|A) → P(A|B) = P(B|A)P(A)/P(B). */
export function buildInversionInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  const pApct = rng.pick([10, 11, 15, 20, 25]);
  const pBpct = rng.pick([20, 23, 30, 40]);
  const pBApct = rng.pick([6, 12, 15, 24]);
  const pA = F(pApct, 100);
  const pB = F(pBpct, 100);
  const pBA = F(pBApct, 100);
  const correctF = bayesInversion(pA, pB, pBA);
  const dp = gradeDp(correctF, 4);
  const answer = decText(correctF, dp);

  const correct: Choice = {
    text: decText(correctF, dp),
    rationale: `Correct — P(A|B) = P(B|A)·P(A)/P(B) = ${pBApct/100}·${pApct/100}/${pBpct/100}.`,
  };
  const distractors: Choice[] = [
    {
      text: decText(pBA, dp),
      rationale: `You reported the given direction P(B|A) = ${pBApct}% as the answer. The question asks the REVERSED conditional P(A|B); rescale by P(A)/P(B).`,
      misconception: MISCONCEPTION.reversedConditional,
    },
    {
      text: decText(pBA.mul(pA), dp),
      rationale: `That's the JOINT P(A∩B) = P(B|A)P(A). To get P(A|B) you must still divide by P(B) = ${pBpct}%.`,
    },
    {
      text: decText(pA, dp),
      rationale: `That's just the prior P(A) = ${pApct}%, ignoring the evidence B entirely.`,
    },
  ];

  const prompt =
    `In a population, P(A) = ${pApct}%, P(B) = ${pBpct}%, and among those with A, ${pBApct}% also have B. ` +
    `Pick a random member WITH B — what is the probability they have A? (Round to ${dp} decimals.)`;
  const explanation =
    `Bayes by inversion: P(A|B) = P(B|A)·P(A)/P(B) = (${pBApct/100})(${pApct/100})/(${pBpct/100}) = ${decText(correctF, dp)}. ` +
    `Reporting the given P(B|A) = ${pBApct}% is the reversed-conditional (prosecutor's-fallacy) error.`;

  return {
    answer,
    question: {
      id: `cp-inv-${pApct}-${pBpct}-${pBApct}`,
      prompt,
      explanation,
      difficulty,
      concept: "Bayes' theorem (reversed conditional)",
      source: "Conditional Probability · Bayes' theorem",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

/* ========================================================================== */
/* ==========  LEVEL 1 & 2 — FREE-RESPONSE (numeric) CONVERSIONS  ============ */
/* ==  MCQ→numeric conversions of the reduced-sample-space and Bayes families  */
/* ==  (mirrors the geo-1 pattern): the SAME exact solver + the SAME genuine    */
/* ==  error modes, now as a parametric error-mode catalog carrying a machine-  */
/* ==  readable `misconception` tag and an answer-withholding rung-1 coaching   */
/* ==  sentence. The learner types a fraction or decimal (gradeFreeResponse).   */
/* ==  The quiz builders above are KEPT (still used by the verification tests). */
/* ========================================================================== */

/** FREE-RESPONSE table conditioning — numeric conversion of `buildTableInstance`. */
export function buildTableNumericInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const sc = rng.pick(TABLE_SCENARIOS);
  const threshold = rng.pick([15, 25, 35, 45, 55]) * 1000;
  let aboveCounts: number[];
  let guard = 0;
  do {
    aboveCounts = sc.cols.map(() => rng.int(1, 4));
    guard++;
  } while (guard < 50 && aboveCounts.reduce((a, b) => a + b, 0) < 4);
  const targetCol = rng.int(0, 3);
  const grid: number[][] = sc.rows.map(() => sc.cols.map(() => 0));
  aboveCounts.forEach((cnt, c) => {
    const rowsAbove = rng.shuffle([0, 1, 2, 3]).slice(0, cnt);
    for (let rIdx = 0; rIdx < 4; rIdx++) {
      const delta = rng.int(1, 9) * 100;
      grid[rIdx][c] = rowsAbove.includes(rIdx) ? threshold + delta : threshold - delta;
    }
  });
  const total = aboveCounts.reduce((a, b) => a + b, 0);
  const favorable = aboveCounts[targetCol];
  const value = tableAboveThresholdProb(grid, threshold, targetCol); // favorable/total
  const dp = gradeDp(value);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(favorable, 4),
    `Close! Dividing by 4 gives P(above | ${sc.cols[targetCol]}) — the REVERSED conditional. Which event were you told has ALREADY happened, and so belongs in the denominator?`,
    MISCONCEPTION.reversedConditional,
  );
  push(
    F(favorable, 16),
    `It looks like you divided by all 16 cells. You were TOLD the entry tops ${threshold.toLocaleString("en-US")} — doesn't that shrink the pool you should count within?`,
    "ignored_conditioning",
  );
  push(
    F(total, 16),
    `That's the chance a random entry beats the threshold at all. But you already KNOW this one did — so what should the denominator be now?`,
    "conditioning_event_prob",
  );
  push(
    F(total - favorable, total),
    `Careful — that's the chance the above-threshold entry is NOT a ${sc.cols[targetCol]} figure. Which side of the split did the question ask for?`,
    MISCONCEPTION.complementConfusion,
  );

  const prompt =
    `A 4×4 grid records the ${sc.metric} of four ${sc.unit}s (${sc.cols.join(", ")}) over four periods. ` +
    `One of the 16 entries is picked uniformly at random, and you learn it tops ${threshold.toLocaleString("en-US")} dollars — ${total} of the entries clear that bar, and ${favorable} of those come from ${sc.cols[targetCol]}. ` +
    `What is the probability the chosen entry belongs to ${sc.cols[targetCol]}? (Enter a fraction or decimal.) Round to the nearest thousandth.`;
  const explanation =
    `Conditioning shrinks the sample space to the ${total} above-threshold figures (P(A|B) = #(A∩B)/#B). ` +
    `${sc.cols[targetCol]} accounts for ${favorable} of them, so P = ${favorable}/${total} = ${fracText(value)} ≈ ${decText(value, dp)}. ` +
    `The tempting ${favorable}/4 is the REVERSED conditional P(above | ${sc.cols[targetCol]}).`;

  return {
    answer,
    numeric: {
      id: `cp-tablenum-${favorable}-${total}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Reduced sample space (reversed-conditional trap)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Conditional Probability · Reduced sample space",
    },
  };
}

/** FREE-RESPONSE "both given at least one" — numeric conversion of `buildBothInstance`. */
export function buildBothNumericInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const N = rng.pick([4, 6, 8, 10, 12]);
  const face = rng.int(1, N);
  const value = bothGivenAtLeastOne(N); // 1/(2N−1)
  const dp = gradeDp(value);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(1, N),
    `Close! 1/${N} treats the other die as free. But "at least one is a ${face}" already pooled the two overlapping single-${face} rolls — how many ordered pairs contain a ${face}?`,
    "naive_independent_second",
  );
  push(
    F(1, N * N),
    `That's the UNconditional chance both dice show ${face}. The clue "at least one is a ${face}" rules out many outcomes — shouldn't that raise the probability?`,
    "unconditional_joint",
  );
  push(
    F(2, 2 * N - 1),
    `You counted (${face},${face}) twice among the survivors. How many ordered pairs actually show a ${face} on BOTH dice?`,
    "double_counted_outcome",
  );

  const prompt =
    `Two fair ${N}-sided dice are rolled where you cannot see them, and an honest referee reveals only that a ${face} appeared on at least one of the two. ` +
    `Given that, what is the probability that ${face} came up on BOTH dice? (Enter a fraction or decimal.) Round to the nearest thousandth.`;
  const explanation =
    `Enumerate the ordered pairs that contain a ${face}: (${face},1…${N}) together with (1…${N},${face}) — ${2 * N - 1} distinct pairs in all. ` +
    `Just one of them, (${face},${face}), has two, so P = 1/${2 * N - 1} = ${fracText(value)} ≈ ${decText(value, dp)}. The trap 1/${N} overlooks that the conditioning pools the two overlapping single-${face} pairs.`;

  return {
    answer,
    numeric: {
      id: `cp-bothnum-${N}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Reduced sample space (Boy-or-Girl / at-least-one)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Conditional Probability · Reduced sample space",
    },
  };
}

/** FREE-RESPONSE "sum → at least one face" — numeric conversion of `buildGivenSumInstance`. */
export function buildGivenSumNumericInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const N = rng.pick([8, 10, 12]);
  const s = rng.int(4, N + 2);
  const pairs: [number, number][] = [];
  for (let a = 1; a <= N; a++)
    for (let b = 1; b <= N; b++) if (a + b === s) pairs.push([a, b]);
  const faces = Array.from(new Set(pairs.flat()));
  const face = rng.pick(faces);
  const survivors = pairs.length;
  const favorable = pairs.filter(([a, b]) => a === face || b === face).length;
  const value = diceSumFaceProb(N, s, face);
  const dp = gradeDp(value);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(favorable, 2 * survivors),
    `Close! Halving treats (a,b) and (b,a) as the same roll. Two distinct dice give ORDERED outcomes — how many ordered pairs sum to ${s}?`,
    MISCONCEPTION.orderedVsUnordered,
  );
  push(
    F(1, survivors),
    `It looks like you counted just ONE pair that includes a ${face}. How many of the ${survivors} summing pairs actually contain one?`,
    "single_favorable_miscount",
  );
  push(
    F(favorable, N * N),
    `You divided by all ${N}² rolls, ignoring the clue "sum = ${s}". What is the real size of the reduced sample space?`,
    "ignored_conditioning",
  );

  const prompt =
    `A pair of fair ${N}-faced dice is tossed behind a screen; all you learn is that the two faces add up to exactly ${s}. ` +
    `Given only that, how likely is it that a ${face} turns up on at least one of the two dice? (Enter a fraction or decimal.) Round to the nearest thousandth.`;
  const explanation =
    `Keep only the outcomes consistent with the total: the ordered pairs adding to ${s} number ${survivors}. ` +
    `Of those, ${favorable} include a ${face}, so the conditional probability is ${favorable}/${survivors} = ${fracText(value)} ≈ ${decText(value, dp)}. ` +
    `Collapsing (a,b) and (b,a) into one unordered pair is the classic miscount that wrongly halves the survivor count.`;

  return {
    answer,
    numeric: {
      id: `cp-gsumnum-${N}-${s}-${face}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Reduced sample space (ordered pairs)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Conditional Probability · Reduced sample space",
    },
  };
}

/** FREE-RESPONSE Bertrand's box — numeric conversion of `buildBertrandInstance`. */
export function buildBertrandNumericInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const g = rng.pick([1, 2]);
  const m = rng.pick([1, 2, 3].filter((x) => x !== 2 * g));
  const value = bertrandGreenProb(g, m); // 2g/(2g+m)
  const naive = F(g, g + m); // count OBJECTS not faces
  const dp = gradeDp(value);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    naive,
    `Close! You counted CHIPS, not faces. An all-red chip flashes red twice as often — should a red sighting be weighted by chips or by faces?`,
    MISCONCEPTION.facesNotObjects,
  );
  push(
    F(1, 2),
    `That's the "it must be 50/50" hunch. Seeing a red face isn't neutral evidence — which chips surface red more often?`,
    "must_be_half",
  );
  push(
    F(m, 2 * g + m),
    `That's the chance the hidden side is WHITE — the opposite event. Which underside did the question ask about?`,
    MISCONCEPTION.complementConfusion,
  );

  const prompt =
    `A tin contains ${g} chip(s) coloured red on BOTH faces and ${m} chip(s) red on one face and white on the other. ` +
    `You shake out a single chip and it settles red-side up. How likely is it that its concealed underside is red as well? (Enter a fraction or decimal.) Round to the nearest thousandth.`;
  const explanation =
    `Condition on FACES rather than chips. There are ${2 * g} red faces belonging to all-red chips (their undersides are red) and ${m} red faces on two-tone chips (undersides white). ` +
    `Given a red face on top, P(underside also red) = ${2 * g}/${2 * g + m} = ${fracText(value)} ≈ ${decText(value, dp)} — well above the naive ${fracText(naive)}.`;

  return {
    answer,
    numeric: {
      id: `cp-bertnum-${g}-${m}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Bertrand's box (condition on faces, not objects)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Conditional Probability · Conditional counting",
    },
  };
}

/** FREE-RESPONSE "all on given at least one" — numeric conversion of `buildAllOnInstance`. */
export function buildAllOnNumericInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const n = rng.pick([3, 4, 5, 6]);
  const value = allOnGivenAtLeastOne(n); // 1/(2ⁿ−1)
  const dp = gradeDp(value);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(1, 2 ** n),
    `Close! That's the UNconditional chance all ${n} are on. The health check "at least one is on" removes the all-off outcome — does that raise or lower the probability?`,
    "unconditional_joint",
  );
  push(
    F(1, n),
    `It looks like you used the number of servers directly. The events live over 2^${n} on/off configurations — what is the conditioned denominator?`,
    "naive_one_over_n",
  );
  push(
    F(1, 2 ** n + 1),
    `So close — you adjusted the denominator the wrong way. Conditioning DROPS the impossible all-off case, so do you subtract or add that one configuration?`,
    "wrong_conditioning_correction",
  );

  const prompt =
    `A cluster of ${n} servers each boots up successfully, independently, with probability ½. A health check reports that at least one of them came online. ` +
    `What is the probability that EVERY one of the ${n} servers is online? (Enter a fraction or decimal.) Round to the nearest thousandth.`;
  const explanation =
    `Let A = all online (⊆ B), B = at least one online. P(A) = (1/2)^${n} = 1/${2 ** n}, P(B) = 1 − 1/${2 ** n} = ${2 ** n - 1}/${2 ** n}. ` +
    `P(A|B) = (1/${2 ** n})/(${2 ** n - 1}/${2 ** n}) = 1/${2 ** n - 1} = ${fracText(value)} ≈ ${decText(value, dp)} (general n: 1/(2ⁿ−1)).`;

  return {
    answer,
    numeric: {
      id: `cp-allonnum-${n}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Conditional probability with complement (1/(2ⁿ−1))",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Conditional Probability · Reduced sample space",
    },
  };
}

/** FREE-RESPONSE test/disease Bayes — numeric conversion of `buildBayesTestInstance`. */
export function buildBayesTestNumericInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const prevPct = rng.pick([1, 2, 5, 10, 20]);
  const sensPct = rng.pick([80, 90, 95, 99]);
  const fprPct = rng.pick([5, 10, 20, 30]);
  const prev = F(prevPct, 100);
  const sens = F(sensPct, 100);
  const fpr = F(fprPct, 100);
  const value = bayesPosterior([prev, F(1).sub(prev)], [sens, fpr], 0);
  const dp = gradeDp(value);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    sens,
    `Close! You reported the test's hit-rate P(+ | condition) = ${sensPct}%. With only a ${prevPct}% base rate, how many positives are actually FALSE alarms? What must the denominator include?`,
    MISCONCEPTION.baseRateNeglect,
  );
  push(
    F(1).sub(fpr),
    `That's the test's specificity (1 − false-positive rate), not the chance a positive is real. Which conditional does the question actually ask for?`,
    "specificity_as_posterior",
  );
  push(
    prev.mul(sens),
    `That's the JOINT chance of HAVING it AND testing positive. To turn a joint into P(condition | +), what must you still divide by?`,
    "joint_not_posterior",
  );

  const prompt =
    `A condition affects ${prevPct}% of a population. A screening test flags ${sensPct}% of people who have it, but also flags ${fprPct}% of people who don't. ` +
    `A random person tests positive. What is the probability they actually have the condition? (Enter a fraction or decimal.) Round to the nearest thousandth.`;
  const explanation =
    `Bayes: P(D|+) = P(+|D)P(D) / [P(+|D)P(D) + P(+|¬D)P(¬D)] = (${sensPct / 100})(${prevPct / 100}) / [(${sensPct / 100})(${prevPct / 100}) + (${fprPct / 100})(${(100 - prevPct) / 100})] = ${fracText(value)} ≈ ${decText(value, dp)}. ` +
    `Reporting the ${sensPct}% sensitivity as the answer is textbook base-rate neglect.`;

  return {
    answer,
    numeric: {
      id: `cp-btnum-${prevPct}-${sensPct}-${fprPct}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Bayes' theorem (base-rate neglect)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Conditional Probability · Bayes' theorem",
    },
  };
}

/** FREE-RESPONSE which-die Bayes — numeric conversion of `buildWhichDieInstance`. */
export function buildWhichDieNumericInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const [N1, N2] = rng.shuffle([6, 8, 10, 12, 20]).slice(0, 2).sort((a, b) => a - b);
  const r = rng.int(1, N1); // a value both dice can show
  const value = bayesPosterior([F(1, 2), F(1, 2)], [F(1, N1), F(1, N2)], 0); // = N2/(N1+N2)
  const dp = gradeDp(value);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(1, N1),
    `Close! 1/${N1} is the LIKELIHOOD of rolling ${r} on the ${N1}-faced die, not the posterior. Bayes flips and normalises this — what do you divide by?`,
    MISCONCEPTION.likelihoodAsPosterior,
  );
  push(
    F(1, 2),
    `That's the prior (each die equally likely before the roll). But rolling ${r} is evidence — which die makes a low roll more likely?`,
    "prior_ignored_evidence",
  );
  push(
    F(N1, N1 + N2),
    `You put the wrong die's count on top. The die with FEWER faces makes any single result more likely — which numerator should that give?`,
    "swapped_bayes_numerator",
  );

  const prompt =
    `Two dice lie on the table — one with ${N1} faces, the other with ${N2} faces. A friend secretly chooses one of them uniformly at random, rolls it out of sight, and announces the outcome is ${r}. ` +
    `How probable is it that the die actually rolled was the ${N1}-faced one? (Enter a fraction or decimal.) Round to the nearest thousandth.`;
  const explanation =
    `Equal priors of ½. The likelihoods are P(${r}|${N1}-faced) = 1/${N1} and P(${r}|${N2}-faced) = 1/${N2}. ` +
    `Bayes gives P(${N1}-faced|${r}) = (½·1/${N1})/(½·1/${N1} + ½·1/${N2}) = ${N2}/${N1 + N2} = ${fracText(value)} ≈ ${decText(value, dp)}. The die with fewer faces makes any single result more likely, so the evidence tilts toward it.`;

  return {
    answer,
    numeric: {
      id: `cp-dienum-${N1}-${N2}-${r}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Bayes' theorem (likelihood ≠ posterior)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Conditional Probability · Bayes' theorem",
    },
  };
}

/** FREE-RESPONSE cheer-for-a-loser Bayes — numeric conversion of `buildCheerLoserInstance`. */
export function buildCheerLoserNumericInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const d = rng.pick([10, 16, 20]);
  const isSourceTuple = (dd: number, x: number, y: number, z: number) => {
    const key = [x, y, z].sort((p, q) => p - q).join(",");
    return (dd === 10 && key === "1,2,7") || (dd === 16 && key === "1,3,12");
  };
  const uniform = [F(1, 3), F(1, 3), F(1, 3)];
  let a = 0, b = 0, c = 0, target = 0;
  let wins: FractionType[] = [];
  let losses: FractionType[] = [];
  let correctF = F(0);
  let winW = F(0);
  let guard = 0;
  let picked = false;
  do {
    a = rng.int(1, d - 2);
    b = rng.int(1, d - 1 - a);
    c = rng.int(1, d - a - b);
    target = rng.int(0, 2);
    wins = [F(a, d), F(b, d), F(c, d)];
    losses = wins.map((w) => F(1).sub(w));
    correctF = bayesPosterior(uniform, losses, target);
    winW = bayesPosterior(uniform, wins, target);
    guard++;
    const cand = new Set(
      [correctF, F(1, 3), winW, losses[target]].map((f) => fracText(f)),
    );
    picked =
      a !== b &&
      b !== c &&
      a !== c &&
      a + b + c <= d &&
      !isSourceTuple(d, a, b, c) &&
      cand.size >= 4;
  } while (guard < 160 && !picked);
  const names = ["the Falcons", "the Otters", "the Bison"];
  const value = correctF;
  const dp = gradeDp(value);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(1, 3),
    `Close! 1/3 is the prior — the chance you picked ${names[target]} before knowing anything. But your team LOST; how should that shift the odds among the three?`,
    "prior_ignored_evidence",
  );
  push(
    winW,
    `It looks like you weighted by each team's WIN probability. Your team lost — should a loss favour the strong favourites or the underdogs?`,
    "weighted_by_win_not_loss",
  );
  push(
    losses[target],
    `That's just ${names[target]}'s own chance of losing, un-normalised. To get a conditional probability, what must you divide by?`,
    "likelihood_not_normalized",
  );

  const prompt =
    `Three teams — ${names.join(", ")} — carry chances of ${fracText(wins[0])}, ${fracText(wins[1])}, and ${fracText(wins[2])} of prevailing in their respective upcoming matches. ` +
    `You throw your support behind one of them chosen at random, and that team then goes on to LOSE. How probable is it that the side you had chosen was ${names[target]}? (Enter a fraction or decimal.) Round to the nearest thousandth.`;
  const explanation =
    `Equal priors of ⅓. Reweight by the LOSS likelihood 1 − win: ${losses.map(fracText).join(", ")}. ` +
    `P(${names[target]} | your team lost) = ${fracText(losses[target])}/(${losses.map(fracText).join(" + ")}) = ${fracText(value)} ≈ ${decText(value, dp)}. A loss is evidence AGAINST the strongest teams, lifting the underdogs' posteriors.`;

  return {
    answer,
    numeric: {
      id: `cp-losernum-${d}-${a}-${b}-${c}-${target}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Bayes' theorem (cheer-for-a-loser)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Conditional Probability · Bayes' theorem",
    },
  };
}

/** FREE-RESPONSE inversion Bayes — numeric conversion of `buildInversionInstance`. */
export function buildInversionNumericInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const pApct = rng.pick([10, 11, 15, 20, 25]);
  const pBpct = rng.pick([20, 23, 30, 40]);
  const pBApct = rng.pick([6, 12, 15, 24]);
  const pA = F(pApct, 100);
  const pB = F(pBpct, 100);
  const pBA = F(pBApct, 100);
  const value = bayesInversion(pA, pB, pBA);
  const dp = gradeDp(value);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    pBA,
    `Close! You reported the given direction P(B|A) = ${pBApct}%. The question asks the REVERSED conditional P(A|B) — what do you rescale by to flip it?`,
    MISCONCEPTION.reversedConditional,
  );
  push(
    pBA.mul(pA),
    `That's the JOINT P(A∩B) = P(B|A)P(A). To turn a joint into P(A|B), what must you still divide by?`,
    "joint_not_posterior",
  );
  push(
    pA,
    `That's just the prior P(A) = ${pApct}%, ignoring the evidence B entirely. How should knowing B change it?`,
    "prior_ignored_evidence",
  );

  const prompt =
    `In a population, P(A) = ${pApct}%, P(B) = ${pBpct}%, and among those with A, ${pBApct}% also have B. ` +
    `Pick a random member WITH B — what is the probability they have A? (Enter a fraction or decimal.) Round to the nearest thousandth.`;
  const explanation =
    `Bayes by inversion: P(A|B) = P(B|A)·P(A)/P(B) = (${pBApct / 100})(${pApct / 100})/(${pBpct / 100}) = ${fracText(value)} ≈ ${decText(value, dp)}. ` +
    `Reporting the given P(B|A) = ${pBApct}% is the reversed-conditional (prosecutor's-fallacy) error.`;

  return {
    answer,
    numeric: {
      id: `cp-invnum-${pApct}-${pBpct}-${pBApct}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Bayes' theorem (reversed conditional)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Conditional Probability · Bayes' theorem",
    },
  };
}

/* ========================================================================== */
/* ==============  LEVEL 3 — TOTAL PROBABILITY & CONTINUOUS  ================= */
/* ============================  (numeric)  ================================= */
/* ========================================================================== */

/** Transfer LOTP: move one item Box1→Box2, then draw from Box2. P(dark). */
export function buildTransferInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const d1 = rng.int(1, 4);
  const m1 = rng.int(1, 4);
  const d2 = rng.int(2, 6);
  const m2 = rng.int(1, 5);
  const pDarkMoved = F(d1, d1 + m1);
  const pMilkMoved = F(m1, d1 + m1);
  const size2 = d2 + m2 + 1;
  const value = lawTotalProb(
    [pDarkMoved, pMilkMoved],
    [F(d2 + 1, size2), F(d2, size2)],
  );
  const dp = gradeDp(value, 4);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(d2, d2 + m2),
    `You reused the second jar's starting ratio ${d2}/${d2 + m2} and ignored the marble that arrived. The transfer reshapes the jar — condition on which colour moved.`,
  );
  push(
    F(d2 + 1, size2),
    `You assumed a RED marble made the trip for certain. It is red only w.p. ${fracText(pDarkMoved)}; average over both transfer outcomes.`,
  );
  push(
    pDarkMoved,
    `That's merely P(the transferred marble is red). The question asks P(the marble later drawn from the second jar is red) once the transfer has happened.`,
  );

  const prompt =
    `Jar A holds ${d1} red and ${m1} blue marbles; Jar B holds ${d2} red and ${m2} blue. ` +
    `A single marble is scooped blindly from Jar A and dropped into Jar B, and afterwards one marble is drawn at random from Jar B. ` +
    `What is the probability that this drawn marble is red? (Round to ${dp} decimals.)`;
  const explanation =
    `Split on the colour that crossed over. If a red marble moved (w.p. ${fracText(pDarkMoved)}), Jar B becomes ${d2 + 1}/${size2} red; ` +
    `if a blue one moved (w.p. ${fracText(pMilkMoved)}), Jar B stays ${d2}/${size2} red. ` +
    `Averaging: ${fracText(pDarkMoved)}·${d2 + 1}/${size2} + ${fracText(pMilkMoved)}·${d2}/${size2} = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `cp-transfer-${d1}-${m1}-${d2}-${m2}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Law of total probability (transfer)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Conditional Probability · Law of total probability",
    },
  };
}

/** Two-line LOTP: line shares + defect rates → overall P(defect). */
export function buildLotpLineInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const w1pct = rng.pick([40, 50, 60, 70, 75, 80]);
  const r1pct = rng.pick([2, 4, 5, 8]);
  const r2pct = rng.pick([6, 10, 12, 15]);
  const w1 = F(w1pct, 100);
  const w2 = F(100 - w1pct, 100);
  const value = lawTotalProb([w1, w2], [F(r1pct, 100), F(r2pct, 100)]);
  const dp = gradeDp(value, 4);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(r1pct + r2pct, 200),
    `You averaged the two defect rates equally. Weight each by its production SHARE (${w1pct}% vs ${100 - w1pct}%), not 50/50.`,
    MISCONCEPTION.equalWeightMixture,
  );
  push(
    F(r1pct, 100),
    `That's only Line A's defect rate. Total defect probability mixes both lines by their shares.`,
  );
  push(
    F(r2pct, 100),
    `That's only Line B's defect rate. Combine both via the law of total probability.`,
  );

  const prompt =
    `A factory makes ${w1pct}% of its widgets on Line A (defect rate ${r1pct}%) and the rest on Line B (defect rate ${r2pct}%). ` +
    `A random widget is picked. What is the probability it is defective? (Round to ${dp} decimals.)`;
  const explanation =
    `Law of total probability: P(defect) = ${w1pct/100}·${r1pct/100} + ${(100-w1pct)/100}·${r2pct/100} = ${fracText(value)} ≈ ${decText(value, dp)}. ` +
    `Averaging the rates equally ignores that the lines produce different volumes.`;

  return {
    answer,
    numeric: {
      id: `cp-lotp-${w1pct}-${r1pct}-${r2pct}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Law of total probability (mixture)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Conditional Probability · Law of total probability",
    },
  };
}

/** Continuous conditioning: Uniform(a,b), still running at g → P(ends within w). */
export function buildUniformInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const a = rng.pick([0, 1, 2]);
  const span = rng.pick([6, 8, 10, 12]);
  const b = a + span;
  const g = rng.int(a + 1, b - 2); // elapsed, still running
  const w = rng.int(1, b - g - 1); // extra window
  const value = uniformConditional(a, b, g, g + w); // w/(b−g)
  const dp = gradeDp(value, 4);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(w, b - a),
    `MEMORYLESS error: w/(b−a) treats the uniform like an exponential. A uniform is NOT memoryless — given it has already passed ${g}, what remains is uniform on (${g}, ${b}), a ${b - g}-second window.`,
    MISCONCEPTION.memorylessUniform,
  );
  push(
    F(w, b),
    `You divided by the full upper bound ${b}, not the surviving window (${b} − ${g}) = ${b - g}.`,
  );
  push(
    F(g, b),
    `That's the elapsed fraction ${g}/${b}, unrelated to the chance of wrapping up in the next ${w} second(s).`,
  );

  const prompt =
    `A file's download time is uniformly distributed between ${a} and ${b} seconds. It is ${g} seconds in and still transferring. ` +
    `What is the probability the download completes within the next ${w} second(s)? (Round to ${dp} decimals.)`;
  const explanation =
    `Because the download has already survived to ${g} seconds, its total time is now uniform on (${g}, ${b}) — a window of just ${b - g} seconds. ` +
    `Completing within ${w} more seconds covers ${w} of those, giving P = ${w}/${b - g} = ${fracText(value)} ≈ ${decText(value, dp)}. ` +
    `(A uniform is NOT memoryless: the fixed upper cap makes finishing soon steadily MORE likely as time elapses.)`;

  return {
    answer,
    numeric: {
      id: `cp-unif-${a}-${b}-${g}-${w}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Continuous conditioning (uniform, not memoryless)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Conditional Probability · Continuous conditioning",
    },
  };
}

/* ========================================================================== */
/* ====================  LEVEL 4 — RACES & RECURSION  ======================= */
/* ============================  (numeric)  ================================= */
/* ========================================================================== */

/** Sum race: roll two dN until sum s1 or s2 → P(s1 first) = ways(s1)/(sum). */
export function buildSumRaceInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const N = 6;
  const ways = (s: number) => {
    let c = 0;
    for (let a = 1; a <= N; a++) for (let b = 1; b <= N; b++) if (a + b === s) c++;
    return c;
  };
  // Two distinct target sums with different ordered counts. Exclude the {6,11}
  // pair so we never reproduce the source "sum-6 before sum-11" number tuple.
  const isSourcePair = (x: number, y: number) =>
    (x === 6 && y === 11) || (x === 11 && y === 6);
  let s1: number, s2: number;
  let guard = 0;
  do {
    s1 = rng.int(3, 11);
    s2 = rng.int(3, 11);
    guard++;
  } while (
    guard < 80 &&
    (s1 === s2 ||
      ways(s1) === 0 ||
      ways(s2) === 0 ||
      ways(s1) === ways(s2) ||
      isSourcePair(s1, s2))
  );
  const w1 = ways(s1);
  const w2 = ways(s2);
  const value = raceProb(w1, w2);
  const dp = gradeDp(value, 4);
  const answer = Number(decText(value, dp));

  // Unordered-count distractor (the Six-Before-Eleven trap).
  const unord = (s: number) => {
    let c = 0;
    for (let a = 1; a <= N; a++) for (let b = a; b <= N; b++) if (a + b === s) c++;
    return c;
  };
  const { errors, push } = numericErrors(answer, dp);
  push(
    F(unord(s1), unord(s1) + unord(s2)),
    `The ORDERED-vs-UNORDERED trap: counting unordered pairs gives ${unord(s1)} and ${unord(s2)} ways. But (a,b) and (b,a) are distinct rolls — use ordered counts ${w1} and ${w2}.`,
  );
  push(
    F(w1, 36),
    `That's P(sum ${s1} on a single roll) = ${w1}/36. The race ignores rolls that hit NEITHER target — divide by ${w1} + ${w2}, the deciding rolls.`,
  );
  push(
    F(1, 2),
    `The two sums aren't equally likely: sum ${s1} has ${w1} ways vs ${w2} for sum ${s2}, so it's ${w1}/(${w1}+${w2}), not ½.`,
  );

  const prompt =
    `A pair of ordinary six-sided dice is thrown again and again until the two faces first total either ${s1} or ${s2}. ` +
    `What is the chance the total reaches ${s1} before it ever reaches ${s2}? (Round to ${dp} decimals.)`;
  const explanation =
    `Throw away every roll that hits neither target; only the deciding rolls count. A total of ${s1} arises in ${w1} ordered ways, a total of ${s2} in ${w2}. ` +
    `So P(${s1} first) = ${w1}/(${w1} + ${w2}) = ${fracText(value)} ≈ ${decText(value, dp)}. Counting unordered pairs instead is the classic miscount.`;

  return {
    answer,
    numeric: {
      id: `cp-race-${s1}-${s2}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Race conditioning (ordered a/(a+b))",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Conditional Probability · Race conditioning",
    },
  };
}

/** Alternating first-to-success race, p=1/M; P(2nd mover won on toss 1 | won). */
export function buildFirstTossInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  // Per-toss success 1/M with M ≥ 3 keeps this off the source's fair-coin
  // (M = 2) instance while preserving the geometric-race conditioning.
  const M = rng.pick([3, 4, 5, 6]);
  const p = F(1, M);
  const q = F(1).sub(p);
  const value = secondMoverFirstTossGivenWin(p); // 1 − q²
  const dp = gradeDp(value, 4);
  const answer = Number(decText(value, dp));

  const bobWins = q.mul(p).div(F(1).sub(q.pow(2))); // qp/(1−q²)
  const { errors, push } = numericErrors(answer, dp);
  push(
    q.mul(p),
    `That's the UNconditional P(second mover wins on toss 1) = q·p. The question conditions on "the second mover won", so divide by P(second mover wins) = ${fracText(bobWins)}.`,
  );
  push(
    p,
    `That's the per-toss success probability p = 1/${M}, not the conditional first-toss share.`,
  );
  push(
    bobWins,
    `That's P(the second mover wins at all), the DENOMINATOR of the conditional — not the numerator restricted to a first-toss win.`,
  );

  const prompt =
    `Two contestants take turns tossing a biased coin that yields a success with probability 1/${M} on each toss; whoever lands the first success takes the game, and contestant one tosses first. ` +
    `Conditioned on contestant two being the eventual winner, how likely is it that their win arrived on their very opening toss? (Round to ${dp} decimals.)`;
  const explanation =
    `Contestant two wins on their opening toss through the sequence (miss, success), w.p. q·p = ${fracText(q.mul(p))}. ` +
    `Their overall win probability is qp/(1 − q²) = ${fracText(bobWins)}. So the conditional is (q·p)/(qp/(1−q²)) = 1 − q² = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `cp-firsttoss-${M}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Conditional over a geometric race",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Conditional Probability · Race conditioning",
    },
  };
}

/** Tie-breaker race: two dN, ties favour one player, reroll otherwise. */
export function buildTieInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  // Die sizes excluding d8 keep this off the source's d8 tie-to-win instance.
  const N = rng.pick([4, 6, 10, 12]);
  const value = tieBreakerProb(N); // 2/(N+1)
  const dp = gradeDp(value, 4);
  const answer = Number(decText(value, dp));
  const ties = N;
  const decisiveAgainst = (N * N - N) / 2;

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(ties, N * N),
    `That's P(tie) = ${ties}/${N * N} on one round. But rerolls (when the first player leads) don't decide anything — condition on the ${ties + decisiveAgainst} decisive outcomes.`,
  );
  push(
    F(1, 2),
    `The two decisive outcomes aren't equal: ${ties} ties (favouring one player) vs ${decisiveAgainst} strict-lead outcomes for the other.`,
  );
  push(
    F(ties, ties + N * N),
    `You divided the ties by the wrong total. Only the decisive outcomes (ties + one-sided leads = ${ties + decisiveAgainst}) count, not all ${N * N} plus ties.`,
  );

  const prompt =
    `Two players each roll a fair ${N}-sided die. If they tie, Player 1 wins; if Player 1 rolls strictly higher, Player 2 wins; if Player 2 rolls strictly higher, they both reroll. ` +
    `What is the probability Player 1 eventually wins? (Round to ${dp} decimals.)`;
  const explanation =
    `Of ${N * N} ordered outcomes: ${ties} ties (P1 wins), ${decisiveAgainst} with P1 higher (P2 wins), ${decisiveAgainst} with P2 higher (reroll). ` +
    `Among decisive outcomes, P(P1) = ${ties}/(${ties} + ${decisiveAgainst}) = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `cp-tie-${N}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Race with re-roll conditioning",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Conditional Probability · Race conditioning",
    },
  };
}

/** First-step recursion: alternating race, per-turn win prob w=a/b → 1/(2−w). */
export function buildFirstStepInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const [wn, wd] = rng.pick([
    [1, 2],
    [1, 3],
    [2, 3],
    [1, 4],
    [3, 4],
  ]);
  const w = F(wn, wd);
  const value = F(1).div(F(2).sub(w)); // 1/(2−w)
  const dp = gradeDp(value, 4);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    w,
    `That's just the per-turn win probability w = ${fracText(w)}. Going FIRST is worth more than one turn — solve p = w + (1−w)(1−p).`,
  );
  push(
    F(1, 2),
    `Not ½ — the first mover has an edge: they get the first chance to win each cycle, giving 1/(2−w).`,
  );
  push(
    w.div(F(1).add(w)),
    `You solved the wrong recursion. From p = w + (1−w)(1−p), the fixed point is 1/(2−w), not w/(1+w).`,
  );

  const prompt =
    `Two players alternate taking turns; on each turn the mover immediately WINS with probability ${fracText(w)} (otherwise play passes to the opponent). ` +
    `The first player goes first. What is the probability the first player wins? (Round to ${dp} decimals.)`;
  const explanation =
    `Let p be the first mover's win probability. p = ${fracText(w)} + (1 − ${fracText(w)})·(1 − p) since after a miss the opponent is now the "first mover". ` +
    `Solving: p = 1/(2 − ${fracText(w)}) = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `cp-firststep-${wn}-${wd}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "First-step recursion (alternating race)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Conditional Probability · First-step recursion",
    },
  };
}

/* ========================================================================== */
/* ====================  LEVEL 5 — RUSSIAN ROULETTE  ======================== */
/* ==============  (quiz — probabilities AND spin/no-spin decisions)  ======= */
/* ========================================================================== */

/** Fixed cylinder: one bullet, spun once, alternate → P(first player survives). */
export function buildRRFixedInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  // ODD chamber counts only: the ½-symmetry answer is then genuinely WRONG (the
  // opener pulls the extra chamber), so it stays a real distractor and all four
  // options are distinct — and it also keeps us off the source's even 6-chamber
  // ½ case. (Even counts would make ½ the correct answer, collapsing the trap.)
  const c = rng.pick([5, 7, 9]);
  const correctF = rrFixedFirstSurvives(c); // ⌊c/2⌋/c
  const shot = F(Math.ceil(c / 2), c); // P(first player shot)

  const correct: Choice = {
    text: fracText(correctF),
    rationale: `Correct — the cylinder is FIXED after one spin; the first player fires ${Math.ceil(c / 2)} of the ${c} chambers, surviving w.p. ${Math.floor(c / 2)}/${c}.`,
  };
  const distractors: Choice[] = [
    {
      text: fracText(F(1, 2)),
      rationale: `The symmetry guess. With ${c} chambers (odd count) the first player pulls the extra chamber, so it isn't exactly ½ — it's ${fracText(correctF)}.`,
    },
    {
      text: fracText(shot),
      rationale: `That's P(the FIRST player is shot) = ${fracText(shot)}. The question asks their SURVIVAL probability, the complement.`,
    },
    {
      text: fracText(F(1, c)),
      rationale: `That's the chance the bullet is in the very first chamber (1/${c}). The first player faces several chambers over the game, not just one.`,
    },
  ];

  const prompt =
    `A cylinder of ${c} chambers is loaded with a single round and spun exactly once; after that two players take alternating turns squeezing the trigger with no more spins, and you take the very first turn. ` +
    `With what probability do you come through unharmed (never meeting the loaded chamber)?`;
  const explanation =
    `That one spin fixes where the round sits. As the opener you cover chambers 1, 3, 5, … — ${Math.ceil(c / 2)} of the ${c} — and are hit only if the round lies in one of them. ` +
    `So P(unharmed) = ${Math.floor(c / 2)}/${c} = ${fracText(correctF)}.`;

  return {
    answer: fracText(correctF),
    question: {
      id: `cp-rrfixed-${c}`,
      prompt,
      explanation,
      difficulty,
      concept: "Russian Roulette (fixed cylinder / symmetry)",
      source: "Conditional Probability · Russian Roulette",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

/** Re-spun cylinder: one bullet, respin each pull → P(second player survives). */
export function buildRRRespunInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  // Chamber counts excluding 6 keep this off the source's canonical 6-chamber
  // (6/11) re-spun instance while preserving the memoryless recursion.
  const c = rng.pick([8, 10, 12]);
  const p = F(1, c);
  const correctF = rrRespunSecondSurvives(p); // 1/(2−1/c) = c/(2c−1)
  const firstSurvive = F(1).sub(correctF); // (c−1)/(2c−1)

  const correct: Choice = {
    text: fracText(correctF),
    rationale: `Correct — memoryless pulls (p = 1/${c}). P(player 1 eventually shot) = 1/(2 − 1/${c}) = ${c}/${2 * c - 1}, which is also player 2's survival probability.`,
  };
  const distractors: Choice[] = [
    {
      text: fracText(firstSurvive),
      rationale: `That's the FIRST player's survival ${fracText(firstSurvive)}. Player 2 is safer (goes second under memoryless pulls): ${fracText(correctF)}.`,
    },
    {
      text: fracText(F(1, 2)),
      rationale: `Not ½ — re-spinning makes pulls independent, and the first player faces the bullet first, so player 2 is strictly safer.`,
    },
    {
      text: fracText(p),
      rationale: `That's the single-pull risk 1/${c}. The survival probability accounts for the whole alternating, memoryless sequence.`,
    },
  ];

  const prompt =
    `A ${c}-chamber cylinder holding one round is spun afresh before each and every trigger pull. Two players take alternating turns, the opener going first. ` +
    `With what probability does the SECOND player come through safely?`;
  const explanation =
    `Every pull is an independent 1/${c} risk. Writing x = P(the opener is eventually hit): x = p + (1 − p)²·x ⇒ x = 1/(2 − p) = ${c}/${2 * c - 1}. ` +
    `The second player walks away precisely when the opener is the one hit, so their survival probability is ${fracText(correctF)} — the safer seat.`;

  return {
    answer: fracText(correctF),
    question: {
      id: `cp-rrrespun-${c}`,
      prompt,
      explanation,
      difficulty,
      concept: "Russian Roulette (re-spun / memoryless recursion)",
      source: "Conditional Probability · Russian Roulette",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

export const RR_SPIN = "Spin again (re-randomize the cylinder)";
export const RR_KEEP = "Do not spin (keep pulling the same cylinder)";
export const RR_SAME = "It makes no difference either way";

/** Two RANDOM bullets, first player survived → should the second player spin? */
export function buildRRTwoRandomInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  const c = rng.pick([6, 8]);
  const b = 2;
  const dec = rrTwoRandomDecision(c, b);
  const answer = dec.shouldSpin ? RR_SPIN : RR_KEEP; // → should spin

  const correct: Choice = {
    text: answer,
    rationale: `Correct — spinning resets loss risk to ${fracText(dec.spinLose)}, while not spinning leaves the ${b} bullets among the other ${c - 1} chambers → ${fracText(dec.noSpinLose)} > ${fracText(dec.spinLose)}.`,
  };
  const distractors: Choice[] = [
    {
      text: RR_KEEP,
      rationale: `Not spinning leaves loss risk at ${fracText(dec.noSpinLose)} (${b}/${c - 1}), HIGHER than the ${fracText(dec.spinLose)} you'd get by spinning. Surviving didn't clear enough danger.`,
    },
    {
      text: RR_SAME,
      rationale: `It does differ: spinning gives ${fracText(dec.spinLose)}, not spinning gives ${fracText(dec.noSpinLose)}. The survival evidence changes the conditional risk.`,
    },
  ];

  const prompt =
    `A ${c}-chamber revolver has two rounds dropped into randomly chosen chambers. The player ahead of you pulls once, survives, and passes it over. ` +
    `Do you re-spin the cylinder before firing, or fire it just as it stands?`;
  const explanation =
    `Re-spin: the loss probability resets to ${b}/${c} = ${fracText(dec.spinLose)}. Fire as-is: the ${b} rounds sit among the ${c - 1} untried chambers, so loss = ${b}/${c - 1} = ${fracText(dec.noSpinLose)}. ` +
    `Because ${fracText(dec.spinLose)} < ${fracText(dec.noSpinLose)}, you SHOULD re-spin.`;

  return {
    answer,
    question: {
      id: `cp-rrrandom-${c}-${b}`,
      prompt,
      explanation,
      difficulty,
      concept: "Russian Roulette (spin decision, random bullets)",
      source: "Conditional Probability · Russian Roulette",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

/** Two CONSECUTIVE bullets, first player survived → should the second spin? */
export function buildRRTwoConsecutiveInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  const c = rng.pick([6, 8]);
  const dec = rrTwoConsecutiveDecision(c);
  const answer = dec.shouldSpin ? RR_SPIN : RR_KEEP; // → should NOT spin

  const correct: Choice = {
    text: answer,
    rationale: `Correct — given survival, the hammer is on one of ${c - 2} empty chambers and only one is followed by the bullet block, so NOT spinning survives w.p. ${fracText(dec.noSpinSurvive)} > ${fracText(dec.spinSurvive)} (spin).`,
  };
  const distractors: Choice[] = [
    {
      text: RR_SPIN,
      rationale: `Spinning resets survival to ${c - 2}/${c} = ${fracText(dec.spinSurvive)}, which is LOWER than the ${fracText(dec.noSpinSurvive)} you keep by not spinning — the two bullets being adjacent helps you.`,
    },
    {
      text: RR_SAME,
      rationale: `It does differ: not spinning survives w.p. ${fracText(dec.noSpinSurvive)} vs ${fracText(dec.spinSurvive)} for spinning. Adjacency of the bullets makes the conditional favourable.`,
    },
  ];

  const prompt =
    `Two rounds occupy two ADJACENT chambers of a ${c}-chamber revolver. The player before you pulls the trigger, survives, and hands the revolver over. ` +
    `Do you re-spin the cylinder before firing, or fire it just as it stands?`;
  const explanation =
    `Fire as-is: since the previous player survived, the hammer now rests on one of the ${c - 2} empty chambers, and only ONE of those is immediately followed by the pair of rounds → survive w.p. ${fracText(dec.noSpinSurvive)}. ` +
    `Re-spin: survive w.p. ${c - 2}/${c} = ${fracText(dec.spinSurvive)}. Because ${fracText(dec.noSpinSurvive)} > ${fracText(dec.spinSurvive)}, you should NOT re-spin.`;

  return {
    answer,
    question: {
      id: `cp-rrconsec-${c}`,
      prompt,
      explanation,
      difficulty,
      concept: "Russian Roulette (spin decision, adjacent bullets)",
      source: "Conditional Probability · Russian Roulette",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

/* ========================================================================== */
/* ==================  LEVEL 6 — PARADOXES & CLASSICS  ====================== */
/* ==========================  (flashcard)  ================================= */
/* ========================================================================== */

/**
 * Framing paradoxes whose answer is two-part or a decision + probability —
 * routed as integrity-based flashcards, never scalar-graded:
 *   • Two-child: the SAME-sounding setups give 1/3 vs 1/2 (how the info arose).
 *   • Monty Hall: a DECISION (switch) plus the probability 2/3 (trap: ½).
 *   • Bertrand's box: 2/3, not the naive ½ (condition on faces).
 *   • Vacant Room: a multi-stage conditional resolving to 4/5.
 * All freshly worded — no verbatim source-dataset text.
 */
export const conditionalProbabilityFlashcards: Flashcard[] = [
  {
    id: "cp-fc-twochild",
    prompt:
      "Two neighbours each have two children. (a) Neighbour X is on a mailing list for 'families with at least one boy'. What is the probability BOTH of X's children are boys? (b) You bump into neighbour Y walking with one of their children, a boy. What is the probability BOTH of Y's children are boys?",
    answer:
      "(a) 1/3.  (b) 1/2.  The setups sound identical but the information arises differently, so they condition differently.",
    explanation:
      "Sample space for two kids: {bb, bg, gb, gg}, each 1/4. (a) 'At least one boy' keeps {bb, bg, gb}; among these P(bb) = (1/4)/(3/4) = 1/3. (b) Seeing one SPECIFIC child be a boy fixes that child and leaves the other child's sex independent, so P(other is a boy) = 1/2. The difference is not the wording but HOW the boy was revealed — a class fact ('at least one') versus observing a particular child. Collapsing both to one number is the whole trap.",
    difficulty: "medium",
    concept: "Two-child paradox (conditioning on how info arose)",
    source: "Conditional Probability · Two-child paradox",
  },
  {
    id: "cp-fc-montyhall",
    prompt:
      "A quiz show sets out three sealed boxes, a cash prize tucked inside exactly one of them. After you point to a box, the presenter — who is fully aware of where the prize sits — lifts the lid on a different box to show it is empty, then invites you to abandon your original choice for the one box still shut. Is trading up worthwhile, and if you do it, how often will you walk away with the prize?",
    answer:
      "Yes — SWITCH. Switching wins with probability 2/3 (staying wins only 1/3). The trap answer is 1/2.",
    explanation:
      "Your first pick is right with probability 1/3 and wrong with probability 2/3. If your first pick was wrong (2/3), the host is FORCED to reveal the other empty box, so the remaining box holds the prize and switching wins. If your first pick was right (1/3), switching loses. Hence P(win | switch) = 2/3. The host's action is not random — it is constrained by his knowledge — which is exactly the information that breaks the naive '2 boxes left, so 1/2' reasoning.",
    difficulty: "easy",
    concept: "Monty Hall (conditioning on the host's constrained action)",
    source: "Conditional Probability · Counterintuitive classics",
  },
  {
    id: "cp-fc-bertrand",
    prompt:
      "A drawer holds three two-sided cards: one red on both sides, one blue on both sides, and one red/blue. You pull a card at random and lay it down; the visible side is red. What is the probability the OTHER side is also red?",
    answer:
      "2/3 — not the intuitive 1/2.",
    explanation:
      "Count FACES, not cards. There are three red faces: two on the red/red card and one on the mixed card. Each is equally likely to be the visible red side. Of those three, two (the red/red card's faces) have a red back; only one (the mixed card) has a blue back. So P(other side red) = 2/3. The naive 1/2 wrongly conditions on the CARD; but a card that is red on both sides shows red twice as often, so a red sighting is evidence for it — the same faces-not-objects lesson as the coin/disc version.",
    difficulty: "medium",
    concept: "Bertrand's box paradox (faces, not objects)",
    source: "Conditional Probability · Counterintuitive classics",
  },
  {
    id: "cp-fc-vacantroom",
    prompt:
      "A public EV charging stall has a small status flag drivers are asked to set. Two-fifths of drivers always set it properly (to 'In Use' when they plug in, back to 'Available' when they leave); half of all drivers never touch it at all; and the remaining one-tenth flip it to 'In Use' on arrival but forget to reset it when they drive off. Independently of all that, the stall is genuinely in use two-fifths of the time. You walk up and its flag reads 'Available'. What is the probability the stall is actually free?",
    answer:
      "3/4 (= 0.75).",
    explanation:
      "The flag can read 'Available' only if the last driver who actually touched it was a proper (both-ways) setter — the forget-on-exit drivers would have left it on 'In Use', and the never-touch drivers change nothing. Among flag-touching drivers, P(proper) = (2/5)/(2/5 + 1/10) = 4/5, a common factor of both 'Available' worlds, so it cancels: P(free | 'Available') = P(free)/[P(free) + P(in use)·P(never-touch)] = (3/5)/[(3/5) + (2/5)(1/2)] = (3/5)/(4/5) = 3/4. The subtlety is that a never-touch driver can occupy the stall while the flag still reads 'Available' from an earlier proper user — which is exactly why the answer sits below 1.",
    difficulty: "hard",
    concept: "Multi-stage conditional over user types",
    source: "Conditional Probability · Multi-stage conditional",
  },
  {
    id: "cp-fc-threeprisoners",
    prompt:
      "Three cards go into a hat: one black on both faces, one white on both faces, one black/white. A card is drawn and slapped on the table showing BLACK. A friend bets you even money that the underside is white, arguing 'it's obviously one of the two cards with a black face, so 50/50'. Is this a fair bet?",
    answer:
      "No — the bet favours you. P(underside is black) = 2/3, so P(white) is only 1/3; even money is a losing bet for your friend.",
    explanation:
      "This is Bertrand's box in disguise. Given a black face is showing, condition on the three equally-likely black FACES: two belong to the black/black card (black underside) and one to the mixed card (white underside). So the underside is black with probability 2/3 and white with only 1/3. Your friend's '50/50' counts CARDS, ignoring that the double-black card is twice as likely to have produced a black face. At even money you should take the 'underside is black' side and expect to win 2/3 of the time.",
    difficulty: "medium",
    concept: "Bertrand's box (betting framing)",
    source: "Conditional Probability · Counterintuitive classics",
  },
];

/* ========================================================================== */
/*  Named generators (adapters used by the levels + verification tests)        */
/* ========================================================================== */

// Level 1 — Reduced sample space (quiz)
export const genTable = (rng: Rng): Question => buildTableInstance(rng, "easy").question;
export const genBoth = (rng: Rng): Question => buildBothInstance(rng, "easy").question;
export const genGivenSum = (rng: Rng): Question => buildGivenSumInstance(rng, "easy").question;
export const genBertrand = (rng: Rng): Question => buildBertrandInstance(rng, "easy").question;
export const genAllOn = (rng: Rng): Question => buildAllOnInstance(rng, "easy").question;

// Level 2 — Bayes (quiz)
export const genBayesTest = (rng: Rng): Question => buildBayesTestInstance(rng, "medium").question;
export const genWhichDie = (rng: Rng): Question => buildWhichDieInstance(rng, "medium").question;
export const genCheerLoser = (rng: Rng): Question => buildCheerLoserInstance(rng, "medium").question;
export const genInversion = (rng: Rng): Question => buildInversionInstance(rng, "medium").question;

// Level 1 — Reduced sample space (numeric — MCQ→free-response conversions)
export const genTableNumeric = (rng: Rng): NumericQuestion => buildTableNumericInstance(rng, "easy").numeric;
export const genBothNumeric = (rng: Rng): NumericQuestion => buildBothNumericInstance(rng, "easy").numeric;
export const genGivenSumNumeric = (rng: Rng): NumericQuestion => buildGivenSumNumericInstance(rng, "easy").numeric;
export const genBertrandNumeric = (rng: Rng): NumericQuestion => buildBertrandNumericInstance(rng, "easy").numeric;
export const genAllOnNumeric = (rng: Rng): NumericQuestion => buildAllOnNumericInstance(rng, "easy").numeric;

// Level 2 — Bayes (numeric — MCQ→free-response conversions)
export const genBayesTestNumeric = (rng: Rng): NumericQuestion => buildBayesTestNumericInstance(rng, "medium").numeric;
export const genWhichDieNumeric = (rng: Rng): NumericQuestion => buildWhichDieNumericInstance(rng, "medium").numeric;
export const genCheerLoserNumeric = (rng: Rng): NumericQuestion => buildCheerLoserNumericInstance(rng, "medium").numeric;
export const genInversionNumeric = (rng: Rng): NumericQuestion => buildInversionNumericInstance(rng, "medium").numeric;

// Level 3 — Total probability & continuous (numeric)
export const genTransfer = (rng: Rng): NumericQuestion => buildTransferInstance(rng, "medium").numeric;
export const genLotpLine = (rng: Rng): NumericQuestion => buildLotpLineInstance(rng, "easy").numeric;
export const genUniform = (rng: Rng): NumericQuestion => buildUniformInstance(rng, "medium").numeric;

// Level 4 — Races & recursion (numeric)
export const genSumRace = (rng: Rng): NumericQuestion => buildSumRaceInstance(rng, "medium").numeric;
export const genFirstToss = (rng: Rng): NumericQuestion => buildFirstTossInstance(rng, "medium").numeric;
export const genTie = (rng: Rng): NumericQuestion => buildTieInstance(rng, "medium").numeric;
export const genFirstStep = (rng: Rng): NumericQuestion => buildFirstStepInstance(rng, "medium").numeric;

// Level 5 — Russian Roulette (quiz: probabilities + decisions)
export const genRRFixed = (rng: Rng): Question => buildRRFixedInstance(rng, "medium").question;
export const genRRRespun = (rng: Rng): Question => buildRRRespunInstance(rng, "medium").question;
export const genRRTwoRandom = (rng: Rng): Question => buildRRTwoRandomInstance(rng, "medium").question;
export const genRRTwoConsecutive = (rng: Rng): Question =>
  buildRRTwoConsecutiveInstance(rng, "medium").question;

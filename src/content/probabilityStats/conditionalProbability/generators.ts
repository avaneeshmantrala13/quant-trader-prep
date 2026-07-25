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

const TABLE_SCENARIOS = [
  { unit: "cafe", metric: "quarterly profit", cols: ["Downtown", "Harbor", "Airport", "Campus"], rows: ["Q1", "Q2", "Q3", "Q4"] },
  { unit: "property", metric: "annual rent", cols: ["Maple", "Oak", "Pine", "Cedar"], rows: ["2020", "2021", "2022", "2023"] },
  { unit: "region", metric: "annual revenue", cols: ["North", "South", "East", "West"], rows: ["2021", "2022", "2023", "2024"] },
];

/**
 * Reduced-sample-space over a 4×4 money table: one cell is drawn, told it
 * exceeds a threshold; P(it is in the target column). The canonical distractor
 * is the REVERSED conditional (Pine Property trap): P(above | target) =
 * favorable/4 instead of P(target | above) = favorable/total.
 */
export function buildTableInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  const sc = rng.pick(TABLE_SCENARIOS);
  const threshold = rng.pick([40, 60, 70, 80]) * 1000;
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
      rationale: `The REVERSED conditional (Pine-Property trap): ${favorable}/4 is P(above | ${sc.cols[targetCol]}) — the chance a ${sc.cols[targetCol]} figure is high — not the asked P(${sc.cols[targetCol]} | above), which divides by the ${total} survivors.`,
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
    `A 4×4 table lists the ${sc.metric} of four ${sc.unit}s (${sc.cols.join(", ")}) across four periods. ` +
    `You draw one of the 16 figures at random and are told it exceeds ${threshold.toLocaleString("en-US")} dollars — ${total} of the figures do, and ${favorable} of those belong to ${sc.cols[targetCol]}. ` +
    `What is the probability the figure belongs to ${sc.cols[targetCol]}?`;
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
    `A friend rolls two fair ${N}-sided dice and truthfully tells you at least one of them came up ${face}. ` +
    `What is the probability that BOTH dice show ${face}?`;
  const explanation =
    `List the ordered pairs containing a ${face}: (${face},1…${N}) and (1…${N},${face}), which is ${2 * N - 1} distinct pairs. ` +
    `Only (${face},${face}) has both, so P = 1/${2 * N - 1} = ${fracText(correctF)}. The trap 1/${N} forgets that the conditioning pools the two overlapping single-${face} cases.`;

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
  const N = rng.pick([6, 8]);
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
    `You roll two fair ${N}-sided dice and are told their sum is ${s}. ` +
    `What is the probability that at least one die shows a ${face}?`;
  const explanation =
    `The ordered pairs summing to ${s} are the survivors (${survivors} of them). ` +
    `Exactly ${favorable} contain a ${face}, so P = ${favorable}/${survivors} = ${fracText(correctF)}. ` +
    `Using UNORDERED pairs is the classic miscount that halves the count wrongly.`;

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
  const m = rng.pick([1, 2, 3]);
  const correctF = bertrandGreenProb(g, m); // 2g/(2g+m)
  const naive = F(g, g + m); // P(all-green disc | ...) by OBJECTS

  const correct: Choice = {
    text: fracText(correctF),
    rationale: `Correct — count FACES: ${2 * g} green faces sit on all-green discs (green backs) and ${m} on mixed discs (non-green backs): ${2 * g}/${2 * g + m}.`,
  };
  const distractors: Choice[] = [
    {
      text: fracText(naive),
      rationale: `The naive answer counts DISCS not faces: ${g}/(${g}+${m}). But an all-green disc shows green twice as often, so seeing green is evidence for it — weight by faces: ${2 * g}/${2 * g + m}.`,
      misconception: MISCONCEPTION.facesNotObjects,
    },
    {
      text: fracText(F(1, 2)),
      rationale: `The "it's 50/50" intuition. Observing a green face is not neutral — the all-green discs produce green up-faces more often, tilting the posterior above ½.`,
    },
    {
      text: fracText(F(m, 2 * g + m)),
      rationale: `That's the complement — P(hidden face is NON-green) among the green-up faces. The question asks for a green hidden face.`,
    },
  ];

  const prompt =
    `A bag holds ${g} disc(s) green on BOTH sides and ${m} disc(s) green on one side and grey on the other. ` +
    `You draw one disc at random and drop it; the face showing is green. What is the probability the HIDDEN face is also green?`;
  const explanation =
    `Condition on FACES, not discs. There are ${2 * g} green faces on all-green discs (their backs are green) and ${m} green faces on mixed discs (backs grey). ` +
    `Given a green up-face, P(back also green) = ${2 * g}/${2 * g + m} = ${fracText(correctF)} — not the naive ${fracText(naive)}.`;

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
    `A strip of ${n} bulbs each turns on independently with probability ½. You glance over and see at least one is lit. ` +
    `What is the probability that ALL ${n} bulbs are on?`;
  const explanation =
    `Let A = all on (⊆ B), B = at least one on. P(A) = (1/2)^${n} = 1/${2 ** n}, P(B) = 1 − 1/${2 ** n} = ${2 ** n - 1}/${2 ** n}. ` +
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
  const [N1, N2] = rng.shuffle([4, 6, 8, 10, 12]).slice(0, 2).sort((a, b) => a - b);
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
    `You pick one of two fair dice at random — a ${N1}-sided and a ${N2}-sided die — and roll it, getting a ${r}. ` +
    `What is the probability you rolled the ${N1}-sided die?`;
  const explanation =
    `Priors ½ each. P(${r}|d${N1}) = 1/${N1}, P(${r}|d${N2}) = 1/${N2}. ` +
    `P(d${N1}|${r}) = (½·1/${N1})/(½·1/${N1} + ½·1/${N2}) = ${N2}/${N1 + N2} = ${fracText(correctF)}. A smaller die makes any given low roll more likely.`;

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
  let a: number, b: number, c: number;
  let guard = 0;
  do {
    a = rng.int(1, d - 2);
    b = rng.int(1, d - 1 - a);
    c = rng.int(1, d - a - b);
    guard++;
  } while (guard < 80 && (a === b || b === c || a === c || a + b + c > d));
  const wins = [F(a, d), F(b, d), F(c, d)];
  const losses = wins.map((w) => F(1).sub(w));
  const target = rng.int(0, 2);
  const correctF = bayesPosterior([F(1, 3), F(1, 3), F(1, 3)], losses, target);
  const names = ["Alpha", "Bravo", "Cosmo"];

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
    `Three racers win with probabilities ${fracText(wins[0])}, ${fracText(wins[1])}, and ${fracText(wins[2])} (${names.join(", ")}). ` +
    `You pick one at random to cheer for, and your racer LOSES. What is the probability you picked ${names[target]}?`;
  const explanation =
    `Priors ⅓. Weight by the LOSS likelihood 1 − win: ${losses.map(fracText).join(", ")}. ` +
    `P(${names[target]} | lost) = ${fracText(losses[target])}/(${losses.map(fracText).join(" + ")}) = ${fracText(correctF)}. Losing is evidence AGAINST the strong racers.`;

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
    `You ignored the transfer and used Box 2's original ratio ${d2}/${d2 + m2}. The moved chocolate changes Box 2's composition — condition on what was moved.`,
  );
  push(
    F(d2 + 1, size2),
    `You assumed a DARK chocolate was moved for sure. It's dark only w.p. ${fracText(pDarkMoved)}; average over both transfer outcomes.`,
  );
  push(
    pDarkMoved,
    `That's just P(the moved chocolate is dark). The question asks P(the chocolate EATEN from Box 2 is dark) after the transfer.`,
  );

  const prompt =
    `Box 1 has ${d1} dark and ${m1} milk chocolates; Box 2 has ${d2} dark and ${m2} milk. ` +
    `You move one random chocolate from Box 1 into Box 2, then eat one random chocolate from Box 2. ` +
    `What is the probability the eaten chocolate is dark? (Round to ${dp} decimals.)`;
  const explanation =
    `Condition on the transferred chocolate. Dark moved (w.p. ${fracText(pDarkMoved)}): Box 2 is ${d2 + 1}/${size2} dark. ` +
    `Milk moved (w.p. ${fracText(pMilkMoved)}): ${d2}/${size2} dark. ` +
    `P(dark) = ${fracText(pDarkMoved)}·${d2 + 1}/${size2} + ${fracText(pMilkMoved)}·${d2}/${size2} = ${fracText(value)} ≈ ${decText(value, dp)}.`;

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
    `MEMORYLESS error: w/(b−a) treats the uniform like an exponential. Uniform is NOT memoryless — given it has run past ${g}, the remaining time is uniform on (${g}, ${b}), a ${b - g}-unit window.`,
    MISCONCEPTION.memorylessUniform,
  );
  push(
    F(w, b),
    `You divided by the full upper bound ${b}, not the remaining window (${b} − ${g}) = ${b - g}.`,
  );
  push(
    F(g, b),
    `That's the elapsed fraction ${g}/${b}, unrelated to the chance of finishing in the next ${w} unit(s).`,
  );

  const prompt =
    `A process lasts a Uniform(${a}, ${b}) number of minutes. It has already run for ${g} minutes and is still going. ` +
    `What is the probability it finishes within the next ${w} minute(s)? (Round to ${dp} decimals.)`;
  const explanation =
    `Given the process passed ${g} minutes, its total duration is uniform on (${g}, ${b}) — a ${b - g}-minute window. ` +
    `Finishing within ${w} more minutes covers ${w} of those, so P = ${w}/${b - g} = ${fracText(value)} ≈ ${decText(value, dp)}. ` +
    `(Uniform is NOT memoryless: as time passes, the fixed cap makes finishing soon MORE likely.)`;

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
  // Two distinct target sums with different ordered counts.
  let s1: number, s2: number;
  let guard = 0;
  do {
    s1 = rng.int(3, 11);
    s2 = rng.int(3, 11);
    guard++;
  } while (guard < 80 && (s1 === s2 || ways(s1) === 0 || ways(s2) === 0 || ways(s1) === ways(s2)));
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
    `You roll two fair six-sided dice repeatedly. What is the probability you roll a sum of ${s1} before a sum of ${s2}? (Round to ${dp} decimals.)`;
  const explanation =
    `Only the deciding rolls matter. Sum ${s1} has ${w1} ordered ways, sum ${s2} has ${w2}. ` +
    `P(${s1} first) = ${w1}/(${w1} + ${w2}) = ${fracText(value)} ≈ ${decText(value, dp)}. Using unordered pairs is the classic miscount.`;

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
  const M = rng.pick([2, 3, 4, 6]);
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
    `Two players alternately flip a coin with P(success) = 1/${M} per flip; the first success wins, and the FIRST player flips first. ` +
    `Given that the SECOND player won, what is the probability they won on their very first flip? (Round to ${dp} decimals.)`;
  const explanation =
    `The second player wins on flip 1 via (miss, success) w.p. q·p = ${fracText(q.mul(p))}. ` +
    `They win at all w.p. qp/(1 − q²) = ${fracText(bobWins)}. Conditional = (q·p)/(qp/(1−q²)) = 1 − q² = ${fracText(value)} ≈ ${decText(value, dp)}.`;

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
  const N = rng.pick([4, 6, 8, 10]);
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
  const c = rng.pick([5, 6, 7, 8]);
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
    `A revolver has ${c} chambers and one bullet. It is spun ONCE, then two players alternate pulling the trigger (no further spins), the first player going first. ` +
    `What is the probability the first player survives (is never shot)?`;
  const explanation =
    `After a single spin the bullet's position is fixed. The first player fires chambers 1, 3, 5, … (${Math.ceil(c / 2)} of the ${c}); they are shot iff the bullet sits in one of those. ` +
    `P(survive) = ${Math.floor(c / 2)}/${c} = ${fracText(correctF)}.`;

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
  const c = rng.pick([6, 8, 10]);
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
    `A revolver with ${c} chambers and one bullet is RE-SPUN before every trigger pull. Two players alternate, the first going first. ` +
    `What is the probability the SECOND player survives?`;
  const explanation =
    `Each pull is independent with risk p = 1/${c}. Let x = P(player 1 is eventually shot): x = p + (1 − p)²·x ⇒ x = 1/(2 − p) = ${c}/${2 * c - 1}. ` +
    `Player 2 survives exactly when player 1 is the one shot, so P = ${fracText(correctF)} — player 2 is the safer seat.`;

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
    `Two bullets are placed in RANDOM chambers of a ${c}-chamber revolver. The first player pulls the trigger and survives, then hands it to you. ` +
    `Should you spin the cylinder before pulling, or pull as-is?`;
  const explanation =
    `Spin: loss probability resets to ${b}/${c} = ${fracText(dec.spinLose)}. No spin: the ${b} bullets are among the ${c - 1} chambers you haven't tried, so loss = ${b}/${c - 1} = ${fracText(dec.noSpinLose)}. ` +
    `Since ${fracText(dec.spinLose)} < ${fracText(dec.noSpinLose)}, you SHOULD spin.`;

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
    `Two bullets sit in two CONSECUTIVE chambers of a ${c}-chamber revolver. The first player pulls and survives, then hands it to you. ` +
    `Should you spin the cylinder before pulling, or pull as-is?`;
  const explanation =
    `No spin: given the first player survived, the hammer rests on one of the ${c - 2} empty chambers, and only ONE of those is immediately followed by the bullet pair → survive w.p. ${fracText(dec.noSpinSurvive)}. ` +
    `Spin: survive w.p. ${c - 2}/${c} = ${fracText(dec.spinSurvive)}. Since ${fracText(dec.noSpinSurvive)} > ${fracText(dec.spinSurvive)}, you should NOT spin.`;

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
      "On a game show there are three identical boxes; exactly one holds a prize. You pick a box. The host, who knows the contents, opens one of the OTHER two boxes to reveal it is empty, then offers you the chance to switch to the remaining unopened box. Should you switch, and what is your probability of winning if you do?",
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
      "A phone booth has a sign users are supposed to flip: half of users always flip it correctly (to 'Occupied' on entering, back to 'Vacant' on leaving); a quarter ignore the sign entirely; the remaining quarter flip it to 'Occupied' on entry but forget to flip it back on exit. The booth is genuinely occupied half the time. You walk up and the sign reads 'Vacant'. What is the probability the booth is actually vacant?",
    answer:
      "4/5 (= 0.8).",
    explanation:
      "The sign reads 'Vacant' only when the last sign-touching user was a correct (both-ways) flipper — the forget-on-exit users would have left it on 'Occupied', and ignorers never touch it. Among sign-touching users, P(both-ways) = (1/2)/(1/2 + 1/4) = 2/3, a common factor in both 'Vacant' worlds. So it cancels: P(vacant | 'Vacant') = P(vacant)/[P(vacant) + P(occupied)·P(ignore)] = (1/2)/[(1/2) + (1/2)(1/4)] = (1/2)/(5/8) = 4/5. The subtlety is that an ignorer can occupy the booth while the sign still (correctly, from a past user) reads 'Vacant', which is why the answer isn't 1.",
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

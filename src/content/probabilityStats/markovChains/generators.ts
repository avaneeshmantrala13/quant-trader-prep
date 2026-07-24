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
  boldPlayReachProb,
  cubeWalkExpected,
  decText,
  exactDecimals,
  fracText,
  gamblerRuinReach,
  grid2DCenterExpected,
  lineWalkExpected,
  patternRaceProb,
  patternWaitExpected,
  polygonOppositeExpected,
  runWaitExpected,
  spinnerTwoDistinctExpected,
  twoInARowExpected,
  twoStateReturnExpected,
} from "./markov";
import { mixNumericGenerators, mixQuestionGenerators } from "../../mixFamilies";

/**
 * Parametric generators + per-family misconception taxonomy for the
 * Probability & Statistics → Markov Chain Probability subcategory.
 *
 * Every generated scalar is produced by the EXACT solver in `./markov.ts` (first-
 * step analysis); every distractor (`quiz` choices / `numeric` commonErrors) is a
 * re-derived, NAMED misconception, guaranteed distinct and ≠ the answer.
 *
 * Mode per family (see `./levels.ts`):
 *   • `numeric`   — where a clean expected value is the point: two-state return
 *                   times, spinners, small line walks (mc-1); coin-pattern &
 *                   reset waits (mc-2); random walks on the cube/polygon/2-D grid
 *                   (mc-4).
 *   • `quiz`      — where NAMING the misconception teaches: pattern waits (THH-
 *                   treated-like-HHH overlap trap) & pattern races (naive ½)
 *                   (mc-3); gambler's-ruin symmetric-vs-biased & bold-play traps
 *                   (mc-5).
 *   • `flashcard` — the reasoning specials whose answer is piecewise or a
 *                   judgment + number (Drunkard's Walk, birthday-repeat bet) (mc-6).
 *
 * NONE of the 16 source-dataset questions are user-facing — they live only in
 * `./markovChains.test.ts` as hidden fixtures; every playable item is freshly
 * generated with different names/numbers/framing.
 */

/* ========================================================================== */
/*  Shared helpers (mirrors the sibling subcategories)                         */
/* ========================================================================== */

interface Choice {
  text: string;
  rationale: string;
}

/** Assemble + shuffle MC choices so the answer position never leaks. */
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

/** Deduping accumulator for `numeric` commonErrors (rounded to `dp`, ≠ answer). */
function numericErrors(
  answer: number,
  dp: number,
): {
  errors: { value: number; feedback: string }[];
  push: (raw: FractionType | number, feedback: string) => void;
} {
  const f = 10 ** dp;
  const seen = new Set<number>([Math.round(answer * f)]);
  const errors: { value: number; feedback: string }[] = [];
  const push = (raw: FractionType | number, feedback: string) => {
    const v = typeof raw === "number" ? raw : raw.valueOf();
    if (!Number.isFinite(v)) return;
    const rounded = Math.round(v * f) / f;
    const k = Math.round(rounded * f);
    if (seen.has(k)) return;
    seen.add(k);
    errors.push({ value: rounded, feedback });
  };
  return { errors, push };
}

/** Decimals for a numeric expected value (exact if terminating within 2). */
function numDp(f: FractionType): number {
  return exactDecimals(f, 2);
}

/** Decimals a ruin probability quiz choice is formatted at (≥ 2, cap 3). */
function ruinDp(f: FractionType): number {
  return Math.max(2, exactDecimals(f, 3));
}

/** Combine several Question generators into one that picks per call (family-tagged). */
export const mixQuiz = (pool: QuestionGenerator[]): QuestionGenerator =>
  mixQuestionGenerators(pool);

/** Combine several numeric generators into one that picks per call (family-tagged). */
export const mixNumeric = (
  pool: NumericQuestionGenerator[],
): NumericQuestionGenerator => mixNumericGenerators(pool);

/* ========================================================================== */
/* =================  LEVEL 1 — FIRST-STEP ANALYSIS (numeric)  ============== */
/* ========================================================================== */

const WEATHER = [
  { s: "clear", o: "stormy", unit: "day" },
  { s: "calm", o: "volatile", unit: "session" },
  { s: "sunny", o: "rainy", unit: "day" },
];

/**
 * Two-state return time (Animal-Migrations skeleton): today's regime `s`
 * repeats w.p. pStayS, else flips to `o` which repeats w.p. pStayO. Expected
 * steps until the next `s`. E = 1 + (1−pStayS)/(1−pStayO). The canonical trap is
 * FORGETTING the +1 (each transition is still a step).
 */
export function buildMigrationsInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const w = rng.pick(WEATHER);
  const pS = rng.pick([6, 7, 8, 9]); // tenths
  const pO = rng.pick([4, 5, 6].filter((x) => x < pS));
  const pStayS = F(pS, 10);
  const pStayO = F(pO, 10);
  const value = twoStateReturnExpected(pStayS, pStayO);
  const dp = Math.max(2, numDp(value));
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(1).sub(pStayS).div(F(1).sub(pStayO)),
    `You forgot the +1. Even the transitions you take count as ${w.unit}s — first-step analysis is E = 1 + Σ P·E', so add the current step.`,
  );
  push(
    F(1).div(F(1).sub(pStayO)),
    `That's the expected run-length of a ${w.o} spell, 1/(1−${fracText(pStayO)}), not the wait for the next ${w.s} ${w.unit}.`,
  );
  push(
    F(1).div(F(1).sub(pStayS)),
    `That treats it as a simple geometric wait to leave the ${w.s} state, ignoring the detour through ${w.o} ${w.unit}s before you return.`,
  );

  const pctS = pS * 10;
  const pctO = pO * 10;
  const prompt =
    `Each ${w.unit}'s weather depends only on the last. A ${w.s} ${w.unit} is followed by another ${w.s} ${w.unit} ${pctS}% of the time (otherwise ${w.o}); ` +
    `a ${w.o} ${w.unit} stays ${w.o} ${pctO}% of the time (otherwise ${w.s}). Today is ${w.s}. ` +
    `On average, how many ${w.unit}s until the next ${w.s} ${w.unit}? (Round to ${dp} decimals.)`;
  const explanation =
    `First-step analysis. From ${w.o}: E_o = 1 + ${fracText(pStayO)}·E_o ⇒ E_o = 1/(1−${fracText(pStayO)}) = ${fracText(F(1).div(F(1).sub(pStayO)))}. ` +
    `From ${w.s} the next ${w.unit} is ${w.s} (done) w.p. ${fracText(pStayS)}, else you visit ${w.o}: E = 1 + (1−${fracText(pStayS)})·E_o = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `mc-migrate-${pS}-${pO}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Expected hitting time (two-state return)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Markov Chains · First-step analysis",
    },
  };
}

const SPINNER_TRIPLES: [number, number, number][][] = [
  [[1, 2], [1, 4], [1, 4]],
  [[1, 2], [1, 3], [1, 6]],
  [[2, 5], [2, 5], [1, 5]],
  [[1, 3], [1, 3], [1, 3]],
  [[1, 2], [3, 8], [1, 8]],
  [[3, 8], [3, 8], [1, 4]],
].map((t) => t as [number, number, number][]);

/**
 * Spinner: expected spins to land on TWO DISTINCT regions. After the first spin
 * in region r, the wait for anything different is geometric mean 1/(1−P(r)), so
 * E = 1 + Σ P(r)/(1−P(r)). Traps: forgetting the first spin, or ignoring the
 * weighting.
 */
export function buildSpinnerInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const triple = rng.pick(SPINNER_TRIPLES);
  const probs = triple.map(([n, d]) => F(n, d));
  const value = spinnerTwoDistinctExpected(probs);
  const dp = Math.max(2, numDp(value));
  const answer = Number(decText(value, dp));

  const sumRatio = probs.reduce((a, p) => a.add(p.div(F(1).sub(p))), F(0));
  const sumUnweighted = probs.reduce((a, p) => a.add(F(1).div(F(1).sub(p))), F(0));
  const { errors, push } = numericErrors(answer, dp);
  push(
    sumRatio,
    `You forgot to count the FIRST spin. The formula is 1 + Σ P(r)/(1−P(r)); you dropped the leading 1.`,
  );
  push(
    2,
    `2 is the MINIMUM number of spins, not the expected — you can keep re-landing in the first region several times before something new appears.`,
  );
  push(
    sumUnweighted,
    `You summed 1/(1−P(r)) without weighting by P(r) — each region's follow-on wait must be weighted by the chance you land there first.`,
  );

  const probText = probs.map((p) => fracText(p)).join(", ");
  const prompt =
    `A spinner is divided into three regions with probabilities ${probText}. ` +
    `You spin repeatedly until the pointer has landed in two DIFFERENT regions. ` +
    `What is the expected number of spins? (Round to ${dp} decimals.)`;
  const explanation =
    `After the first spin lands in region r, the extra spins to see something different are geometric with mean 1/(1−P(r)). ` +
    `So E = 1 + Σ P(r)/(1−P(r)) = 1 + ${probs.map((p) => `${fracText(p)}/(1−${fracText(p)})`).join(" + ")} = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `mc-spin-${triple.map(([n, d]) => `${n}_${d}`).join("-")}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Expected hitting time (spinner, two distinct regions)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Markov Chains · First-step analysis",
    },
  };
}

const WALK_THEME = [
  { actor: "a frog", place: "lily pads", edge: "the water" },
  { actor: "a checker", place: "squares", edge: "off the board" },
  { actor: "a marble", place: "grooves", edge: "the edge" },
];

/**
 * Symmetric ±1 walk on a short row of `sites` interior positions; from
 * `startSite` step to either neighbour w.p. ½, absorbed on stepping off either
 * end. Expected steps = startSite·(sites+1−startSite). Traps: guessing the
 * distance to the nearest edge, or using the wrong boundary (sites vs sites+1).
 */
export function buildLineWalkInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(WALK_THEME);
  const sites = rng.pick([2, 3, 4, 5]);
  const startSite = rng.int(1, sites);
  const value = lineWalkExpected(sites, startSite);
  const dp = 0;
  const answer = value.valueOf();

  const { errors, push } = numericErrors(answer, dp);
  push(
    Math.min(startSite, sites + 1 - startSite),
    `That's the distance to the nearer edge — the fewest possible steps, not the expected number, since the walk often wanders the wrong way first.`,
  );
  push(
    startSite * (sites - startSite),
    `Off-by-one on the boundary: the exit time is i·(N−i) with N = sites+1 = ${sites + 1} (the two off-board spots), so it's ${startSite}·${sites + 1 - startSite}, not ${startSite}·${sites - startSite}.`,
  );
  push(
    sites,
    `You guessed the number of positions (${sites}). The expected exit time depends on WHERE you start, via startSite·(sites+1−startSite).`,
  );

  const prompt =
    `${th.actor.charAt(0).toUpperCase() + th.actor.slice(1)} sits on a row of ${sites} ${th.place}, on position ${startSite} counting from the left. ` +
    `Each second it hops to an adjacent position with equal probability; hopping off either end lands it in ${th.edge} and it stops. ` +
    `What is the expected number of hops before it stops? (Whole number.)`;
  const explanation =
    `This is a symmetric walk on ${sites} interior sites, absorbed off either end. The expected exit time from site i is i·(N−i) with N = ${sites + 1}: ` +
    `${startSite}·(${sites + 1}−${startSite}) = ${startSite}·${sites + 1 - startSite} = ${fracText(value)}.`;

  return {
    answer,
    numeric: {
      id: `mc-line-${sites}-${startSite}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Expected hitting time (symmetric line walk)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Markov Chains · First-step analysis",
    },
  };
}

/* ========================================================================== */
/* ==================  LEVEL 2 — COIN PATTERN WAITS (numeric)  ============== */
/* ========================================================================== */

const RUN_THEME = [
  { actor: "a fair coin", event: "heads", verb: "flip" },
  { actor: "a fair coin", event: "tails", verb: "toss" },
];

/**
 * Expected fair-coin flips to see a RUN of n in a row = 2^{n+1}−2. Traps:
 * 1/pⁿ = 2ⁿ (treating each n-window as independent), n/p = 2n (a failure only
 * costs one step), and the 2^{n+1}−1 off-by-one.
 */
export function buildRunHeadsInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(RUN_THEME);
  const n = rng.pick([2, 3, 4, 5]);
  const value = runWaitExpected(F(1, 2), n);
  const dp = 0;
  const answer = value.valueOf();

  const { errors, push } = numericErrors(answer, dp);
  push(
    2 ** n,
    `1/pⁿ = 2^${n} = ${2 ** n} is the reciprocal of the chance a SPECIFIC block of ${n} flips is all ${th.event} — it ignores that a run can start mid-stream and that failures reset progress.`,
  );
  push(
    2 * n,
    `n/p = 2·${n} = ${2 * n} assumes a failure costs you just one step. In a run, a single wrong flip wipes out ALL progress, so the wait is far longer.`,
  );
  push(
    2 ** (n + 1) - 1,
    `Off by one — the closed form for a run of n is 2^{n+1}−2 = ${2 ** (n + 1) - 2}, not 2^{n+1}−1.`,
  );

  const prompt =
    `You ${th.verb} ${th.actor} repeatedly. What is the expected number of ${th.verb}s until you first see ${n} ${th.event} in a row? (Whole number.)`;
  const explanation =
    `Let s_k be the expected additional flips with k of the ${n} in hand: s_k = 1 + ½·s_{k+1} + ½·s_0. Back-substituting gives the closed form 2^{n+1}−2 = 2^${n + 1}−2 = ${fracText(value)}.`;

  return {
    answer,
    numeric: {
      id: `mc-run-${n}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Expected wait for a run of n (2^{n+1}−2)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Markov Chains · Coin-pattern waits",
    },
  };
}

const TILE_THEME = [
  { actor: "chips from a bag", hit: "a red chip", other: "chips" },
  { actor: "cards from a large shuffled deck", hit: "a face card", other: "cards" },
  { actor: "beads from a jar", hit: "a gold bead", other: "beads" },
];

const TWO_IN_ROW_P: [number, number][] = [
  [3, 8],
  [2, 5],
  [1, 4],
  [3, 5],
  [1, 3],
  [2, 7],
];

/**
 * Expected draws (each a success w.p. p) for TWO successes in a row = (1+p)/p².
 * Traps: 1/p² (forgot the +1 term — the pure geometric), 2/p (double single-
 * success wait), 1/p (one success only).
 */
export function buildTwoInARowInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(TILE_THEME);
  const [pn, pd] = rng.pick(TWO_IN_ROW_P);
  const p = F(pn, pd);
  const value = twoInARowExpected(p);
  const dp = numDp(value);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(1).div(p.pow(2) as FractionType),
    `1/p² forgets the +1 term. It is the wait for a specific ordered pair with no self-overlap; but after one success, a failure drops you back one step, so the true wait is (1+p)/p².`,
  );
  push(
    F(2).div(p),
    `2/p just doubles a single-success wait. Two in a ROW is not twice one success — you keep losing partial progress.`,
  );
  push(
    F(1).div(p),
    `1/p is the wait for ONE success. You need two consecutive, which is much longer: (1+p)/p².`,
  );

  const prompt =
    `You draw ${th.actor} one at a time (with replacement); each draw is ${th.hit} with probability ${fracText(p)}. ` +
    `What is the expected number of draws until you get two of ${th.hit.replace("a ", "").replace("an ", "")} in a row? (Round to ${dp} decimals.)`;
  const explanation =
    `Two states: E₀ (no streak) = 1 + p·E₁ + (1−p)·E₀; E₁ (one in hand) = 1 + p·0 + (1−p)·E₀. ` +
    `Solving gives E₀ = (1+p)/p² = (1+${fracText(p)})/(${fracText(p)})² = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `mc-tworow-${pn}-${pd}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Expected wait for two-in-a-row ((1+p)/p²)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Markov Chains · Coin-pattern waits",
    },
  };
}

const RESET_THEME = [
  { need: "correct digits", device: "a keypad", reset: "a wrong tap clears everything" },
  { need: "good rounds", device: "a bonus game", reset: "a miss resets your progress" },
  { need: "valid coins", device: "an old meter", reset: "it jams and spits everything back" },
];

/**
 * Reset chain (Parking-Meter skeleton): need k successes in a row, and each
 * step succeeds w.p. ½ else FULLY resets — identical skeleton to a run of k, so
 * the wait is 2^{k+1}−2. Traps: k/p = 2k (a reset only costs one), 2^k, and the
 * off-by-one.
 */
export function buildResetChainInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(RESET_THEME);
  const k = rng.pick([3, 4, 5]);
  const value = runWaitExpected(F(1, 2), k);
  const dp = 0;
  const answer = value.valueOf();

  const { errors, push } = numericErrors(answer, dp);
  push(
    2 * k,
    `k/p = 2·${k} = ${2 * k} assumes a reset costs you a single step. The reset wipes ALL ${k} of your accumulated ${th.need}, so the wait is far longer.`,
  );
  push(
    2 ** k,
    `2^${k} = ${2 ** k} = 1/pᵏ is the reciprocal of finishing in the first ${k} tries with no reset — it undercounts by ignoring restarts.`,
  );
  push(
    2 ** (k + 1) - 1,
    `Off by one — the closed form is 2^{k+1}−2 = ${2 ** (k + 1) - 2}.`,
  );

  const prompt =
    `You need ${k} consecutive ${th.need} on ${th.device}; after each attempt there is a 50% chance ${th.reset}. ` +
    `What is the expected number of attempts until you succeed? (Whole number.)`;
  const explanation =
    `Because a failure resets ALL progress, this is exactly a run of ${k} "successes" on a fair coin: s_k = 1 + ½·s_{k+1} + ½·s_0, giving 2^{k+1}−2 = 2^${k + 1}−2 = ${fracText(value)}.`;

  return {
    answer,
    numeric: {
      id: `mc-reset-${k}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Expected hitting time with reset (2^{k+1}−2)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Markov Chains · Coin-pattern waits",
    },
  };
}

/* ========================================================================== */
/* ===================  LEVEL 3 — PATTERN RACES (quiz)  ===================== */
/* ========================================================================== */

/** Random binary pattern (H/T) of a given length. */
function randomPattern(rng: Rng, len: number): string {
  return Array.from({ length: len }, () => (rng.chance(0.5) ? "H" : "T")).join("");
}

/**
 * Expected fair-coin flips to first see a given pattern = 2·corr(A,A) (Conway).
 * The signature trap is TREATING EVERY length-L pattern like the max-overlap run
 * HHH…H (value 2^{L+1}−2) — but overlap makes patterns like THH strictly faster.
 */
export function buildPatternWaitInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  const L = rng.pick([3, 3, 4]);
  let pat = randomPattern(rng, L);
  // Avoid the all-same pattern so the overlap trap is a genuine (wrong) distractor.
  let guard = 0;
  while (guard < 40 && new Set(pat.split("")).size === 1) {
    pat = randomPattern(rng, L);
    guard++;
  }
  const value = patternWaitExpected(pat);
  const noOverlap = 2 ** (L + 1) - 2;
  const independent = 2 ** L;

  const correct: Choice = {
    text: fracText(value),
    rationale: `Correct — by Conway's rule E = 2·(overlap sum). Pattern ${pat} shares only its full-length overlap with itself in some places, giving ${fracText(value)}.`,
  };
  const distractors: Choice[] = [
    {
      text: String(noOverlap),
      rationale: `The overlap trap: assuming EVERY length-${L} pattern waits 2^{${L}+1}−2 = ${noOverlap} like a run of ${L} identical flips. Patterns with a leading mismatch (e.g. ${pat}) don't fully reset on failure, so they're faster.`,
    },
    {
      text: String(independent),
      rationale: `1/pᴸ = 2^${L} = ${independent} treats the pattern as a single independent ${L}-flip block. The true expected wait accounts for overlapping progress.`,
    },
    {
      text: String(2 * L),
      rationale: `L/p = ${2 * L} sums ${L} independent single-flip waits, ignoring that the pattern must appear CONSECUTIVELY.`,
    },
  ];

  const prompt =
    `You flip a fair coin repeatedly, writing H for heads and T for tails. ` +
    `What is the expected number of flips until the pattern ${pat} first appears?`;
  const explanation =
    `By Conway's leading-number rule, E[wait for A] = 2·corr(A,A), where corr sums 2^{k−1} over each k for which A's last k symbols equal its first k. For ${pat} this gives ${fracText(value)}. ` +
    `The tempting ${noOverlap} assumes every length-${L} pattern behaves like ${"H".repeat(L)} (2^{L+1}−2), but overlap structure makes waits differ.`;

  return {
    answer: fracText(value),
    question: {
      id: `mc-patwait-${pat}`,
      prompt,
      explanation,
      difficulty,
      concept: "Expected pattern wait (Conway; overlap ≠ run)",
      source: "Markov Chains · Pattern waits",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

/**
 * P(pattern A appears before pattern B) on a fair coin, via Conway's odds
 * formula. The naive answer is ½ (patterns are "equally likely"); the truth
 * depends on overlap structure (HHH-before-THH = 1/8). Also traps: reversing
 * which pattern, and a speed-proportional guess E_B/(E_A+E_B).
 */
export function buildPatternRaceInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  let a = randomPattern(rng, 3);
  let b = randomPattern(rng, 3);
  let value = F(1, 2);
  let guard = 0;
  // Require a non-degenerate, non-½ race with both Conway surpluses positive.
  while (guard < 200) {
    guard++;
    a = randomPattern(rng, 3);
    b = randomPattern(rng, 3);
    if (a === b) continue;
    try {
      value = patternRaceProb(a, b);
    } catch {
      continue;
    }
    const v = value.valueOf();
    if (v > 0 && v < 1 && !value.equals(F(1, 2))) break;
  }
  const reversed = F(1).sub(value);
  const waitA = patternWaitExpected(a);
  const waitB = patternWaitExpected(b);
  const speedGuess = F(waitB.valueOf(), waitA.valueOf() + waitB.valueOf());

  const correct: Choice = {
    text: fracText(value),
    rationale: `Correct — Conway's odds rule (from the self/cross overlaps of ${a} and ${b}) gives P(${a} first) = ${fracText(value)}.`,
  };
  const distractors: Choice[] = [
    {
      text: fracText(F(1, 2)),
      rationale: `The naive ½ assumes the two patterns are symmetric. They usually aren't — overlap structure can make one pattern far more likely to appear first.`,
    },
    {
      text: fracText(reversed),
      rationale: `That's P(${b} first) = 1 − ${fracText(value)} — you solved the race for the OTHER pattern.`,
    },
    {
      text: fracText(speedGuess),
      rationale: `Weighting by expected waits (E_${b}/(E_${a}+E_${b})) assumes the faster pattern wins in proportion to its speed. Pattern races don't work that way; use Conway's overlap-based odds.`,
    },
  ];

  const prompt =
    `You flip a fair coin repeatedly. What is the probability that the pattern ${a} appears strictly before the pattern ${b}?`;
  const explanation =
    `Conway's leading numbers turn each pattern's self- and cross-overlaps into odds. Here P(${a} before ${b}) = ${fracText(value)}. ` +
    `The naive ½ ignores overlap; e.g. the classic HHH-before-THH is 1/8, not ½, because HHH can only win if it hits in the very first three flips.`;

  return {
    answer: fracText(value),
    question: {
      id: `mc-patrace-${a}-${b}`,
      prompt,
      explanation,
      difficulty,
      concept: "Pattern race (Conway; naive-½ trap)",
      source: "Markov Chains · Pattern races",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

/* ========================================================================== */
/* ================  LEVEL 4 — RANDOM WALKS ON GRAPHS (numeric)  ============ */
/* ========================================================================== */

const CUBE_THEME = [
  { actor: "an ant", node: "corner", solid: "cube" },
  { actor: "a bug", node: "vertex", solid: "cube" },
];

/**
 * Random walk on the corners of a cube, start corner → opposite corner (each
 * step to a uniform neighbour, 1/3). Expected steps = 10. Traps: the graph
 * distance 3 (min steps), the vertex count 8, and the distance-1 hitting time 9.
 */
export function buildCubeWalkInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(CUBE_THEME);
  const value = cubeWalkExpected();
  const dp = 0;
  const answer = value.valueOf();

  const { errors, push } = numericErrors(answer, dp);
  push(3, `3 is the graph distance (fewest edges) between opposite ${th.node}s — the minimum, not the expected number under a random walk.`);
  push(8, `8 is the number of ${th.node}s on the ${th.solid}. The expected hitting time is a solved system, not the vertex count.`);
  push(9, `9 is the expected time from an ADJACENT ${th.node} (distance 1). From the start (distance 0) it is one more: 10.`);

  const prompt =
    `${th.actor.charAt(0).toUpperCase() + th.actor.slice(1)} sits at one ${th.node} of a ${th.solid} and each second walks along an edge to one of the three neighbouring ${th.node}s, chosen uniformly. ` +
    `What is the expected number of seconds until it first reaches the ${th.node} diagonally opposite its start? (Whole number.)`;
  const explanation =
    `Group ${th.node}s by distance from the start (0,1,2,3). By symmetry E₁ = 1 + E₂, E₂ = 1 + ⅔E₃ + ⅓E₁, E₃ = 1 + ⅔E₂, with E at the opposite ${th.node} = 0. Solving gives E₀ = 10.`;

  return {
    answer,
    numeric: {
      id: `mc-cube-3`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Expected hitting time on a cube (symmetry)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Markov Chains · Random walks on graphs",
    },
  };
}

const POLY_THEME = [
  { actor: "a beetle", place: "a ring of stones" },
  { actor: "a token", place: "a circular track" },
];

/**
 * Random walk on a regular polygon (even # corners) with a "stay" probability;
 * expected time to the opposite corner. Traps: the graph distance sides/2 (min
 * moves), and ignoring the "stay" (which stretches every time by 1/(1−pStay)).
 */
export function buildPolygonWalkInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(POLY_THEME);
  const sides = rng.pick([6, 8]);
  // p(step each direction) = m/den with a stay probability left over.
  const [mv, den] = rng.pick([
    [2, 5],
    [1, 3],
    [3, 8],
    [2, 6],
  ]);
  const pCW = F(mv, den);
  const pCCW = F(mv, den);
  const value = polygonOppositeExpected(sides, pCW, pCCW);
  const dp = Math.max(2, numDp(value));
  const answer = Number(decText(value, dp));

  const half = sides / 2;
  const noStay = polygonOppositeExpected(sides, F(1, 2), F(1, 2));
  const { errors, push } = numericErrors(answer, dp);
  push(half, `${half} is the graph distance to the opposite corner — the minimum number of moves, not the expected time with back-steps and stays.`);
  push(noStay, `You ignored the "stay" probability. Staying put wastes turns, stretching every expected time by 1/(1−P(stay)); without it you'd get ${decText(noStay, dp)}.`);
  push(half * half, `(sides/2)² = ${half * half} is a rough "distance-squared" guess; the actual value comes from solving the distance chain.`);

  const prompt =
    `${th.actor.charAt(0).toUpperCase() + th.actor.slice(1)} moves around ${th.place} of ${sides} evenly-spaced spots. Each step it goes one spot clockwise w.p. ${fracText(pCW)}, one spot counter-clockwise w.p. ${fracText(pCCW)}, and stays put otherwise. ` +
    `What is the expected number of steps to reach the spot directly opposite its start? (Round to ${dp} decimals.)`;
  const explanation =
    `By clockwise/counter-clockwise symmetry, track the distance d ∈ {0,…,${half}} to the goal (${half} absorbing). Solve E_d = 1 + P(stay)·E_d + ${fracText(pCW)}·E_{d+1} + ${fracText(pCCW)}·E_{d−1} (with both directions merging at d=0). This gives ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `mc-poly-${sides}-${mv}-${den}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Expected hitting time on a polygon (with stay)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Markov Chains · Random walks on graphs",
    },
  };
}

const GRID_THEME = [
  { actor: "a robot", place: "grid of tiles" },
  { actor: "a random walker", place: "lattice of points" },
];

/**
 * Random walk from the CENTER of a (2m+1)×(2m+1) grid to the boundary (each
 * step N/S/E/W, 1/4). Exact rational solve for small m. Traps: the distance m
 * (min steps), the 1-D exit time m² (ignoring the extra escape routes), and the
 * width 2m.
 */
export function buildGridWalkInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(GRID_THEME);
  const m = rng.pick([2, 3]);
  const size = 2 * m + 1;
  const value = grid2DCenterExpected(m);
  const dp = Math.max(2, numDp(value));
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(m, `${m} is the straight-line distance from the center to the boundary — the minimum, not the expected random-walk time.`);
  push(
    m * m,
    `m² = ${m * m} is the 1-D exit time from the middle of a length-${2 * m} segment. In 2-D there are twice as many directions to escape, so the true expected time is smaller.`,
  );
  push(2 * m, `2m = ${2 * m} is the grid's width in steps, not an expected hitting time.`);

  const prompt =
    `${th.actor.charAt(0).toUpperCase() + th.actor.slice(1)} starts at the center of a ${size}×${size} ${th.place}. Each step it moves north, south, east, or west with equal probability, stopping the moment it reaches any boundary point. ` +
    `What is the expected number of steps? (Round to ${dp} decimals.)`;
  const explanation =
    `For each interior point, E = 1 + ¼·(sum of the four neighbours' E), with E = 0 on the boundary. Solving this linear system for the ${size}×${size} grid gives the center value ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `mc-grid-${m}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Expected hitting time on a 2-D grid (linear solve)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Markov Chains · Random walks on graphs",
    },
  };
}

/* ========================================================================== */
/* ====================  LEVEL 5 — GAMBLER'S RUIN (quiz)  =================== */
/* ========================================================================== */

const RUIN_P: [number, number][] = [
  [2, 3],
  [1, 3],
  [3, 5],
  [2, 5],
  [3, 4],
  [1, 4],
];

/**
 * Gambler's ruin: from `k` units, reach `N` before 0, winning each round w.p.
 * p ≠ ½. Correct = (1−rᵏ)/(1−rᴺ), r = q/p. The canonical trap is the SYMMETRIC
 * k/N used even when p ≠ ½; also inverting r (q/p ↔ p/q) and reversing player.
 */
export function buildRuinReachInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  const [pn, pd] = rng.pick(RUIN_P);
  const p = F(pn, pd);
  const q = F(1).sub(p);
  const N = rng.pick([3, 4, 5, 6]);
  const k = rng.int(1, N - 1);
  const value = gamblerRuinReach(k, N, p);
  const dp = ruinDp(value);
  const answer = decText(value, dp);

  const symmetric = F(k, N);
  const inverted = gamblerRuinReach(k, N, q); // r ↔ 1/r
  const reversed = F(1).sub(value);

  const correct: Choice = {
    text: decText(value, dp),
    rationale: `Correct — biased ruin: with r = q/p = ${fracText(q.div(p))}, P = (1−rᵏ)/(1−rᴺ) = ${decText(value, dp)}.`,
  };
  const distractors: Choice[] = [
    {
      text: decText(symmetric, dp),
      rationale: `k/N = ${fracText(symmetric)} is the FAIR-game answer. With a per-round edge (win w.p. ${fracText(p)} ≠ ½) you must use the biased formula (1−rᵏ)/(1−rᴺ).`,
    },
    {
      text: decText(inverted, dp),
      rationale: `You inverted r. Using r = p/q instead of q/p flips the advantage; the ratio must put the LOSS-over-win odds q/p in the numerator's powers.`,
    },
    {
      text: decText(reversed, dp),
      rationale: `That's the probability of hitting 0 first (the opponent's win) = 1 − ${decText(value, dp)}.`,
    },
  ];

  const prompt =
    `You start with ${k} chip(s) and play rounds staking one chip; you win each round with probability ${fracText(p)} (otherwise you lose the chip). ` +
    `You stop at ${N} chips (win) or 0 chips (broke). What is the probability you reach ${N} before going broke? (Round to ${dp} decimals.)`;
  const explanation =
    `Gambler's ruin with r = q/p = ${fracText(q.div(p))}: P(reach ${N} from ${k}) = (1 − r^${k})/(1 − r^${N}) = ${decText(value, dp)}. ` +
    `The tempting ${fracText(symmetric)} (= k/N) only holds for a FAIR game (p = ½).`;

  return {
    answer,
    question: {
      id: `mc-ruin-${k}-${N}-${pn}-${pd}`,
      prompt,
      explanation,
      difficulty,
      concept: "Gambler's ruin (biased vs symmetric k/N)",
      source: "Markov Chains · Gambler's ruin",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

/**
 * Bold play: start `start`, target `target`, stake min(w, target−w) each round,
 * win w.p. p (usually < ½). Correct = solved chain (e.g. 29/77). Traps: the
 * TIMID unit-stake ruin value (bold play beats it in an unfavourable game), the
 * symmetric start/target, and p itself.
 */
export function buildBoldPlayInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  const target = rng.pick([4, 5, 6]);
  const start = rng.int(1, target - 1);
  const [pn, pd] = rng.pick([
    [1, 3],
    [2, 5],
    [1, 4],
    [3, 8],
  ]);
  const p = F(pn, pd);
  const value = boldPlayReachProb(start, target, p);
  const dp = ruinDp(value);
  const answer = decText(value, dp);

  const timid = gamblerRuinReach(start, target, p);
  const symmetric = F(start, target);

  const correct: Choice = {
    text: decText(value, dp),
    rationale: `Correct — solving the bold-play chain (stake min(w, ${target}−w), win w.p. ${fracText(p)}) gives ${decText(value, dp)}.`,
  };
  const distractors: Choice[] = [
    {
      text: decText(timid, dp),
      rationale: `That's the TIMID unit-stake ruin probability (${decText(timid, dp)}). In an UNFAVOURABLE game (p < ½), bold play is strictly better — betting big shortens exposure to the house edge.`,
    },
    {
      text: decText(symmetric, dp),
      rationale: `start/target = ${fracText(symmetric)} is the fair-game guess; it ignores both the edge and the betting strategy.`,
    },
    {
      text: decText(p, dp),
      rationale: `${fracText(p)} is the single-round win probability, not the chance of reaching the target.`,
    },
  ];

  const prompt =
    `You have ${start} token(s) and want to reach ${target}. Each round you boldly stake as much as you can without overshooting — min(current, ${target}−current) — and win the stake with probability ${fracText(p)}, else lose it. ` +
    `What is the probability you reach ${target} before hitting 0? (Round to ${dp} decimals.)`;
  const explanation =
    `Bold play: from state w the stake is min(w, ${target}−w). First-step analysis P_w = p·P_{w+stake} + (1−p)·P_{w−stake}, with P_0 = 0, P_${target} = 1. Solving gives P_${start} = ${decText(value, dp)}, which BEATS the timid unit-stake value ${decText(timid, dp)} in this unfavourable game.`;

  return {
    answer,
    question: {
      id: `mc-bold-${start}-${target}-${pn}-${pd}`,
      prompt,
      explanation,
      difficulty,
      concept: "Gambler's ruin (bold play beats timid)",
      source: "Markov Chains · Gambler's ruin",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

/* ========================================================================== */
/* =================  LEVEL 6 — MARKOV REASONING DESK (flashcard)  ========== */
/* ========================================================================== */

/**
 * Reasoning specials whose answer is PIECEWISE or a judgment + number — routed
 * as integrity-based flashcards, never scalar-graded. All freshly worded (no
 * verbatim source-dataset text).
 */
export const markovChainsFlashcards: Flashcard[] = [
  {
    id: "mc-fc-drunkard",
    prompt:
      "A hiker stands one step from the edge of a cliff (the edge is position 0; the hiker is at position 1). Each step, they move one unit AWAY from the edge with probability p and one unit TOWARD it with probability 1−p; the walk is on the infinite line to the safe side. In terms of p, what is the probability the hiker eventually falls off? Evaluate it for p = 2/3, and say what happens when p ≤ 1/2.",
    answer:
      "PIECEWISE: if p ≤ 1/2, falling is CERTAIN (probability 1); if p > 1/2, the fall probability is (1−p)/p. For p = 2/3 that is (1/3)/(2/3) = 1/2 — even favouring escape 2-to-1, the hiker still falls half the time.",
    explanation:
      "Let X = P(fall from position 1). Stepping toward the edge (w.p. 1−p) falls immediately; stepping away (w.p. p) reaches position 2, from which falling requires returning to 1 and then falling again — two independent copies of the same problem, probability X². So X = (1−p) + p·X². Solving p·X² − X + (1−p) = 0 factors as (X−1)(pX−(1−p)) = 0, giving roots X = 1 and X = (1−p)/p. For p ≤ 1/2 the only valid probability ≤ 1 is X = 1 (certain fall — a fair or unfavourable walk on a half-line is recurrent toward the barrier). For p > 1/2 the relevant root is (1−p)/p < 1. At p = 2/3 this is 1/2. The trap is assuming a 2:1 push away from the cliff makes escape likely; it only makes the fall probability exactly 1/2.",
    difficulty: "hard",
    concept: "Semi-infinite gambler's ruin (piecewise fall probability)",
    source: "Markov Chains · Gambler's ruin (semi-infinite)",
  },
  {
    id: "mc-fc-birthday-repeat",
    prompt:
      "A streaming app has a library of 2000 tracks and its 'shuffle' plays each next track uniformly at random and independently (repeats allowed). A friend bets they can listen to 100 tracks in a row without ever hearing the same track twice. Is that a safe bet? Roughly how many tracks do you expect to hear before the first repeat?",
    answer:
      "NOT a safe bet. The expected number of tracks until the first repeat is only about 57 (≈ 56.72), far below 100 — a repeat within 100 tracks is very likely.",
    explanation:
      "This is a birthday-style absorbing chain. With k distinct tracks already heard, the next track is new with probability (2000−k)/2000, so the expected additional tracks satisfy E[k] = 1 + ((2000−k)/2000)·E[k+1], back-recursing from E[2000] = 0. Computing this (or using the birthday approximation, where the expected wait scales like √(πN/2) ≈ √(π·2000/2) ≈ 56) gives E[0] ≈ 56.72. Because the expected first repeat arrives around track 57, betting on 100 clean tracks is a losing proposition. The intuition trap is thinking 100 out of 2000 'feels small' — but the number of PAIRS grows quadratically, so collisions come fast.",
    difficulty: "medium",
    concept: "Birthday-repeat expected hitting time (back-recursion)",
    source: "Markov Chains · Expected hitting time (birthday)",
  },
  {
    id: "mc-fc-hhh-before-thh",
    prompt:
      "You flip a fair coin until you see either HHH or THH. Which is more likely to appear first, and what is the probability that HHH appears before THH?",
    answer:
      "THH is far more likely first. P(HHH before THH) = 1/8; so P(THH first) = 7/8.",
    explanation:
      "The clean insight: HHH can ONLY beat THH if the very first three flips are HHH. Why? The moment any tail appears before you've completed HHH, the two flips HH that must eventually follow will complete THH first (the T is already on the board). So HHH wins exactly on the event {first three flips = HHH}, probability (1/2)³ = 1/8. A Markov confirmation: make HHH and 'any tail seen' absorbing; then s_HH = 1/2, s_H = 1/4, s_start = 1/8. The trap is assuming two length-3 patterns are symmetric (1/2 each) — overlap structure breaks the symmetry.",
    difficulty: "medium",
    concept: "Pattern race (why HHH-before-THH = 1/8)",
    source: "Markov Chains · Pattern races",
  },
  {
    id: "mc-fc-overlap-wait",
    prompt:
      "On a fair coin, the expected wait for HHH is 14 flips. A friend claims the expected wait for THH must also be 14, 'since both are length-3 patterns with probability 1/8 each'. Are they right? What is the expected wait for THH, and why does it differ?",
    answer:
      "They're wrong. The expected wait for THH is 8, not 14. Equal single-occurrence probability does NOT imply equal waiting time.",
    explanation:
      "Waiting time depends on a pattern's SELF-OVERLAP, not just its probability. HHH overlaps itself at shifts of 1 and 2 (a fresh H extends the run), so a failure costs a lot of accumulated progress; Conway's rule gives E = 2·(2⁰+2¹+2²) = 14. THH has no proper self-overlap (its suffix H, HH never matches its prefix T, TH), so after a mismatch you rarely fall all the way back — indeed a stray T is itself useful progress toward THH. Conway gives E = 2·(2²) = 8. This 'overlap ⇒ longer wait' effect is why HH (E=6) is slower than HT (E=4), and it's the key to the whole pattern family.",
    difficulty: "hard",
    concept: "Pattern waits (self-overlap lengthens the wait)",
    source: "Markov Chains · Pattern waits",
  },
  {
    id: "mc-fc-dominant-edge",
    prompt:
      "You and an opponent each start with $10 and bet $1 per round; you win each round with probability 2/3. Play continues until someone is broke. Without grinding the full algebra, is the opponent's ruin close to certain or closer to a coin flip? Give the approximate probability.",
    answer:
      "Close to certain — the opponent goes broke with probability ≈ 0.999. A steady 2/3 edge over an equal-length game is overwhelming.",
    explanation:
      "Gambler's ruin with a bias: states 0..20 (your wealth), r = q/p = (1/3)/(2/3) = 1/2, and P(you reach 20 from 10) = (1 − r¹⁰)/(1 − r²⁰) = (1 − 2⁻¹⁰)/(1 − 2⁻²⁰) ≈ 0.999. The lesson is how NON-linear the edge is: a fair game (p = ½) would give exactly k/N = 1/2, but even a modest per-round edge compounds over many rounds into near-certainty. The trap is reaching for the symmetric k/N = 1/2 out of habit; that formula is only valid when p = ½.",
    difficulty: "hard",
    concept: "Gambler's ruin (how an edge compounds)",
    source: "Markov Chains · Gambler's ruin",
  },
];

/* ========================================================================== */
/*  Named generators (adapters used by the levels + verification tests)        */
/* ========================================================================== */

// Level 1 — First-step analysis (numeric)
export const genMigrations = (rng: Rng): NumericQuestion => buildMigrationsInstance(rng, "easy").numeric;
export const genSpinner = (rng: Rng): NumericQuestion => buildSpinnerInstance(rng, "easy").numeric;
export const genLineWalk = (rng: Rng): NumericQuestion => buildLineWalkInstance(rng, "easy").numeric;

// Level 2 — Coin pattern waits (numeric)
export const genRunHeads = (rng: Rng): NumericQuestion => buildRunHeadsInstance(rng, "easy").numeric;
export const genTwoInARow = (rng: Rng): NumericQuestion => buildTwoInARowInstance(rng, "medium").numeric;
export const genResetChain = (rng: Rng): NumericQuestion => buildResetChainInstance(rng, "easy").numeric;

// Level 3 — Pattern races (quiz)
export const genPatternWait = (rng: Rng): Question => buildPatternWaitInstance(rng, "medium").question;
export const genPatternRace = (rng: Rng): Question => buildPatternRaceInstance(rng, "medium").question;

// Level 4 — Random walks on graphs (numeric)
export const genCubeWalk = (rng: Rng): NumericQuestion => buildCubeWalkInstance(rng, "medium").numeric;
export const genPolygonWalk = (rng: Rng): NumericQuestion => buildPolygonWalkInstance(rng, "medium").numeric;
export const genGridWalk = (rng: Rng): NumericQuestion => buildGridWalkInstance(rng, "hard").numeric;

// Level 5 — Gambler's ruin (quiz)
export const genRuinReach = (rng: Rng): Question => buildRuinReachInstance(rng, "hard").question;
export const genBoldPlay = (rng: Rng): Question => buildBoldPlayInstance(rng, "hard").question;

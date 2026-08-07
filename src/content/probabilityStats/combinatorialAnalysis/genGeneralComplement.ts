import type { Rng } from "@/lib/rng";
import type { Difficulty, NumericQuestion } from "@/types/content";
import type FractionType from "fraction.js";
import {
  F,
  binomPMF,
  binomTailGE,
  binomTailLE,
  bothColorsProb,
  containsDigitProb,
  decText,
  fracText,
  productEvenProb,
  smallestNForAtLeastOne,
} from "../coreSolvers";
import { cap, numDp, numericErrors } from "../coreScaffold";

/**
 * Parametric generators + per-family misconception taxonomy for the
 * Probability & Statistics → **Combinatorial Analysis** subcategory,
 * complement / at-least-one family (re-homed from the former "General" set).
 *
 * Every generated scalar is produced by the EXACT solver in `./general.ts`
 * (never a hardcoded table); every distractor (`numeric` commonErrors) is a
 * re-derived, NAMED misconception, guaranteed distinct and ≠ the answer at the
 * grading precision (`numericErrors` dedupes and drops non-finite values).
 *
 * NONE of the source-dataset questions are user-facing, every playable item is
 * freshly themed with different objects, stories, and numbers.
 */

/* ========================================================================== */
/* =====================  1. BOTH COLOURS (numeric)  ====================== */
/* ========================================================================== */

const TWO_COLOUR_THEME = [
  { c1: "amber", c2: "violet", obj: "marbles", vessel: "a velvet pouch", verb: "scoop out" },
  { c1: "teal", c2: "crimson", obj: "tokens", vessel: "a game box", verb: "grab" },
  { c1: "silver", c2: "copper", obj: "beads", vessel: "a jar", verb: "draw" },
];

/**
 * P(at least one of EACH colour) when drawing `draw` items without replacement
 * from an equal split of `half` + `half`. = 1 − 2·mono, where mono = P(all one
 * colour) = Π_{i=0}^{draw−1} (half−i)/(total−i). The signature traps are
 * subtracting only ONE monochrome case, reporting the OPPOSITE (all-one-colour)
 * event, or forgetting to double the single-colour product.
 */
export function buildBothColorsInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(TWO_COLOUR_THEME);
  // half ≠ 26: a 26+26 pool drawn 3 would reproduce the source's 52-card tuple.
  const half = rng.pick([18, 20, 22, 24]);
  const draw = rng.pick([3, 4]);
  const total = 2 * half;

  const value = bothColorsProb(half, half, draw);
  // mono = P(all one colour), computed directly as an exact Fraction.
  let mono = F(1);
  for (let i = 0; i < draw; i++) mono = mono.mul(F(half - i, total - i));

  const dp = numDp(value, 2, 3);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(1).sub(mono),
    `You subtracted only ONE monochrome case; both "all ${th.c1}" and "all ${th.c2}" must be removed → 1 − 2·mono, not 1 − mono.`,
  );
  push(
    mono.mul(2),
    `That's P(all one colour), the OPPOSITE event; the question asks for at-least-one-of-each = 1 − that.`,
  );
  push(
    mono,
    `That's just P(all ${th.c1}); double it for both colours, then take the complement (1 − 2·mono).`,
  );

  const prompt =
    `${cap(th.vessel)} holds ${half} ${th.c1} ${th.obj} and ${half} ${th.c2} ${th.obj} (${total} in all). ` +
    `You ${th.verb} ${draw} ${th.obj} at once, without replacement. ` +
    `What is the probability your handful contains at least one ${th.obj.slice(0, -1)} of EACH colour? (Round to ${dp} decimals.)`;
  const monoProd = Array.from({ length: draw }, (_, i) => `${half - i}/${total - i}`).join("·");
  const explanation =
    `P(all one colour) for a single colour is the product of shrinking without-replacement fractions: ${monoProd} = ${fracText(mono)} ≈ ${decText(mono, Math.max(dp, 3))}. ` +
    `By symmetry P(all ${th.c1}) = P(all ${th.c2}) = that, so P(monochrome) = 2·${fracText(mono)}. ` +
    `The complement is P(at least one of each) = 1 − 2·mono = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-bothcolors-${half}-${draw}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Complement / at-least-one (both colours = 1 − 2·mono)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "General · Complement / at-least-one",
    },
  };
}

/* ========================================================================== */
/* =====================  2. CONTAINS DIGIT (numeric)  ==================== */
/* ========================================================================== */

const DIGIT_THEME = [
  { thing: "a randomly generated access code", pos: "digits" },
  { thing: "a random lottery serial", pos: "digits" },
  { thing: "a uniformly random locker PIN", pos: "digits" },
];

/**
 * P(a uniformly random `L`-position decimal string contains the digit `d` at
 * least once) = 1 − (9/10)^L. Traps: reporting the NO-appearance complement
 * (9/10)^L, an additive per-position count L/10 that double-counts, or the
 * single-position value 1 − 9/10 = 0.1.
 */
export function buildContainsDigitInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(DIGIT_THEME);
  // L ≠ 6: a 6-position string would reproduce the source's 1-in-a-million answer.
  const L = rng.pick([4, 5, 7]);
  const d = rng.pick([1, 2, 3, 4, 5, 6, 7, 8, 9]);

  const value = containsDigitProb(L);
  const dp = 4;
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(9 ** L, 10 ** L),
    `That's P(the digit ${d} NEVER appears) = (9/10)^${L}, you forgot to take the complement (1 − that).`,
  );
  push(
    L / 10,
    `Additive per-position counting (${L}·(1/10)) double-counts strings where ${d} appears twice; you must use 1 − (9/10)^${L}.`,
  );
  push(
    1 - 9 / 10,
    `That's the chance for ONE position only (1 − 9/10 = 0.1); there are ${L} positions, so use 1 − (9/10)^${L}.`,
  );

  const prompt =
    `Consider ${th.thing} with ${L} ${th.pos}, each position an independent uniform digit 0–9. ` +
    `What is the probability the code contains the digit ${d} at least once? (Round to ${dp} decimals.)`;
  const explanation =
    `Use the complement. Each of the ${L} positions avoids ${d} with probability 9/10, so P(no ${d} anywhere) = (9/10)^${L} = ${fracText(F(9 ** L, 10 ** L))} ≈ ${decText(F(9 ** L, 10 ** L), dp)}. ` +
    `Therefore P(at least one ${d}) = 1 − (9/10)^${L} = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-containsdigit-${L}-${d}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Complement / at-least-one (contains a digit = 1 − (9/10)^L)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "General · Complement / at-least-one",
    },
  };
}

/* ========================================================================== */
/* =====================  3. SUB-INTERVAL (numeric)  ====================== */
/* ========================================================================== */

const SUBINTERVAL_THEME = [
  { window: "one-hour monitoring window", event: "sensor glitch", sub: "equal time-slots" },
  { window: "full work shift", event: "machine stall", sub: "equal segments" },
  { window: "whole broadcast", event: "signal dropout", sub: "equal blocks" },
];

const SUBINTERVAL_F: [number, number][] = [
  [1, 2],
  [2, 5],
  [1, 3],
  [3, 5],
  [3, 4],
  [2, 3],
];

/**
 * A window splits into `k` independent equal sub-intervals; each has no-event
 * probability f, so the whole-window at-least-one probability is 1 − f^k (the
 * GIVEN number). The per-sub-interval at-least-one probability is 1 − f. Built
 * forward from a clean rational f so the answer is exact. Traps: re-reporting
 * the given whole-window value, dividing it linearly by k, or reporting the
 * per-interval NO-event probability f.
 */
export function buildSubIntervalInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(SUBINTERVAL_THEME);
  const [a, b] = rng.pick(SUBINTERVAL_F);
  let k = rng.pick([2, 3, 4]);
  // Avoid the source tuple f = 2/5, k = 4 (its given whole-window prob is 609/625).
  if (a === 2 && b === 5 && k === 4) k = rng.pick([2, 3]);
  const f = F(a, b);

  const whole = F(1).sub(f.pow(k) as FractionType); // P(≥1 in whole window). GIVEN
  const value = F(1).sub(f); // P(≥1 in one sub-interval). ANSWER

  const dp = numDp(value);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    whole,
    `That's the whole-window probability you were GIVEN (1 − f^${k}), not the single sub-interval value.`,
  );
  push(
    whole.div(k),
    `Probabilities don't scale linearly across sub-intervals; you must take the ${k}-th root of the no-event probability, not divide by ${k}.`,
  );
  push(
    f,
    `That's the per-interval NO-event probability f = ${fracText(f)}; the question asks for at-least-one = 1 − f.`,
  );

  const wholeDp = Math.max(dp, 3);
  const prompt =
    `During a ${th.window}, the probability that at least one ${th.event} occurs is ${fracText(whole)} (≈ ${decText(whole, wholeDp)}). ` +
    `The window is divided into ${k} independent, equal ${th.sub}, and a ${th.event} is equally likely to strike in any of them. ` +
    `What is the probability that at least one ${th.event} occurs in a single sub-interval? (Round to ${dp} decimals.)`;
  const explanation =
    `Let f be the probability one sub-interval sees NO ${th.event}. The ${k} sub-intervals are independent, so P(no ${th.event} in the whole window) = f^${k}, and P(at least one in the window) = 1 − f^${k} = ${fracText(whole)}. ` +
    `Hence f^${k} = ${fracText(f.pow(k) as FractionType)}, so f = ${fracText(f)} and the single sub-interval answer is 1 − f = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-subinterval-${a}-${b}-${k}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Complement / at-least-one (per sub-interval = 1 − f)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "General · Complement / at-least-one",
    },
  };
}

/* ========================================================================== */
/* =====================  4. PRODUCT EVEN (numeric)  ====================== */
/* ========================================================================== */

const DICE_THEME = [
  { actor: "a player", obj: "dice" },
  { actor: "a gamer", obj: "number cubes" },
  { actor: "a referee", obj: "dice" },
];

/**
 * P(the product of `dice` fair d-sided dice is even) = 1 − (odd/faces)^dice,
 * where the dice have an equal count of odd/even faces (odd = faces/2). Traps:
 * reporting P(product odd) = (odd/faces)^dice, the single-die parity ½, or
 * 1 − odd/faces (only one die accounted for).
 */
export function buildProductEvenInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(DICE_THEME);
  // dice ≠ 3: a 3-dice even-product is exactly the source's 7/8 answer.
  const dice = rng.pick([2, 4, 5]);
  const faces = rng.pick([6, 8, 10]);
  const odd = faces / 2; // equal odd/even split

  const value = productEvenProb(dice, faces);
  const dp = numDp(value);
  const answer = Number(decText(value, dp));

  const allOdd = F(odd, faces).pow(dice) as FractionType;
  const { errors, push } = numericErrors(answer, dp);
  push(
    allOdd,
    `That's P(product ODD) = P(all ${dice} dice odd) = (${odd}/${faces})^${dice}, the complement of what's asked.`,
  );
  push(
    F(1, 2),
    `That's the parity of a SINGLE die; with ${dice} dice the product is odd only if ALL of them are odd, so use 1 − (odd/faces)^${dice}.`,
  );
  push(
    F(1).sub(F(odd, faces)),
    `That only accounts for ONE die being even; every die must be odd for an odd product, so the complement is 1 − (odd/faces)^${dice}.`,
  );

  const prompt =
    `${cap(th.actor)} rolls ${dice} fair ${faces}-sided ${th.obj} and multiplies the faces together. ` +
    `What is the probability the product is even? (Round to ${dp} decimals.)`;
  const explanation =
    `The product is even unless EVERY die is odd. Each die is odd with probability ${odd}/${faces} = 1/2, so P(all odd) = (${odd}/${faces})^${dice} = ${fracText(allOdd)} ≈ ${decText(allOdd, Math.max(dp, 3))}. ` +
    `Therefore P(product even) = 1 − (${odd}/${faces})^${dice} = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-producteven-${dice}-${faces}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Complement / at-least-one (even product = 1 − (odd/faces)^dice)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "General · Complement / at-least-one",
    },
  };
}

/* ========================================================================== */
/* =====================  5. SMALLEST N (numeric integer)  ================ */
/* ========================================================================== */

const SMALLEST_N_THEME = [
  { trial: "raffle ticket", winVerb: "wins a prize", winNoun: "winning ticket" },
  { trial: "booster pack", winVerb: "contains the rare card", winNoun: "pack with the rare card" },
  { trial: "test run", winVerb: "triggers the bug", winNoun: "run that triggers the bug" },
];

/**
 * Smallest number of independent trials `n` so P(at least one success) ≥
 * `threshold`, each trial succeeding w.p. `pWin`: n = ⌈ln(1−threshold)/ln(1−pWin)⌉.
 * Traps: rounding the raw real DOWN (floor) or to NEAREST (round) instead of up,
 * or ⌈1/pWin⌉ (the geometric mean number of tries for ONE success).
 */
export function buildSmallestNInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(SMALLEST_N_THEME);
  // pWin ≠ 0.15: (0.15, 0.95) is the source tuple (answer n = 19).
  const pWin = rng.pick([0.05, 0.1, 0.12, 0.2, 0.25]);
  const threshold = rng.pick([0.9, 0.95, 0.99]);

  const answer = smallestNForAtLeastOne(pWin, threshold);
  const raw = Math.log(1 - threshold) / Math.log(1 - pWin);

  const { errors, push } = numericErrors(answer, 0);
  push(
    Math.floor(raw),
    `You rounded DOWN. n must satisfy 1 − (1−p)^n ≥ ${threshold}, so to REACH the threshold you round the real ${raw.toFixed(2)} UP (ceil), not down.`,
  );
  push(
    Math.round(raw),
    `Rounding the real ${raw.toFixed(2)} to the NEAREST integer can land just below the threshold; always ceil to guarantee ≥ ${threshold}.`,
  );
  push(
    Math.ceil(1 / pWin),
    `That's ⌈1/p⌉ = the expected number of tries for ONE success (geometric mean 1/p), not the n needed for a ≥ ${threshold} chance of at least one.`,
  );

  const pctWin = Math.round(pWin * 100);
  const pctThr = Math.round(threshold * 100);
  const prompt =
    `Each ${th.trial} independently ${th.winVerb} with probability ${pctWin}%. ` +
    `What is the smallest number of ${th.trial}s needed so that the probability of getting at least one ${th.winNoun} is at least ${pctThr}%? (Whole number.)`;
  const explanation =
    `Use the complement: 1 − (1−p)^n ≥ ${threshold} ⟺ (1−p)^n ≤ ${(1 - threshold).toFixed(2)} ⟺ n ≥ ln(${(1 - threshold).toFixed(2)})/ln(${(1 - pWin).toFixed(2)}) = ${raw.toFixed(4)}. ` +
    `Since n must be a whole number of trials that REACHES the threshold, round UP: n = ⌈${raw.toFixed(4)}⌉ = ${answer}.`;

  return {
    answer,
    numeric: {
      id: `gen-smalln-${pctWin}-${pctThr}`,
      prompt,
      answer,
      difficulty,
      concept: "Complement / at-least-one (smallest n via logs, ceil)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "General · Complement / at-least-one",
    },
  };
}

/* ========================================================================== */
/* =====================  6. BINOMIAL TAIL (numeric)  ===================== */
/* ========================================================================== */

const BINOM_THEME = [
  { actor: "a factory", n: "widgets", hit: "defective", trial: "widget" },
  { actor: "an inbox", n: "messages", hit: "flagged as spam", trial: "message" },
  { actor: "a survey", n: "respondents", hit: "left-handed", trial: "respondent" },
];

const BINOM_P: [number, number][] = [
  [1, 6],
  [1, 3],
  [1, 5],
  [1, 4],
  [1, 2],
  [2, 6],
];

/**
 * Binomial tail probability P(X ≤ k) or P(X ≥ k) for X ~ Bin(n, p), sampled so
 * the answer is neither ~0 nor ~1. Traps: the OPPOSITE tail (1 − answer), the
 * single term P(X = k), and an off-by-one on whether the boundary k is included.
 */
export function buildBinomTailInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(BINOM_THEME);

  let n = 8;
  let pn = 1;
  let pd = 3;
  let p = F(pn, pd);
  let dir: "le" | "ge" = "le";
  let k = 1;
  let value = F(0);
  for (let tries = 0; tries < 40; tries++) {
    n = rng.pick([5, 6, 8, 10, 12]);
    [pn, pd] = rng.pick(BINOM_P);
    p = F(pn, pd);
    dir = rng.pick(["le", "ge"] as const);
    k = rng.int(1, n - 1);
    value = dir === "le" ? binomTailLE(n, p, k) : binomTailGE(n, p, k);
    const v = value.valueOf();
    // Avoid the source tuple Bin(6, 1/5) with P(X ≤ 2) (the "cakes" answer ≈ 0.9).
    const isSourceTuple = n === 6 && pn === 1 && pd === 5 && dir === "le" && k === 2;
    if (v >= 0.02 && v <= 0.98 && !isSourceTuple) break;
  }

  const dp = 3;
  const answer = Number(decText(value, dp));

  const opposite = F(1).sub(value);
  const single = binomPMF(n, p, k);
  const offByOne =
    dir === "ge" ? binomTailGE(n, p, k + 1) : binomTailLE(n, p, k - 1);

  const { errors, push } = numericErrors(answer, dp);
  push(
    opposite,
    `You forgot the complement. P(X ≤ ${k}) and P(X ≥ ${k}) are complements only around the boundary; this is the OPPOSITE tail (1 − answer).`,
  );
  push(
    single,
    `That's just P(X = ${k}), the single term, not the whole ${dir === "le" ? "≤" : "≥"} ${k} tail.`,
  );
  push(
    offByOne,
    `Off-by-one on whether the boundary ${k} is included: you ${dir === "ge" ? `started the sum at ${k + 1}` : `stopped the sum at ${k - 1}`} instead of at ${k}.`,
  );

  const rel = dir === "le" ? "at most" : "at least";
  const prompt =
    `In ${th.actor} of ${n} ${th.n}, each ${th.trial} is independently ${th.hit} with probability ${fracText(p)}. ` +
    `Let X be the number that are ${th.hit}. What is P(X ${dir === "le" ? "≤" : "≥"} ${k}), i.e. that ${rel} ${k} are ${th.hit}? (Round to ${dp} decimals.)`;
  const explanation =
    `X ~ Bin(${n}, ${fracText(p)}). Sum the exact binomial terms: P(X ${dir === "le" ? "≤" : "≥"} ${k}) = ${
      dir === "le" ? `Σ_{j=0}^{${k}}` : `Σ_{j=${k}}^{${n}}`
    } C(${n},j)·${fracText(p)}^j·(1−${fracText(p)})^{${n}−j} = ${fracText(value)} ≈ ${decText(value, dp)}. ` +
    `The single term P(X = ${k}) = ${fracText(single)} ≈ ${decText(single, dp)} is only one piece of this tail.`;

  return {
    answer,
    numeric: {
      id: `gen-binomtail-${n}-${pn}-${pd}-${dir}-${k}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Complement / at-least-one (binomial tail)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "General · Complement / at-least-one",
    },
  };
}

/* ========================================================================== */
/*  Named generators (adapters used by the levels + verification tests)        */
/* ========================================================================== */

export const genBothColors = (rng: Rng): NumericQuestion =>
  buildBothColorsInstance(rng, "easy").numeric;
export const genContainsDigit = (rng: Rng): NumericQuestion =>
  buildContainsDigitInstance(rng, "easy").numeric;
export const genSubInterval = (rng: Rng): NumericQuestion =>
  buildSubIntervalInstance(rng, "easy").numeric;
export const genProductEven = (rng: Rng): NumericQuestion =>
  buildProductEvenInstance(rng, "easy").numeric;
export const genSmallestN = (rng: Rng): NumericQuestion =>
  buildSmallestNInstance(rng, "easy").numeric;
export const genBinomTail = (rng: Rng): NumericQuestion =>
  buildBinomTailInstance(rng, "easy").numeric;

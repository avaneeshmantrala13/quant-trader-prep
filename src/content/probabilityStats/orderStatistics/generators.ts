import type { Rng } from "@/lib/rng";
import type { Difficulty, NumericQuestion } from "@/types/content";
import {
  F,
  decText,
  exponentialMedian,
  factorial,
  fracText,
  minInIntervalProb,
  orderingProb,
} from "../coreSolvers";
import { numericErrors } from "../coreScaffold";

/**
 * Parametric generators for the Probability & Statistics → **Order Statistics**
 * subcategory: minimums, orderings, and the median (central order statistic) of
 * continuous distributions (re-homed from the former "General" set — the uniform
 * order-statistics family plus the exponential median).
 *
 * Every correct value is produced ONLY by the exact/high-precision solvers in
 * `../coreSolvers`; every distractor is a re-derived, NAMED misconception
 * guaranteed ≠ the answer and distinct. All items are `numeric`.
 */

/* ========================================================================== */
/* =====================  1 — MINIMUM IN INTERVAL (numeric)  =============== */
/* ========================================================================== */

const SENSOR_THEME = [
  { actor: "temperature probes", draw: "reading", span: "°C" },
  { actor: "arrival timers", draw: "timestamp", span: "s" },
  { actor: "voltage taps", draw: "sample", span: "mV" },
];

/**
 * P(the MINIMUM of `n` iid uniform draws on [a,b] lands in [lo,hi]) =
 * ((b−lo)/(b−a))ⁿ − ((b−hi)/(b−a))ⁿ. Trap family: keeping only the P(all>lo)
 * term, using a single-uniform width ratio, or taking the complement.
 */
export function buildMinIntervalInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(SENSOR_THEME);
  const n = rng.pick([2, 3, 4]);
  const a = rng.int(0, 4);
  const b = a + rng.int(4, 8);
  const span = b - a;
  const lo = rng.int(a + 1, b - 2);
  const hi = rng.int(lo + 1, b - 1);

  const value = minInIntervalProb(n, a, b, lo, hi);
  const dp = 3;
  const answer = Number(decText(value, dp));

  const aboveLo = Math.pow((b - lo) / span, n);
  const { errors, push } = numericErrors(answer, dp);
  push(
    aboveLo,
    `That's ((b−lo)/(b−a))ⁿ = ((${b}−${lo})/${span})^${n} = P(all ${n} draws exceed ${lo}). You forgot to SUBTRACT P(all draws exceed ${hi}); the minimum is in [${lo},${hi}] only when it clears ${lo} but not ${hi}.`,
  );
  push(
    (hi - lo) / span,
    `(hi−lo)/(b−a) = ${hi - lo}/${span} is the width ratio for a SINGLE uniform draw. We want the MINIMUM of ${n} draws, which shrinks toward the low end — you must raise the tail probabilities to the ${n}th power.`,
  );
  push(
    1 - aboveLo,
    `1 − ((b−lo)/(b−a))ⁿ = P(at least one draw is ≤ ${lo}) — the complement of "all exceed ${lo}", which is the wrong event entirely.`,
  );

  const prompt =
    `You take ${n} independent ${th.actor} whose ${th.draw}s are each uniform on [${a}, ${b}] ${th.span}. ` +
    `What is the probability that the SMALLEST of the ${n} ${th.draw}s falls in the interval [${lo}, ${hi}]? (Round to ${dp} decimals.)`;
  const explanation =
    `P(min ∈ [${lo},${hi}]) = P(all > ${lo}) − P(all > ${hi}) = ((${b}−${lo})/${span})^${n} − ((${b}−${hi})/${span})^${n} ` +
    `= ${fracText(value)} ≈ ${decText(value, dp)}. Each "all above x" event is (fraction of the range above x) raised to the ${n}th power because the draws are independent.`;

  return {
    answer,
    numeric: {
      id: `gen-mininterval-${n}-${a}-${b}-${lo}-${hi}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Uniform order statistics (distribution of the minimum)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Order Statistics · minimum",
    },
  };
}

/* ========================================================================== */
/* =====================  2 — SPECIFIC ORDERING (numeric)  ================= */
/* ========================================================================== */

const ORDER_THEME = [
  { actor: "runners", quantity: "finish times" },
  { actor: "auction bids", quantity: "prices" },
  { actor: "seismic sensors", quantity: "trigger times" },
];

/**
 * P(`n` iid continuous draws come out in one SPECIFIC strict order) = 1/n!.
 * Traps: ½-per-comparison independence (1/2^{n−1}), confusing ordering with a
 * single specified maximum (1/n), and the off-by-a-factor 1/(n−1)!.
 */
export function buildOrderingInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(ORDER_THEME);
  const n = rng.pick([3, 4, 5]);
  const value = orderingProb(n);
  const dp = 4;
  const answer = Number(decText(value, dp));
  const nFact = factorial(n).valueOf();

  const { errors, push } = numericErrors(answer, dp);
  push(
    1 / 2 ** (n - 1),
    `1/2^(${n}−1) treats the ${n - 1} pairwise comparisons as independent ½'s. They aren't — but all ${n}! orderings are equally likely, so the answer is 1/${n}! = 1/${nFact}.`,
  );
  push(
    1 / n,
    `1/${n} is P(one SPECIFIC draw is the largest). Fixing the entire ordering is much stronger than fixing just the maximum, so it's 1/${n}!, not 1/${n}.`,
  );
  push(
    n / nFact,
    `n/n! = 1/(n−1)! = ${fracText(F(1).div(factorial(n - 1)))} is off by a factor of ${n}; there is exactly ONE favourable ordering out of ${nFact}, not ${n}.`,
  );

  const prompt =
    `You record the ${th.quantity} of ${n} ${th.actor}; all ties have probability zero (continuous values). ` +
    `What is the probability they come out in one particular strict order (say, ${th.actor} 1 > 2 > … > ${n})? (Round to ${dp} decimals.)`;
  const explanation =
    `All ${n}! orderings of ${n} distinct continuous values are equally likely, so any single specified ordering has probability 1/${n}! = 1/${nFact} = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-ordering-${n}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Uniform order statistics (probability of a specific ordering)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Order Statistics · ordering",
    },
  };
}

/* ========================================================================== */
/* =====================  3 — EXPONENTIAL MEDIAN (numeric)  ================ */
/* ========================================================================== */

const EXPMED_THEME = [
  { thing: "a component's lifetime (years)", rate: "failure rate" },
  { thing: "the wait for the next call (minutes)", rate: "arrival rate" },
  { thing: "time between decays (seconds)", rate: "decay rate" },
];

/**
 * Median (central order statistic) of Exp(λ) = ln2/λ. Traps: the MEAN 1/λ,
 * forgetting to divide by λ (reporting ln2), and "half the mean" 1/(2λ).
 */
export function buildExpMedianInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(EXPMED_THEME);
  const lambda = rng.pick([2, 3, 4, 5, 8, 10]);

  const value = exponentialMedian(lambda);
  const dp = 3;
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    1 / lambda,
    `1/λ = ${(1 / lambda).toFixed(dp)} is the MEAN. The median ln2/λ ≈ 0.693/λ is smaller because the exponential is right-skewed.`,
  );
  push(
    Math.LN2,
    `ln2 ≈ ${Math.LN2.toFixed(dp)} drops the λ; you must divide by λ = ${lambda}.`,
  );
  push(
    1 / (2 * lambda),
    `1/(2λ) = ${(1 / (2 * lambda)).toFixed(dp)} assumes the median is half the mean; it is ln2/λ, not (1/λ)/2.`,
  );

  const prompt =
    `Suppose ${th.thing} follows an exponential distribution with ${th.rate} λ = ${lambda}. ` +
    `What is the MEDIAN of this distribution? (Round to ${dp} decimals.)`;
  const explanation =
    `The median m solves P(X ≤ m) = 1 − e^{−λm} = 1/2, i.e. e^{−λm} = 1/2, so m = ln2/λ. ` +
    `With λ = ${lambda}: m = ln2/${lambda} = ${Math.LN2.toFixed(4)}/${lambda} = ${decText(value, dp)}, below the mean 1/λ = ${(1 / lambda).toFixed(dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-expmedian-${lambda}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Continuous distributions (exponential median = ln2/λ)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Order Statistics · median",
    },
  };
}

/* ========================================================================== */
/*  Named generators (adapters)                                                */
/* ========================================================================== */

export const genMinInterval = (rng: Rng): NumericQuestion =>
  buildMinIntervalInstance(rng, "medium").numeric;
export const genOrdering = (rng: Rng): NumericQuestion =>
  buildOrderingInstance(rng, "easy").numeric;
export const genExpMedian = (rng: Rng): NumericQuestion =>
  buildExpMedianInstance(rng, "medium").numeric;

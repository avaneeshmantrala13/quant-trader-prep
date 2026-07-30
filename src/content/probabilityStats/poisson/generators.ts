import type { Rng } from "@/lib/rng";
import type { Difficulty, NumericQuestion } from "@/types/content";
import { F, decText, fracText } from "../coreSolvers";
import { cap, numericErrors } from "../coreScaffold";
import {
  poissonAtLeastOne,
  poissonFirstStreamProb,
  poissonPMF,
  poissonProcessMean,
  poissonSuperposedMean,
  poissonThinnedMean,
  poissonVariance,
} from "./poisson";

/**
 * Parametric numeric generators for **Poisson Distribution & Process**. Every
 * correct value comes ONLY from `./poisson.ts`; every `commonError` is a
 * re-derived, NAMED misconception, distinct and ≠ the answer at grading
 * precision (asserted in `./poisson.test.ts`).
 */

/* ========================================================================== */
/* ============================  DISTRIBUTION  ============================== */
/* ========================================================================== */

const PMF_THEME = [
  { unit: "typos per page", who: "an editor scans a page" },
  { unit: "calls per minute to a desk", who: "a trading desk logs one minute" },
  { unit: "meteors per hour", who: "an observer watches for an hour" },
];

/**
 * P(X = k) for X ~ Poisson(λ). Traps: dropping the e^{−λ} normaliser (λ^k/k!),
 * and off-by-one in k (reporting P(X=k−1) or P(X=k+1) — a very common slip).
 */
export function buildPoissonPmfInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(PMF_THEME);
  const lambda = rng.pick([2, 3, 4, 5]);
  const k = rng.int(1, lambda + 1);
  const dp = 4;
  const value = poissonPMF(lambda, k);
  const answer = Number(decText(value, dp));

  const forgotExp = (lambda ** k) / factForErr(k); // λ^k/k! without e^{−λ}
  const { errors, push } = numericErrors(answer, dp);
  push(
    forgotExp,
    `λ^k/k! = ${lambda}^${k}/${k}! = ${decText(forgotExp, dp)} drops the e^{−λ} normaliser. The Poisson pmf is e^{−λ}·λ^k/k!, so you must multiply by e^{−${lambda}}.`,
  );
  push(
    poissonPMF(lambda, k - 1),
    `${decText(poissonPMF(lambda, k - 1), dp)} is P(X = ${k - 1}), an off-by-one in k. The question asks for exactly ${k} events.`,
  );
  push(
    poissonPMF(lambda, k + 1),
    `${decText(poissonPMF(lambda, k + 1), dp)} is P(X = ${k + 1}); you overshot k by one.`,
  );

  const prompt =
    `Suppose ${th.unit} follow a Poisson distribution with mean λ = ${lambda}. When ${th.who}, ` +
    `what is the probability of exactly ${k} of them? (Round to ${dp} decimals.)`;
  const explanation =
    `P(X = ${k}) = e^{−λ}·λ^k/k! = e^{−${lambda}}·${lambda}^${k}/${k}! = ${decText(value, dp)}. ` +
    `The e^{−λ} factor is what makes the whole pmf sum to 1.`;

  return {
    answer,
    numeric: {
      id: `gen-poisson-pmf-${lambda}-${k}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Poisson pmf P(X=k)=e^{−λ}λ^k/k!",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Poisson · pmf",
    },
  };
}

function factForErr(k: number): number {
  let f = 1;
  for (let i = 2; i <= k; i++) f *= i;
  return f;
}

/**
 * P(at least one event) = 1 − e^{−λ}. Traps: reporting P(X=0)=e^{−λ} (the
 * complement), P(X=1)=λe^{−λ}, or 1−λe^{−λ}.
 */
export function buildPoissonAtLeastOneInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(PMF_THEME);
  const lambda = rng.pick([1, 2, 3, 4]);
  const dp = 4;
  const value = poissonAtLeastOne(lambda);
  const answer = Number(decText(value, dp));

  const none = Math.exp(-lambda);
  const exactlyOne = lambda * Math.exp(-lambda);
  const { errors, push } = numericErrors(answer, dp);
  push(
    none,
    `e^{−λ} = ${decText(none, dp)} is P(X = 0), the complement. "At least one" is 1 − P(X=0) = 1 − e^{−λ}.`,
  );
  push(
    exactlyOne,
    `λe^{−λ} = ${decText(exactlyOne, dp)} is P(X = 1) exactly, not P(X ≥ 1).`,
  );
  push(
    1 - exactlyOne,
    `1 − λe^{−λ} = ${decText(1 - exactlyOne, dp)} subtracts P(X=1) instead of P(X=0).`,
  );

  const prompt =
    `Suppose ${th.unit} follow a Poisson distribution with mean λ = ${lambda}. When ${th.who}, ` +
    `what is the probability of AT LEAST ONE? (Round to ${dp} decimals.)`;
  const explanation =
    `P(X ≥ 1) = 1 − P(X = 0) = 1 − e^{−λ} = 1 − e^{−${lambda}} = ${decText(value, dp)}. ` +
    `Complementing through the single X=0 term is far easier than summing the tail.`;

  return {
    answer,
    numeric: {
      id: `gen-poisson-atleastone-${lambda}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Poisson P(X≥1)=1−e^{−λ}",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Poisson · at-least-one",
    },
  };
}

/**
 * Variance of Poisson(λ) = λ (equal to the mean). Traps: √λ (SD-vs-variance),
 * λ² (variance-as-mean-squared), and λ/2.
 */
export function buildPoissonVarianceInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(PMF_THEME);
  const lambda = rng.pick([4, 6, 9, 10, 12, 16]);
  const dp = 0;
  const value = poissonVariance(lambda);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    Math.sqrt(lambda),
    `√λ = ${Math.sqrt(lambda).toFixed(2)} is the standard DEVIATION, not the variance. For a Poisson, Var = λ.`,
  );
  push(
    lambda * lambda,
    `λ² = ${lambda * lambda} treats variance as mean². A Poisson is special: its variance EQUALS its mean, so Var = λ.`,
  );
  push(
    lambda / 2,
    `λ/2 = ${lambda / 2} halves the mean. For a Poisson, variance = mean = λ exactly.`,
  );

  const prompt =
    `Suppose ${th.unit} follow a Poisson distribution with mean λ = ${lambda}. ` +
    `What is the VARIANCE of the count? (Whole number.)`;
  const explanation =
    `A Poisson distribution has Var(X) = λ = ${lambda} — its variance equals its mean. ` +
    `(The standard deviation is √λ = ${Math.sqrt(lambda).toFixed(2)}.)`;

  return {
    answer,
    numeric: {
      id: `gen-poisson-var-${lambda}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Poisson variance = mean = λ",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Poisson · variance",
    },
  };
}

/* ========================================================================== */
/* ==============================  PROCESS  ================================= */
/* ========================================================================== */

const PROC_THEME = [
  { ev: "customer arrivals", rateU: "per hour", t: "hours" },
  { ev: "packet arrivals", rateU: "per second", t: "seconds" },
  { ev: "trade prints", rateU: "per minute", t: "minutes" },
];

/**
 * P(exactly k arrivals) over a window of length t for a rate-λ process: the count
 * is Poisson with mean m = λt. Traps: using λ (not λt) as the mean, and off-by-one
 * in k.
 */
export function buildPoissonIntervalInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(PROC_THEME);
  const rate = rng.pick([1, 2, 3]);
  const t = rng.pick([2, 3]);
  const m = poissonProcessMean(rate, t); // = λt
  const k = rng.int(1, m);
  const dp = 4;
  const value = poissonPMF(m, k);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    poissonPMF(rate, k),
    `${decText(poissonPMF(rate, k), dp)} uses mean = λ = ${rate}. Over ${t} ${th.t} the mean is λt = ${rate}·${t} = ${m}; the window length scales the mean.`,
  );
  push(
    poissonPMF(m, k - 1),
    `${decText(poissonPMF(m, k - 1), dp)} is P(N = ${k - 1}), an off-by-one in the count.`,
  );
  push(
    poissonPMF(m, k + 1),
    `${decText(poissonPMF(m, k + 1), dp)} is P(N = ${k + 1}); you overshot k by one.`,
  );

  const prompt =
    `${cap(th.ev)} occur as a Poisson process at rate λ = ${rate} ${th.rateU}. Over ${t} ${th.t}, ` +
    `what is the probability of exactly ${k} ${th.ev}? (Round to ${dp} decimals.)`;
  const explanation =
    `The count over ${t} ${th.t} is Poisson with mean m = λt = ${rate}·${t} = ${m}. ` +
    `So P(N = ${k}) = e^{−${m}}·${m}^${k}/${k}! = ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-poisson-interval-${rate}-${t}-${k}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Poisson process: count over t is Poisson(λt)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Poisson process · interval count",
    },
  };
}

/**
 * Splitting/thinning: expected # of a subtype (each event type-A w.p. p) over
 * time t = λpt. Traps: forgetting the thinning (λt), using (1−p), squaring p.
 */
export function buildPoissonSplitInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(PROC_THEME);
  const rate = rng.pick([4, 6, 8, 10]);
  const t = rng.pick([2, 3, 5]);
  const pNum = rng.pick([1, 1, 3]);
  const pDen = rng.pick([4, 5, 10]);
  const p = pNum / pDen;
  const dp = 3;
  const value = poissonThinnedMean(rate, p, t);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    poissonProcessMean(rate, t),
    `λt = ${rate}·${t} = ${rate * t} forgets the thinning. Only a fraction p = ${fracText(F(pNum, pDen))} are the subtype, so multiply by p.`,
  );
  push(
    poissonThinnedMean(rate, 1 - p, t),
    `λt(1−p) = ${decText(poissonThinnedMean(rate, 1 - p, t), dp)} uses the OTHER subtype's fraction (1−p) instead of p.`,
  );
  push(
    poissonThinnedMean(rate, p * p, t),
    `λtp² = ${decText(poissonThinnedMean(rate, p * p, t), dp)} squares p; thinning multiplies by p ONCE.`,
  );

  const prompt =
    `${cap(th.ev)} occur as a Poisson process at rate λ = ${rate} ${th.rateU}; each is independently a "priority" ` +
    `event with probability p = ${fracText(F(pNum, pDen))}. Over ${t} ${th.t}, what is the EXPECTED number of priority ${th.ev}? (Round to ${dp} decimals.)`;
  const explanation =
    `Thinning a Poisson process keeps it Poisson at rate λp, so the expected priority count over ${t} ${th.t} is ` +
    `λpt = ${rate}·${fracText(F(pNum, pDen))}·${t} = ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-poisson-split-${rate}-${pNum}_${pDen}-${t}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Poisson thinning: subtype rate λp",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Poisson process · splitting",
    },
  };
}

/**
 * Superposition COUNT: two independent streams (rates r1, r2) merge to rate
 * r1+r2, so expected total over t = (r1+r2)t. Traps: only one stream, product
 * of rates, or averaging the rates.
 */
export function buildPoissonSuperInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(PROC_THEME);
  const r1 = rng.pick([2, 3, 4]);
  const r2 = rng.pick([1, 2, 5]);
  const t = rng.pick([2, 3]);
  const dp = 0;
  const value = poissonSuperposedMean([r1, r2], t);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    r1 * t,
    `${r1 * t} counts only stream 1 (r₁t). Superposition ADDS the rates: expected total = (r₁+r₂)t.`,
  );
  push(
    r1 * r2 * t,
    `${r1 * r2 * t} multiplies the rates. Independent Poisson streams superpose by ADDING rates, not multiplying.`,
  );
  push(
    ((r1 + r2) / 2) * t,
    `${decText(((r1 + r2) / 2) * t, dp)} averages the rates. The merged rate is the SUM r₁+r₂, so the count is (r₁+r₂)t.`,
  );

  const prompt =
    `Two independent Poisson streams of ${th.ev} arrive at rates r₁ = ${r1} and r₂ = ${r2} ${th.rateU}. ` +
    `Over ${t} ${th.t}, what is the EXPECTED total number of ${th.ev}? (Whole number.)`;
  const explanation =
    `Superposing independent Poisson processes gives a Poisson process at the summed rate r₁+r₂ = ${r1 + r2}. ` +
    `Expected total over ${t} ${th.t} = (r₁+r₂)t = ${r1 + r2}·${t} = ${value}.`;

  return {
    answer,
    numeric: {
      id: `gen-poisson-super-${r1}-${r2}-${t}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Poisson superposition: merged rate r₁+r₂",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Poisson process · superposition",
    },
  };
}

/**
 * "Which stream first": for two independent Poisson streams (rates r1, r2) the
 * next event is from stream 1 w.p. r1/(r1+r2) — exact rational. Traps: r1/r2
 * (odds not probability), r2/(r1+r2) (the other stream), ½ (ignoring the rates).
 */
export function buildPoissonFirstStreamInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(PROC_THEME);
  const r1 = rng.pick([2, 3, 4, 5]);
  const r2 = rng.pick([1, 2, 3]);
  const { value } = poissonFirstStreamProb(r1, r2);
  const frac = F(r1, r1 + r2);
  const dp = 3;
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    r1 / r2,
    `r₁/r₂ = ${decText(r1 / r2, dp)} is the ODDS, not a probability. The chance the next event is stream 1 is r₁/(r₁+r₂).`,
  );
  push(
    r2 / (r1 + r2),
    `r₂/(r₁+r₂) = ${decText(r2 / (r1 + r2), dp)} is the probability the next event is from stream 2.`,
  );
  push(
    0.5,
    `0.5 ignores the rates. A faster stream is more likely to fire first: P = r₁/(r₁+r₂).`,
  );

  const prompt =
    `Two independent Poisson streams of ${th.ev} run at rates r₁ = ${r1} and r₂ = ${r2} ${th.rateU}. ` +
    `What is the probability that the NEXT ${th.ev.replace(/s$/, "")} comes from stream 1? (Round to ${dp} decimals.)`;
  const explanation =
    `Among competing Poisson streams, the next event is from stream 1 with probability r₁/(r₁+r₂) = ${r1}/${r1 + r2} = ${fracText(frac)} ≈ ${decText(value, dp)}. ` +
    `(This is the memoryless "which exponential fires first" split.)`;

  return {
    answer,
    numeric: {
      id: `gen-poisson-firststream-${r1}-${r2}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Poisson superposition split r₁/(r₁+r₂)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Poisson process · which-stream-first",
    },
  };
}

/* ========================================================================== */
/*  Named generators (adapters)                                                */
/* ========================================================================== */

export const genPoissonPmf = (rng: Rng): NumericQuestion =>
  buildPoissonPmfInstance(rng, "medium").numeric;
export const genPoissonAtLeastOne = (rng: Rng): NumericQuestion =>
  buildPoissonAtLeastOneInstance(rng, "medium").numeric;
export const genPoissonVariance = (rng: Rng): NumericQuestion =>
  buildPoissonVarianceInstance(rng, "easy").numeric;
export const genPoissonInterval = (rng: Rng): NumericQuestion =>
  buildPoissonIntervalInstance(rng, "hard").numeric;
export const genPoissonSplit = (rng: Rng): NumericQuestion =>
  buildPoissonSplitInstance(rng, "hard").numeric;
export const genPoissonSuper = (rng: Rng): NumericQuestion =>
  buildPoissonSuperInstance(rng, "medium").numeric;
export const genPoissonFirstStream = (rng: Rng): NumericQuestion =>
  buildPoissonFirstStreamInstance(rng, "hard").numeric;

import type { Rng } from "@/lib/rng";
import type { Difficulty, NumericQuestion } from "@/types/content";
import { F, decText, fracText } from "../coreSolvers";
import { cap, numDp, numericErrors } from "../coreScaffold";
import {
  compoundPoissonMean,
  poissonAtLeastOne,
  poissonCondUniformKthTime,
  poissonFirstStreamProb,
  poissonInterarrivalMean,
  poissonKthArrivalMean,
  poissonNoEventProb,
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
 * and off-by-one in k (reporting P(X=k−1) or P(X=k+1), a very common slip).
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
    `A Poisson distribution has Var(X) = λ = ${lambda}, its variance equals its mean. ` +
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
 * next event is from stream 1 w.p. r1/(r1+r2), exact rational. Traps: r1/r2
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
/* ==========================  PROCESS DEPTH  ============================== */
/* ========================================================================== */

/**
 * Mean interarrival time = 1/λ (interarrivals are Exp(λ)). Traps: reporting λ
 * (the rate), 2/λ (time to the 2nd arrival), and 1/λ² (wrong units).
 */
export function buildInterarrivalMeanInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(PROC_THEME);
  const rate = rng.pick([2, 4, 5, 8, 10]);
  const { num, den } = poissonInterarrivalMean(rate);
  const value = F(num, den);
  const dp = numDp(value, 2, 4);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(rate),
    `${rate} is λ, the mean NUMBER of ${th.ev} per unit time. The mean TIME between them is the reciprocal 1/λ.`,
  );
  push(
    F(2, rate),
    `2/λ = ${fracText(F(2, rate))} is the mean time to the SECOND arrival, not the gap between consecutive events.`,
  );
  push(
    F(1, rate * rate),
    `1/λ² = ${fracText(F(1, rate * rate))} has the wrong units; the mean interarrival is 1/λ.`,
  );

  const prompt =
    `${cap(th.ev)} occur as a Poisson process at rate λ = ${rate} ${th.rateU}. ` +
    `What is the mean TIME between consecutive ${th.ev} (in ${th.t})? (Round to ${dp} decimals.)`;
  const explanation =
    `Interarrival times of a Poisson process are Exponential(λ), so the mean gap is 1/λ = 1/${rate} = ${fracText(value)} ≈ ${decText(value, dp)} ${th.t}.`;

  return {
    answer,
    numeric: {
      id: `gen-poisson-interarrival-${rate}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Interarrival mean = 1/λ (Exponential gaps)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Poisson process · interarrival mean",
    },
  };
}

/**
 * P(no event before time t) = P(first arrival after t) = e^{−λt}. Traps:
 * 1−e^{−λt} (the complement), e^{−λ} (dropped t), λt·e^{−λt} (P of exactly one).
 */
export function buildNoEventProbInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(PROC_THEME);
  const rate = rng.pick([1, 2, 3]);
  const t = rng.pick([2, 3, 4]);
  const dp = 4;
  const value = poissonNoEventProb(rate, t);
  const answer = Number(decText(value, dp));
  const m = rate * t;

  const { errors, push } = numericErrors(answer, dp);
  push(
    1 - value,
    `${decText(1 - value, dp)} = 1 − e^{−λt} is P(at least one ${th.ev.replace(/s$/, "")} by time t), the complement of "no events".`,
  );
  push(
    Math.exp(-rate),
    `${decText(Math.exp(-rate), dp)} = e^{−λ} drops the window length t; over ${t} ${th.t} the mean is λt = ${m}, so use e^{−λt}.`,
  );
  push(
    m * Math.exp(-m),
    `${decText(m * Math.exp(-m), dp)} = λt·e^{−λt} is P(exactly one), not P(none).`,
  );

  const prompt =
    `${cap(th.ev)} occur as a Poisson process at rate λ = ${rate} ${th.rateU}. ` +
    `What is the probability that the FIRST ${th.ev.replace(/s$/, "")} arrives only AFTER ${t} ${th.t} (i.e. no ${th.ev} in the first ${t} ${th.t})? (Round to ${dp} decimals.)`;
  const explanation =
    `P(first arrival > t) = P(0 events in [0,t]) = e^{−λt} = e^{−${rate}·${t}} = e^{−${m}} = ${decText(value, dp)}. ` +
    `(Equivalently, the first interarrival, an Exp(λ), exceeds t.)`;

  return {
    answer,
    numeric: {
      id: `gen-poisson-noevent-${rate}-${t}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "P(no event in t) = P(T>t) = e^{−λt}",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Poisson process · waiting-time tail",
    },
  };
}

/**
 * Mean waiting time to the k-th arrival = k/λ (Erlang(k,λ) mean = sum of k iid
 * Exp(λ) gaps). Traps: 1/λ (only one gap), kλ (multiplied), k/λ² (wrong power).
 */
export function buildKthArrivalMeanInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(PROC_THEME);
  const rate = rng.pick([2, 3, 4, 5]);
  const k = rng.pick([2, 3, 4, 5]);
  const { num, den } = poissonKthArrivalMean(k, rate);
  const value = F(num, den);
  const dp = numDp(value, 2, 4);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(1, rate),
    `1/λ = ${fracText(F(1, rate))} is the mean time to just ONE arrival; the k-th arrival waits for k gaps, so k/λ.`,
  );
  push(
    F(k * rate),
    `k·λ = ${k * rate} multiplies by the rate; you DIVIDE by it: the k-th arrival mean is k/λ.`,
  );
  push(
    F(k, rate * rate),
    `k/λ² = ${fracText(F(k, rate * rate))} uses the wrong power of λ; each Exp(λ) gap has mean 1/λ, so k of them give k/λ.`,
  );

  const prompt =
    `${cap(th.ev)} occur as a Poisson process at rate λ = ${rate} ${th.rateU}. ` +
    `What is the expected TIME (in ${th.t}) until the ${k}-th ${th.ev.replace(/s$/, "")}? (Round to ${dp} decimals.)`;
  const explanation =
    `The time to the k-th arrival is a sum of k iid Exp(λ) interarrivals (an Erlang(k,λ)), with mean k/λ = ${k}/${rate} = ${fracText(value)} ≈ ${decText(value, dp)} ${th.t}.`;

  return {
    answer,
    numeric: {
      id: `gen-poisson-kth-${rate}-${k}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Time to k-th arrival ~ Erlang, mean k/λ",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Poisson process · k-th arrival mean",
    },
  };
}

/**
 * Conditional uniformity: given exactly n events in [0,T], the arrival times are
 * order statistics of n Uniform(0,T) draws, so E[S_(j)|N(T)=n] = j·T/(n+1).
 * Traps: j·T/n (wrong split), T/2 (ignore the rank), T/(n+1) (assume j=1).
 */
export function buildCondUniformInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(PROC_THEME);
  const T = rng.pick([6, 10, 12]);
  const n = rng.pick([3, 4, 5]);
  const j = rng.int(1, n);
  const { num, den } = poissonCondUniformKthTime(j, n, T);
  const value = F(num, den);
  const dp = numDp(value, 2, 4);
  const answer = Number(decText(value, dp));

  const ord = (r: number) =>
    r === 1 ? "1st" : r === 2 ? "2nd" : r === 3 ? "3rd" : `${r}th`;

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(j * T, n),
    `j·T/n = ${fracText(F(j * T, n))} divides by n; the n arrivals split [0,T] into n+1 equal expected gaps, so use n+1.`,
  );
  push(
    F(T, 2),
    `T/2 = ${fracText(F(T, 2))} is the mean of a single uniform point, ignoring the rank j among the n arrivals.`,
  );
  push(
    F(T, n + 1),
    `T/(n+1) = ${fracText(F(T, n + 1))} is the expected FIRST arrival time (j=1); scale it by j.`,
  );

  const prompt =
    `${cap(th.ev)} occur as a Poisson process over a window [0, ${T}] ${th.t}. ` +
    `GIVEN that exactly ${n} ${th.ev} occurred in the window, what is the expected time of the ${ord(j)} ${th.ev.replace(/s$/, "")}? (Round to ${dp} decimals.)`;
  const explanation =
    `Given N(T)=${n}, the arrival times are distributed as the order statistics of ${n} Uniform(0,${T}) draws, so E[S_(${j})|N=${n}] = j·T/(n+1) = ${j}·${T}/${n + 1} = ${fracText(value)} ≈ ${decText(value, dp)} ${th.t}.`;

  return {
    answer,
    numeric: {
      id: `gen-poisson-conduniform-${T}-${n}-${j}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Conditional uniformity: E[S_(j)|N=n]=jT/(n+1)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Poisson process · conditional uniformity",
    },
  };
}

const MARK_POOL: [number, number][] = [
  [3, 1],
  [5, 1],
  [3, 2],
  [5, 2],
  [7, 2],
];

/**
 * Compound Poisson mean: events at rate λ over time t, each carrying an iid mark
 * of mean μ ⇒ E[total] = λtμ. Traps: λt (forgot the mark), λμ (forgot t),
 * μt (forgot the rate).
 */
export function buildCompoundMeanInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const rate = rng.pick([2, 3, 4]);
  const t = rng.pick([2, 3, 5]);
  const [mn, md] = rng.pick(MARK_POOL);
  const mark = F(mn, md);
  const { num, den } = compoundPoissonMean(rate, t, mn, md);
  const value = F(num, den);
  const dp = numDp(value, 2, 4);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(rate * t),
    `λt = ${rate * t} is the expected NUMBER of claims; multiply by the mean claim size μ = ${fracText(mark)} to get the total.`,
  );
  push(
    F(rate * mn, md),
    `λμ = ${fracText(F(rate * mn, md))} forgets the time window t = ${t}.`,
  );
  push(
    F(t * mn, md),
    `μt = ${fracText(F(t * mn, md))} forgets the arrival rate λ = ${rate}.`,
  );

  const prompt =
    `Insurance claims arrive as a Poisson process at rate λ = ${rate} per day, and each claim has an independent mean size of $${fracText(mark)}. ` +
    `Over ${t} days, what is the EXPECTED total claim amount (in dollars)? (Round to ${dp} decimals.)`;
  const explanation =
    `A compound Poisson total has mean E[S] = λ·t·E[mark] = ${rate}·${t}·${fracText(mark)} = ${fracText(value)} ≈ ${decText(value, dp)}. ` +
    `(By Wald over the Poisson count N with E[N]=λt.)`;

  return {
    answer,
    numeric: {
      id: `gen-poisson-compound-${rate}-${t}-${mn}_${md}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Compound Poisson mean = λt·E[mark]",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Poisson process · compound mean",
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
export const genPoissonInterarrival = (rng: Rng): NumericQuestion =>
  buildInterarrivalMeanInstance(rng, "medium").numeric;
export const genPoissonNoEvent = (rng: Rng): NumericQuestion =>
  buildNoEventProbInstance(rng, "hard").numeric;
export const genPoissonKthArrival = (rng: Rng): NumericQuestion =>
  buildKthArrivalMeanInstance(rng, "hard").numeric;
export const genPoissonCondUniform = (rng: Rng): NumericQuestion =>
  buildCondUniformInstance(rng, "hard").numeric;
export const genPoissonCompound = (rng: Rng): NumericQuestion =>
  buildCompoundMeanInstance(rng, "hard").numeric;

/**
 * Exact + high-precision solvers for the Probability & Statistics → **Poisson
 * Distribution & Process** subcategory (UT M362K ch. 4.7 / M362M Poisson-process
 * core; interview-relevant per FIRM_TIMED_ASSESSMENTS, arrival/rare-event
 * modelling).
 *
 * The Poisson pmf carries an `e^{−λ}` factor, so probabilities are genuinely
 * transcendental and computed as `number` to a stated precision (mirroring the
 * CLT `Φ(z)` and exponential-median families in `../coreSolvers.ts`). The
 * process COUNT expectations (`λt`, thinning `λtp`, superposition `(λ₁+λ₂)t`) and
 * the "which stream first" split `λ₁/(λ₁+λ₂)` are exact rationals.
 *
 * NONE of these are copied source questions, the generators author fresh items;
 * this file is the independent verifier the tests re-derive against.
 */

/** Plain integer factorial for small k (k ≤ ~20 here). */
export function factN(k: number): number {
  let f = 1;
  for (let i = 2; i <= k; i++) f *= i;
  return f;
}

/** Poisson pmf P(X = k) = e^{−λ}·λ^k / k! (float; λ, k small). */
export function poissonPMF(lambda: number, k: number): number {
  return (Math.exp(-lambda) * lambda ** k) / factN(k);
}

/** P(X ≥ 1) = 1 − e^{−λ} (the "at least one event" complement). */
export function poissonAtLeastOne(lambda: number): number {
  return 1 - Math.exp(-lambda);
}

/** Variance of Poisson(λ) = λ (equal to the mean, the signature Poisson fact). */
export function poissonVariance(lambda: number): number {
  return lambda;
}

/** Expected number of events of a rate-`rate` Poisson process over time `t` = rate·t. */
export function poissonProcessMean(rate: number, t: number): number {
  return rate * t;
}

/**
 * Thinning / splitting: a rate-`rate` Poisson process where each event is "type
 * A" independently w.p. `p` yields a rate-`rate·p` Poisson process, so the
 * expected # of type-A events over time `t` is rate·p·t.
 */
export function poissonThinnedMean(rate: number, p: number, t: number): number {
  return rate * p * t;
}

/**
 * Superposition: independent Poisson processes with rates `rates` merge into one
 * with rate Σrates, so the expected total over time `t` is (Σrates)·t.
 */
export function poissonSuperposedMean(rates: number[], t: number): number {
  return rates.reduce((a, r) => a + r, 0) * t;
}

/**
 * Competing exponentials / superposition split: for independent Poisson streams
 * with rates `rate1`, `rate2`, the next arrival comes from stream 1 with
 * probability rate1/(rate1+rate2) (exact rational numerator/denominator).
 */
export function poissonFirstStreamProb(rate1: number, rate2: number): {
  num: number;
  den: number;
  value: number;
} {
  return { num: rate1, den: rate1 + rate2, value: rate1 / (rate1 + rate2) };
}

/* ========================================================================== */
/*  PROCESS DEPTH: interarrivals, waiting times, conditional uniformity,       */
/*  compound Poisson (M362M Poisson-process core)                              */
/* ========================================================================== */

/**
 * Interarrival times of a rate-λ Poisson process are iid Exponential(λ), so the
 * MEAN gap between consecutive events is 1/λ (exact rational num/den).
 */
export function poissonInterarrivalMean(rate: number): { num: number; den: number } {
  return { num: 1, den: rate };
}

/**
 * P(no event in a window of length t) = P(interarrival > t) = e^{−λt} (float,
 * transcendental). Equivalently P(the first arrival happens after time t).
 */
export function poissonNoEventProb(rate: number, t: number): number {
  return Math.exp(-rate * t);
}

/**
 * Waiting time to the k-th arrival is Gamma/Erlang(k, λ) with MEAN k/λ (the sum
 * of k iid Exp(λ) interarrivals). Exact rational num/den.
 */
export function poissonKthArrivalMean(k: number, rate: number): { num: number; den: number } {
  return { num: k, den: rate };
}

/**
 * CONDITIONAL UNIFORMITY: given exactly n events of a Poisson process in [0,T],
 * the n arrival times are distributed as the order statistics of n iid
 * Uniform(0,T) draws. Hence the expected time of the j-th (of n) arrival is
 * E[S_(j) | N(T)=n] = j·T/(n+1). Exact rational num/den.
 */
export function poissonCondUniformKthTime(
  j: number,
  n: number,
  T: number,
): { num: number; den: number } {
  return { num: j * T, den: n + 1 };
}

/**
 * COMPOUND Poisson: if events arrive at rate λ over time t and each carries an
 * iid mark of mean `markMean`, the total S = Σ marks has E[S] = λ·t·markMean
 * (Wald over a Poisson count). Exact rational num/den for rational markMean given
 * as `markNum/markDen`.
 */
export function compoundPoissonMean(
  rate: number,
  t: number,
  markNum: number,
  markDen: number,
): { num: number; den: number } {
  return { num: rate * t * markNum, den: markDen };
}

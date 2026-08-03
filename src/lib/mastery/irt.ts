import { Rng } from "@/lib/rng";
import { sigmoid } from "./elo";

/**
 * 2PL Item Response Theory (T12 adaptive engine — additive).
 *
 * The two-parameter logistic model gives the probability that a learner of
 * latent ability θ answers an item with discrimination `a` and difficulty `b`
 * correctly:
 *
 *     P(correct | θ, a, b) = σ(a · (θ − b))
 *
 * (Lord 1980; Baker & Kim, *Item Response Theory*, 2004.) This module RECOVERS
 * θ from a set of graded responses with per-item (a, b) via penalized maximum
 * likelihood — a MAP estimate under a Gaussian prior θ ~ N(priorMean, priorSd²).
 * The prior is what keeps the estimate finite when every response is correct (or
 * every response is wrong), which plain MLE cannot handle.
 *
 * This is a PARALLEL psychometric signal to the incremental guessing-corrected
 * Elo `theta` in `mastery.ts`; it NEVER replaces it. Everything here is pure —
 * given the same responses (and, when multi-start is requested, the same seed)
 * it returns the same estimate.
 */

/** One graded response fed to the 2PL estimator. */
export interface IrtResponse {
  /** Item discrimination a > 0 (steepness of the logistic). */
  a: number;
  /** Item difficulty b (logit scale; the θ at which P = 0.5). */
  b: number;
  /**
   * Graded outcome ∈ [0,1]. Binary 0/1 is the usual case; fractional partial
   * credit (from `creditSchedule.ts`) is accepted directly as a soft response.
   */
  score: number;
}

export interface Ability2PLResult {
  /** MAP ability estimate θ̂ on the logit scale. */
  theta: number;
  /** Standard error from the observed information (+ prior). Smaller = surer. */
  se: number;
  /** Total Fisher/observed information at θ̂ (higher = more precise). */
  information: number;
  /** Newton iterations actually run for the winning start. */
  iterations: number;
  /** Number of responses the estimate was fit on. */
  n: number;
  /** Value of the log-posterior at θ̂ (used to pick the best multi-start). */
  logPosterior: number;
}

export interface Ability2PLOptions {
  /** Prior mean for the MAP regularizer (default 0 — the neutral logit). */
  priorMean?: number;
  /**
   * Prior SD for the MAP regularizer (default 2). Larger ⇒ weaker shrinkage
   * (closer to raw MLE); smaller ⇒ estimates pulled harder toward `priorMean`.
   */
  priorSd?: number;
  /** Clamp the estimate to ±this many logits (default 6) for numeric safety. */
  clamp?: number;
  /** Max Newton iterations per start (default 60). */
  maxIter?: number;
  /** Convergence tolerance on the Newton step (default 1e-9). */
  tol?: number;
  /**
   * Number of jittered Newton starts (default 1 ⇒ fully deterministic single
   * start at `priorMean`). When > 1, `rng` (or `seed`) seeds reproducible
   * starting jitter and the best log-posterior wins — this is the ONLY place
   * randomness enters, and it is seedable so results are deterministic.
   */
  starts?: number;
  /** Seed for the multi-start jitter (ignored when `starts` ≤ 1). */
  seed?: number;
  /** Explicit RNG (takes precedence over `seed`) for multi-start jitter. */
  rng?: Rng;
}

/** 2PL success probability P(correct | θ, a, b) = σ(a·(θ − b)). */
export function probability2PL(theta: number, a: number, b: number): number {
  return sigmoid(a * (theta - b));
}

/**
 * Fisher information contributed by a single 2PL item at ability θ:
 *   I(θ) = a² · P · (1 − P).
 * Maximized when P = 0.5 (θ = b) — i.e. an item is most informative for a
 * learner right at its difficulty. Used by the selector to reason about which
 * item sharpens the ability estimate fastest.
 */
export function itemInformation2PL(theta: number, a: number, b: number): number {
  const p = probability2PL(theta, a, b);
  return a * a * p * (1 - p);
}

/** Total 2PL test information at θ across a set of items. */
export function testInformation2PL(theta: number, items: { a: number; b: number }[]): number {
  return items.reduce((s, it) => s + itemInformation2PL(theta, it.a, it.b), 0);
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** Log-posterior ∝ log-likelihood + Gaussian log-prior (dropping constants). */
function logPosterior(
  theta: number,
  responses: IrtResponse[],
  priorMean: number,
  priorSd: number,
): number {
  let ll = 0;
  for (const r of responses) {
    const p = probability2PL(theta, r.a, r.b);
    const s = clamp01(r.score);
    // Guard the logs against p exactly 0/1.
    const pe = Math.min(1 - 1e-12, Math.max(1e-12, p));
    ll += s * Math.log(pe) + (1 - s) * Math.log(1 - pe);
  }
  const dm = theta - priorMean;
  ll += -(dm * dm) / (2 * priorSd * priorSd);
  return ll;
}

/**
 * Estimate the latent 2PL ability θ from a set of graded responses via a damped
 * Newton–Raphson MAP fit under a Gaussian prior.
 *
 * Empty input returns the prior mean with the prior SE (no information). The
 * result carries the observed information and its implied standard error so
 * callers can gate on confidence.
 */
export function estimateAbility2PL(
  responses: IrtResponse[],
  opts: Ability2PLOptions = {},
): Ability2PLResult {
  const priorMean = opts.priorMean ?? 0;
  const priorSd = opts.priorSd ?? 2;
  const clamp = opts.clamp ?? 6;
  const maxIter = opts.maxIter ?? 60;
  const tol = opts.tol ?? 1e-9;
  const starts = Math.max(1, Math.floor(opts.starts ?? 1));
  const priorPrec = 1 / (priorSd * priorSd);

  if (responses.length === 0) {
    return {
      theta: priorMean,
      se: priorSd,
      information: priorPrec,
      iterations: 0,
      n: 0,
      logPosterior: 0,
    };
  }

  const rng = opts.rng ?? (starts > 1 ? new Rng(opts.seed ?? 12345) : undefined);

  const runFrom = (start: number): { theta: number; iterations: number } => {
    let theta = start;
    let iterations = 0;
    for (let i = 0; i < maxIter; i++) {
      iterations = i + 1;
      // Gradient g = Σ a·(s − P) − (θ − μ)/σ²; curvature (−Hessian)
      // J = Σ a²·P·(1 − P) + 1/σ².
      let g = 0;
      let j = 0;
      for (const r of responses) {
        const p = probability2PL(theta, r.a, r.b);
        g += r.a * (clamp01(r.score) - p);
        j += r.a * r.a * p * (1 - p);
      }
      g -= (theta - priorMean) * priorPrec;
      j += priorPrec;
      // J is strictly positive (prior precision), so the Newton step is safe.
      const step = g / j;
      theta += step;
      if (theta > clamp) theta = clamp;
      else if (theta < -clamp) theta = -clamp;
      if (Math.abs(step) < tol) break;
    }
    return { theta, iterations };
  };

  let best: { theta: number; iterations: number } | null = null;
  let bestLp = -Infinity;
  for (let s = 0; s < starts; s++) {
    // First start is always the prior mean (deterministic); extra starts jitter.
    const start =
      s === 0 || !rng ? priorMean : priorMean + (rng.next() * 2 - 1) * 3;
    const cand = runFrom(start);
    const lp = logPosterior(cand.theta, responses, priorMean, priorSd);
    if (lp > bestLp) {
      bestLp = lp;
      best = cand;
    }
  }

  const theta = best!.theta;
  // Observed information at θ̂ (Hessian of the negative log-posterior).
  let information = priorPrec;
  for (const r of responses) {
    const p = probability2PL(theta, r.a, r.b);
    information += r.a * r.a * p * (1 - p);
  }
  const se = 1 / Math.sqrt(information);

  return {
    theta,
    se,
    information,
    iterations: best!.iterations,
    n: responses.length,
    logPosterior: bestLp,
  };
}

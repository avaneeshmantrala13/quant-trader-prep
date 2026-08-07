import { Rng } from "@/lib/rng";
import {
  estimateAbility2PL,
  probability2PL,
  type IrtResponse,
} from "./irt";
import {
  glickoRatingToLogit,
  initialGlicko,
  logitToGlickoRating,
  updateItemDifficulty,
} from "./glicko";
import { thompsonSelect, type ThompsonArm } from "./thompson";
import { P_TARGET } from "./config";

/**
 * Offline evaluation harness for the T12 adaptive engine (additive; no runtime
 * consumers). It simulates SYNTHETIC learners answering under a KNOWN latent
 * ability against items with KNOWN parameters, runs the estimators + selector,
 * and reports parameter-recovery and learning-gain metrics. The accompanying
 * `offlineEval.test.ts` asserts these clear sensible baselines:
 *
 *  - IRT (2PL) recovers each learner's true ability (high true-vs-estimated
 *    correlation, low RMSE).
 *  - Glicko recovers each item's true difficulty ordering (high correlation).
 *  - The Thompson (ZPD) selector produces MORE learning gain than a random
 *    (and a greedy "mastery") baseline.
 *
 * Everything is deterministic given a seed, so the eval is a stable regression
 * guard, not a flaky Monte-Carlo.
 */

/** Pearson correlation between two equal-length series. */
export function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n === 0 || n !== ys.length) return 0;
  const mx = xs.reduce((s, x) => s + x, 0) / n;
  const my = ys.reduce((s, y) => s + y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  const denom = Math.sqrt(sxx * syy);
  return denom === 0 ? 0 : sxy / denom;
}

/** Root-mean-square error between two equal-length series. */
export function rmse(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n === 0 || n !== ys.length) return 0;
  let s = 0;
  for (let i = 0; i < n; i++) s += (xs[i] - ys[i]) ** 2;
  return Math.sqrt(s / n);
}

/** Evenly spaced values across [lo, hi] (inclusive), n points. */
function linspace(lo: number, hi: number, n: number): number[] {
  if (n <= 1) return [lo];
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(lo + ((hi - lo) * i) / (n - 1));
  return out;
}

// ----------------------------------------------------------------------------
// 1. IRT (2PL) ability recovery
// ----------------------------------------------------------------------------

export interface IrtRecoveryResult {
  correlation: number;
  rmse: number;
  nLearners: number;
  nItems: number;
  trueTheta: number[];
  estTheta: number[];
}

export interface IrtRecoveryOptions {
  seed?: number;
  nLearners?: number;
  nItems?: number;
  /** Difficulty spread of the item bank. */
  bRange?: [number, number];
  /** Discrimination spread of the item bank. */
  aRange?: [number, number];
  /** Ability spread of the synthetic learners. */
  thetaRange?: [number, number];
}

/**
 * Simulate `nLearners` learners of known ability answering an `nItems` bank
 * under the 2PL model, then recover each ability with {@link estimateAbility2PL}
 * and correlate estimate vs truth.
 */
export function simulateIrtRecovery(opts: IrtRecoveryOptions = {}): IrtRecoveryResult {
  const seed = opts.seed ?? 42;
  const nLearners = opts.nLearners ?? 60;
  const nItems = opts.nItems ?? 40;
  const [bLo, bHi] = opts.bRange ?? [-2.5, 2.5];
  const [aLo, aHi] = opts.aRange ?? [0.7, 1.8];
  const [tLo, tHi] = opts.thetaRange ?? [-2.5, 2.5];

  const rng = new Rng(seed);
  const bank = Array.from({ length: nItems }, () => ({
    a: aLo + rng.next() * (aHi - aLo),
    b: bLo + rng.next() * (bHi - bLo),
  }));

  const trueTheta: number[] = [];
  const estTheta: number[] = [];

  for (let l = 0; l < nLearners; l++) {
    const theta = tLo + ((tHi - tLo) * l) / Math.max(1, nLearners - 1);
    const responses: IrtResponse[] = bank.map((it) => {
      const p = probability2PL(theta, it.a, it.b);
      return { a: it.a, b: it.b, score: rng.next() < p ? 1 : 0 };
    });
    const est = estimateAbility2PL(responses, { priorSd: 3 });
    trueTheta.push(theta);
    estTheta.push(est.theta);
  }

  return {
    correlation: pearson(trueTheta, estTheta),
    rmse: rmse(trueTheta, estTheta),
    nLearners,
    nItems,
    trueTheta,
    estTheta,
  };
}

// ----------------------------------------------------------------------------
// 2. Glicko item-difficulty recovery
// ----------------------------------------------------------------------------

export interface GlickoRecoveryResult {
  correlation: number;
  nItems: number;
  nLearnersPerItem: number;
  trueDifficultyLogit: number[];
  estDifficultyLogit: number[];
}

export interface GlickoRecoveryOptions {
  seed?: number;
  nItems?: number;
  nLearnersPerItem?: number;
  bRange?: [number, number];
  thetaRange?: [number, number];
}

/**
 * Simulate a population of learners of varying ability repeatedly answering each
 * item; fold each outcome into the item's Glicko difficulty rating and correlate
 * the recovered difficulty (converted back to logits) with the truth.
 */
export function simulateGlickoRecovery(
  opts: GlickoRecoveryOptions = {},
): GlickoRecoveryResult {
  const seed = opts.seed ?? 7;
  const nItems = opts.nItems ?? 25;
  const nLearnersPerItem = opts.nLearnersPerItem ?? 120;
  const [bLo, bHi] = opts.bRange ?? [-2, 2];
  const [tLo, tHi] = opts.thetaRange ?? [-2.5, 2.5];

  const rng = new Rng(seed);
  const trueB = linspace(bLo, bHi, nItems);
  const trueDifficultyLogit: number[] = [];
  const estDifficultyLogit: number[] = [];

  for (let i = 0; i < nItems; i++) {
    const b = trueB[i];
    let rating = initialGlicko();
    for (let k = 0; k < nLearnersPerItem; k++) {
      const theta = tLo + rng.next() * (tHi - tLo);
      const p = probability2PL(theta, 1, b);
      const correct = rng.next() < p;
      rating = updateItemDifficulty(rating, {
        correct,
        learnerRating: logitToGlickoRating(theta),
      });
    }
    trueDifficultyLogit.push(b);
    estDifficultyLogit.push(glickoRatingToLogit(rating.rating));
  }

  return {
    correlation: pearson(trueDifficultyLogit, estDifficultyLogit),
    nItems,
    nLearnersPerItem,
    trueDifficultyLogit,
    estDifficultyLogit,
  };
}

// ----------------------------------------------------------------------------
// 3. Selector learning-gain (Thompson ZPD vs random vs greedy)
// ----------------------------------------------------------------------------

export type SelectorStrategy = "thompson-zpd" | "thompson-mastery" | "random";

export interface SelectorGainResult {
  thompsonZpdGain: number;
  thompsonMasteryGain: number;
  randomGain: number;
  steps: number;
  nTopics: number;
  nRuns: number;
}

export interface SelectorGainOptions {
  seed?: number;
  /** Number of practice steps per simulated session. */
  steps?: number;
  /** Number of topics (each a fixed-difficulty arm). */
  nTopics?: number;
  /** Independent learner runs to average over (variance reduction). */
  nRuns?: number;
  /** Base learning rate per well-placed item. */
  learningRate?: number;
  /** Recency decay applied to the selector's Beta bookkeeping. */
  decay?: number;
  /** Success-probability at which learning gain peaks (desirable difficulty). */
  pStar?: number;
  /** Width of the learning-gain Gaussian around `pStar`. */
  gainWidth?: number;
}

/**
 * A single learner's practice session under one selection strategy. Returns the
 * ability gain (final − initial θ). The learning model rewards DESIRABLE
 * DIFFICULTY: gain per item peaks when the item's success probability is near
 * `pStar` (a Gaussian in p), so serving items in the ZPD maximizes learning.
 */
function runSession(
  strategy: SelectorStrategy,
  topicB: number[],
  startTheta: number,
  rng: Rng,
  cfg: Required<
    Pick<
      SelectorGainOptions,
      "steps" | "learningRate" | "decay" | "pStar" | "gainWidth"
    >
  > & { target: number },
): number {
  const M = topicB.length;
  // Selector's own decayed Beta bookkeeping per topic (not the mastery layer).
  const alpha = new Array(M).fill(1);
  const beta = new Array(M).fill(1);
  let theta = startTheta;

  for (let t = 0; t < cfg.steps; t++) {
    let j: number;
    if (strategy === "random") {
      j = rng.int(0, M - 1);
    } else {
      const arms: ThompsonArm[] = topicB.map((_, idx) => ({
        key: String(idx),
        alpha: alpha[idx],
        beta: beta[idx],
      }));
      const choice = thompsonSelect(arms, rng, {
        objective: strategy === "thompson-mastery" ? "mastery" : "zpd",
        target: cfg.target,
      });
      j = choice.key === null ? 0 : Number(choice.key);
    }

    const p = probability2PL(theta, 1, topicB[j]);
    const correct = rng.next() < p;

    // Learning gain: desirable-difficulty Gaussian centred at pStar.
    const g = Math.exp(-((p - cfg.pStar) ** 2) / (2 * cfg.gainWidth ** 2));
    theta += cfg.learningRate * g;

    // Update the selector's recency-decayed Beta bookkeeping.
    const y = correct ? 1 : 0;
    alpha[j] = cfg.decay * alpha[j] + y;
    beta[j] = cfg.decay * beta[j] + (1 - y);
  }

  return theta - startTheta;
}

/**
 * Compare learning gain across the Thompson-ZPD selector, a greedy
 * Thompson-mastery selector, and a random baseline, averaged over `nRuns`
 * learners. Deterministic given the seed.
 */
export function simulateSelectorGain(
  opts: SelectorGainOptions = {},
): SelectorGainResult {
  const seed = opts.seed ?? 99;
  // 150 steps lets a low-ability learner climb far enough that the ZPD selector's
  // advantage over greedy exploitation (which over-serves now-too-easy items)
  // becomes clear — the desirable-difficulty effect needs a horizon to show.
  const steps = opts.steps ?? 150;
  const nTopics = opts.nTopics ?? 10;
  const nRuns = opts.nRuns ?? 24;
  const learningRate = opts.learningRate ?? 0.05;
  const decay = opts.decay ?? 0.9;
  const pStar = opts.pStar ?? P_TARGET;
  const gainWidth = opts.gainWidth ?? 0.12;

  const topicB = linspace(-2.5, 2.5, nTopics);
  const cfg = { steps, learningRate, decay, pStar, gainWidth, target: pStar };

  let zpd = 0;
  let mastery = 0;
  let random = 0;

  for (let r = 0; r < nRuns; r++) {
    const startTheta = -1.5;
    // Each strategy gets its OWN seeded stream so the only difference is the
    // selection policy, not the random draws.
    zpd += runSession(
      "thompson-zpd",
      topicB,
      startTheta,
      new Rng(seed + r * 3 + 0),
      cfg,
    );
    mastery += runSession(
      "thompson-mastery",
      topicB,
      startTheta,
      new Rng(seed + r * 3 + 1),
      cfg,
    );
    random += runSession(
      "random",
      topicB,
      startTheta,
      new Rng(seed + r * 3 + 2),
      cfg,
    );
  }

  return {
    thompsonZpdGain: zpd / nRuns,
    thompsonMasteryGain: mastery / nRuns,
    randomGain: random / nRuns,
    steps,
    nTopics,
    nRuns,
  };
}

// ----------------------------------------------------------------------------
// Combined report
// ----------------------------------------------------------------------------

export interface OfflineEvalReport {
  irt: IrtRecoveryResult;
  glicko: GlickoRecoveryResult;
  selector: SelectorGainResult;
}

/** Run all three evaluations with their defaults (or overrides). */
export function runOfflineEval(opts: {
  irt?: IrtRecoveryOptions;
  glicko?: GlickoRecoveryOptions;
  selector?: SelectorGainOptions;
} = {}): OfflineEvalReport {
  return {
    irt: simulateIrtRecovery(opts.irt),
    glicko: simulateGlickoRecovery(opts.glicko),
    selector: simulateSelectorGain(opts.selector),
  };
}

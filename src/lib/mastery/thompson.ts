import { Rng } from "@/lib/rng";
import type { TopicMastery } from "@/types/mastery";
import { BETA_PRIOR_ALPHA, BETA_PRIOR_BETA, P_TARGET } from "./config";

/**
 * Thompson-sampling item/topic selector (T12 adaptive engine — additive).
 *
 * Thompson sampling (Thompson 1933; Chapelle & Li 2011) picks the next arm by
 * drawing one sample from each arm's posterior and choosing the best sampled
 * arm — naturally trading off exploration and exploitation without any tuning
 * knob. Here each arm is a candidate topic/item carrying a Beta(α,β) success
 * posterior (the SAME posterior the mastery layer already maintains), so the
 * selector reuses existing state.
 *
 * Two objectives are supported:
 *  - `objective: "mastery"` — pick the arm with the highest sampled success
 *    probability (classic exploit-the-best bandit).
 *  - `objective: "zpd"` (default) — pick the arm whose sampled success
 *    probability is CLOSEST to a target band centre (default P_TARGET = 0.8, the
 *    Wilson 85%-rule / desirable-difficulty zone). This drives learning-gain by
 *    keeping the learner in their Zone of Proximal Development, while the
 *    posterior sampling still explores under-served topics.
 *
 * This is a NEW, opt-in selection API. It does NOT remove or alter any existing
 * ZPDES / selection path other code depends on, and it never mutates the
 * posteriors it reads. Deterministic: given the same arms and the same seeded
 * `Rng` it always returns the same choice.
 */

/** Box–Muller standard normal draw from a seeded uniform stream. */
export function sampleNormal(rng: Rng): number {
  let u = rng.next();
  // Guard against log(0).
  if (u < 1e-12) u = 1e-12;
  const v = rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Gamma(shape, scale) draw via Marsaglia & Tsang (2000), with Ahrens–Dieter
 * boosting for shape < 1. Deterministic given the seeded `Rng`.
 */
export function sampleGamma(rng: Rng, shape: number, scale = 1): number {
  if (shape < 1) {
    // Boost: Gamma(a) = Gamma(a+1) · U^(1/a).
    const u = Math.max(1e-12, rng.next());
    return sampleGamma(rng, shape + 1, scale) * Math.pow(u, 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  // Rejection loop; bounded in expectation, so a generous cap is just safety.
  for (let i = 0; i < 1000; i++) {
    let x: number;
    let vv: number;
    do {
      x = sampleNormal(rng);
      vv = 1 + c * x;
    } while (vv <= 0);
    vv = vv * vv * vv;
    const u = rng.next();
    const x2 = x * x;
    if (u < 1 - 0.0331 * x2 * x2) return d * vv * scale;
    if (Math.log(u) < 0.5 * x2 + d * (1 - vv + Math.log(vv))) {
      return d * vv * scale;
    }
  }
  // Fallback (essentially never reached): the distribution mean.
  return shape * scale;
}

/** Beta(a, b) draw via the ratio of two Gamma draws. Deterministic given `rng`. */
export function sampleBeta(rng: Rng, a: number, b: number): number {
  const x = sampleGamma(rng, a);
  const y = sampleGamma(rng, b);
  const s = x + y;
  if (s <= 0) return 0.5;
  return x / s;
}

/** One selectable arm carrying a Beta success posterior. */
export interface ThompsonArm {
  key: string;
  /** Beta success pseudo-count α (default {@link BETA_PRIOR_ALPHA}). */
  alpha?: number;
  /** Beta failure pseudo-count β (default {@link BETA_PRIOR_BETA}). */
  beta?: number;
  /** Optional eligibility filter; a false arm is never selected. */
  eligible?: boolean;
}

export type ThompsonObjective = "zpd" | "mastery";

export interface ThompsonOptions {
  /** Selection objective (default `"zpd"`). */
  objective?: ThompsonObjective;
  /** ZPD target success probability (default {@link P_TARGET} = 0.8). */
  target?: number;
}

export interface ThompsonChoice {
  /** Chosen arm key (null when no eligible arms). */
  key: string | null;
  /** The winning arm's sampled success probability. */
  sample: number;
  /** Per-arm sampled probabilities (parallel to the eligible input order). */
  samples: { key: string; sample: number; utility: number }[];
}

function utilityFor(sample: number, objective: ThompsonObjective, target: number): number {
  // Higher utility = more preferred. Mastery: raw sampled prob. ZPD: closeness
  // to the target band centre (negated distance).
  return objective === "mastery" ? sample : -Math.abs(sample - target);
}

/**
 * Thompson-sample every eligible arm and return the argmax under the objective.
 * Pure w.r.t. the arms; consumes `rng` for exactly one Beta draw per eligible
 * arm (in input order), so the choice is reproducible for a given seed.
 */
export function thompsonSelect(
  arms: ThompsonArm[],
  rng: Rng,
  opts: ThompsonOptions = {},
): ThompsonChoice {
  const objective = opts.objective ?? "zpd";
  const target = opts.target ?? P_TARGET;

  const samples: { key: string; sample: number; utility: number }[] = [];
  let bestKey: string | null = null;
  let bestUtility = -Infinity;
  let bestSample = 0;

  for (const arm of arms) {
    if (arm.eligible === false) continue;
    const a = arm.alpha ?? BETA_PRIOR_ALPHA;
    const b = arm.beta ?? BETA_PRIOR_BETA;
    const sample = sampleBeta(rng, a, b);
    const utility = utilityFor(sample, objective, target);
    samples.push({ key: arm.key, sample, utility });
    if (utility > bestUtility) {
      bestUtility = utility;
      bestKey = arm.key;
      bestSample = sample;
    }
  }

  return { key: bestKey, sample: bestSample, samples };
}

/**
 * Build Thompson arms from a per-topic mastery map and Thompson-select the next
 * topic. Topics with a confidently-mastered posterior can be excluded via
 * `excludeKeys` (e.g. the caller's ciLow ≥ bar set) so the selector focuses
 * effort where it still moves the needle. Additive convenience — reads the
 * existing Beta posteriors, mutates nothing.
 */
export function selectNextTopic(
  masteryByKey: Record<string, TopicMastery | undefined>,
  candidateKeys: string[],
  rng: Rng,
  opts: ThompsonOptions & { excludeKeys?: Iterable<string> } = {},
): ThompsonChoice {
  const excluded = new Set(opts.excludeKeys ?? []);
  const arms: ThompsonArm[] = candidateKeys.map((key) => {
    const m = masteryByKey[key];
    return {
      key,
      alpha: m?.alpha ?? BETA_PRIOR_ALPHA,
      beta: m?.beta ?? BETA_PRIOR_BETA,
      eligible: !excluded.has(key),
    };
  });
  return thompsonSelect(arms, rng, opts);
}

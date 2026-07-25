import type { ItemAttempt, TopicMastery } from "@/types/mastery";
import {
  BETA_DECAY_RHO,
  BETA_PRIOR_ALPHA,
  BETA_PRIOR_BETA,
  MASTERY_MODE,
  MISCONCEPTION_DECAY,
} from "./config";
import { seedTierDifficulty, updateElo } from "./elo";
import { betaUpdate } from "./beta";
import { bumpMisconceptions, decayMisconceptions } from "./misconceptions";

/**
 * The pure fold: apply ONE ItemAttempt to (mastery, tierD). Returns fresh copies
 * — the inputs are never mutated (PHASE_1 §4/§8). This is the single place Elo,
 * Beta, and misconception updates are composed; `recordItemAttempt` in
 * ProgressContext is a thin wrapper that persists what this returns.
 *
 * `dExposures` = how many times this (topic,tier) has been seen before, supplied
 * by the caller (it lives in the TierDifficultyMap companion, see topicKey.ts).
 */
export function applyItemAttempt(
  prev: TopicMastery | undefined,
  tierD: number | undefined,
  a: ItemAttempt,
  dExposures: number,
): { mastery: TopicMastery; tierD: number } {
  const y: 0 | 1 = a.correct ? 1 : 0;

  const base: TopicMastery = prev ?? {
    theta: 0,
    n: 0,
    alpha: BETA_PRIOR_ALPHA,
    beta: BETA_PRIOR_BETA,
    lastSeen: a.at,
    misconceptions: {},
  };

  // Tier difficulty: seed on first exposure, else use the stored value.
  let d = tierD ?? seedTierDifficulty(a.tier);
  let theta = base.theta;

  // BACKUP mode "beta" skips the Elo block entirely (PHASE_1 §2/§5); θ and d
  // simply carry through untouched.
  if (MASTERY_MODE === "elo+beta") {
    const stepped = updateElo({
      theta: base.theta,
      d,
      y,
      kOptions: a.kOptions,
      n: base.n,
      dExposures,
    });
    theta = stepped.theta;
    d = stepped.d;
  }

  const { alpha, beta } = betaUpdate(base.alpha, base.beta, y, BETA_DECAY_RHO);

  // Misconceptions: bump the tripped keys on a wrong answer; fade all on a right
  // answer (PHASE_1 §5). Caller resolves `a.misconceptions` via topicKey helpers.
  const misconceptions =
    y === 1
      ? decayMisconceptions(base.misconceptions, MISCONCEPTION_DECAY)
      : bumpMisconceptions(base.misconceptions, a.misconceptions ?? []);

  const mastery: TopicMastery = {
    ...base,
    theta,
    n: base.n + 1,
    alpha,
    beta,
    lastSeen: a.at,
    misconceptions,
  };

  return { mastery, tierD: d };
}

/**
 * Seed a topic's mastery from a diagnostic result (Phase 3 consumer, PHASE_1 §7):
 * α = 1 + successes, β = 1 + failures, θ = thetaSeed ?? 0, n = successes+failures.
 * Preserves any prior misconception flags / review schedule.
 */
export function applyDiagnosticSeed(
  prev: TopicMastery | undefined,
  seed: { successes: number; failures: number; thetaSeed?: number; at?: string },
): TopicMastery {
  const { successes, failures, thetaSeed, at } = seed;
  return {
    theta: thetaSeed ?? 0,
    n: successes + failures,
    alpha: BETA_PRIOR_ALPHA + successes,
    beta: BETA_PRIOR_BETA + failures,
    lastSeen: at ?? prev?.lastSeen ?? new Date(0).toISOString(),
    reviewDue: prev?.reviewDue,
    reviewStep: prev?.reviewStep,
    misconceptions: prev?.misconceptions ?? {},
  };
}

/**
 * Additively persist the SM-2 spaced-review schedule on a topic — the pure fold
 * behind `ProgressContext.setReviewSchedule` (COORDINATION §2.1 `reviewDue` /
 * `reviewStep`). It writes ONLY the two schedule scalars; θ/n/α/β/misconceptions
 * are carried through untouched, and it never touches `LevelProgress.mastered`
 * (the unlock gate) or the migration. When a topic has no mastery yet (a review
 * can be scheduled from remediation climb-back before the first graded item in
 * that topic), a fresh Beta(1,1) entry is created so the schedule has a home.
 * Pure: the input `prev` is never mutated.
 */
export function applyReviewSchedule(
  prev: TopicMastery | undefined,
  reviewDue: string,
  reviewStep: number,
): TopicMastery {
  const base: TopicMastery = prev ?? {
    theta: 0,
    n: 0,
    alpha: BETA_PRIOR_ALPHA,
    beta: BETA_PRIOR_BETA,
    lastSeen: new Date(0).toISOString(),
    misconceptions: {},
  };
  return { ...base, reviewDue, reviewStep };
}

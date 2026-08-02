import type { TopicMastery } from "@/types/mastery";
import { BETA_PRIOR_ALPHA, BETA_PRIOR_BETA, MASTERY_BAR } from "./config";
import { betaMean, betaMeanCI } from "./beta";

/**
 * LOW-CONFIDENCE UNLOCK (Part B) — a diagnostic-seeded "unlocked, but held at low
 * confidence" topic state, distinct from confidently-EARNED mastery.
 *
 * ## Two bars, one Beta posterior
 * The mastery layer already has a STICKY earned-mastery bar: a topic is
 * "confidently mastered" when the Beta 95%-CI LOWER bound `ciLow ≥ MASTERY_BAR`
 * (0.8). Reaching it needs a lot of evidence (≈16+ clean successes), so it moves
 * slowly and one bad quiz barely dents it — exactly the earned-mastery stickiness
 * we must preserve.
 *
 * The UNLOCK bar is a POINT-ESTIMATE gate on the posterior MEAN
 * (`betaMean ≥ UNLOCK_MEAN_BAR`, 0.70). Because the diagnostic seeds a topic with
 * only a couple of pseudo-counts (α = 1 + successes, β = 1 + failures — see
 * `applyDiagnosticSeed`), a strong 2/2 diagnostic lands at α=3, β=1 ⇒ mean 0.75
 * (unlocked) with `ciLow ≈ 0.29` (NOT confidently mastered). The estimate has
 * LOW precision (α+β small), so it SWINGS a lot with new evidence: one failing
 * graded item folds to α=3, β=2 ⇒ mean 0.60, dropping BELOW the unlock bar and
 * RE-LOCKING the topic. Earned mastery (high α+β) stays above the bar after the
 * same single miss.
 *
 * This module is ADDITIVE: it reads the existing Beta pseudo-counts and never
 * mutates them, never touches `LevelProgress.mastered` (the per-level unlock
 * gate), scoring, or the migration. `isSkillMastered` (the confident bar) is
 * unchanged; unlock is a parallel, more-forgiving signal.
 */

/**
 * Point-estimate UNLOCK threshold on the Beta posterior mean. Deliberately BELOW
 * the confident-mastery `ciLow` bar (0.8) so a topic can be "unlocked but not yet
 * confidently mastered". A strong 2/2 diagnostic (mean 0.75) clears it; a single
 * subsequent miss (mean 0.60) falls back under it.
 */
export const UNLOCK_MEAN_BAR = 0.7;

/** Pseudo-count / precision α+β of a topic's Beta posterior (higher = stickier). */
export function unlockPrecision(m: TopicMastery | undefined): number {
  const alpha = m?.alpha ?? BETA_PRIOR_ALPHA;
  const beta = m?.beta ?? BETA_PRIOR_BETA;
  return alpha + beta;
}

/**
 * Is this topic UNLOCKED? True when there is at least one graded observation and
 * the Beta posterior mean clears {@link UNLOCK_MEAN_BAR}. A fresh topic (no
 * evidence) is NOT unlocked even though its prior mean is 0.5.
 */
export function isTopicUnlocked(m: TopicMastery | undefined): boolean {
  if (!m || m.n <= 0) return false;
  return betaMean(m.alpha, m.beta) >= UNLOCK_MEAN_BAR;
}

/** Is this topic confidently (STICKILY) mastered — the earned ciLow ≥ bar gate? */
export function isConfidentMastery(m: TopicMastery | undefined): boolean {
  if (!m) return false;
  const { lo } = betaMeanCI(m.alpha, m.beta);
  return lo >= MASTERY_BAR;
}

/**
 * A LOW-CONFIDENCE unlock: unlocked by the point-estimate bar but NOT yet
 * confidently mastered. This is the state a strong diagnostic seeds — the topic
 * is available to the learner, but its estimate is fragile and one failing quiz
 * swings it back below the unlock bar (see {@link relocksOnMiss}).
 */
export function isLowConfidenceUnlock(m: TopicMastery | undefined): boolean {
  return isTopicUnlocked(m) && !isConfidentMastery(m);
}

/**
 * Would ONE more failing graded item (a single 0-credit observation) drop this
 * topic below the unlock bar and RE-LOCK it? True only for a currently-unlocked,
 * low-precision estimate — the diagnostic-seeded case. Earned mastery (high
 * pseudo-counts) returns false: it is sticky. Pure; does not mutate `m`.
 */
export function relocksOnMiss(m: TopicMastery | undefined): boolean {
  if (!isTopicUnlocked(m)) return false;
  // A miss is a Beta observation of y=0 ⇒ β += 1 (see `betaUpdate`).
  const afterMiss = betaMean(m!.alpha, m!.beta + 1);
  return afterMiss < UNLOCK_MEAN_BAR;
}

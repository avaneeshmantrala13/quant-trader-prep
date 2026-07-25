import type { TopicMastery } from "@/types/mastery";
import {
  REVIEW_INTERVALS_DAYS,
  isNodeCleared,
  scheduleReview,
} from "@/lib/remediation/climbBack";

/**
 * SM-2 spaced-review helpers for the Phase-5 dashboard/adaptivity over the
 * Phase-1 `reviewStep`/`reviewDue` fields on `TopicMastery`.
 *
 * OWNERSHIP (PHASE_5 §5 / PHASE_4 §7): Phase 4's `src/lib/remediation/climbBack.ts`
 * is the SINGLE owner of the SM-2 fold (`scheduleReview`) and the interval ladder
 * (`REVIEW_INTERVALS_DAYS`, `[1,3,7,16,35]`, advance-on-pass / reset-on-lapse).
 * This module no longer re-implements them — it re-exports the canonical
 * `scheduleReview` and adds only the thin, pure accessors Phase 5 needs
 * (`reviewIntervalDays`, `isReviewDue`) plus `planRoundReview`, the integration
 * glue that maps a finished graded round to the next schedule (persisted via
 * `ProgressContext.setReviewSchedule`). All functions take an injected `now` ISO
 * timestamp so tests are clock-free (COORDINATION §3.7).
 */

/** Clamp a ladder index into `[0, REVIEW_INTERVALS_DAYS.length - 1]`. */
function clampStep(step: number): number {
  if (step < 0) return 0;
  const max = REVIEW_INTERVALS_DAYS.length - 1;
  return step > max ? max : step;
}

/** Interval (days) for a given 0-based ladder step. */
export function reviewIntervalDays(step: number): number {
  return REVIEW_INTERVALS_DAYS[clampStep(step)];
}

/** `now ≥ reviewDue` (absent schedule ⇒ never due). */
export function isReviewDue(
  reviewDue: string | undefined,
  now: string,
): boolean {
  if (!reviewDue) return false;
  return new Date(now).getTime() >= new Date(reviewDue).getTime();
}

/**
 * Plan the SM-2 schedule update for a topic after a graded round, using the
 * canonical `scheduleReview` (Phase 4). Returns the new `{reviewDue, reviewStep}`
 * to persist via `setReviewSchedule`, or `null` when nothing should change.
 *
 *  - CLEARED node (Bloom ~80% bar via `isNodeCleared`): treat as a PASS — schedule
 *    the current rung's interval and advance the ladder (first mastery ⇒ step 0).
 *  - Otherwise, if a review was already scheduled AND is DUE now, treat the round
 *    as a lapse — RESET to the shortest interval.
 *  - Otherwise (still learning, no schedule due): leave the schedule untouched.
 *
 * Pure + deterministic in the injected `now`.
 */
export function planRoundReview(
  mastery: TopicMastery | undefined,
  now: string,
): { reviewDue: string; reviewStep: number } | null {
  if (!mastery) return null;
  // CI-derived clearing (the recent-correct-at-target signal isn't tracked here,
  // so pass 0 and rely on the Beta credible-interval bar).
  if (isNodeCleared(mastery.alpha, mastery.beta, 0)) {
    const { reviewDue, step } = scheduleReview(now, mastery.reviewStep ?? 0, true);
    return { reviewDue, reviewStep: step };
  }
  if (mastery.reviewStep !== undefined && isReviewDue(mastery.reviewDue, now)) {
    const { reviewDue, step } = scheduleReview(now, mastery.reviewStep, false);
    return { reviewDue, reviewStep: step };
  }
  return null;
}

export { REVIEW_INTERVALS_DAYS, scheduleReview };

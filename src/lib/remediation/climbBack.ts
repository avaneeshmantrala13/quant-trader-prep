import { betaMeanCI } from "@/lib/mastery/beta";
import { CLEAR_BAR, CLEAR_CORRECT_AT_TARGET } from "./config";

/**
 * Success-ladder climb-back + SM-2 spaced-review scheduling (PHASE_4 §5, Bjork).
 *
 * Once a remediated node is CLEARED, re-serve the PARENT at its ~85%-predicted
 * tier — one edge at a time (KST learning-smoothness) — INTERLEAVED with the
 * repaired node (never massed) and SPACED via the SM-2 ladder. This module is
 * the single owner of SM-2 scheduling; Phase 5 imports {@link scheduleReview}
 * and {@link REVIEW_INTERVALS_DAYS} rather than re-implementing them (PHASE_4 §7).
 *
 * Research: Bjork (desirable difficulties — interleave + space); the SM-2 ladder
 * is the standard spacing schedule Phase-1's `TopicMastery.reviewStep` indexes.
 */

/** SM-2-style spacing ladder (days). Phase-1 `reviewStep` is a 0-based index here. */
export const REVIEW_INTERVALS_DAYS = [1, 3, 7, 16, 35];

const MS_PER_DAY = 86_400_000;

/**
 * Next `reviewDue` (ISO) + ladder `step` from the SM-2 ladder.
 *  - PASS  ⇒ schedule the interval at the current `step`, then ADVANCE the step
 *    (clamped to the last rung).
 *  - MISS  ⇒ RESET to step 0 and schedule the shortest interval.
 *
 * Deterministic in `now` (injected ISO timestamp) — no real clock.
 */
export function scheduleReview(
  now: string,
  step: number,
  passed: boolean,
): { reviewDue: string; step: number } {
  const last = REVIEW_INTERVALS_DAYS.length - 1;
  if (!passed) {
    return {
      reviewDue: addDays(now, REVIEW_INTERVALS_DAYS[0]),
      step: 0,
    };
  }
  const current = clamp(step, 0, last);
  return {
    reviewDue: addDays(now, REVIEW_INTERVALS_DAYS[current]),
    step: clamp(step + 1, 0, last),
  };
}

/**
 * A node is "cleared" (Bloom ~80% bar) when EITHER the Beta credible-interval
 * lower bound reaches {@link CLEAR_BAR} OR the learner has {@link
 * CLEAR_CORRECT_AT_TARGET} recent correct answers at the node's target tier.
 */
export function isNodeCleared(
  alpha: number,
  beta: number,
  recentCorrectAtTarget: number,
): boolean {
  if (recentCorrectAtTarget >= CLEAR_CORRECT_AT_TARGET) return true;
  return betaMeanCI(alpha, beta).lo >= CLEAR_BAR;
}

/**
 * Build the interleaved climb-back order for a cleared node and its parent
 * (Bjork: interleave, don't mass-drill). Returns an alternating sequence
 * [repaired, parent, repaired, parent, …] of length `2 * rungs` so the repaired
 * skill is revisited BETWEEN parent reps rather than blocked.
 */
export function climbBackSequence(
  repairedTopicKey: string,
  parentTopicKey: string,
  rungs = 2,
): string[] {
  const out: string[] = [];
  for (let i = 0; i < rungs; i++) {
    out.push(repairedTopicKey, parentTopicKey);
  }
  return out;
}

function addDays(nowIso: string, days: number): string {
  return new Date(new Date(nowIso).getTime() + days * MS_PER_DAY).toISOString();
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

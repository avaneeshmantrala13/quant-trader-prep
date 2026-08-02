/**
 * arena/speedStats.ts — TIME-TO-SOLVE tracking + speed targets for the interview
 * overlay (Case B speed focus).
 *
 * Accuracy alone doesn't get a candidate through an OA — they must be accurate
 * AT the firm's pace. So alongside the existing accuracy/score analytics, the
 * post-run report surfaces SPEED stats: the median solve time, the share of
 * questions answered within budget, and whether the learner beat the speed
 * target. These are the numbers a real screen implicitly grades.
 *
 * Pure + deterministic (takes the resolved `AnsweredItem[]` + a budget; no clock)
 * so it is fully unit-tested. It reuses the same `median` helper as the accuracy
 * analytics for consistency, and never touches scoring — Case A is unaffected.
 */
import { median } from "./analytics";
import type { AnsweredItem } from "./scoring";

/**
 * The speed TARGET is a fraction of the budget — clearing questions in ~80% of
 * the allotted time is the cushion that survives the hard ones. Tunable design
 * default (not a hard invariant).
 */
export const SPEED_TARGET_RATIO = 0.8;

/** The speed target (ms): answer within this to have comfortable margin. */
export function speedTargetMs(
  budgetMs: number,
  ratio: number = SPEED_TARGET_RATIO,
): number {
  return budgetMs * ratio;
}

export interface SpeedStats {
  /** Attempted (non-skipped) count these stats are computed over. */
  attempted: number;
  /** Median solve time over attempted items (ms). */
  medianSolveMs: number;
  /** Mean solve time over attempted items (ms). */
  meanSolveMs: number;
  /** Fastest attempted solve (ms); 0 when nothing attempted. */
  fastestMs: number;
  /** Per-question budget these were paced against (ms). */
  budgetMs: number;
  /** Attempted items answered within budget (rt ≤ budget). */
  withinBudget: number;
  /** withinBudget / attempted, in [0, 1] (0 when nothing attempted). */
  pctWithinBudget: number;
  /** Attempted items that were BOTH correct AND within budget. */
  correctWithinBudget: number;
  /** correctWithinBudget / attempted, in [0, 1]. */
  pctCorrectWithinBudget: number;
  /** Speed target (ms) the median is compared against. */
  targetMs: number;
  /** True ⇔ median solve time beats the speed target. */
  beatTarget: boolean;
}

/**
 * Compute speed stats for a finished run. Skipped items are excluded (they were
 * never "solved"), matching how the accuracy analytics treat attempts.
 */
export function speedStats(
  answered: AnsweredItem[],
  budgetMs: number,
  targetRatio: number = SPEED_TARGET_RATIO,
): SpeedStats {
  const attemptedItems = answered.filter((a) => !a.skipped);
  const rts = attemptedItems.map((a) => a.rtMs);
  const attempted = attemptedItems.length;
  const targetMs = speedTargetMs(budgetMs, targetRatio);

  const withinBudget = attemptedItems.filter((a) => a.rtMs <= budgetMs).length;
  const correctWithinBudget = attemptedItems.filter(
    (a) => a.correct && a.rtMs <= budgetMs,
  ).length;
  const medianSolveMs = median(rts);
  const meanSolveMs = attempted > 0 ? rts.reduce((s, x) => s + x, 0) / attempted : 0;

  return {
    attempted,
    medianSolveMs,
    meanSolveMs,
    fastestMs: attempted > 0 ? Math.min(...rts) : 0,
    budgetMs,
    withinBudget,
    pctWithinBudget: attempted > 0 ? withinBudget / attempted : 0,
    correctWithinBudget,
    pctCorrectWithinBudget: attempted > 0 ? correctWithinBudget / attempted : 0,
    targetMs,
    beatTarget: attempted > 0 && medianSolveMs <= targetMs,
  };
}

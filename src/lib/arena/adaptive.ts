/**
 * arena/adaptive.ts — OPTIONAL adaptive time pressure + "beat the clock" for the
 * interview overlay (Case B speed focus).
 *
 * The point of interview prep is to get FASTER without losing accuracy. So once
 * a learner's accuracy has STABILIZED at a high level, we tighten the
 * per-question budget a notch — always accurate-first, never speed-at-the-cost-
 * of-accuracy, and never below a research-grounded floor. And a "beat the clock"
 * progressive mode shrinks the budget every round so the learner deliberately
 * races a shrinking clock.
 *
 * Pure + deterministic (no clock, no state, no storage) so it is fully unit-
 * tested. The React/persistence layer decides WHEN to call these; the functions
 * themselves just compute the next budget. Nothing here affects scoring, so
 * Case A stays untouched.
 */
import { DEFAULT_SPRINT_BUDGET_MS } from "./config";

export interface AdaptiveConfig {
  /** Never tighten below this per-question budget (ms). */
  floorMs: number;
  /** Fraction to shrink the budget by on each tighten (0.1 ⇒ −10%). */
  tightenStep: number;
  /** Accuracy (0–1) at/above which tightening is allowed. */
  accuracyTarget: number;
  /** Minimum attempts before we trust the accuracy signal enough to tighten. */
  minSample: number;
}

/**
 * Defaults: floor at 3s/q (IMC's "<3 s/q edge" / Belvedere 2-digit <3s is the
 * fastest realistic human pace — FIRM_TIMED_ASSESSMENTS.md §2/part1), tighten
 * 10% per step, require ≥85% accuracy over ≥20 attempts before tightening.
 */
export const DEFAULT_ADAPTIVE: AdaptiveConfig = {
  floorMs: 3000,
  tightenStep: 0.1,
  accuracyTarget: 0.85,
  minSample: 20,
};

/**
 * True ⇔ accuracy has stabilized enough to justify tightening: enough attempts
 * AND accuracy at/above the target.
 */
export function shouldTighten(
  accuracy: number,
  sample: number,
  cfg: AdaptiveConfig = DEFAULT_ADAPTIVE,
): boolean {
  return sample >= cfg.minSample && accuracy >= cfg.accuracyTarget;
}

/**
 * The next per-question budget given the last run's accuracy + sample size:
 *  - if accuracy has stabilized high ⇒ shrink by `tightenStep`, clamped at the
 *    floor (the learner earned more pressure);
 *  - otherwise hold the current budget (accuracy-first: never tighten while the
 *    learner is still missing questions).
 * Never returns below `floorMs`, and never above the current budget.
 */
export function nextAdaptiveBudgetMs(
  currentMs: number,
  accuracy: number,
  sample: number,
  cfg: AdaptiveConfig = DEFAULT_ADAPTIVE,
): number {
  if (!shouldTighten(accuracy, sample, cfg)) return currentMs;
  const tightened = currentMs * (1 - cfg.tightenStep);
  return Math.max(cfg.floorMs, Math.round(tightened));
}

/**
 * "Beat the clock" progressive schedule: the per-question budget for `round`
 * (0-indexed), shrinking `tightenStep` each round from `baseMs`, clamped at the
 * floor. Round 0 = full base budget; each later round is tighter. Deterministic,
 * so a session can preview its whole ramp.
 */
export function beatTheClockBudgetMs(
  round: number,
  baseMs: number = DEFAULT_SPRINT_BUDGET_MS,
  cfg: AdaptiveConfig = DEFAULT_ADAPTIVE,
): number {
  const r = Math.max(0, Math.floor(round));
  const shrunk = baseMs * (1 - cfg.tightenStep) ** r;
  return Math.max(cfg.floorMs, Math.round(shrunk));
}

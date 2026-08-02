/**
 * arena/budget.ts — per-question / per-section TIME BUDGETS for the interview
 * pacing overlay (Case B speed focus).
 *
 * Real top-tier OAs give a candidate a FIXED, short budget per question (Optiver
 * 80-in-8 ⇒ 6 s/q; Flow 60-in-6 ⇒ 6 s/q; Maven 50-in-5 ⇒ 6 s/q — see
 * FIRM_TIMED_ASSESSMENTS.md §1). The Speed Arena already runs a fixed WINDOW;
 * this module turns that window into an explicit per-question budget so the
 * runner can show a live per-question countdown and pacing feedback, exactly
 * like sitting a real screen.
 *
 * Pure + framework-free (no clock, no state) so it is fully unit-tested. Nothing
 * here affects scoring — budgets drive pacing feedback + "% within budget" only,
 * so Case A (course mastery) is entirely untouched.
 */
import { DEFAULT_SPRINT_BUDGET_MS, type ArenaPreset } from "./config";

/**
 * The per-question time budget (ms) implied by a preset:
 *  - an explicit `preset.budgetMs` wins (adaptive tightening sets this);
 *  - else, with a question cap, it's `window / cap` (the true OA pace, e.g.
 *    480_000 / 80 = 6000ms for Optiver);
 *  - else (open window, no cap) it falls back to the sprint consensus budget.
 * Always ≥ 1ms so downstream ratios never divide by zero.
 */
export function perQuestionBudgetMs(preset: ArenaPreset): number {
  if (preset.budgetMs && preset.budgetMs > 0) {
    return Math.max(1, preset.budgetMs);
  }
  const windowMs = preset.durationSec * 1000;
  const cap = preset.questionCap && preset.questionCap > 0 ? preset.questionCap : 0;
  if (cap > 0) return Math.max(1, windowMs / cap);
  return DEFAULT_SPRINT_BUDGET_MS;
}

/** The whole-section budget (ms) = the run's fixed window. */
export function sectionBudgetMs(preset: ArenaPreset): number {
  return Math.max(0, preset.durationSec * 1000);
}

/** Live pacing bands for a single question against its budget. */
export type PaceBand = "ahead" | "on-pace" | "behind" | "over";

/**
 * Fraction of the per-question budget consumed so far, clamped to [0, 1] so it
 * can drive a countdown ring/bar. `elapsedMs ≥ budget` ⇒ 1.
 */
export function paceFraction(elapsedMs: number, budgetMs: number): number {
  if (budgetMs <= 0) return 1;
  const f = Math.max(0, elapsedMs) / budgetMs;
  return Math.min(1, f);
}

/**
 * Classify live progress on the CURRENT question:
 *  - `over`     once the budget is fully spent (elapsed ≥ budget),
 *  - `behind`   past the "warn" mark (default 75% of budget),
 *  - `on-pace`  past the comfortable mark (default 40%),
 *  - `ahead`    early in the budget.
 * The marks are tunable but default to a gentle 40/75 split so the color only
 * turns urgent when it should.
 */
export function paceBand(
  elapsedMs: number,
  budgetMs: number,
  opts: { onPaceAt?: number; behindAt?: number } = {},
): PaceBand {
  const onPaceAt = opts.onPaceAt ?? 0.4;
  const behindAt = opts.behindAt ?? 0.75;
  if (budgetMs <= 0) return "over";
  const f = elapsedMs / budgetMs;
  if (f >= 1) return "over";
  if (f >= behindAt) return "behind";
  if (f >= onPaceAt) return "on-pace";
  return "ahead";
}

/** A design-token color hint for each pace band (consumed by the runner UI). */
export const PACE_BAND_TOKEN: Record<PaceBand, string> = {
  ahead: "text-bull",
  "on-pace": "text-primary",
  behind: "text-gold",
  over: "text-bear",
};

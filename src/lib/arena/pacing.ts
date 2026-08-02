/**
 * arena/pacing.ts — the PURE live-pacing state for the interview overlay.
 *
 * The React runner owns the wall clock; every 100ms it feeds the elapsed time
 * on the CURRENT question (and the run so far) into these pure functions to get
 * a fully-derived pacing snapshot: how much of the per-question budget is spent,
 * which pace band it's in, and whether — at the current rate — the learner is on
 * track to clear the whole section in the window. No clock and no randomness
 * here, so it is deterministic and unit-tested; the component is a thin view.
 *
 * Nothing here changes scoring or progression — it only drives feedback, so the
 * course-mastery (Case A) surfaces are untouched.
 */
import { paceBand, paceFraction, type PaceBand } from "./budget";

/** Live pacing snapshot for the question currently on screen. */
export interface QuestionPaceState {
  /** Per-question budget (ms) this question is being paced against. */
  budgetMs: number;
  /** Time spent on this question so far (ms). */
  elapsedMs: number;
  /** Budget remaining (ms), clamped at 0. */
  remainingMs: number;
  /** Fraction of budget consumed, clamped to [0, 1] (for a ring/bar). */
  fraction: number;
  band: PaceBand;
  /** True once the per-question budget is fully spent. */
  overBudget: boolean;
}

/** Derive the live per-question pacing snapshot. */
export function questionPace(
  elapsedMs: number,
  budgetMs: number,
): QuestionPaceState {
  const spent = Math.max(0, elapsedMs);
  const remainingMs = Math.max(0, budgetMs - spent);
  return {
    budgetMs,
    elapsedMs: spent,
    remainingMs,
    fraction: paceFraction(spent, budgetMs),
    band: paceBand(spent, budgetMs),
    overBudget: budgetMs > 0 && spent >= budgetMs,
  };
}

/** Section-level projection: are you on track to clear every question in time? */
export interface SectionPaceState {
  /** Questions resolved so far. */
  answered: number;
  /** Total questions the section will present. */
  total: number;
  /** Section time remaining (ms). */
  remainingMs: number;
  /** Average ms per question so far (0 before the first answer). */
  msPerQuestion: number;
  /** How many MORE questions the current pace projects within the remaining time. */
  projectedRemaining: number;
  /** Projected total = answered + projectedRemaining. */
  projectedTotal: number;
  /** True ⇔ the current pace clears all `total` questions before time runs out. */
  onTrack: boolean;
}

/**
 * Project section completion from the run so far. `elapsedMs` is total time
 * spent, `answered` the count resolved, `total` the section size, `remainingMs`
 * the section clock left. Pure — the runner passes live values.
 */
export function sectionPace(params: {
  answered: number;
  total: number;
  elapsedMs: number;
  remainingMs: number;
}): SectionPaceState {
  const { answered, total, elapsedMs, remainingMs } = params;
  const msPerQuestion = answered > 0 ? elapsedMs / answered : 0;
  const projectedRemaining =
    msPerQuestion > 0 ? Math.floor(Math.max(0, remainingMs) / msPerQuestion) : total - answered;
  const projectedTotal = answered + projectedRemaining;
  return {
    answered,
    total,
    remainingMs: Math.max(0, remainingMs),
    msPerQuestion,
    projectedRemaining,
    projectedTotal,
    onTrack: projectedTotal >= total,
  };
}

/**
 * arena/scoring.ts — pure scoring for the Speed Arena (Phase 6).
 *
 *  - Zetamac: fixed window, NO penalty ⇒ `score = #correct` (skips ignored).
 *  - Optiver: +1 correct / −1 wrong, "skips free" toggle (skip scores 0 when
 *    free, −1 when strict). This mirrors Optiver's real "80-in-8" screen where
 *    guessing is punished, so skipping a low-confidence question preserves EV.
 *
 * Both take the SAME `AnsweredItem[]` so a single run can be re-scored under
 * either rule (the leaderboard Lambda re-scores from the same shape).
 */
import type { ArenaPreset } from "./config";

export interface AnsweredItem {
  id: string;
  correct: boolean;
  skipped: boolean;
  rtMs: number;
  op: string;
}

/** Zetamac: number of correct (non-skipped) answers. No penalty. */
export function zetamacScore(items: AnsweredItem[]): number {
  let n = 0;
  for (const it of items) if (!it.skipped && it.correct) n++;
  return n;
}

/**
 * Optiver: +1 per correct, −1 per wrong. A skip scores 0 when `skipsFree`,
 * else −1 (strict, penalized skip). The score may go negative.
 */
export function optiverScore(items: AnsweredItem[], skipsFree: boolean): number {
  let s = 0;
  for (const it of items) {
    if (it.skipped) {
      if (!skipsFree) s -= 1;
      continue;
    }
    s += it.correct ? 1 : -1;
  }
  return s;
}

/**
 * Score a run under whichever rule its preset implies: `penalty` ⇒ Optiver
 * +1/−1 (honoring `skipsFree`); otherwise Zetamac count. This is the single
 * entry point the report + the server re-score both use.
 */
export function scoreRun(items: AnsweredItem[], preset: ArenaPreset): number {
  return preset.penalty
    ? optiverScore(items, preset.skipsFree)
    : zetamacScore(items);
}

/**
 * srs/schedule.ts — a pure, deterministic spaced-repetition scheduler (TASK T14,
 * retention). An SM-2 variant with NO randomness: given a card's state and a
 * recall grade, `reviewCard` returns the next state (new ease, interval, due
 * time). Fully unit-testable and framework-free; any surface can persist a
 * `SrsCard` and call these helpers to schedule reviews.
 *
 * Grades follow the SM-2 convention:
 *   0–2 = failed recall (lapse → interval resets), 3–5 = successful recall.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Ease never drops below this floor (SM-2). */
export const MIN_EASE = 1.3;
/** A brand-new card's starting ease factor. */
export const INITIAL_EASE = 2.5;
/** Interval (days) after the 1st and 2nd successful reviews. */
export const FIRST_INTERVAL_DAYS = 1;
export const SECOND_INTERVAL_DAYS = 6;

/** A recall grade: 0 (blackout) … 5 (perfect). 0–2 are lapses. */
export type SrsGrade = 0 | 1 | 2 | 3 | 4 | 5;

/** The persisted scheduling state for one reviewable item. */
export interface SrsCard {
  /** SM-2 ease factor (≥ MIN_EASE). */
  ease: number;
  /** Current inter-review interval in days. */
  intervalDays: number;
  /** Count of consecutive successful reviews (resets to 0 on a lapse). */
  reps: number;
  /** Epoch ms when the card next becomes due. */
  dueAtMs: number;
  /** Total number of times the card has lapsed. */
  lapses: number;
}

/** A fresh card, due immediately at `nowMs`. */
export function newCard(nowMs: number): SrsCard {
  return {
    ease: INITIAL_EASE,
    intervalDays: 0,
    reps: 0,
    dueAtMs: nowMs,
    lapses: 0,
  };
}

/**
 * The SM-2 ease update for a successful review. Clamped at MIN_EASE. Higher
 * grades raise ease; a barely-passing grade of 3 lowers it slightly.
 */
export function nextEase(ease: number, grade: SrsGrade): number {
  const delta = 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02);
  return Math.max(MIN_EASE, ease + delta);
}

/**
 * Apply a recall `grade` to `card` at `nowMs`, returning the NEXT card state.
 * Pure and deterministic — same inputs always yield the same output.
 */
export function reviewCard(card: SrsCard, grade: SrsGrade, nowMs: number): SrsCard {
  const passed = grade >= 3;

  if (!passed) {
    // Lapse: keep some ease penalty, reset reps + interval, re-show tomorrow.
    const ease = Math.max(MIN_EASE, card.ease - 0.2);
    return {
      ease,
      intervalDays: FIRST_INTERVAL_DAYS,
      reps: 0,
      dueAtMs: nowMs + FIRST_INTERVAL_DAYS * MS_PER_DAY,
      lapses: card.lapses + 1,
    };
  }

  const ease = nextEase(card.ease, grade);
  const reps = card.reps + 1;
  let intervalDays: number;
  if (reps === 1) intervalDays = FIRST_INTERVAL_DAYS;
  else if (reps === 2) intervalDays = SECOND_INTERVAL_DAYS;
  else intervalDays = Math.round(card.intervalDays * ease);

  return {
    ease,
    intervalDays,
    reps,
    dueAtMs: nowMs + intervalDays * MS_PER_DAY,
    lapses: card.lapses,
  };
}

/** Whether the card is due for review at `nowMs`. */
export function isDue(card: SrsCard, nowMs: number): boolean {
  return card.dueAtMs <= nowMs;
}

/**
 * All due cards from a keyed map, sorted most-overdue first (stable by key on
 * ties) — the review queue.
 */
export function dueQueue<K extends string>(
  cards: Record<K, SrsCard>,
  nowMs: number,
): K[] {
  return (Object.keys(cards) as K[])
    .filter((k) => isDue(cards[k], nowMs))
    .sort((a, b) => {
      const d = cards[a].dueAtMs - cards[b].dueAtMs;
      return d !== 0 ? d : a < b ? -1 : a > b ? 1 : 0;
    });
}

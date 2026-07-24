/**
 * PER-SECTION level progression / unlock logic — the single source of truth for
 * how the progression map (`TrackPage`), the Table of Contents (`/contents`),
 * and the level-play deep-link guards (`LessonPage`) decide whether a level is
 * locked.
 *
 * ## The rule
 * A track lays its levels out as one ordered Candy-Crush path, but a single
 * track can bundle several distinct TOPICS/sections (e.g. the Probability / Math
 * track: Core Probability, Betting & Sizing, Game Theory & Puzzles, Expected
 * Value, Conditional Probability, Markov Chains, General). Locking is therefore
 * PER-SECTION, not per-track:
 *
 *   A level is UNLOCKED  ⇔  it is the FIRST level of its section
 *                           OR the previous level *within the same section* is
 *                           mastered.
 *
 * So the first level of every topic is always playable immediately (you can
 * practice any topic without grinding earlier topics), while the harder levels
 * of a topic stay gated behind mastering that topic's earlier levels.
 *
 * ## Sections & the unlabeled fallback
 * A "section" is a maximal contiguous run of levels sharing the same `section`
 * value. A boundary is ANY change in `section` between adjacent levels. Levels
 * with no `section` (`undefined`) form their own contiguous topic(s): tracks
 * that don't use sections at all (Mental Math, Brainteasers, Interview Games)
 * collapse to a single topic, so they keep the original strictly-sequential
 * behavior with only their first level unlocked. This mirrors the visual
 * `startsSection` divider rule, except it also treats unlabeled runs as topics
 * (dividers are only drawn for labeled sections).
 *
 * ## Mastery signal
 * "Mastered" is read from `LevelProgress.mastered` (see `progressOps.ts` /
 * `ProgressContext.recordAttempt` + `completeFlashcardLevelInPlace`), the same
 * sticky flag the rest of the app already uses for a completed level.
 */

/** Node state used by the map and Table of Contents. */
export type LockState = "locked" | "unlocked" | "mastered";

/**
 * Minimal shape needed to compute locking: the ordered level id plus its
 * optional `section`. `Level` (and the ToC's lesson item) satisfy this.
 */
export interface LockLevel {
  id: string;
  section?: string;
}

/**
 * True when the level at index `i` begins a new section — i.e. it is the FIRST
 * level of a maximal contiguous run of levels sharing the same `section` value.
 * Index 0 always starts a section. Unlike the visual `startsSection` divider,
 * this also returns true when an unlabeled (`undefined`) run begins, so each
 * unlabeled run is treated as its own topic for gating purposes.
 */
export function isFirstOfSection(
  levels: readonly LockLevel[],
  i: number,
): boolean {
  if (i <= 0) return true;
  return levels[i].section !== levels[i - 1].section;
}

/**
 * Whether the level at `index` is unlocked under the per-section rule:
 * unlocked ⇔ it is the first level of its section OR the previous level (which,
 * for a non-section-start, is guaranteed to be in the SAME section) is
 * mastered.
 */
export function isLevelUnlockedBySection(
  levels: readonly LockLevel[],
  index: number,
  isMastered: (levelId: string) => boolean,
): boolean {
  if (index <= 0) return true;
  if (isFirstOfSection(levels, index)) return true;
  // Not a section start ⇒ levels[index - 1] shares this level's section.
  return isMastered(levels[index - 1].id);
}

/**
 * The full node state for the level at `index`: `"mastered"` if it is itself
 * mastered, otherwise `"unlocked"` / `"locked"` per {@link isLevelUnlockedBySection}.
 */
export function levelLockState(
  levels: readonly LockLevel[],
  index: number,
  isMastered: (levelId: string) => boolean,
): LockState {
  if (isMastered(levels[index].id)) return "mastered";
  return isLevelUnlockedBySection(levels, index, isMastered)
    ? "unlocked"
    : "locked";
}

/** Batch helper: the {@link LockState} for every level, in order. */
export function computeLockStates(
  levels: readonly LockLevel[],
  isMastered: (levelId: string) => boolean,
): LockState[] {
  return levels.map((_, i) => levelLockState(levels, i, isMastered));
}

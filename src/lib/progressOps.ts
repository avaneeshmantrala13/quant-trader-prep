import type { LevelProgress, UserProgress } from "@/types/progress";

/**
 * Pure progress mutations, extracted so both the React context and unit tests
 * share ONE source of truth for mastery/streak/flashcard logic. Every function
 * here mutates the `UserProgress` it is given IN PLACE and (where useful)
 * returns a small result — callers pass a fresh clone (the context's `update`
 * already hands us a `structuredClone`).
 */

/** XP awarded the first time a flashcard level is mastered. */
export const FLASHCARD_MASTERY_XP = 150;

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.round(ms / 86_400_000);
}

/** Advance the daily streak counter (shared by quiz + flashcard completion). */
export function bumpStreakInPlace(p: UserProgress): void {
  const today = todayStr();
  if (p.lastActiveDate !== today) {
    const gap = daysBetween(p.lastActiveDate, today);
    p.streak = gap === 1 ? p.streak + 1 : 1;
    p.lastActiveDate = today;
  } else if (p.streak === 0) {
    p.streak = 1;
  }
}

function ensureLevel(p: UserProgress, levelId: string): LevelProgress {
  const existing = p.levelProgress[levelId];
  if (existing) return existing;
  const created: LevelProgress = { bestScore: 0, mastered: false, attempts: 0 };
  p.levelProgress[levelId] = created;
  return created;
}

/** The set of problem ids the learner has marked "Got it" for a level. */
export function getUnderstood(p: UserProgress, levelId: string): string[] {
  return p.levelProgress[levelId]?.understood ?? [];
}

/**
 * A flashcard level is complete once EVERY problem in its pool has been marked
 * "Got it". (An empty pool is never auto-complete.)
 */
export function isFlashcardLevelComplete(
  understood: Iterable<string>,
  poolIds: string[],
): boolean {
  if (poolIds.length === 0) return false;
  const set = new Set(understood);
  return poolIds.every((id) => set.has(id));
}

/** Record that a specific flashcard problem has been marked "Got it". */
export function markUnderstoodInPlace(
  p: UserProgress,
  levelId: string,
  problemId: string,
): void {
  const lvl = ensureLevel(p, levelId);
  const set = new Set(lvl.understood ?? []);
  set.add(problemId);
  lvl.understood = [...set];
}

/**
 * Master/complete a flashcard level. Used by BOTH completion paths (all cards
 * marked "Got it", and the explicit "I understand this topic — advance"
 * button). Mirrors the quiz path's mastery side effects: sticky `mastered`,
 * XP + streak bump, and resume cleared — so the existing unlock/map-station
 * system treats it identically to finishing a quiz level.
 */
export function completeFlashcardLevelInPlace(
  p: UserProgress,
  levelId: string,
): { isNewMastery: boolean; xpGained: number } {
  const existing = p.levelProgress[levelId];
  const isNewMastery = !existing?.mastered;
  const xpGained = isNewMastery ? FLASHCARD_MASTERY_XP : 0;

  p.levelProgress[levelId] = {
    bestScore: Math.max(existing?.bestScore ?? 0, 1),
    mastered: true,
    attempts: (existing?.attempts ?? 0) + 1,
    completedAt: new Date().toISOString(),
    understood: existing?.understood,
  };
  delete p.resume[levelId];
  p.xp += xpGained;
  bumpStreakInPlace(p);

  return { isNewMastery, xpGained };
}

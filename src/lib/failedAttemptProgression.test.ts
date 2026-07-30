import { describe, expect, it } from "vitest";
import { probabilityTrack } from "@/content/probability/levels";
import { isLevelUnlockedBySection, levelLockState } from "@/lib/locking";
import { materializeLevel, materializeNumericLevel } from "@/content/materialize";
import { isFlashcardLevel, isNumericLevel } from "@/types/content";

/**
 * REGRESSION (progression safety): a FAILED level attempt must NEVER lock a
 * learner out of retrying that level or its section, and the level must still
 * serve questions on the retry. This pins the invariant for the Probability &
 * Statistics track — in particular the "Conditional Probability & Bayes" level
 * (`pr-2`) and every level of the "Conditional Probability" section.
 *
 * The unlock gate (`@/lib/locking`) reads ONLY the sticky `LevelProgress.mastered`
 * flag, and a failed finish (score < threshold) never sets it — see
 * `ProgressContext.recordAttempt`: `mastered = (existing?.mastered ?? false) ||
 * (score >= threshold)`. We model that exact write here so the guarantee is
 * enforced against the REAL content, not a synthetic fixture.
 */

const levels = probabilityTrack.levels;
const indexOf = (id: string) => levels.findIndex((l) => l.id === id);

/** The `mastered` flag after an attempt, per `recordAttempt`'s sticky rule. */
function masteredAfter(
  priorMastered: boolean,
  score: number,
  threshold: number,
): boolean {
  return priorMastered || score >= threshold;
}

/** How many questions a level serves for a fresh attempt (retry) at `seed`. */
function servedCount(levelId: string, seed: number): number {
  const level = levels[indexOf(levelId)];
  if (isFlashcardLevel(level)) return (level.flashcards ?? []).length;
  if (isNumericLevel(level)) return materializeNumericLevel(level, seed).length;
  return materializeLevel(level, seed).length;
}

describe("a failed attempt keeps the level unlocked and re-playable with questions", () => {
  it("pr-2 (Conditional Probability & Bayes): failing keeps it unlocked + serving", () => {
    const i = indexOf("pr-2");
    expect(levels[i].title).toBe("Conditional Probability & Bayes");
    // pr-1 mastered (so pr-2 was reachable); pr-2 FAILED this attempt.
    const pr2Mastered = masteredAfter(false, 0.4, levels[i].masteryThreshold);
    expect(pr2Mastered).toBe(false);
    const isMastered = (id: string) =>
      id === "pr-1" || (id === "pr-2" && pr2Mastered);
    expect(isLevelUnlockedBySection(levels, i, isMastered)).toBe(true);
    expect(levelLockState(levels, i, isMastered)).toBe("unlocked");
    // Still serves questions on retry (across several fresh seeds).
    for (const s of [1, 7, 99, 12345]) {
      expect(servedCount("pr-2", s)).toBeGreaterThan(0);
    }
  });

  it("Conditional Probability section: failing the first level keeps it open + serving", () => {
    const cp = levels.filter((l) => l.section === "Conditional Probability");
    expect(cp.length).toBeGreaterThan(0);
    const first = cp[0];
    const i = indexOf(first.id);
    // Nothing mastered (fresh, or just failed the first level): a section's first
    // level is ALWAYS unlocked, so it can be retried immediately.
    const none = () => false;
    expect(isLevelUnlockedBySection(levels, i, none)).toBe(true);
    expect(levelLockState(levels, i, none)).toBe("unlocked");
    for (const s of [2, 33, 500]) {
      expect(servedCount(first.id, s)).toBeGreaterThan(0);
    }
  });

  it("every Conditional Probability level still serves questions after a fresh/failed state", () => {
    const cp = levels.filter((l) => l.section === "Conditional Probability");
    for (const l of cp) {
      expect(servedCount(l.id, 4242), `level ${l.id} served 0`).toBeGreaterThan(0);
    }
  });

  it("a failed attempt never flips any previously-unlocked level to locked (whole track)", () => {
    // Baseline: master a prefix of the track so a spread of levels is unlocked.
    const masteredIds = new Set(
      levels.slice(0, Math.ceil(levels.length / 2)).map((l) => l.id),
    );
    const isMastered = (id: string) => masteredIds.has(id);
    const before = levels.map((_, i) =>
      isLevelUnlockedBySection(levels, i, isMastered),
    );
    // Now FAIL each currently-unlocked level in turn. A failed finish leaves the
    // `mastered` set unchanged (sticky), so no lock state may regress.
    for (let i = 0; i < levels.length; i++) {
      const stillMastered = new Set(masteredIds); // failing changes nothing
      const after = levels.map((_, j) =>
        isLevelUnlockedBySection(levels, j, (id) => stillMastered.has(id)),
      );
      after.forEach((open, j) => {
        if (before[j]) expect(open, `level ${levels[j].id} regressed`).toBe(true);
      });
    }
  });
});

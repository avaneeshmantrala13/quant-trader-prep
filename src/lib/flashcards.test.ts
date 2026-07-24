import { describe, expect, it } from "vitest";
import {
  completeFlashcardLevelInPlace,
  FLASHCARD_MASTERY_XP,
  getUnderstood,
  isFlashcardLevelComplete,
  markUnderstoodInPlace,
} from "./progressOps";
import { brainteasersTrack } from "@/content/brainteasers/levels";
import { emptyProgress } from "@/types/progress";

const btLevel = brainteasersTrack.levels[0]; // bt-1
const poolIds = (btLevel.flashcards ?? []).map((c) => c.id);

describe("flashcard completion logic", () => {
  it("(a) marking ALL pool problems 'Got it' completes/masters the level", () => {
    const p = emptyProgress();

    // Mark all but the last — not complete yet, not mastered.
    for (const id of poolIds.slice(0, -1)) {
      markUnderstoodInPlace(p, btLevel.id, id);
      expect(isFlashcardLevelComplete(getUnderstood(p, btLevel.id), poolIds)).toBe(
        false,
      );
    }
    expect(p.levelProgress[btLevel.id]?.mastered ?? false).toBe(false);

    // Mark the final one → pool is now fully understood.
    markUnderstoodInPlace(p, btLevel.id, poolIds[poolIds.length - 1]);
    expect(isFlashcardLevelComplete(getUnderstood(p, btLevel.id), poolIds)).toBe(
      true,
    );

    // The player calls complete() at that point, which masters the level.
    const r = completeFlashcardLevelInPlace(p, btLevel.id);
    expect(r.isNewMastery).toBe(true);
    expect(r.xpGained).toBe(FLASHCARD_MASTERY_XP);
    expect(p.levelProgress[btLevel.id].mastered).toBe(true);
    expect(p.levelProgress[btLevel.id].bestScore).toBe(1);
    expect(p.levelProgress[btLevel.id].completedAt).toBeTruthy();
  });

  it("(b) the manual 'I understand this topic' path completes it without all cards", () => {
    const p = emptyProgress();

    // Only one card marked, pool NOT complete...
    markUnderstoodInPlace(p, btLevel.id, poolIds[0]);
    expect(isFlashcardLevelComplete(getUnderstood(p, btLevel.id), poolIds)).toBe(
      false,
    );

    // ...but the explicit declaration masters the level immediately.
    const r = completeFlashcardLevelInPlace(p, btLevel.id);
    expect(r.isNewMastery).toBe(true);
    expect(p.levelProgress[btLevel.id].mastered).toBe(true);

    // Re-completing an already-mastered level is idempotent (sticky, no new XP).
    const again = completeFlashcardLevelInPlace(p, btLevel.id);
    expect(again.isNewMastery).toBe(false);
    expect(again.xpGained).toBe(0);
    expect(p.levelProgress[btLevel.id].mastered).toBe(true);
  });

  it("(c) the understood set round-trips through save/resume (JSON persistence)", () => {
    const p = emptyProgress();
    markUnderstoodInPlace(p, btLevel.id, poolIds[0]);
    markUnderstoodInPlace(p, btLevel.id, poolIds[1]);
    // Marking the same id twice must not duplicate it.
    markUnderstoodInPlace(p, btLevel.id, poolIds[0]);

    // Simulate the localStorage save → reload cycle.
    const reloaded = JSON.parse(JSON.stringify(p));

    const understood = getUnderstood(reloaded, btLevel.id);
    expect(new Set(understood)).toEqual(new Set([poolIds[0], poolIds[1]]));
    expect(understood.length).toBe(2);
    expect(isFlashcardLevelComplete(understood, poolIds)).toBe(false);
  });

  it("isFlashcardLevelComplete treats an empty pool as never complete", () => {
    expect(isFlashcardLevelComplete([], [])).toBe(false);
  });
});

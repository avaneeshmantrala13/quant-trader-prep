import { describe, expect, it } from "vitest";
import { PLAYABLE_TRACKS } from "./index";
import { materializeLevel } from "./materialize";
import { isFlashcardLevel, isNumericLevel } from "@/types/content";
import {
  DIAGNOSTIC_BLUEPRINT,
  COURSE_DIAGNOSTIC_BLUEPRINT,
} from "./diagnostic/blueprint";
import { drawSlotItems } from "./diagnostic/items";

/**
 * GLOBAL CONTENT GUARANTEE: every CHOICE-BASED (multiple-choice) question a
 * learner can ever see — whether a practice quiz item or a diagnostic probe —
 * must offer AT LEAST 4 options. Fewer than 4 choices makes an item too
 * guessable (and, for probability items, near-trivially eliminable). Numeric
 * free-entry and integrity flashcards are exempt: they have no options.
 *
 * This exercises the two live surfaces:
 *  1. Practice: every quiz-mode level, materialized across many seeds.
 *  2. Diagnostic: every blueprint slot (interview + course), which surfaces
 *     numeric levels as MCQ by turning their authored `commonErrors` into
 *     distractors (`diagnostic/items.ts` → `numericToMcq`).
 */

const SEEDS = Array.from({ length: 150 }, (_, i) => i * 131 + 3);
const MIN_CHOICES = 4;

describe("every practice MCQ offers at least 4 options", () => {
  for (const track of PLAYABLE_TRACKS) {
    for (const level of track.levels) {
      if (isFlashcardLevel(level) || isNumericLevel(level)) continue;
      it(`${track.id}/${level.id}`, () => {
        for (const seed of SEEDS) {
          for (const q of materializeLevel(level, seed)) {
            expect(
              q.choices.length,
              `${track.id}/${level.id} item ${q.id} had ${q.choices.length} choices`,
            ).toBeGreaterThanOrEqual(MIN_CHOICES);
            // A padded placeholder would technically satisfy the count but is a
            // giveaway; the defensive pad must never actually fire in practice.
            for (const c of q.choices) {
              expect(c.includes("·alt")).toBe(false);
            }
            expect(new Set(q.choices).size).toBe(q.choices.length);
          }
        }
      });
    }
  }
});

describe("every diagnostic probe offers at least 4 options", () => {
  const blueprints = {
    interview: DIAGNOSTIC_BLUEPRINT,
    course: COURSE_DIAGNOSTIC_BLUEPRINT,
  } as const;
  for (const [mode, blueprint] of Object.entries(blueprints)) {
    for (const slot of blueprint) {
      it(`${mode}: ${slot.trackId}/${slot.levelId}`, () => {
        for (const seed of SEEDS) {
          for (const q of drawSlotItems(slot, seed)) {
            expect(
              q.choices.length,
              `${mode} ${slot.levelId} item ${q.id} had ${q.choices.length} choices`,
            ).toBeGreaterThanOrEqual(MIN_CHOICES);
            expect(new Set(q.choices).size).toBe(q.choices.length);
          }
        }
      });
    }
  }
});

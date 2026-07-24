import { describe, expect, it } from "vitest";
import { conditionalGeneralFlashcards } from "./generalFlashcards";

/**
 * Re-homed from the former `general/general.test.ts`: the stopping-rule
 * invariant (GN65 "All-Boys City") — a non-scalar reasoning special whose
 * answer is that a self-selected stopping time cannot bias the sex ratio.
 */
describe("re-homed reasoning flashcard (stopping-rule invariant)", () => {
  it("stopping-rule special concludes the boy fraction stays 50%", () => {
    const fc = conditionalGeneralFlashcards.find((c) => c.id === "gen-fc-stoppingrule")!;
    expect(fc).toBeTruthy();
    expect(/50%|½|half/i.test(fc.answer)).toBe(true);
    expect(fc.explanation.trim().length).toBeGreaterThan(40);
  });
});

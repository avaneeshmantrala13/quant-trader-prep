import { describe, expect, it } from "vitest";
import type { TopicVerdict } from "@/lib/mastery/verdict";
import {
  NO_MASTERY_STAGE2_ITEMS,
  NO_MASTERY_STAGE3_ITEMS,
  assessNoMasteryGuidance,
} from "./noMastery";

/** Minimal TopicVerdict factory (only the fields the guidance reads). */
function v(
  partial: Partial<TopicVerdict> & { topicKey: string },
): TopicVerdict {
  return {
    state: "WEAK",
    mean: 0.4,
    lo: 0.2,
    hi: 0.6,
    n: 0,
    theta: 0,
    namedMisconceptions: [],
    mastered: false,
    ...partial,
  };
}

describe("assessNoMasteryGuidance", () => {
  it("does NOT trigger when any topic is mastered", () => {
    const g = assessNoMasteryGuidance({
      verdicts: [
        v({ topicKey: "a", n: 20, mean: 0.4 }),
        v({ topicKey: "b", n: 30, mean: 0.9, mastered: true }),
      ],
      justFailed: true,
    });
    expect(g.triggered).toBe(false);
    expect(g.stage).toBe(0);
  });

  it("does NOT trigger when the strongest evidenced topic clears the unlock bar", () => {
    const g = assessNoMasteryGuidance({
      verdicts: [v({ topicKey: "a", n: 10, mean: 0.75 })], // ≥ 0.7 unlock bar
      justFailed: true,
    });
    expect(g.triggered).toBe(false);
  });

  it("triggers stage 1 for a fresh no-mastery learner who just failed (little evidence)", () => {
    const g = assessNoMasteryGuidance({
      verdicts: [v({ topicKey: "a", n: 5, mean: 0.35 })],
      justFailed: true,
    });
    expect(g.triggered).toBe(true);
    expect(g.stage).toBe(1);
    // Stage 1 points at Mental Probability.
    expect(g.actions.some((a) => a.href === "/track/mental-math")).toBe(true);
  });

  it("escalates to stage 2 (Simulations) once enough no-mastery evidence accrues", () => {
    const g = assessNoMasteryGuidance({
      verdicts: [
        v({ topicKey: "a", n: NO_MASTERY_STAGE2_ITEMS, mean: 0.3 }),
      ],
      justFailed: true,
    });
    expect(g.stage).toBe(2);
    expect(g.actions.some((a) => a.href === "/simulations")).toBe(true);
  });

  it("escalates to stage 3 (textbook / high-school math) under persistent failure", () => {
    const g = assessNoMasteryGuidance({
      verdicts: [
        v({ topicKey: "a", n: NO_MASTERY_STAGE3_ITEMS, mean: 0.3 }),
      ],
    });
    expect(g.stage).toBe(3);
    expect(g.body.toLowerCase()).toContain("textbook");
    expect(g.body.toLowerCase()).toMatch(/high-school|calculus|statistics/);
  });

  it("on the dashboard (no justFailed) fires only once graded evidence exists", () => {
    // No evidence at all ⇒ silent (never nags a brand-new user).
    expect(
      assessNoMasteryGuidance({ verdicts: [v({ topicKey: "a", n: 0 })] }).triggered,
    ).toBe(false);
    // With evidence and no mastery ⇒ triggers even without justFailed.
    expect(
      assessNoMasteryGuidance({ verdicts: [v({ topicKey: "a", n: 6, mean: 0.3 })] })
        .triggered,
    ).toBe(true);
  });
});

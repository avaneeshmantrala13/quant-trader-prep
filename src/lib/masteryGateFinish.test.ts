import { describe, expect, it } from "vitest";
import {
  creditForRung,
  creditRoundScore,
  meetsMasteryGate,
} from "./score";
import { isLevelUnlockedBySection } from "./locking";
import { topicKeyOf } from "./mastery/topicKey";
import { MISCONCEPTION } from "./tutor/misconception";
import {
  suggestPrereqsToStrengthen,
  type PrereqMasterySnapshot,
} from "./remediation/suggestPrereqs";

/**
 * SETTLEMENT-GATE REGRESSION (end-to-end at the logic level).
 *
 * Reproduces the lesson-finish decision WITHOUT React so we can pin the whole
 * chain the settlement bug broke:
 *   1. `mastered` gates on the CREDIT-WEIGHTED mastery (meetsMasteryGate), NOT the
 *      raw correct/total — so a 4/5 round answered only after deep hints (~22%
 *      credit) reads NOT mastered.
 *   2. A NOT-mastered finish leaves the next same-section level LOCKED (no false
 *      "next node unlocked"), while a mastered finish unlocks it.
 *   3. A NOT-mastered finish FIRES the failed-topic ZPD prerequisite suggestion
 *      (LevelFinishGuidance shows it exactly when `!mastered`); a mastered finish
 *      shows none.
 */

const MARKOV = topicKeyOf("probability", "Markov Chains");
const EXPECTED_VALUE = topicKeyOf("probability", "Expected Value");
const CONDITIONAL = topicKeyOf("probability", "Conditional Probability");
const L1 = topicKeyOf("probability", "Core Probability");

const THRESHOLD = 0.8;

/** Mirror `recordAttempt`: mastered ⇔ credit-weighted mastery clears the bar. */
function finishMastered(credits: number[], threshold = THRESHOLD): boolean {
  return meetsMasteryGate(creditRoundScore(credits, credits.length), threshold);
}

/** Mirror `LevelFinishGuidance`: suggestions surface only on a failed finish. */
function finishSuggestions(
  failedTopicKey: string,
  mastered: boolean,
  masteryOf: (k: string) => PrereqMasterySnapshot | undefined,
  misconceptionTag?: string,
) {
  if (mastered) return [];
  return suggestPrereqsToStrengthen({ failedTopicKey, masteryOf, misconceptionTag });
}

/** A prereq snapshot with EV/conditioning/L1 strong-but-not-perfect (~0.85). */
const masteryOf = (overrides: Record<string, PrereqMasterySnapshot>) =>
  (k: string): PrereqMasterySnapshot | undefined => overrides[k];

// Two adjacent levels in the SAME section; mastering the first unlocks the second.
const SECTIONED = [
  { id: "mc-1", section: "Markov Chains" },
  { id: "mc-2", section: "Markov Chains" },
];

describe("hint-heavy 4/5 round (~22% credit) fails the settlement gate", () => {
  // 4 eventually-correct (all after deep hints) + 1 never correct.
  const credits = [
    creditForRung(true, 1), // 0.65
    creditForRung(true, 3), // 0.20
    creditForRung(true, 3), // 0.20
    creditForRung(true, 4), // 0.10
    creditForRung(false, 5), // 0.00
  ];

  it("reads NOT mastered on the credit-weighted mastery", () => {
    expect(creditRoundScore(credits, 5)).toBeLessThan(0.3);
    expect(finishMastered(credits)).toBe(false);
  });

  it("does NOT unlock the next same-section node", () => {
    const isMastered = () => false; // nothing mastered this failed round
    // The section's first level stays open (retry), but its SECOND level stays LOCKED.
    expect(isLevelUnlockedBySection(SECTIONED, 0, isMastered)).toBe(true);
    expect(isLevelUnlockedBySection(SECTIONED, 1, isMastered)).toBe(false);
  });

  it("FIRES the ~0.85 failed-topic prerequisite suggestion that the bug suppressed", () => {
    const mastered = finishMastered(credits);
    const out = finishSuggestions(
      MARKOV,
      mastered,
      masteryOf({
        [EXPECTED_VALUE]: { mean: 0.85, n: 10 }, // strong-but-not-perfect ⇒ suggested
        [CONDITIONAL]: { mean: 0.99, n: 10 }, // mastered ⇒ excluded
      }),
    );
    expect(out.length).toBeGreaterThan(0);
    expect(out.map((s) => s.topicKey)).toContain(EXPECTED_VALUE);
    for (const s of out) {
      expect(s.mean).toBeGreaterThanOrEqual(0.7);
      expect(s.mean).toBeLessThanOrEqual(0.98);
    }
  });

  it("prefers the misconception-linked prereq when a tag is present", () => {
    const out = finishSuggestions(
      MARKOV,
      false,
      masteryOf({
        [EXPECTED_VALUE]: { mean: 0.85, n: 10 },
        [L1]: { mean: 0.8, n: 10 }, // reversed_conditional ⇒ Core Probability (L1)
      }),
      MISCONCEPTION.reversedConditional,
    );
    expect(out[0].topicKey).toBe(L1);
    expect(out[0].misconceptionLinked).toBe(true);
  });
});

describe("clean high-credit round still masters + unlocks (legit mastery preserved)", () => {
  it("a no-hint round clears the bar and reads mastered", () => {
    expect(finishMastered([1, 1, 1, 1, 1])).toBe(true);
  });

  it("a light-hint round above the bar still masters", () => {
    // four first-try + one 1-hint correct = 0.93 ≥ 0.80.
    expect(finishMastered([1, 1, 1, 1, creditForRung(true, 1)])).toBe(true);
  });

  it("unlocks the next same-section node once mastered", () => {
    const isMastered = (id: string) => id === "mc-1";
    expect(isLevelUnlockedBySection(SECTIONED, 1, isMastered)).toBe(true);
  });

  it("shows NO prerequisite suggestions on a mastered finish", () => {
    const out = finishSuggestions(
      MARKOV,
      true,
      masteryOf({ [EXPECTED_VALUE]: { mean: 0.85, n: 10 } }),
    );
    expect(out).toEqual([]);
  });
});

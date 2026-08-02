import { describe, expect, it } from "vitest";
import {
  UNLOCK_MEAN_BAR,
  isConfidentMastery,
  isLowConfidenceUnlock,
  isTopicUnlocked,
  relocksOnMiss,
  unlockPrecision,
} from "./unlock";
import { applyDiagnosticSeed, applyItemAttempt } from "./mastery";
import { betaMean } from "./beta";
import type { ItemAttempt, TopicMastery } from "@/types/mastery";
import {
  isSkillUnlocked,
  type SkillEvidence,
} from "@/lib/roadmap/readiness";

const TOPIC = "probability::Conditional Probability";

function failingItem(): ItemAttempt {
  return {
    topicKey: TOPIC,
    tier: "medium",
    correct: false,
    mode: "quiz",
    kOptions: 4,
    at: "2026-02-01T00:00:00.000Z",
  };
}

/** Simulate one failing graded quiz item folding into mastery. */
function afterOneFail(m: TopicMastery): TopicMastery {
  return applyItemAttempt(m, undefined, failingItem(), 0).mastery;
}

describe("diagnostic-seeded LOW-CONFIDENCE unlock", () => {
  it("a strong (2/2) diagnostic unlocks the topic but only at low confidence", () => {
    const seed = applyDiagnosticSeed(undefined, {
      successes: 2,
      failures: 0,
      thetaSeed: 0.5,
    });
    // α = 1 + 2 = 3, β = 1 ⇒ mean 0.75, low pseudo-count (α+β = 4).
    expect(seed.alpha).toBe(3);
    expect(seed.beta).toBe(1);
    expect(betaMean(seed.alpha, seed.beta)).toBeCloseTo(0.75, 5);
    expect(unlockPrecision(seed)).toBe(4);

    expect(isTopicUnlocked(seed)).toBe(true); // mean 0.75 ≥ 0.70 bar
    expect(isConfidentMastery(seed)).toBe(false); // ciLow ≪ 0.80 (never earned)
    expect(isLowConfidenceUnlock(seed)).toBe(true);
    expect(relocksOnMiss(seed)).toBe(true); // one miss will swing it under the bar
  });

  it("a fresh / mixed diagnostic does NOT unlock", () => {
    expect(isTopicUnlocked(undefined)).toBe(false);
    const mixed = applyDiagnosticSeed(undefined, { successes: 1, failures: 1 });
    expect(betaMean(mixed.alpha, mixed.beta)).toBeCloseTo(0.5, 5);
    expect(isTopicUnlocked(mixed)).toBe(false);
  });
});

describe("swing-and-relock on a subsequent failure", () => {
  it("one failing quiz item swings the mean DOWN below the bar and re-locks", () => {
    const unlocked = applyDiagnosticSeed(undefined, {
      successes: 2,
      failures: 0,
      thetaSeed: 0.5,
    });
    expect(isTopicUnlocked(unlocked)).toBe(true);

    const relocked = afterOneFail(unlocked);
    // α = 3, β = 2 ⇒ mean 0.6 < 0.70.
    expect(betaMean(relocked.alpha, relocked.beta)).toBeLessThan(UNLOCK_MEAN_BAR);
    expect(isTopicUnlocked(relocked)).toBe(false); // RE-LOCKED
    // Elo θ also swings down with the miss (the estimate moved a lot).
    expect(relocked.theta).toBeLessThan(unlocked.theta);
  });
});

describe("EARNED mastery stays sticky (preserved behavior)", () => {
  it("a confidently-mastered topic survives a single miss (no relock)", () => {
    // Lots of clean evidence ⇒ ciLow ≥ bar (confident) and high precision.
    const earned = applyDiagnosticSeed(undefined, {
      successes: 17,
      failures: 0,
      thetaSeed: 2,
    });
    expect(isConfidentMastery(earned)).toBe(true);
    expect(isTopicUnlocked(earned)).toBe(true);
    expect(isLowConfidenceUnlock(earned)).toBe(false);
    expect(relocksOnMiss(earned)).toBe(false); // sticky

    const afterMiss = afterOneFail(earned);
    expect(isTopicUnlocked(afterMiss)).toBe(true); // still unlocked
  });
});

describe("roadmap surfaces the unlock (and its re-lock)", () => {
  function evidence(mean: number, gradedCount: number): SkillEvidence {
    return {
      topicKey: TOPIC,
      ciLow: 0,
      mean,
      gradedCount,
      theta: 0,
      levelsMastered: 0,
      levelsTotal: 3,
    };
  }
  it("isSkillUnlocked tracks the point-estimate bar and re-locks on the swing", () => {
    expect(isSkillUnlocked(evidence(0.75, 2))).toBe(true); // low-confidence unlock
    expect(isSkillUnlocked(evidence(0.6, 3))).toBe(false); // swung down ⇒ re-locked
    expect(isSkillUnlocked(evidence(0.9, 0))).toBe(false); // no graded evidence
  });
});

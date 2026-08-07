import { describe, expect, it } from "vitest";
import {
  creditRoundScore,
  creditForRung,
  meetsMasteryGate,
  roundScore,
} from "./score";

/**
 * These lock in the CREDIT-WEIGHTED visible mastery % AND the fact that it — not
 * the lenient binary `roundScore` — is what the mastery/unlock gate compares to
 * the bar ({@link meetsMasteryGate}). So using hints lowers BOTH the displayed
 * mastery and, when it drops below the bar, the mastered verdict: a hint-heavy
 * round no longer earns a false "Mastered" stamp, while a clean few/no-hint round
 * keeps near-full credit and still masters.
 */
describe("creditForRung", () => {
  it("mirrors the calibrated rung schedule", () => {
    expect(creditForRung(true, 0)).toBe(1.0);
    expect(creditForRung(true, 1)).toBe(0.65);
    expect(creditForRung(true, 2)).toBe(0.45);
    expect(creditForRung(true, 3)).toBe(0.2);
    expect(creditForRung(true, 4)).toBe(0.1);
    expect(creditForRung(true, 5)).toBe(0.04);
  });

  it("earns 0 for a wrong answer regardless of rung", () => {
    expect(creditForRung(false, 0)).toBe(0);
    expect(creditForRung(false, 5)).toBe(0);
  });
});

describe("creditRoundScore", () => {
  it("worked example: 4 no-hint correct + 1 correct after 1 hint === 0.93", () => {
    // 0.8 (four full-credit items) + 0.65*0.2 (one rung-1 item) = 0.93.
    const score = creditRoundScore([1, 1, 1, 1, creditForRung(true, 1)], 5);
    expect(score).toBeCloseTo(0.93, 10);
  });

  it("correct after 2 hints is worth 0.45 and a full such round is 0.45 (< 100%)", () => {
    expect(creditForRung(true, 2)).toBe(0.45);
    const credits = Array(5).fill(creditForRung(true, 2));
    const score = creditRoundScore(credits, 5);
    expect(score).toBeCloseTo(0.45, 10);
    expect(score).toBeLessThan(1);
  });

  it("a no-hint full round scores 1.0", () => {
    expect(creditRoundScore([1, 1, 1, 1, 1], 5)).toBe(1);
  });

  it("all wrong-after-5 scores 0", () => {
    const credits = Array(5).fill(creditForRung(false, 5));
    expect(creditRoundScore(credits, 5)).toBe(0);
  });

  it("returns 0 for an empty round and treats non-finite credits as 0", () => {
    expect(creditRoundScore([], 0)).toBe(0);
    expect(creditRoundScore([1, 1], 0)).toBe(0);
    expect(creditRoundScore([1, NaN, Infinity, 1], 4)).toBeCloseTo(0.5, 10);
  });
});

describe("meetsMasteryGate: the mastery bar reads the CREDIT-WEIGHTED score", () => {
  const threshold = 0.8;

  it("SETTLEMENT BUG regression: 4/5 correct but ~22% credit reads NOT mastered", () => {
    // The reported case: every correct answer arrived only after deep hints, so
    // the visible mastery is ~22% even though 4 of 5 were eventually correct.
    const total = 5;
    const credits = [
      creditForRung(true, 1), // 0.65
      creditForRung(true, 3), // 0.20
      creditForRung(true, 3), // 0.20
      creditForRung(true, 4), // 0.10
      creditForRung(false, 5), // 0.00 — never got it
    ];
    const binaryGate = roundScore(4, total); // 0.80 — the OLD (buggy) gate value
    const display = creditRoundScore(credits, total); // ≈ 0.23

    expect(binaryGate).toBe(0.8);
    expect(display).toBeLessThan(0.3);
    // OLD behavior would have passed (binaryGate ≥ bar); the CORRECT gate fails.
    expect(binaryGate >= threshold).toBe(true);
    expect(meetsMasteryGate(display, threshold)).toBe(false);
  });

  it("a clean no-hint round still masters (few/no hints unaffected)", () => {
    const display = creditRoundScore([1, 1, 1, 1, 1], 5); // 1.0
    expect(meetsMasteryGate(display, threshold)).toBe(true);
  });

  it("a light-hint round that stays above the bar still masters", () => {
    // Four first-try + one 1-hint correct = 0.93 ≥ 0.80.
    const display = creditRoundScore([1, 1, 1, 1, creditForRung(true, 1)], 5);
    expect(display).toBeCloseTo(0.93, 10);
    expect(meetsMasteryGate(display, threshold)).toBe(true);
  });

  it("the gate is a pure ≥ comparison on the supplied (credit-weighted) score", () => {
    expect(meetsMasteryGate(0.8, 0.8)).toBe(true);
    expect(meetsMasteryGate(0.79, 0.8)).toBe(false);
    expect(meetsMasteryGate(0.45, 0.8)).toBe(false);
  });
});

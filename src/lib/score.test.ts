import { describe, expect, it } from "vitest";
import { creditRoundScore, creditForRung, roundScore } from "./score";

/**
 * These lock in the CREDIT-WEIGHTED visible mastery %, which is DISTINCT from the
 * binary `roundScore` used for the advance/unlock gate. Using hints lowers the
 * displayed score (`creditRoundScore`) but never the gate (`roundScore` of items
 * ultimately correct), so hint use cannot bounce a learner below the pass bar.
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

describe("gate independence: hints never change advancement", () => {
  // Mirrors ProgressContext.recordAttempt's gate decision without importing React.
  const pass = (gate: number, threshold: number) => gate >= threshold;

  it("a round ultimately all-correct passes the gate while displaying < 100%", () => {
    const threshold = 0.8;
    // Every item was ULTIMATELY correct, but some needed hints.
    const correctCount = 5;
    const total = 5;
    const gate = roundScore(correctCount, total); // binary → 1.0
    const displayCredits = [
      creditForRung(true, 0), // no hint
      creditForRung(true, 2), // 2 hints
      creditForRung(true, 1), // 1 hint
      creditForRung(true, 0),
      creditForRung(true, 3), // 3 hints
    ];
    const display = creditRoundScore(displayCredits, total);

    expect(gate).toBe(1);
    expect(pass(gate, threshold)).toBe(true); // advancement unaffected by hints
    expect(display).toBeLessThan(1); // visible mastery reflects hint use
  });
});

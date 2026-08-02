import { describe, expect, it } from "vitest";
import { SPEED_TARGET_RATIO, speedStats, speedTargetMs } from "./speedStats";
import type { AnsweredItem } from "./scoring";

const item = (p: Partial<AnsweredItem>): AnsweredItem => ({
  id: p.id ?? "x",
  correct: p.correct ?? false,
  skipped: p.skipped ?? false,
  rtMs: p.rtMs ?? 1000,
  op: p.op ?? "add",
});

describe("speedTargetMs", () => {
  it("is the ratio of the budget", () => {
    expect(speedTargetMs(6000)).toBe(6000 * SPEED_TARGET_RATIO);
    expect(speedTargetMs(6000, 0.5)).toBe(3000);
  });
});

describe("speedStats", () => {
  const budget = 6000;

  it("computes median/mean/fastest over attempted items (skips excluded)", () => {
    const items = [
      item({ id: "a", correct: true, rtMs: 2000 }),
      item({ id: "b", correct: true, rtMs: 4000 }),
      item({ id: "c", correct: false, rtMs: 9000 }),
      item({ id: "d", skipped: true, rtMs: 0 }),
    ];
    const s = speedStats(items, budget);
    expect(s.attempted).toBe(3);
    expect(s.medianSolveMs).toBe(4000); // median [2000,4000,9000]
    expect(s.meanSolveMs).toBe(5000);
    expect(s.fastestMs).toBe(2000);
  });

  it("counts within-budget and correct-within-budget shares", () => {
    const items = [
      item({ id: "a", correct: true, rtMs: 2000 }), // in budget, correct
      item({ id: "b", correct: false, rtMs: 5000 }), // in budget, wrong
      item({ id: "c", correct: true, rtMs: 9000 }), // over budget, correct
    ];
    const s = speedStats(items, budget);
    expect(s.withinBudget).toBe(2); // a, b (rt ≤ 6000)
    expect(s.pctWithinBudget).toBeCloseTo(2 / 3, 6);
    expect(s.correctWithinBudget).toBe(1); // only a
    expect(s.pctCorrectWithinBudget).toBeCloseTo(1 / 3, 6);
  });

  it("beatTarget when the median is within the 80% target", () => {
    // budget 6000 → target 4800. median 4000 ≤ 4800 ⇒ beat.
    const fast = speedStats(
      [item({ rtMs: 4000, correct: true }), item({ rtMs: 4000, correct: true })],
      budget,
    );
    expect(fast.targetMs).toBe(4800);
    expect(fast.beatTarget).toBe(true);

    // median 5000 > 4800 ⇒ not beaten.
    const slow = speedStats(
      [item({ rtMs: 5000, correct: true }), item({ rtMs: 5000, correct: true })],
      budget,
    );
    expect(slow.beatTarget).toBe(false);
  });

  it("is safe (no NaN) for an all-skipped / empty run", () => {
    const s = speedStats([item({ skipped: true })], budget);
    expect(s.attempted).toBe(0);
    expect(s.medianSolveMs).toBe(0);
    expect(s.pctWithinBudget).toBe(0);
    expect(s.beatTarget).toBe(false);
    expect(speedStats([], budget).beatTarget).toBe(false);
  });
});

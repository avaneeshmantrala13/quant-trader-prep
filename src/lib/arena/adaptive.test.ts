import { describe, expect, it } from "vitest";
import {
  DEFAULT_ADAPTIVE,
  beatTheClockBudgetMs,
  nextAdaptiveBudgetMs,
  shouldTighten,
} from "./adaptive";
import { DEFAULT_SPRINT_BUDGET_MS } from "./config";

describe("shouldTighten", () => {
  it("requires both a big enough sample and high accuracy", () => {
    expect(shouldTighten(0.9, 25)).toBe(true);
    expect(shouldTighten(0.9, 5)).toBe(false); // too few attempts
    expect(shouldTighten(0.7, 25)).toBe(false); // accuracy below target
    expect(shouldTighten(0.85, 20)).toBe(true); // exactly at both thresholds
  });
});

describe("nextAdaptiveBudgetMs", () => {
  it("tightens by the step when accuracy has stabilized high", () => {
    // 6000 × (1 − 0.1) = 5400
    expect(nextAdaptiveBudgetMs(6000, 0.9, 30)).toBe(5400);
  });

  it("holds the budget when accuracy is not yet stable", () => {
    expect(nextAdaptiveBudgetMs(6000, 0.7, 30)).toBe(6000);
    expect(nextAdaptiveBudgetMs(6000, 0.95, 5)).toBe(6000); // sample too small
  });

  it("never tightens below the floor", () => {
    const floor = DEFAULT_ADAPTIVE.floorMs; // 3000
    expect(nextAdaptiveBudgetMs(3100, 0.99, 50)).toBe(floor);
    expect(nextAdaptiveBudgetMs(floor, 0.99, 50)).toBe(floor);
  });
});

describe("beatTheClockBudgetMs", () => {
  it("round 0 is the full base budget", () => {
    expect(beatTheClockBudgetMs(0)).toBe(DEFAULT_SPRINT_BUDGET_MS);
  });

  it("shrinks monotonically each round", () => {
    const r0 = beatTheClockBudgetMs(0);
    const r1 = beatTheClockBudgetMs(1);
    const r2 = beatTheClockBudgetMs(2);
    expect(r1).toBeLessThan(r0);
    expect(r2).toBeLessThan(r1);
    expect(beatTheClockBudgetMs(1)).toBe(Math.round(6000 * 0.9)); // 5400
  });

  it("clamps at the floor for large rounds", () => {
    expect(beatTheClockBudgetMs(100)).toBe(DEFAULT_ADAPTIVE.floorMs);
  });

  it("treats negative/fractional rounds as round 0-ish (floored, non-negative)", () => {
    expect(beatTheClockBudgetMs(-5)).toBe(DEFAULT_SPRINT_BUDGET_MS);
    expect(beatTheClockBudgetMs(1.9)).toBe(beatTheClockBudgetMs(1));
  });
});

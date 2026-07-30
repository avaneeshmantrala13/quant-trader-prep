import { describe, expect, it } from "vitest";
import {
  simulateMontyHall,
  bayesPosterior,
  naturalFrequencyCounts,
  simulateDartboard,
  mixedStrategySolution,
  CIRCLE_AREA_RATIO,
} from "./games";

describe("simulateMontyHall", () => {
  it("returns a running proportion of the requested length", () => {
    const out = simulateMontyHall(true, 200, 1);
    expect(out).toHaveLength(200);
    for (const p of out) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });

  it("is deterministic given the seed", () => {
    expect(simulateMontyHall(true, 500, 42)).toEqual(
      simulateMontyHall(true, 500, 42),
    );
  });

  it("switching converges to ≈2/3 and staying to ≈1/3", () => {
    const sw = simulateMontyHall(true, 20000, 7);
    const stay = simulateMontyHall(false, 20000, 7);
    expect(Math.abs(sw[sw.length - 1] - 2 / 3)).toBeLessThan(0.03);
    expect(Math.abs(stay[stay.length - 1] - 1 / 3)).toBeLessThan(0.03);
  });
});

describe("bayesPosterior", () => {
  it("matches the closed-form Bayes computation", () => {
    // (0.8·0.01) / (0.8·0.01 + 0.096·0.99) = 0.008 / 0.10304 ≈ 0.07764
    expect(bayesPosterior(0.01, 0.8, 0.096)).toBeCloseTo(0.07764, 3);
  });

  it("is 1 for a perfect test on a positive prior and 0 for a zero prior", () => {
    expect(bayesPosterior(0.5, 1, 0)).toBeCloseTo(1, 10);
    expect(bayesPosterior(0, 0.9, 0.1)).toBe(0);
  });
});

describe("naturalFrequencyCounts", () => {
  it("buckets sum to the total (default 1000)", () => {
    const c = naturalFrequencyCounts(0.01, 0.8, 0.096);
    expect(c.total).toBe(1000);
    expect(c.haveAndPos + c.haveAndNeg + c.noAndPos + c.noAndNeg).toBe(1000);
  });

  it("respects a custom total and rounds to whole people", () => {
    const c = naturalFrequencyCounts(0.1, 0.9, 0.2, 500);
    expect(c.total).toBe(500);
    expect(c.haveAndPos + c.haveAndNeg + c.noAndPos + c.noAndNeg).toBe(500);
    for (const v of [c.haveAndPos, c.haveAndNeg, c.noAndPos, c.noAndNeg]) {
      expect(Number.isInteger(v)).toBe(true);
    }
  });
});

describe("simulateDartboard", () => {
  it("estimates π/4 within 0.02 and caps returned points", () => {
    const res = simulateDartboard(20000, 3, 1500);
    expect(res.total).toBe(20000);
    expect(Math.abs(res.proportion - CIRCLE_AREA_RATIO)).toBeLessThan(0.02);
    expect(res.points.length).toBeLessThanOrEqual(1500);
  });

  it("marks each returned point inside iff x²+y² ≤ 1", () => {
    const res = simulateDartboard(50, 9, 1500);
    for (const p of res.points) {
      expect(p.inside).toBe(p.x * p.x + p.y * p.y <= 1);
    }
  });
});

describe("mixedStrategySolution", () => {
  it("solves matching pennies: value 0, 50/50 mixes, no saddle", () => {
    const sol = mixedStrategySolution([
      [1, -1],
      [-1, 1],
    ]);
    expect(sol.saddle).toBe(false);
    expect(sol.value).toBeCloseTo(0, 10);
    expect(sol.rowStrategy[0]).toBeCloseTo(0.5, 10);
    expect(sol.rowStrategy[1]).toBeCloseTo(0.5, 10);
    expect(sol.colStrategy[0]).toBeCloseTo(0.5, 10);
    expect(sol.colStrategy[1]).toBeCloseTo(0.5, 10);
  });

  it("detects a pure saddle point with the correct value", () => {
    const sol = mixedStrategySolution([
      [4, 3],
      [2, 1],
    ]);
    expect(sol.saddle).toBe(true);
    expect(sol.value).toBe(3);
    expect(sol.rowStrategy).toEqual([1, 0]);
    expect(sol.colStrategy).toEqual([0, 1]);
  });
});

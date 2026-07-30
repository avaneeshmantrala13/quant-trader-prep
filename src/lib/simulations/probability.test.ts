import { describe, expect, it } from "vitest";
import {
  simulateCoinFlips,
  simulateDieFaceRunning,
  dieFaceCounts,
  twoDiceSumDistribution,
  twoDiceEventCount,
} from "./probability";

describe("simulateCoinFlips", () => {
  it("returns a running proportion of the requested length", () => {
    const out = simulateCoinFlips(0.5, 100, 1);
    expect(out).toHaveLength(100);
    for (const p of out) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });

  it("is deterministic given the seed", () => {
    expect(simulateCoinFlips(0.5, 500, 42)).toEqual(
      simulateCoinFlips(0.5, 500, 42),
    );
  });

  it("converges to pHeads within 0.03 at N=20000", () => {
    const p = 0.3;
    const out = simulateCoinFlips(p, 20000, 7);
    expect(Math.abs(out[out.length - 1] - p)).toBeLessThan(0.03);
  });
});

describe("simulateDieFaceRunning", () => {
  it("has the requested length and converges to 1/sides", () => {
    const out = simulateDieFaceRunning(6, 3, 20000, 11);
    expect(out).toHaveLength(20000);
    expect(Math.abs(out[out.length - 1] - 1 / 6)).toBeLessThan(0.03);
  });
});

describe("dieFaceCounts", () => {
  it("has length sides and sums to rolls", () => {
    const rolls = 6000;
    const counts = dieFaceCounts(6, rolls, 99);
    expect(counts).toHaveLength(6);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(rolls);
  });

  it("each face is close to rolls/sides", () => {
    const sides = 6;
    const rolls = 6000;
    const counts = dieFaceCounts(sides, rolls, 123);
    const expected = rolls / sides;
    for (const c of counts) {
      expect(Math.abs(c - expected)).toBeLessThan(expected * 0.2);
    }
  });
});

describe("twoDiceSumDistribution", () => {
  it("covers sums 2..12 with probabilities summing to 1", () => {
    const dist = twoDiceSumDistribution();
    expect(dist.map((d) => d.sum)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const totalCount = dist.reduce((a, d) => a + d.count, 0);
    expect(totalCount).toBe(36);
    const totalProb = dist.reduce((a, d) => a + d.prob, 0);
    expect(totalProb).toBeCloseTo(1, 10);
  });

  it("P(sum = 7) = 6/36", () => {
    const seven = twoDiceSumDistribution().find((d) => d.sum === 7);
    expect(seven?.count).toBe(6);
    expect(seven?.prob).toBeCloseTo(6 / 36, 10);
  });
});

describe("twoDiceEventCount", () => {
  it("counts doubles (a === b) as 6", () => {
    expect(twoDiceEventCount((a, b) => a === b)).toBe(6);
  });

  it("counts at-least-one-6 as 11", () => {
    expect(twoDiceEventCount((a, b) => a === 6 || b === 6)).toBe(11);
  });

  it("counts sum >= 8 as 15", () => {
    expect(twoDiceEventCount((a, b) => a + b >= 8)).toBe(15);
  });
});

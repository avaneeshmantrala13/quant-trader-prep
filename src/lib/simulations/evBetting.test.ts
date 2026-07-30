import { describe, expect, it } from "vitest";
import type { Outcome } from "./evBetting";
import {
  expectedValue,
  simulateRunningAverage,
  kellyFraction,
  simulateBankroll,
  couponCollectorExpectation,
  simulateCouponCollector,
} from "./evBetting";
import { mean } from "./shared";

describe("expectedValue", () => {
  it("computes Σ value·prob on a known set", () => {
    const outcomes: Outcome[] = [
      { value: 10, prob: 0.25 },
      { value: -2, prob: 0.75 },
    ];
    expect(expectedValue(outcomes)).toBeCloseTo(10 * 0.25 - 2 * 0.75, 12);
  });

  it("is 0 for a fair even-money game", () => {
    expect(
      expectedValue([
        { value: 1, prob: 0.5 },
        { value: -1, prob: 0.5 },
      ]),
    ).toBeCloseTo(0, 12);
  });
});

describe("simulateRunningAverage", () => {
  const outcomes: Outcome[] = [
    { value: 5, prob: 0.4 },
    { value: -1, prob: 0.6 },
  ];

  it("has the requested length and is deterministic", () => {
    const a = simulateRunningAverage(outcomes, 500, 42);
    const b = simulateRunningAverage(outcomes, 500, 42);
    expect(a).toHaveLength(500);
    expect(a).toEqual(b);
  });

  it("final running average ≈ expected value at large N", () => {
    const ev = expectedValue(outcomes);
    const out = simulateRunningAverage(outcomes, 20000, 7);
    expect(Math.abs(out[out.length - 1] - ev)).toBeLessThan(0.05);
  });
});

describe("kellyFraction", () => {
  it("kellyFraction(0.6, 1) = 0.2", () => {
    expect(kellyFraction(0.6, 1)).toBeCloseTo(0.2, 12);
  });

  it("clamps to 0 when the edge is negative", () => {
    expect(kellyFraction(0.4, 1)).toBe(0);
  });
});

describe("simulateBankroll", () => {
  it("returns rounds + 1 values and starts at 1.0", () => {
    const out = simulateBankroll(0.6, 1, 0.2, 50, 3);
    expect(out).toHaveLength(51);
    expect(out[0]).toBe(1.0);
  });

  it("is deterministic given the seed", () => {
    expect(simulateBankroll(0.6, 1, 0.2, 100, 9)).toEqual(
      simulateBankroll(0.6, 1, 0.2, 100, 9),
    );
  });
});

describe("couponCollectorExpectation", () => {
  it("equals 1 for n = 1", () => {
    expect(couponCollectorExpectation(1)).toBeCloseTo(1, 12);
  });

  it("equals 3 for n = 2 (2·(1 + 1/2))", () => {
    expect(couponCollectorExpectation(2)).toBeCloseTo(3, 12);
  });
});

describe("simulateCouponCollector", () => {
  it("every count is ≥ n and the array has length trials", () => {
    const n = 8;
    const counts = simulateCouponCollector(n, 300, 21);
    expect(counts).toHaveLength(300);
    for (const c of counts) expect(c).toBeGreaterThanOrEqual(n);
  });

  it("empirical mean ≈ n·H_n within tolerance", () => {
    const n = 10;
    const counts = simulateCouponCollector(n, 4000, 5);
    const expectedMean = couponCollectorExpectation(n);
    expect(Math.abs(mean(counts) - expectedMean)).toBeLessThan(expectedMean * 0.05);
  });
});

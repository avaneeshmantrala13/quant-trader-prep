import { describe, expect, it } from "vitest";
import type { CalibrationPair } from "@/lib/mastery/reliability";
import {
  brierReliabilityGap,
  brierScore,
  reliabilityDiagram,
} from "./reliability";

/** n pairs at a fixed predicted prob, `k` of them correct. */
function group(pred: number, n: number, k: number): CalibrationPair[] {
  return Array.from({ length: n }, (_, i) => ({
    pred,
    outcome: (i < k ? 1 : 0) as 0 | 1,
  }));
}

describe("brierReliabilityGap", () => {
  it("well-calibrated predictions ⇒ gap ≈ 0", () => {
    // 10% predictions right 10% of the time; 90% predictions right 90%.
    const pairs = [...group(0.1, 10, 1), ...group(0.9, 10, 9)];
    expect(brierReliabilityGap(pairs)).toBeLessThan(0.02);
  });

  it("overconfident predictions ⇒ gap > 0", () => {
    // Says 90% but only right 30% of the time.
    const pairs = group(0.9, 10, 3);
    expect(brierReliabilityGap(pairs)).toBeGreaterThan(0.5);
  });

  it("empty input ⇒ 0", () => {
    expect(brierReliabilityGap([])).toBe(0);
  });

  it("handles sparse bins (fewer pairs than requested bins)", () => {
    const pairs = [...group(0.2, 2, 1), ...group(0.8, 2, 2)];
    // nBins=10 but only 4 pairs ⇒ no throw, finite gap.
    const gap = brierReliabilityGap(pairs, 10);
    expect(Number.isFinite(gap)).toBe(true);
    expect(gap).toBeGreaterThanOrEqual(0);
  });
});

describe("brierScore", () => {
  it("perfect predictions ⇒ 0", () => {
    const pairs: CalibrationPair[] = [
      { pred: 1, outcome: 1 },
      { pred: 0, outcome: 0 },
      { pred: 1, outcome: 1 },
    ];
    expect(brierScore(pairs)).toBe(0);
  });

  it("maximally-wrong predictions ⇒ 1", () => {
    const pairs: CalibrationPair[] = [
      { pred: 1, outcome: 0 },
      { pred: 0, outcome: 1 },
    ];
    expect(brierScore(pairs)).toBe(1);
  });

  it("overconfident scores worse (higher) than calibrated", () => {
    const overconfident = brierScore(group(0.9, 10, 3));
    const calibrated = brierScore([...group(0.1, 10, 1), ...group(0.9, 10, 9)]);
    expect(overconfident).toBeGreaterThan(calibrated);
  });
});

describe("reliabilityDiagram", () => {
  it("empty log ⇒ insufficient-data shape (count 0, no bins, no headline)", () => {
    const d = reliabilityDiagram([]);
    expect(d.count).toBe(0);
    expect(d.bins).toEqual([]);
    expect(d.headline).toBeUndefined();
  });

  it("shapes bins as predicted (x) vs observed (y) with counts", () => {
    const pairs = [...group(0.1, 10, 1), ...group(0.9, 10, 9)];
    const d = reliabilityDiagram(pairs);
    expect(d.count).toBe(20);
    // Two distinct confidence levels ⇒ two bins, each calibrated.
    const lo = d.bins.find((b) => b.predicted < 0.5)!;
    const hi = d.bins.find((b) => b.predicted > 0.5)!;
    expect(lo.observed).toBeCloseTo(0.1, 6);
    expect(hi.observed).toBeCloseTo(0.9, 6);
    expect(lo.pMid).toBe(lo.predicted);
  });

  it("headline reads observed accuracy in the ~80% band", () => {
    // 10 predictions near 80%, 6 correct ⇒ headline observed 0.6.
    const d = reliabilityDiagram(group(0.8, 10, 6));
    expect(d.headline).toBeDefined();
    expect(d.headline!.predicted).toBeCloseTo(0.8, 6);
    expect(d.headline!.observed).toBeCloseTo(0.6, 6);
    expect(d.headline!.count).toBe(10);
  });

  it("no predictions in the 80% band ⇒ no headline", () => {
    const d = reliabilityDiagram([...group(0.2, 5, 1), ...group(0.5, 5, 2)]);
    expect(d.headline).toBeUndefined();
  });
});

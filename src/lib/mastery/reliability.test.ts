import { describe, expect, it } from "vitest";
import { brierGap, reliabilityBins, type CalibrationPair } from "./reliability";

function pair(pred: number, outcome: 0 | 1): CalibrationPair {
  return { pred, outcome };
}

describe("reliability / calibration math", () => {
  it("perfectly-calibrated data ⇒ relGap ≈ 0 and Brier = 0", () => {
    const perfect: CalibrationPair[] = [
      ...Array.from({ length: 10 }, () => pair(1, 1 as const)),
      ...Array.from({ length: 10 }, () => pair(0, 0 as const)),
    ];
    const { relGap, brier } = brierGap(perfect);
    expect(relGap).toBeCloseTo(0, 12);
    expect(brier).toBeCloseTo(0, 12);
  });

  it("systematically overconfident data ⇒ relGap > 0", () => {
    // Predict 0.9 but the learner is always wrong.
    const overconfident = Array.from({ length: 20 }, () => pair(0.9, 0 as const));
    const { relGap } = brierGap(overconfident);
    expect(relGap).toBeGreaterThan(0.5);
  });

  it("well-calibrated-at-0.5 data ⇒ small relGap, Brier = 0.25", () => {
    const half: CalibrationPair[] = [
      ...Array.from({ length: 10 }, () => pair(0.5, 1 as const)),
      ...Array.from({ length: 10 }, () => pair(0.5, 0 as const)),
    ];
    const { relGap, brier } = brierGap(half);
    expect(relGap).toBeCloseTo(0, 12); // conf 0.5 == acc 0.5
    expect(brier).toBeCloseTo(0.25, 12);
  });

  it("empty input is a no-op", () => {
    expect(brierGap([])).toEqual({ relGap: 0, brier: 0 });
    expect(reliabilityBins([])).toEqual([]);
  });

  it("bins never exceed the requested count and cover all pairs", () => {
    const data = Array.from({ length: 7 }, (_, i) =>
      pair(i / 7, (i % 2) as 0 | 1),
    );
    const bins = reliabilityBins(data, 10);
    expect(bins.length).toBeLessThanOrEqual(7);
    expect(bins.reduce((s, b) => s + b.count, 0)).toBe(7);
  });
});

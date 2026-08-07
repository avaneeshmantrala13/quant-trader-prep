import { describe, expect, it } from "vitest";
import type { CalibrationPair } from "@/lib/mastery/reliability";
import {
  brierReliabilityGap,
  brierScore,
  CALIB_DEAD_BAND,
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

describe("reliabilityDiagram — WS-CAL sufficiency gate + single signed label", () => {
  it("gates the panel below MIN_PAIRS (kills the n=1 nonsense)", () => {
    const d = reliabilityDiagram(group(0.8, 1, 1)); // a single data point
    expect(d.sufficient).toBe(false);
    expect(d.count).toBe(1);
    expect(d.minPairs).toBe(25);
    // A single ~80% pair must NOT produce a headline ("right 100%, n=1").
    expect(d.headline).toBeUndefined();
  });

  it("becomes sufficient once ≥ MIN_PAIRS pooled pairs exist", () => {
    const d = reliabilityDiagram(group(0.8, 25, 20));
    expect(d.sufficient).toBe(true);
    expect(d.headline).toBeDefined();
  });

  it("derives ONE signed label so headline/chip/caption can never contradict", () => {
    // Says ~80% but only right 30% ⇒ over-confident (signed > 0).
    const over = reliabilityDiagram(group(0.8, 40, 12));
    expect(over.calibration?.lean).toBe("over");
    expect(over.calibration?.signed).toBeGreaterThan(0);
    expect(over.calibration?.label).toMatch(/over-confident/);

    // Says ~30% but right 80% ⇒ under-confident (signed < 0).
    const under = reliabilityDiagram(group(0.3, 40, 32));
    expect(under.calibration?.lean).toBe("under");
    expect(under.calibration?.signed).toBeLessThan(0);

    // Confidence ≈ accuracy ⇒ well-calibrated (dead-band).
    const well = reliabilityDiagram([
      ...group(0.1, 20, 2),
      ...group(0.9, 20, 18),
    ]);
    expect(well.calibration?.lean).toBe("well");
  });
});

describe("reliabilityDiagram — signed error is the single source of truth", () => {
  it("over-confident: predicted > observed across bins ⇒ signed > 0, lean 'over'", () => {
    const d = reliabilityDiagram([
      ...group(0.7, 30, 15), // say 70 / right 50
      ...group(0.9, 30, 18), // say 90 / right 60
    ]);
    expect(d.calibration!.signed).toBeGreaterThan(CALIB_DEAD_BAND);
    expect(d.calibration!.lean).toBe("over");
    expect(d.calibration!.label).toMatch(/over-confident/);
  });

  it("under-confident: predicted < observed across bins ⇒ signed < 0, lean 'under'", () => {
    const d = reliabilityDiagram([
      ...group(0.5, 30, 21), // say 50 / right 70
      ...group(0.8, 30, 27), // say 80 / right 90
    ]);
    expect(d.calibration!.signed).toBeLessThan(-CALIB_DEAD_BAND);
    expect(d.calibration!.lean).toBe("under");
    expect(d.calibration!.label).toMatch(/under-confident/);
  });

  it("well-calibrated: predicted ≈ observed ⇒ |signed| within tolerance, lean 'well'", () => {
    const d = reliabilityDiagram([
      ...group(0.3, 30, 9), // say 30 / right 30
      ...group(0.8, 30, 24), // say 80 / right 80
    ]);
    expect(Math.abs(d.calibration!.signed)).toBeLessThanOrEqual(CALIB_DEAD_BAND);
    expect(d.calibration!.lean).toBe("well");
    expect(d.calibration!.label).toMatch(/well-calibrated/);
  });

  it("the sign of the signed error matches which side of the diagonal the curve reads", () => {
    // over ⇒ predicted above observed ⇒ every point BELOW the diagonal.
    const over = reliabilityDiagram(group(0.9, 40, 20));
    expect(over.calibration!.signed).toBeGreaterThan(0);
    expect(over.bins.every((b) => b.predicted >= b.observed)).toBe(true);
    // under ⇒ predicted below observed ⇒ every point ABOVE the diagonal.
    const under = reliabilityDiagram(group(0.4, 40, 28));
    expect(under.calibration!.signed).toBeLessThan(0);
    expect(under.bins.every((b) => b.observed >= b.predicted)).toBe(true);
  });
});

describe("reliabilityDiagram — the 80→82 screenshot regression", () => {
  it("say ~80% / right ~82% across bins NEVER reads over-confident", () => {
    // 28 predictions at 0.80, 23 correct ⇒ observed ≈ 0.821 (ABOVE the diagonal).
    const d = reliabilityDiagram(group(0.8, 28, 23));
    expect(d.sufficient).toBe(true);
    expect(d.calibration!.signed).toBeLessThanOrEqual(0); // predicted ≤ observed
    expect(d.calibration!.lean).not.toBe("over");
    expect(["under", "well"]).toContain(d.calibration!.lean);
    expect(d.calibration!.label).not.toMatch(/over-confident/);
    // The concrete headline AGREES: right ~82% when you say ~80% (above diagonal).
    expect(d.headline).toBeDefined();
    expect(d.headline!.observed).toBeGreaterThan(d.headline!.predicted);
    expect(Math.round(d.headline!.observed * 100)).toBe(82);
  });

  it("a clearly under-confident 80% band reads under-confident with the point above the diagonal", () => {
    const d = reliabilityDiagram([
      ...group(0.6, 30, 24), // say 60 / right 80
      ...group(0.8, 30, 27), // say 80 / right 90
    ]);
    expect(d.calibration!.lean).toBe("under");
    expect(d.headline).toBeDefined();
    expect(d.headline!.observed).toBeGreaterThan(d.headline!.predicted);
  });
});

describe("reliabilityDiagram — headline can never contradict the aggregate verdict", () => {
  it("withholds the ~80% headline when it bucks an OVER-confident aggregate", () => {
    // The exact screenshot failure: the 80% band alone is under-confident
    // (right ~82%), but heavy over-confidence elsewhere makes the AGGREGATE
    // over-confident. Showing "right 82% at ~80%" next to an OVER-confident
    // verdict (curve below the diagonal) is the self-contradiction we forbid.
    const d = reliabilityDiagram([
      ...group(0.8, 28, 23), // 80% band: right ~82% (local under, above diagonal)
      ...group(0.99, 120, 48), // massively over-confident elsewhere
    ]);
    expect(d.calibration!.lean).toBe("over");
    expect(d.calibration!.signed).toBeGreaterThan(0);
    expect(d.headline).toBeUndefined();
  });

  it("withholds the ~80% headline when it bucks an UNDER-confident aggregate", () => {
    const d = reliabilityDiagram([
      ...group(0.8, 28, 20), // 80% band: right ~71% (local over, below diagonal)
      ...group(0.1, 120, 60), // massively under-confident elsewhere
    ]);
    expect(d.calibration!.lean).toBe("under");
    expect(d.headline).toBeUndefined();
  });

  it("keeps the headline whenever its direction agrees with the verdict", () => {
    const over = reliabilityDiagram(group(0.8, 40, 20)); // say 80 / right 50 ⇒ over
    expect(over.calibration!.lean).toBe("over");
    expect(over.headline).toBeDefined();
    expect(over.headline!.observed).toBeLessThan(over.headline!.predicted);
  });

  it("a shown headline's direction never opposes the signed-error sign", () => {
    const scenarios: CalibrationPair[][] = [
      group(0.8, 40, 20),
      group(0.8, 40, 34),
      group(0.8, 40, 32),
      group(0.8, 28, 23),
      [...group(0.8, 28, 23), ...group(0.99, 120, 48)],
      [...group(0.8, 28, 20), ...group(0.1, 120, 60)],
      [...group(0.6, 30, 24), ...group(0.8, 30, 27)],
    ];
    for (const pairs of scenarios) {
      const d = reliabilityDiagram(pairs);
      if (!d.headline || !d.calibration) continue;
      const headlineSigned = d.headline.predicted - d.headline.observed;
      if (d.calibration.lean === "over") {
        expect(headlineSigned).toBeGreaterThanOrEqual(0);
      }
      if (d.calibration.lean === "under") {
        expect(headlineSigned).toBeLessThanOrEqual(0);
      }
    }
  });

  it("still gates the whole panel below MIN_PAIRS (low-sample)", () => {
    const d = reliabilityDiagram(group(0.8, 10, 8));
    expect(d.sufficient).toBe(false);
    expect(d.count).toBe(10);
  });
});

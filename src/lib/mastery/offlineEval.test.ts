import { describe, expect, it } from "vitest";
import {
  pearson,
  rmse,
  runOfflineEval,
  simulateGlickoRecovery,
  simulateIrtRecovery,
  simulateSelectorGain,
} from "./offlineEval";

describe("offline eval helpers", () => {
  it("pearson is 1 for a perfect positive linear relation and 0 for flat", () => {
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 12);
    expect(pearson([1, 2, 3], [5, 5, 5])).toBe(0);
  });
  it("rmse is 0 for identical series", () => {
    expect(rmse([1, 2, 3], [1, 2, 3])).toBe(0);
  });
});

describe("IRT (2PL) ability recovery", () => {
  it("recovers known abilities with high correlation and low RMSE", () => {
    const r = simulateIrtRecovery({ seed: 42 });
    expect(r.correlation).toBeGreaterThan(0.9);
    expect(r.rmse).toBeLessThan(0.6);
  });
});

describe("Glicko item-difficulty recovery", () => {
  it("recovers the true difficulty ordering with high correlation", () => {
    const r = simulateGlickoRecovery({ seed: 7 });
    expect(r.correlation).toBeGreaterThan(0.9);
  });
});

describe("selector learning gain (Thompson ZPD vs baselines)", () => {
  it("Thompson-ZPD beats the random baseline by a wide margin", () => {
    const r = simulateSelectorGain({ seed: 99 });
    expect(r.thompsonZpdGain).toBeGreaterThan(r.randomGain);
    // A comfortable margin over the random/ZPDES baseline (deterministic seed).
    expect(r.thompsonZpdGain).toBeGreaterThan(r.randomGain * 1.4);
  });

  it("Thompson-ZPD also outlearns greedy exploitation (mastery objective)", () => {
    const r = simulateSelectorGain({ seed: 99 });
    expect(r.thompsonZpdGain).toBeGreaterThan(r.thompsonMasteryGain);
  });

  it("the advantage is stable across independent seeds", () => {
    for (const seed of [1, 17, 123, 2024]) {
      const r = simulateSelectorGain({ seed });
      expect(r.thompsonZpdGain).toBeGreaterThan(r.randomGain);
    }
  });
});

describe("runOfflineEval", () => {
  it("bundles all three evaluations", () => {
    const report = runOfflineEval();
    expect(report.irt.correlation).toBeGreaterThan(0.9);
    expect(report.glicko.correlation).toBeGreaterThan(0.9);
    expect(report.selector.thompsonZpdGain).toBeGreaterThan(
      report.selector.randomGain,
    );
  });
});

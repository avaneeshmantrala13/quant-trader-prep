import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import type { RevealInfo } from "./types";
import {
  diceBinaryScenario,
  diceQuantityScenario,
  probSumOver,
} from "./scenarios/dice";

describe("probSumOver", () => {
  it("matches hand-computed tail probabilities", () => {
    // one die > 3: faces 4,5,6 → 3/6
    expect(probSumOver(1, 3)).toBeCloseTo(0.5, 12);
    // two dice > 7: sums 8..12 = 5+4+3+2+1 = 15 of 36
    expect(probSumOver(2, 7)).toBeCloseTo(15 / 36, 12);
  });

  it("is 1 below the minimum sum and 0 at/above the maximum", () => {
    expect(probSumOver(2, 1)).toBeCloseTo(1, 12); // min sum is 2
    expect(probSumOver(2, 12)).toBeCloseTo(0, 12); // max sum is 12
    expect(probSumOver(3, 2)).toBeCloseTo(1, 12); // min sum is 3
  });

  it("reconstructs a pmf that sums to 1 over the full range", () => {
    const m = 3;
    let total = 0;
    for (let s = m; s <= 6 * m; s++) {
      const pmf = probSumOver(m, s - 1) - probSumOver(m, s);
      expect(pmf).toBeGreaterThanOrEqual(0);
      total += pmf;
    }
    expect(total).toBeCloseTo(1, 12);
  });

  it("handles the m=0 edge (empty sum is exactly 0)", () => {
    expect(probSumOver(0, -1)).toBe(1); // 0 > -1
    expect(probSumOver(0, 0)).toBe(0); // 0 > 0 is false
  });
});

describe("diceQuantityScenario", () => {
  const n = 6;
  const scenario = diceQuantityScenario(n);
  const rng = new Rng(20240607);
  const truth = scenario.drawTruth(rng);
  const reveals: RevealInfo[] = Array.from({ length: n }, (_, i) =>
    scenario.reveal(truth, i, rng),
  );

  it("fair is an EXACT martingale over the next die at every prefix", () => {
    for (let k = 0; k < n; k++) {
      const prefix = reveals.slice(0, k);
      const fairNow = scenario.fair(truth, prefix);
      let acc = 0;
      for (let face = 1; face <= 6; face++) {
        const next: RevealInfo = { round: k, label: "", value: face };
        acc += scenario.fair(truth, [...prefix, next]);
      }
      expect(acc / 6).toBeCloseTo(fairNow, 9);
    }
  });

  it("settle equals the sum of the rolls", () => {
    const expected = truth.rolls.reduce((s, x) => s + x, 0);
    expect(scenario.settle(truth)).toBe(expected);
  });

  it("posterior sd strictly decreases to exactly 0 at full reveal", () => {
    let prev = Infinity;
    for (let k = 0; k <= n; k++) {
      const sd = scenario.posterior(truth, reveals.slice(0, k)).sd;
      expect(sd).toBeLessThan(prev);
      prev = sd;
    }
    expect(scenario.posterior(truth, reveals).sd).toBe(0);
  });
});

describe("diceBinaryScenario", () => {
  const n = 7;
  const scenario = diceBinaryScenario(n);
  const rng = new Rng(88);
  const truth = scenario.drawTruth(rng);
  const reveals: RevealInfo[] = Array.from({ length: n }, (_, i) =>
    scenario.reveal(truth, i, rng),
  );

  it("settle is 0/1 and equals (total > line)", () => {
    const total = truth.rolls.reduce((s, x) => s + x, 0);
    const settle = scenario.settle(truth);
    expect(settle === 0 || settle === 1).toBe(true);
    expect(settle).toBe(total > truth.line ? 1 : 0);
  });

  it("fair stays in [0,1] across all prefixes", () => {
    for (let k = 0; k <= n; k++) {
      const p = scenario.fair(truth, reveals.slice(0, k));
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });

  it("fair at full reveal equals settle", () => {
    expect(scenario.fair(truth, reveals)).toBe(scenario.settle(truth));
  });
});

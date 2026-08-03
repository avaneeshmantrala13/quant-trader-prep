import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import { FERMI_ITEMS } from "@/content/fermi/items";
import { fermiScenario } from "./scenarios/fermi";
import type { RevealInfo } from "./types";

const item = FERMI_ITEMS.find(
  (it) => it.factors.length >= 3 && it.factors.length <= 6,
);

describe("fermiScenario", () => {
  it("has a tractable item to test", () => {
    expect(item).toBeDefined();
  });

  const scenario = fermiScenario(item!);
  const K = item!.factors.length;

  it("settle is a positive product and rounds match the factor count", () => {
    const truth = scenario.drawTruth(new Rng(5));
    expect(scenario.settle(truth)).toBeGreaterThan(0);
    expect(scenario.rounds).toBe(K);
  });

  it("fair at full reveal equals settle", () => {
    const truth = scenario.drawTruth(new Rng(9));
    const reveals: RevealInfo[] = Array.from({ length: K }, (_, i) =>
      scenario.reveal(truth, i, new Rng(0)),
    );
    expect(scenario.fair(truth, reveals)).toBeCloseTo(scenario.settle(truth), 9);
  });

  it("fair is a martingale in expectation (Monte Carlo over many seeds)", () => {
    const N = 2000;
    const sums = new Array(K + 1).fill(0);
    for (let seed = 0; seed < N; seed++) {
      const rng = new Rng(seed * 7 + 1);
      const truth = scenario.drawTruth(rng);
      const reveals: RevealInfo[] = Array.from({ length: K }, (_, i) =>
        scenario.reveal(truth, i, rng),
      );
      for (let k = 0; k <= K; k++) {
        sums[k] += scenario.fair(truth, reveals.slice(0, k));
      }
    }
    const means = sums.map((x) => x / N);
    for (let k = 0; k < K; k++) {
      const rel = Math.abs(means[k + 1] - means[k]) / Math.abs(means[k]);
      expect(rel).toBeLessThan(0.1);
    }
  });
});

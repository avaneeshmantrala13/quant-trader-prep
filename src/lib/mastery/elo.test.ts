import { describe, expect, it } from "vitest";
import {
  learningRateK,
  predictSuccess,
  seedTierDifficulty,
  sigmoid,
  updateElo,
} from "./elo";
import { TIER_FREEZE_N } from "./config";
import type { Difficulty } from "@/types/content";

describe("sigmoid", () => {
  it("σ(0) = 0.5 and is symmetric", () => {
    expect(sigmoid(0)).toBeCloseTo(0.5, 12);
    expect(sigmoid(2) + sigmoid(-2)).toBeCloseTo(1, 12);
  });
});

describe("predictSuccess (guessing-corrected, Pelánek 2016)", () => {
  it("MCQ k=4 at θ=d=0 → 1/4 + 3/4·0.5 = 0.625", () => {
    expect(predictSuccess(0, 0, 4)).toBeCloseTo(0.625, 12);
  });

  it("numeric / no-guess at θ=d=0 → 0.5", () => {
    expect(predictSuccess(0, 0)).toBeCloseTo(0.5, 12);
    expect(predictSuccess(0, 0, 0)).toBeCloseTo(0.5, 12);
  });

  it("rises with skill above difficulty", () => {
    expect(predictSuccess(2, 0)).toBeGreaterThan(predictSuccess(0, 0));
    expect(predictSuccess(0, 2, 4)).toBeGreaterThanOrEqual(0.25);
  });
});

describe("learningRateK (uncertainty function)", () => {
  it("K(0) = 1 and K(20) = 1/2", () => {
    expect(learningRateK(0)).toBeCloseTo(1, 12);
    expect(learningRateK(20)).toBeCloseTo(0.5, 12);
  });

  it("decreases monotonically in n", () => {
    expect(learningRateK(1)).toBeGreaterThan(learningRateK(5));
    expect(learningRateK(5)).toBeGreaterThan(learningRateK(50));
  });
});

describe("updateElo", () => {
  it("raises θ on correct, lowers on wrong; d moves opposite", () => {
    const correct = updateElo({ theta: 0, d: 0, y: 1, kOptions: 4, n: 0, dExposures: 0 });
    expect(correct.theta).toBeGreaterThan(0);
    expect(correct.d).toBeLessThan(0); // d += Kd·(P − y), y=1 ⇒ negative

    const wrong = updateElo({ theta: 0, d: 0, y: 0, kOptions: 4, n: 0, dExposures: 0 });
    expect(wrong.theta).toBeLessThan(0);
    expect(wrong.d).toBeGreaterThan(0);
  });

  it("freezes d once exposures ≥ TIER_FREEZE_N", () => {
    const frozen = updateElo({
      theta: 0,
      d: 0.5,
      y: 1,
      kOptions: 4,
      n: 0,
      dExposures: TIER_FREEZE_N,
    });
    expect(frozen.d).toBe(0.5); // unchanged
    expect(frozen.theta).not.toBe(0); // θ still updates
  });
});

describe("seedTierDifficulty", () => {
  it("is monotone increasing across the tier ladder", () => {
    const order: Difficulty[] = ["intro", "easy", "medium", "hard", "expert"];
    const seeds = order.map(seedTierDifficulty);
    for (let i = 1; i < seeds.length; i++) {
      expect(seeds[i]).toBeGreaterThan(seeds[i - 1]);
    }
    expect(seedTierDifficulty("intro")).toBe(-1.5);
    expect(seedTierDifficulty("expert")).toBe(2.5);
  });
});

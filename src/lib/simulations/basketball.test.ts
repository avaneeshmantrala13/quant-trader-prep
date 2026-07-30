import { describe, expect, it } from "vitest";
import Fraction from "fraction.js";
import {
  DEFAULT_BASKETBALL_CONFIG,
  fairEnteringRound,
  meanPointsPerRound,
  runBasketball,
  type BasketballConfig,
} from "./basketball";
import type { MakerPolicy } from "./liveMarket";

const CFG: BasketballConfig = {
  rounds: 60,
  minPts: 0,
  maxPts: 4,
  noiseProb: 0.85,
  noiseMaxHalf: 3,
  benchPolicy: { halfSpread: 2, skew: 0.25 },
};

describe("meanPointsPerRound / fairEnteringRound (exact rationals)", () => {
  it("computes the exact half-integer mean", () => {
    expect(meanPointsPerRound({ ...CFG, minPts: 1, maxPts: 2 })).toEqual(
      new Fraction(3, 2),
    );
    expect(meanPointsPerRound(CFG).valueOf()).toBe(2);
  });

  it("fair entering round 0 is meanPoints × rounds when nothing is scored", () => {
    // 60 rounds × mean 2 = 120 expected final total, exactly.
    expect(fairEnteringRound(0, 0, CFG).equals(120)).toBe(true);
  });

  it("fair = knownScore + remaining × mean, exactly", () => {
    // Entering round 10 with 30 points on the board: 30 + (60−10)·2 = 130.
    expect(fairEnteringRound(30, 10, CFG).equals(130)).toBe(true);
    // With a half-integer mean the expected remaining stays exact.
    const half = { ...CFG, minPts: 1, maxPts: 2 };
    // 5 + (60−2)·1.5 = 5 + 87 = 92.
    expect(fairEnteringRound(5, 2, half).equals(92)).toBe(true);
  });
});

describe("runBasketball", () => {
  const goodPolicy: MakerPolicy = { halfSpread: 2, skew: 0.25 };

  it("returns full-length, consistent series", () => {
    const res = runBasketball(goodPolicy, 1, CFG);
    expect(res.rounds).toBe(CFG.rounds);
    expect(res.userPnl).toHaveLength(CFG.rounds);
    expect(res.benchPnl).toHaveLength(CFG.rounds);
    expect(res.userInventory).toHaveLength(CFG.rounds);
    expect(res.scorePath).toHaveLength(CFG.rounds);
    expect(res.fairPath).toHaveLength(CFG.rounds);
    // The realized final total is the last cumulative score.
    expect(res.finalTotal).toBe(res.scorePath[CFG.rounds - 1]);
    // Fair value entering the last round = knownScore + 1 possession's mean.
    const knownBeforeLast = res.scorePath[CFG.rounds - 2];
    expect(res.fairPath[CFG.rounds - 1]).toBeCloseTo(knownBeforeLast + 2, 9);
  });

  it("is deterministic given the seed", () => {
    expect(runBasketball(goodPolicy, 42, CFG)).toEqual(
      runBasketball(goodPolicy, 42, CFG),
    );
  });

  it("scores the benchmark policy identically to itself", () => {
    // Running the benchmark's own policy must reproduce the benchmark curve.
    const res = runBasketball(CFG.benchPolicy, 7, CFG);
    expect(res.userPnl).toEqual(res.benchPnl);
    expect(res.userFinal).toBe(res.benchFinal);
  });

  it("a badly-mispriced quote is picked off every round and loses", () => {
    // A huge negative bias forces ask far below fair ⇒ informed lifts it always.
    const badPolicy: MakerPolicy = { halfSpread: 1, skew: 0, bias: -20 };
    const res = runBasketball(badPolicy, 3, CFG);
    expect(res.pickedOff).toBe(res.rounds);
    expect(res.fills).toBe(res.rounds);
    expect(res.userFinal).toBeLessThan(0);
    // And it should trail the (profitable) benchmark badly.
    expect(res.userFinal).toBeLessThan(res.benchFinal);
  });

  it("a competitive straddling quote is never adversely picked off", () => {
    // half 2, no skew, no bias ⇒ the quote always straddles fair.
    const res = runBasketball({ halfSpread: 2, skew: 0 }, 9, CFG);
    expect(res.pickedOff).toBe(0);
  });

  it("the benchmark desk makes money on the default config", () => {
    const res = runBasketball(DEFAULT_BASKETBALL_CONFIG.benchPolicy, 5);
    expect(res.benchFinal).toBeGreaterThan(0);
  });

  it("max drawdown is non-negative", () => {
    const res = runBasketball(goodPolicy, 15, CFG);
    expect(res.userMaxDrawdown).toBeGreaterThanOrEqual(0);
  });
});

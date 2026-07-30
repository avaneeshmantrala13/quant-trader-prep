import { describe, expect, it } from "vitest";
import {
  DEFAULT_ETF_CONFIG,
  nav,
  runEtfChallenge,
  type EtfConfig,
} from "./etfChallenge";
import type { MakerPolicy } from "./liveMarket";

const CFG: EtfConfig = {
  components: 3,
  rounds: 120,
  startPrice: 50,
  tickSize: 1,
  moveProb: 0.8,
  shares: [1, 1, 1],
  noiseProb: 0.85,
  noiseMaxHalf: 3.5,
  benchPolicy: { halfSpread: 2, skew: 0.3 },
};

describe("nav", () => {
  it("is the exact integer weighted sum of component prices", () => {
    expect(nav([50, 60, 40], [1, 1, 1])).toBe(150);
    expect(nav([10, 20, 30], [3, 2, 1])).toBe(30 + 40 + 30); // 100
  });
});

describe("runEtfChallenge", () => {
  const goodPolicy: MakerPolicy = { halfSpread: 2, skew: 0.3 };

  it("returns full-length, consistent series", () => {
    const res = runEtfChallenge(goodPolicy, 1, CFG);
    expect(res.rounds).toBe(CFG.rounds);
    expect(res.userPnl).toHaveLength(CFG.rounds);
    expect(res.benchPnl).toHaveLength(CFG.rounds);
    expect(res.navSeen).toHaveLength(CFG.rounds);
    expect(res.navFill).toHaveLength(CFG.rounds);
    expect(res.userInventory).toHaveLength(CFG.rounds);
    // Each round's fill NAV is the next round's seen NAV (a shared path).
    for (let r = 0; r < CFG.rounds - 1; r++) {
      expect(res.navFill[r]).toBe(res.navSeen[r + 1]);
    }
    // NAV starts at Σ shares · startPrice.
    expect(res.navSeen[0]).toBe(150);
  });

  it("is deterministic given the seed", () => {
    expect(runEtfChallenge(goodPolicy, 42, CFG)).toEqual(
      runEtfChallenge(goodPolicy, 42, CFG),
    );
  });

  it("scores the benchmark policy identically to itself", () => {
    const res = runEtfChallenge(CFG.benchPolicy, 7, CFG);
    expect(res.userPnl).toEqual(res.benchPnl);
    expect(res.userFinal).toBe(res.benchFinal);
  });

  it("a zero-spread quote is arbitraged by the NAV move and loses vs the desk", () => {
    // With no spread the post-move NAV almost always crosses the quote.
    const tight: MakerPolicy = { halfSpread: 0, skew: 0 };
    const res = runEtfChallenge(tight, 3, CFG);
    expect(res.pickedOff).toBeGreaterThan(0);
    expect(res.userFinal).toBeLessThan(res.benchFinal);
  });

  it("a spread that covers the NAV move is picked off far less than a tight one", () => {
    const wide = runEtfChallenge({ halfSpread: 3, skew: 0.3 }, 3, CFG);
    const tight = runEtfChallenge({ halfSpread: 0, skew: 0 }, 3, CFG);
    expect(wide.pickedOff).toBeLessThan(tight.pickedOff);
  });

  it("the benchmark desk is profitable on average across seeds", () => {
    let sum = 0;
    const seeds = 40;
    for (let s = 1; s <= seeds; s++) {
      sum += runEtfChallenge(goodPolicy, s, DEFAULT_ETF_CONFIG).benchFinal;
    }
    expect(sum / seeds).toBeGreaterThan(0);
  });

  it("max drawdown is non-negative", () => {
    const res = runEtfChallenge(goodPolicy, 15, CFG);
    expect(res.userMaxDrawdown).toBeGreaterThanOrEqual(0);
  });
});

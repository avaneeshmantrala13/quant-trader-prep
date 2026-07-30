import { describe, expect, it } from "vitest";
import Fraction from "fraction.js";
import {
  DEFAULT_MARBLE_CONFIG,
  bookIsArbitrageFree,
  runMarbleOlympics,
  trueProbabilities,
  type MarbleConfig,
  type MarblePolicy,
} from "./marbleOlympics";

const CFG: MarbleConfig = {
  marbles: 4,
  rounds: 150,
  noiseProb: 0.9,
  noiseMaxHalf: 0.08,
  estNoise: 0.05,
  benchHalf: 0.04,
};

describe("trueProbabilities", () => {
  it("returns one exact rational per marble summing to exactly 1", () => {
    const p = trueProbabilities(CFG, 1);
    expect(p).toHaveLength(CFG.marbles);
    const sum = p.reduce((a, b) => a.add(b), new Fraction(0));
    expect(sum.equals(1)).toBe(true);
    for (const x of p) expect(x.valueOf()).toBeGreaterThan(0);
  });

  it("is deterministic given the seed", () => {
    const a = trueProbabilities(CFG, 9).map((f) => f.toFraction());
    const b = trueProbabilities(CFG, 9).map((f) => f.toFraction());
    expect(a).toEqual(b);
  });
});

describe("bookIsArbitrageFree", () => {
  it("accepts a book with Σask ≥ 1 and Σbid ≤ 1", () => {
    expect(bookIsArbitrageFree([0.45, 0.45], [0.55, 0.55])).toBe(true);
  });

  it("rejects a Dutch book on the ask side (Σask < 1)", () => {
    // Buy both winner contracts for 0.6, collect a guaranteed 1.
    expect(bookIsArbitrageFree([0.2, 0.2], [0.3, 0.3])).toBe(false);
  });

  it("rejects a Dutch book on the bid side (Σbid > 1)", () => {
    // Sell both to the maker for 1.2, they only owe a guaranteed 1.
    expect(bookIsArbitrageFree([0.6, 0.6], [0.7, 0.7])).toBe(false);
  });
});

describe("runMarbleOlympics", () => {
  const normPolicy: MarblePolicy = { halfSpread: 0.04, normalize: true };

  it("returns consistent series and valid probabilities", () => {
    const res = runMarbleOlympics(normPolicy, 2, CFG);
    expect(res.rounds).toBe(CFG.rounds);
    expect(res.userPnl).toHaveLength(CFG.rounds);
    expect(res.benchPnl).toHaveLength(CFG.rounds);
    expect(res.trueProbs).toHaveLength(CFG.marbles);
    expect(res.trueProbs.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
  });

  it("is deterministic given the seed", () => {
    expect(runMarbleOlympics(normPolicy, 42, CFG)).toEqual(
      runMarbleOlympics(normPolicy, 42, CFG),
    );
  });

  it("a NORMALIZED book never leaks a Dutch book, for any spread", () => {
    for (const halfSpread of [0, 0.01, 0.05, 0.1]) {
      const res = runMarbleOlympics({ halfSpread, normalize: true }, 5, CFG);
      expect(res.bookLeaks).toBe(0);
    }
  });

  it("a tight, UN-normalized book leaks Dutch books and trails the desk", () => {
    const leaky = runMarbleOlympics(
      { halfSpread: 0, normalize: false },
      5,
      CFG,
    );
    expect(leaky.bookLeaks).toBeGreaterThan(0);
    const bench = runMarbleOlympics({ halfSpread: 0, normalize: false }, 5, CFG)
      .benchFinal;
    expect(leaky.userFinal).toBeLessThan(bench);
  });

  it("the arbitrage-free benchmark book has a positive edge on average", () => {
    // Winner-market settlement is high-variance per race, so the vig edge is a
    // statistical claim: average the benchmark's final P&L over many seeds.
    let sum = 0;
    const seeds = 60;
    for (let s = 1; s <= seeds; s++) {
      sum += runMarbleOlympics(normPolicy, s, DEFAULT_MARBLE_CONFIG).benchFinal;
    }
    expect(sum / seeds).toBeGreaterThan(0);
  });

  it("max drawdown is non-negative", () => {
    const res = runMarbleOlympics(normPolicy, 8, CFG);
    expect(res.userMaxDrawdown).toBeGreaterThanOrEqual(0);
  });
});

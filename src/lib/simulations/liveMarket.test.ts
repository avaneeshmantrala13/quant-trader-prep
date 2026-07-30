import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import {
  cumulativeSum,
  drawNoise,
  gradeVsBenchmark,
  makerQuote,
  maxDrawdown,
  resolveFill,
  type Quote,
} from "./liveMarket";

describe("makerQuote", () => {
  it("centers on fair with a symmetric spread when flat and unbiased", () => {
    const q = makerQuote(100, 0, { halfSpread: 2, skew: 0 });
    expect(q).toEqual({ bid: 98, ask: 102 });
  });

  it("skews both quotes DOWN when long inventory (to shed the position)", () => {
    const q = makerQuote(100, 3, { halfSpread: 2, skew: 1 });
    // center = 100 − 1·3 = 97
    expect(q).toEqual({ bid: 95, ask: 99 });
  });

  it("skews both quotes UP when short inventory", () => {
    const q = makerQuote(100, -2, { halfSpread: 1, skew: 0.5 });
    // center = 100 − 0.5·(−2) = 101
    expect(q).toEqual({ bid: 100, ask: 102 });
  });

  it("applies an explicit fair-value bias", () => {
    const q = makerQuote(50, 0, { halfSpread: 1, skew: 0, bias: 5 });
    expect(q).toEqual({ bid: 54, ask: 56 });
  });
});

describe("resolveFill", () => {
  const noiseBuys = { trades: true, buys: true };
  const noiseSells = { trades: true, buys: false };
  const noNoise = { trades: false, buys: false };

  it("is picked off (sells too cheap) when ask < fair", () => {
    const q: Quote = { bid: 90, ask: 99 };
    const f = resolveFill(q, 100, noNoise, 5);
    expect(f).toEqual({ side: "userSells", price: 99, adverse: true });
  });

  it("is picked off (buys too rich) when bid > fair", () => {
    const q: Quote = { bid: 101, ask: 110 };
    const f = resolveFill(q, 100, noNoise, 5);
    expect(f).toEqual({ side: "userBuys", price: 101, adverse: true });
  });

  it("captures noise flow (not adverse) when the quote straddles fair", () => {
    const q: Quote = { bid: 98, ask: 102 };
    expect(resolveFill(q, 100, noiseBuys, 5)).toEqual({
      side: "userSells",
      price: 102,
      adverse: false,
    });
    expect(resolveFill(q, 100, noiseSells, 5)).toEqual({
      side: "userBuys",
      price: 98,
      adverse: false,
    });
  });

  it("wins no flow when the quote is wider than the competitive band", () => {
    const q: Quote = { bid: 90, ask: 110 };
    // 10 away from fair on each side, band is only 5.
    expect(resolveFill(q, 100, noiseBuys, 5).side).toBe("none");
    expect(resolveFill(q, 100, noiseSells, 5).side).toBe("none");
  });

  it("does not trade when there is no noise and the quote straddles fair", () => {
    const q: Quote = { bid: 98, ask: 102 };
    expect(resolveFill(q, 100, noNoise, 5).side).toBe("none");
  });

  it("informed pick-off takes precedence over the noise band width", () => {
    // ask far below fair ⇒ always picked off regardless of noise band.
    const q: Quote = { bid: 80, ask: 90 };
    expect(resolveFill(q, 100, noNoise, 0.5)).toEqual({
      side: "userSells",
      price: 90,
      adverse: true,
    });
  });
});

describe("drawNoise", () => {
  it("is deterministic for a seed and honors the trade probability", () => {
    const a = new Rng(11);
    const b = new Rng(11);
    for (let i = 0; i < 50; i++) {
      expect(drawNoise(a, 0.5)).toEqual(drawNoise(b, 0.5));
    }
    // Never trades at p=0, always trades at p=1.
    const z = new Rng(3);
    for (let i = 0; i < 20; i++) expect(drawNoise(z, 0).trades).toBe(false);
    const o = new Rng(3);
    for (let i = 0; i < 20; i++) expect(drawNoise(o, 1).trades).toBe(true);
  });
});

describe("cumulativeSum", () => {
  it("accumulates and handles the empty case", () => {
    expect(cumulativeSum([])).toEqual([]);
    expect(cumulativeSum([1, 2, 3, -1])).toEqual([1, 3, 6, 5]);
  });
});

describe("maxDrawdown", () => {
  it("is 0 for a monotonically rising curve", () => {
    expect(maxDrawdown([0, 1, 2, 5, 9])).toBe(0);
  });

  it("measures the largest peak-to-trough drop", () => {
    // peak 10 → trough 3 ⇒ drawdown 7 (larger than the later 8→6 drop of 2).
    expect(maxDrawdown([0, 10, 3, 8, 6])).toBe(7);
  });

  it("works when equity goes negative", () => {
    expect(maxDrawdown([5, -3, -1])).toBe(8);
  });

  it("is 0 for empty input", () => {
    expect(maxDrawdown([])).toBe(0);
  });
});

describe("gradeVsBenchmark", () => {
  it("flags a losing run regardless of the benchmark", () => {
    const g = gradeVsBenchmark(-5, 10);
    expect(g.delta).toBe(-15);
    expect(g.label).toMatch(/picked off/i);
  });

  it("credits beating the desk", () => {
    const g = gradeVsBenchmark(20, 12);
    expect(g.delta).toBe(8);
    expect(g.pct).toBeCloseTo((20 / 12) * 100, 6);
    expect(g.label).toMatch(/beat the desk/i);
  });

  it("reports the captured share of benchmark profit when behind", () => {
    expect(gradeVsBenchmark(8, 10).pct).toBeCloseTo(80, 6);
    expect(gradeVsBenchmark(8, 10).label).toMatch(/matched the desk/i);
    expect(gradeVsBenchmark(5, 10).label).toMatch(/leaking edge/i);
    expect(gradeVsBenchmark(2, 10).label).toMatch(/behind the desk/i);
  });
});

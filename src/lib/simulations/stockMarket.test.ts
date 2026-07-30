import { describe, expect, it } from "vitest";
import {
  BEAR,
  BULL,
  bucketize,
  expectedActionPnL,
  expectedFinalPrice,
  overallDrift,
  positionOf,
  recommendedAction,
  regimeStationary,
  regimeTransition,
  simulateFinalPnLs,
  simulatePricePath,
  simulateRegimePath,
  stepDrift,
  type RegimeModel,
} from "./stockMarket";
import { mean } from "./shared";

describe("stepDrift / expected value", () => {
  it("is tick·(2p − 1): positive edge up, negative edge down, zero at fair", () => {
    expect(stepDrift(0.6, 1)).toBeCloseTo(0.2, 12);
    expect(stepDrift(0.4, 1)).toBeCloseTo(-0.2, 12);
    expect(stepDrift(0.5, 5)).toBeCloseTo(0, 12);
    expect(stepDrift(0.55, 2)).toBeCloseTo(0.2, 12);
  });

  it("expectedFinalPrice = S0 + steps·drift", () => {
    expect(expectedFinalPrice(100, 0.6, 1, 50)).toBeCloseTo(110, 12);
    expect(expectedFinalPrice(100, 0.4, 1, 50)).toBeCloseTo(90, 12);
    expect(expectedFinalPrice(100, 0.5, 1, 50)).toBeCloseTo(100, 12);
  });
});

describe("positionOf / expectedActionPnL", () => {
  it("maps actions to signed positions", () => {
    expect(positionOf("buy")).toBe(1);
    expect(positionOf("sell")).toBe(-1);
    expect(positionOf("hold")).toBe(0);
  });

  it("buy earns the drift, short earns its negation, hold earns 0", () => {
    const [p, tick, steps] = [0.6, 1, 40];
    const drift = stepDrift(p, tick) * steps;
    expect(expectedActionPnL("buy", p, tick, steps)).toBeCloseTo(drift, 12);
    expect(expectedActionPnL("sell", p, tick, steps)).toBeCloseTo(-drift, 12);
    expect(expectedActionPnL("hold", p, tick, steps)).toBe(0);
  });
});

describe("recommendedAction", () => {
  it("buy when p>0.5, sell when p<0.5, hold at a fair coin", () => {
    expect(recommendedAction(0.6, 1)).toBe("buy");
    expect(recommendedAction(0.4, 1)).toBe("sell");
    expect(recommendedAction(0.5, 1)).toBe("hold");
  });
});

describe("simulatePricePath", () => {
  it("starts at S0, has length steps+1, and only moves ±tick", () => {
    const path = simulatePricePath(100, 0.55, 2, 30, 7);
    expect(path).toHaveLength(31);
    expect(path[0]).toBe(100);
    for (let i = 1; i < path.length; i++) {
      expect(Math.abs(path[i] - path[i - 1])).toBeCloseTo(2, 12);
    }
  });

  it("is deterministic given the seed", () => {
    expect(simulatePricePath(100, 0.55, 1, 50, 3)).toEqual(
      simulatePricePath(100, 0.55, 1, 50, 3),
    );
  });
});

describe("simulateFinalPnLs", () => {
  it("is deterministic given the seed", () => {
    expect(simulateFinalPnLs("buy", 100, 0.55, 1, 40, 500, 9)).toEqual(
      simulateFinalPnLs("buy", 100, 0.55, 1, 40, 500, 9),
    );
  });

  it("mean final P&L → expected action P&L within tolerance at large trials", () => {
    const [action, S0, p, tick, steps] = ["buy", 100, 0.6, 1, 40] as const;
    const pnls = simulateFinalPnLs(action, S0, p, tick, steps, 20000, 17);
    const ev = expectedActionPnL(action, p, tick, steps);
    expect(Math.abs(mean(pnls) - ev)).toBeLessThan(0.4);
  });

  it("shorting a downtrend is +EV on average", () => {
    const pnls = simulateFinalPnLs("sell", 100, 0.4, 1, 40, 20000, 21);
    expect(mean(pnls)).toBeGreaterThan(0);
  });
});

describe("bucketize", () => {
  it("empty input → []", () => {
    expect(bucketize([], 10)).toEqual([]);
  });

  it("all-equal values collapse to one bucket holding everything", () => {
    const b = bucketize([5, 5, 5], 8);
    expect(b).toHaveLength(1);
    expect(b[0].count).toBe(3);
    expect(b[0].center).toBe(5);
  });

  it("partitions the range into `bins` buckets whose counts sum to N", () => {
    const values = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const buckets = bucketize(values, 5);
    expect(buckets).toHaveLength(5);
    const total = buckets.reduce((a, x) => a + x.count, 0);
    expect(total).toBe(values.length);
    // max value lands in the last bucket (inclusive top edge)
    expect(buckets[buckets.length - 1].count).toBeGreaterThan(0);
  });
});

// ---- Bull / Bear regimes (Markov) ----------------------------------------

const MODEL: RegimeModel = {
  pBull: 0.58,
  pBear: 0.42,
  stayBull: 0.9,
  stayBear: 0.8,
  tick: 1,
};

describe("regimeTransition / regimeStationary", () => {
  it("builds a row-stochastic matrix", () => {
    const P = regimeTransition(MODEL);
    expect(P[0][0] + P[0][1]).toBeCloseTo(1, 12);
    expect(P[1][0] + P[1][1]).toBeCloseTo(1, 12);
  });

  it("stationary mix matches the 2-state formula and is normalized", () => {
    const pi = regimeStationary(MODEL);
    // For stay probs a,b: π_bull = (1−b)/((1−a)+(1−b)).
    const a = MODEL.stayBull;
    const b = MODEL.stayBear;
    const expectedBull = (1 - b) / (1 - a + (1 - b));
    expect(pi[BULL]).toBeCloseTo(expectedBull, 6);
    expect(pi[BULL] + pi[BEAR]).toBeCloseTo(1, 10);
  });
});

describe("overallDrift", () => {
  it("equals the stationary-weighted regime drifts", () => {
    const pi = regimeStationary(MODEL);
    const expected =
      pi[BULL] * stepDrift(MODEL.pBull, MODEL.tick) +
      pi[BEAR] * stepDrift(MODEL.pBear, MODEL.tick);
    expect(overallDrift(MODEL)).toBeCloseTo(expected, 12);
  });
});

describe("simulateRegimePath", () => {
  it("starts at S0, path length steps+1, regimes length steps", () => {
    const rp = simulateRegimePath(MODEL, 100, BULL, 200, 4);
    expect(rp.prices[0]).toBe(100);
    expect(rp.prices).toHaveLength(201);
    expect(rp.regimes).toHaveLength(200);
  });

  it("is deterministic given the seed", () => {
    const a = simulateRegimePath(MODEL, 100, BULL, 300, 5);
    const b = simulateRegimePath(MODEL, 100, BULL, 300, 5);
    expect(a.prices).toEqual(b.prices);
    expect(a.regimes).toEqual(b.regimes);
  });

  it("regime occupancy → stationary mix within tolerance at large steps", () => {
    const rp = simulateRegimePath(MODEL, 100, BULL, 40000, 11);
    const pi = regimeStationary(MODEL);
    expect(Math.abs(rp.occupancy[BULL] - pi[BULL])).toBeLessThan(0.03);
    expect(rp.occupancy[BULL] + rp.occupancy[BEAR]).toBeCloseTo(1, 10);
  });
});

import { describe, it, expect } from "vitest";
import { Rng } from "@/lib/rng";
import {
  applesTotal,
  orangesTotal,
  computeValue,
  roundTo10,
  correctAction,
  edge,
  dealMarket,
  scoreTrade,
  decayedRepeat,
  firstClickAccuracy,
  finalScore,
  type Bag,
  type FruitMarket,
  type Quote,
} from "./engine";

const bag = (apples: number, oranges: number): Bag => ({ apples, oranges });

describe("count transforms under each event", () => {
  const a = bag(8, 8);
  const b = bag(9, 8);

  it("no event leaves totals as the plain sums", () => {
    expect(applesTotal(a, b, "none")).toBe(17);
    expect(orangesTotal(a, b, "none")).toBe(16);
  });

  it("apple-inflation doubles the apple total only", () => {
    expect(applesTotal(a, b, "apple-inflation")).toBe(34);
    expect(orangesTotal(a, b, "apple-inflation")).toBe(16);
  });

  it("orange-inflation doubles the orange total only", () => {
    expect(orangesTotal(a, b, "orange-inflation")).toBe(32);
    expect(applesTotal(a, b, "orange-inflation")).toBe(17);
  });

  it("orange-deflation halves the orange total ROUNDED UP (11 → 6)", () => {
    // oranges 3 + 8 = 11 → ceil(5.5) = 6.
    expect(orangesTotal(bag(1, 3), bag(1, 8), "orange-deflation")).toBe(6);
    // even total halves exactly: 16 → 8.
    expect(orangesTotal(a, b, "orange-deflation")).toBe(8);
  });

  it("no-fruit-a zeroes bag A's apples and oranges", () => {
    expect(applesTotal(a, b, "no-fruit-a")).toBe(9); // only bag B apples
    expect(orangesTotal(a, b, "no-fruit-a")).toBe(8); // only bag B oranges
  });

  it("no-fruit-b zeroes bag B's apples and oranges", () => {
    expect(applesTotal(a, b, "no-fruit-b")).toBe(8);
    expect(orangesTotal(a, b, "no-fruit-b")).toBe(8);
  });
});

describe("computeValue — the spec worked example", () => {
  it("apples 8+9=17, oranges 8+8=16 with orange-inflation → raw 544, trueValue 540", () => {
    const { rawValue, trueValue } = computeValue(bag(8, 8), bag(9, 8), "orange-inflation");
    expect(rawValue).toBe(544); // 17 × 32
    expect(trueValue).toBe(540); // 544 rounds to nearest 10
  });

  it("no-fruit zeroing a bag drives the value to 0", () => {
    // Zero bag A → apples 5, oranges 0 → product 0.
    const { rawValue, trueValue } = computeValue(bag(3, 4), bag(5, 0), "no-fruit-a");
    // orangesTotal = 0 (bagB oranges 0), so product 0 regardless of apples.
    expect(rawValue).toBe(0);
    expect(trueValue).toBe(0);
  });

  it("no-fruit-a with orange-bearing B still multiplies remaining fruit", () => {
    // Zero bag A → apples 5, oranges 7 → 35 → rounds to 40.
    const { rawValue, trueValue } = computeValue(bag(3, 4), bag(5, 7), "no-fruit-a");
    expect(rawValue).toBe(35);
    expect(trueValue).toBe(40);
  });
});

describe("roundTo10", () => {
  it("rounds to the nearest 10 with ties going up", () => {
    expect(roundTo10(544)).toBe(540);
    expect(roundTo10(545)).toBe(550);
    expect(roundTo10(11)).toBe(10);
    expect(roundTo10(0)).toBe(0);
    expect(roundTo10(4)).toBe(0);
    expect(roundTo10(5)).toBe(10);
  });
});

describe("correctAction", () => {
  const quote: Quote = { bid: 100, ask: 110 };

  it("buys when trueValue is above the ask", () => {
    expect(correctAction(120, quote)).toBe("buy");
  });

  it("sells when trueValue is below the bid", () => {
    expect(correctAction(90, quote)).toBe("sell");
  });

  it("skips when trueValue sits inside (inclusive) the quote", () => {
    expect(correctAction(105, quote)).toBe("skip");
    expect(correctAction(100, quote)).toBe("skip"); // == bid
    expect(correctAction(110, quote)).toBe("skip"); // == ask
  });
});

describe("edge signs", () => {
  const quote: Quote = { bid: 100, ask: 110 };

  it("correct buy edge = trueValue − ask (positive)", () => {
    expect(edge(120, quote, "buy")).toBe(10);
  });

  it("correct sell edge = bid − trueValue (positive)", () => {
    expect(edge(90, quote, "sell")).toBe(10);
  });

  it("skip edge is always 0", () => {
    expect(edge(105, quote, "skip")).toBe(0);
  });

  it("edge goes negative when the action is the wrong direction", () => {
    // trueValue 90 is below bid, so a BUY has negative edge.
    expect(edge(90, quote, "buy")).toBe(-20); // 90 − 110
  });
});

describe("dealMarket", () => {
  const config = { maxPerBag: 20, eventsEnabled: true };

  it("is deterministic: same seed → identical market", () => {
    const m1 = dealMarket(new Rng(123), config);
    const m2 = dealMarket(new Rng(123), config);
    expect(m1).toEqual(m2);
  });

  it("produces bags within range and an integer bid < ask", () => {
    for (let seed = 0; seed < 50; seed++) {
      const m = dealMarket(new Rng(seed), config);
      for (const b of [m.bagA, m.bagB]) {
        expect(b.apples).toBeGreaterThanOrEqual(1);
        expect(b.apples).toBeLessThanOrEqual(20);
        expect(b.oranges).toBeGreaterThanOrEqual(1);
        expect(b.oranges).toBeLessThanOrEqual(20);
      }
      expect(Number.isInteger(m.quote.bid)).toBe(true);
      expect(Number.isInteger(m.quote.ask)).toBe(true);
      expect(m.quote.bid).toBeLessThan(m.quote.ask);
      expect(m.trueValue).toBe(roundTo10(m.rawValue));
    }
  });

  it("never emits an event when events are disabled", () => {
    for (let seed = 0; seed < 30; seed++) {
      const m = dealMarket(new Rng(seed), { maxPerBag: 20, eventsEnabled: false });
      expect(m.event).toBe("none");
    }
  });

  it("emits some non-none events across seeds when enabled", () => {
    const events = new Set<string>();
    for (let seed = 0; seed < 100; seed++) {
      events.add(dealMarket(new Rng(seed), config).event);
    }
    expect(events.size).toBeGreaterThan(1); // more than just "none"
  });
});

describe("scoreTrade", () => {
  const market: FruitMarket = {
    bagA: bag(1, 1),
    bagB: bag(1, 1),
    event: "none",
    quote: { bid: 100, ask: 110 },
    rawValue: 120,
    trueValue: 120, // above ask → correct action is BUY, edge = 10
  };

  it("early-bird: more time left → higher profit (floor of half the edge)", () => {
    const full = scoreTrade(market, "buy", 1); // edge 10 × 1.0 = 10
    const half = scoreTrade(market, "buy", 0); // edge 10 × 0.5 = 5
    const mid = scoreTrade(market, "buy", 0.5); // edge 10 × 0.75 = 7.5
    expect(full).toBe(10);
    expect(half).toBe(5);
    expect(mid).toBe(7.5);
    expect(full).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(half);
  });

  it("wrong-direction trade costs the FULL edge, negative, no bonus/decay", () => {
    // Correct action is BUY (edge 10). Selling is the wrong direction.
    expect(scoreTrade(market, "sell", 1)).toBe(-10);
    expect(scoreTrade(market, "sell", 0)).toBe(-10);
  });

  it("skipping when a trade was correct forgoes profit but is not a loss (0)", () => {
    expect(scoreTrade(market, "skip", 1)).toBe(0);
  });

  it("a correct skip scores 0", () => {
    const skipMarket: FruitMarket = {
      ...market,
      trueValue: 105, // inside quote → correct action is skip
    };
    expect(scoreTrade(skipMarket, "skip", 1)).toBe(0);
  });

  it("trading when a skip was correct costs the (0) edge → 0", () => {
    const skipMarket: FruitMarket = { ...market, trueValue: 105 };
    // Correct action is skip (edge 0), so a wrong trade loses -|0| = 0.
    expect(scoreTrade(skipMarket, "buy", 1)).toBe(0);
  });
});

describe("decayedRepeat", () => {
  it("each repeat pays 85% of the previous", () => {
    expect(decayedRepeat(100, 0)).toBe(100);
    expect(decayedRepeat(100, 1)).toBe(85);
    expect(decayedRepeat(100, 2)).toBe(72.25);
  });
});

describe("firstClickAccuracy", () => {
  it("is the fraction of markets whose first trade was correct", () => {
    expect(
      firstClickAccuracy([
        { firstActionCorrect: true },
        { firstActionCorrect: false },
        { firstActionCorrect: true },
        { firstActionCorrect: true },
      ]),
    ).toBe(0.75);
    expect(firstClickAccuracy([])).toBe(0);
  });
});

describe("finalScore", () => {
  it("is raw profit × first-click accuracy", () => {
    expect(finalScore(200, 0.75)).toBe(150);
    expect(finalScore(0, 1)).toBe(0);
  });
});

import { describe, it, expect } from "vitest";
import { Rng } from "@/lib/rng";
import {
  cardFaceValue,
  cardEV,
  diceEV,
  productEV,
  productValue,
  productSD,
  sdDelta,
  playerPriceFor,
  realizedPnl,
  scoreRound,
  maxBuy,
  maxSell,
  makeQuote,
  freshDeck,
  dealRound,
  START_BALANCE,
  type Card,
  type GameConfig,
  type Quote,
} from "./engine";

const card = (rank: number): Card => ({ rank, suit: "♠" });

const cfg = (
  numCards: 1 | 2,
  numDice: 1 | 2,
  aceMode: "low" | "high",
): GameConfig => ({ numCards, numDice, aceMode });

describe("card face values + EV", () => {
  it("pips, faces, and ace low/high", () => {
    expect(cardFaceValue(2, "high")).toBe(2);
    expect(cardFaceValue(10, "low")).toBe(10);
    expect(cardFaceValue(11, "high")).toBe(11); // J
    expect(cardFaceValue(12, "low")).toBe(12); // Q
    expect(cardFaceValue(13, "high")).toBe(13); // K
    expect(cardFaceValue(14, "high")).toBe(14); // ace-high
    expect(cardFaceValue(14, "low")).toBe(1); // ace-low
  });

  it("cardEV is 7 low / 8 high", () => {
    expect(cardEV("low")).toBe(7);
    expect(cardEV("high")).toBe(8);
  });

  it("diceEV is 3.5", () => {
    expect(diceEV()).toBe(3.5);
  });
});

describe("productEV combos", () => {
  it("1c1d high = 8 × 3.5 = 28", () => {
    expect(productEV(cfg(1, 1, "high"))).toBeCloseTo(28, 10);
  });
  it("2c1d low = 7 × 7 × 3.5 = 171.5", () => {
    expect(productEV(cfg(2, 1, "low"))).toBeCloseTo(171.5, 10);
  });
  it("2c2d high = 8 × 8 × 3.5 × 3.5 = 784", () => {
    expect(productEV(cfg(2, 2, "high"))).toBeCloseTo(784, 10);
  });
});

describe("productValue worked example", () => {
  it("cards 6,K + dice 2,4 → 6×13×2×4 = 624", () => {
    expect(productValue([card(6), card(13)], [2, 4], "high")).toBe(624);
  });
});

describe("productSD matches official reference σ (MOST IMPORTANT)", () => {
  it("1c1d ace-high ≈ 19.97", () => {
    expect(productSD(cfg(1, 1, "high"))).toBeCloseTo(19.97, 1);
  });
  it("2c1d ace-low ≈ 175.45", () => {
    expect(productSD(cfg(2, 1, "low"))).toBeCloseTo(175.45, 1);
  });
  it("2c2d ace-high ≈ 885.91", () => {
    expect(productSD(cfg(2, 2, "high"))).toBeCloseTo(885.91, 1);
  });
});

describe("sdDelta sign correctness", () => {
  it("adding a die raises SD (positive delta)", () => {
    expect(sdDelta(cfg(2, 1, "high"), cfg(2, 2, "high"))).toBeGreaterThan(0);
  });
  it("removing a card lowers SD (negative delta)", () => {
    expect(sdDelta(cfg(2, 2, "high"), cfg(1, 2, "high"))).toBeLessThan(0);
  });
});

describe("player price + realized P&L", () => {
  it("buy pays ask, sell receives bid", () => {
    const q: Quote = { bid: 33, ask: 37 };
    expect(playerPriceFor("buy", q)).toBe(37);
    expect(playerPriceFor("sell", q)).toBe(33);
  });

  it("buy N: (product − ask)×N", () => {
    // product 45, ask 37, 3 lots → (45−37)×3 = 24
    expect(realizedPnl("buy", 3, { bid: 33, ask: 37 }, 45)).toBe(24);
  });

  it("sell N: (bid − product)×N", () => {
    // product 45, bid 33, 2 lots → (33−45)×2 = −24
    expect(realizedPnl("sell", 2, { bid: 33, ask: 37 }, 45)).toBe(-24);
  });
});

describe("asymmetric scoring (four quadrants)", () => {
  it("correct profit banks +P", () => {
    expect(scoreRound(40, true)).toBe(40);
  });
  it("correct loss takes −L", () => {
    expect(scoreRound(-15, true)).toBe(-15);
  });
  it("incorrect profit earns 0", () => {
    expect(scoreRound(40, false)).toBe(0);
  });
  it("incorrect loss is doubled", () => {
    expect(scoreRound(-15, false)).toBe(-30);
  });
});

describe("order-size limits", () => {
  it("maxBuy = floor(funds / ask)", () => {
    expect(maxBuy(500000, { bid: 30, ask: 33 })).toBe(Math.floor(500000 / 33));
  });

  it("maxSell worked example: 2c2d ace-high, bid 600, 500000 funds → 77", () => {
    // maxProduct = 14×14×6×6 = 7056; loss/lot = 7056 − 600 = 6456; floor(500000/6456)=77
    expect(maxSell(500000, { bid: 600, ask: 640 }, cfg(2, 2, "high"))).toBe(77);
  });
});

describe("makeQuote", () => {
  it("produces integer bid < ask near EV", () => {
    const config = cfg(2, 2, "high");
    for (let seed = 1; seed <= 50; seed++) {
      const q = makeQuote(new Rng(seed), config);
      expect(Number.isInteger(q.bid)).toBe(true);
      expect(Number.isInteger(q.ask)).toBe(true);
      expect(q.ask).toBeGreaterThan(q.bid);
    }
  });

  it("sometimes buy is right and sometimes sell is right", () => {
    const config = cfg(2, 2, "high");
    const ev = productEV(config);
    let buyRight = false;
    let sellRight = false;
    for (let seed = 1; seed <= 100; seed++) {
      const q = makeQuote(new Rng(seed), config);
      if (q.ask < ev) buyRight = true;
      if (q.bid > ev) sellRight = true;
    }
    expect(buyRight).toBe(true);
    expect(sellRight).toBe(true);
  });
});

describe("dealRound determinism + deck depletion", () => {
  it("is deterministic for a fixed seed and deck", () => {
    const config = cfg(2, 1, "high");
    const a = dealRound(new Rng(7), freshDeck(), config);
    const b = dealRound(new Rng(7), freshDeck(), config);
    expect(a.round.product).toBe(b.round.product);
    expect(a.round.dice).toEqual(b.round.dice);
    expect(a.round.quote).toEqual(b.round.quote);
  });

  it("depletes the deck by numCards and rolls dice in 1..6", () => {
    const config = cfg(2, 2, "high");
    const deck = freshDeck();
    const { round, deck: rest } = dealRound(new Rng(3), deck, config);
    expect(round.cards).toHaveLength(2);
    expect(round.dice).toHaveLength(2);
    expect(rest).toHaveLength(deck.length - 2);
    for (const d of round.dice) {
      expect(d).toBeGreaterThanOrEqual(1);
      expect(d).toBeLessThanOrEqual(6);
    }
    // product equals recomputed value from the dealt cards + dice
    expect(round.product).toBe(productValue(round.cards, round.dice, "high"));
  });

  it("consecutive deals draw distinct cards from the running deck", () => {
    const config = cfg(1, 1, "low");
    const rng = new Rng(11);
    let deck = freshDeck();
    const first = dealRound(rng, deck, config);
    deck = first.deck;
    const second = dealRound(rng, deck, config);
    expect(first.deck).toHaveLength(51);
    expect(second.deck).toHaveLength(50);
  });
});

describe("constants", () => {
  it("START_BALANCE is 500000", () => {
    expect(START_BALANCE).toBe(500000);
  });
});

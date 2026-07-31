import { describe, it, expect } from "vitest";
import { Rng } from "@/lib/rng";
import {
  cardValue,
  freshDeck,
  evPerCard,
  sumCards,
  playerEV,
  botEV,
  evUpdateOnReveal,
  validateQuote,
  botReactToPlayerQuote,
  resolvePlayerQuote,
  playerTradesBotQuote,
  settle,
  dealGame,
  revealNext,
  addFills,
  MAX_SPREAD,
  type Card,
  type GameState,
  type Bot,
  type Quote,
} from "./engine";

const c = (rank: number, suit: Card["suit"], value: number): Card => ({ rank, suit, value });

describe("card valuation (number × 10, signed faces)", () => {
  it("number cards are face × 10 regardless of suit", () => {
    expect(cardValue(2, "♠", "high")).toBe(20);
    expect(cardValue(10, "♥", "high")).toBe(100);
  });

  it("red faces positive, black faces negative", () => {
    expect(cardValue(11, "♥", "high")).toBe(110);
    expect(cardValue(13, "♦", "high")).toBe(130);
    expect(cardValue(11, "♠", "high")).toBe(-110);
    expect(cardValue(13, "♣", "high")).toBe(-130);
  });

  it("ace low = +10 both colours; ace high = ±140", () => {
    expect(cardValue(14, "♥", "low")).toBe(10);
    expect(cardValue(14, "♠", "low")).toBe(10);
    expect(cardValue(14, "♥", "high")).toBe(140);
    expect(cardValue(14, "♠", "high")).toBe(-140);
  });
});

describe("deck-level EV", () => {
  it("high mode: faces and aces cancel, numbers drive EV/card ≈ 41.54", () => {
    // Numbers 2..10 ×10 in all 4 suits = 2160; red/black faces cancel; ±140
    // aces cancel. 2160 / 52 ≈ 41.54.
    expect(evPerCard("high")).toBeCloseTo(2160 / 52, 2);
  });

  it("low mode is all-positive number-driven → EV/card ≈ 42.31", () => {
    // Numbers 2160 + aces (4×10=40) → 2200 / 52 ≈ 42.31.
    expect(evPerCard("low")).toBeCloseTo(2200 / 52, 2);
  });

  it("full deck in high mode sums to just the number cards (2160)", () => {
    expect(sumCards(freshDeck("high"))).toBe(2160);
  });
});

describe("EV estimates from partial information", () => {
  const base: GameState = {
    config: { numBots: 3, numRounds: 4, aceMode: "high" },
    playerHand: [c(5, "♥", 50), c(9, "♦", 90)], // +140
    bots: [],
    community: [c(13, "♦", 130), c(10, "♠", 100), c(2, "♠", 20)],
    revealedCount: 0,
    totalCards: 11,
    trueTotal: 0,
    evPerCard: 0,
    fills: [],
    roundIdx: 1,
  };

  it("player EV = own cards + revealed community + unknown × EV/card", () => {
    // High mode EV/card 0 → EV is just the known sum. Nothing revealed → +140.
    expect(playerEV(base)).toBe(140);
  });

  it("revealing a community card shifts EV by its value (EV/card 0)", () => {
    const r1 = { ...base, revealedCount: 1 }; // reveals K♦ +130
    expect(playerEV(r1)).toBe(140 + 130);
  });

  it("evUpdateOnReveal = revealed value − EV/card", () => {
    expect(evUpdateOnReveal(130, 0)).toBe(130);
    expect(evUpdateOnReveal(20, 42.31)).toBeCloseTo(-22.31, 2);
  });

  it("bot EV uses the bot's own hand", () => {
    const bot: Bot = { id: 0, name: "B", hand: [c(13, "♥", 130), c(12, "♥", 120)], aggression: 1 };
    expect(botEV(bot, base)).toBe(250); // +250, EV/card 0, nothing revealed
  });
});

describe("spread cap + validation", () => {
  it("rejects crossed and too-wide quotes", () => {
    expect(validateQuote({ bid: 10, ask: 10, bidSize: 1, askSize: 1 }).ok).toBe(false);
    expect(validateQuote({ bid: 0, ask: MAX_SPREAD + 1, bidSize: 1, askSize: 1 }).ok).toBe(false);
  });

  it("accepts a legal ≤20 market", () => {
    expect(validateQuote({ bid: 100, ask: 118, bidSize: 2, askSize: 2 }).ok).toBe(true);
  });
});

describe("bot reactions to the player's quote", () => {
  const state: GameState = {
    config: { numBots: 1, numRounds: 1, aceMode: "high" },
    playerHand: [],
    bots: [],
    community: [],
    revealedCount: 0,
    totalCards: 11,
    trueTotal: 0,
    evPerCard: 0,
    fills: [],
    roundIdx: 1,
  };
  const bot: Bot = { id: 0, name: "B", hand: [c(13, "♥", 130), c(12, "♥", 120)], aggression: 1 };
  // botEV = 250.

  it("bot lifts an offer priced well below its EV → player goes short", () => {
    const q: Quote = { bid: 200, ask: 210, bidSize: 2, askSize: 2 };
    const t = botReactToPlayerQuote(bot, q, state)!;
    expect(t.side).toBe("sell"); // player sold
    expect(t.price).toBe(210);
  });

  it("bot hits a bid priced well above its EV → player goes long", () => {
    const lowBot: Bot = { ...bot, hand: [c(2, "♠", 20), c(3, "♠", 30)] }; // EV 50
    const q: Quote = { bid: 90, ask: 110, bidSize: 2, askSize: 2 };
    const t = botReactToPlayerQuote(lowBot, q, state)!;
    expect(t.side).toBe("buy"); // player bought
    expect(t.price).toBe(90);
  });

  it("bot passes when the quote straddles its EV", () => {
    const q: Quote = { bid: 245, ask: 255, bidSize: 2, askSize: 2 };
    expect(botReactToPlayerQuote(bot, q, state)).toBeNull();
  });
});

describe("resolvePlayerQuote across multiple bots", () => {
  it("consumes offered size and records fills", () => {
    const highBot: Bot = { id: 0, name: "H", hand: [c(13, "♥", 130), c(12, "♥", 120)], aggression: 5 };
    const state: GameState = {
      config: { numBots: 2, numRounds: 1, aceMode: "high" },
      playerHand: [],
      bots: [highBot, { ...highBot, id: 1, name: "H2" }],
      community: [],
      revealedCount: 0,
      totalCards: 11,
      trueTotal: 0,
      evPerCard: 0,
      fills: [],
      roundIdx: 1,
    };
    const q: Quote = { bid: 100, ask: 150, bidSize: 3, askSize: 3 };
    const { fills } = resolvePlayerQuote(q, state);
    // Both bots want to lift the cheap offer; total sold ≤ askSize 3.
    const sold = fills.filter((f) => f.side === "sell").reduce((a, f) => a + f.size, 0);
    expect(sold).toBeLessThanOrEqual(3);
    expect(sold).toBeGreaterThan(0);
  });
});

describe("player trading a bot's quote", () => {
  it("lifting the ask makes the player long at the ask", () => {
    const f = playerTradesBotQuote({ bid: 100, ask: 120, bidSize: 2, askSize: 2 }, "buy", 2, 1);
    expect(f).toEqual({ side: "buy", price: 120, size: 2, round: 1 });
  });
  it("hitting the bid makes the player short at the bid", () => {
    const f = playerTradesBotQuote({ bid: 100, ask: 120, bidSize: 2, askSize: 2 }, "sell", 1, 2);
    expect(f).toEqual({ side: "sell", price: 100, size: 1, round: 2 });
  });
});

describe("dealGame + reveal + settle", () => {
  it("deals the right number of cards and a consistent true total", () => {
    const g = dealGame(new Rng(7), { numBots: 3, numRounds: 4, aceMode: "high" });
    expect(g.playerHand).toHaveLength(2);
    expect(g.bots).toHaveLength(3);
    expect(g.community).toHaveLength(3);
    expect(g.totalCards).toBe(2 * 4 + 3); // 11
    const all = [g.playerHand, ...g.bots.map((b) => b.hand), g.community].flat();
    expect(sumCards(all)).toBe(g.trueTotal);
  });

  it("revealNext exposes one more community card per round", () => {
    let g = dealGame(new Rng(7), { numBots: 3, numRounds: 4, aceMode: "high" });
    expect(g.revealedCount).toBe(0);
    g = revealNext(g);
    expect(g.revealedCount).toBe(1);
    expect(g.roundIdx).toBe(2);
    g = revealNext(revealNext(revealNext(g)));
    expect(g.revealedCount).toBe(3); // capped at 3
  });

  it("settle marks the net position to the true total and flags two-sided trading", () => {
    let g = dealGame(new Rng(7), { numBots: 3, numRounds: 4, aceMode: "high" });
    g = { ...g, trueTotal: 300 };
    g = addFills(g, [
      { side: "buy", price: 250, size: 2, round: 1 }, // long 2 @ 250 → +100
      { side: "sell", price: 320, size: 1, round: 2 }, // short 1 @ 320 → +20
    ]);
    const s = settle(g);
    expect(s.position).toBe(1); // +2 −1
    // mark: (300−250)·2 + (320−300)·1 = 100 + 20 = 120.
    expect(s.markPnl).toBe(120);
    expect(s.twoSided).toBe(true);
  });

  it("one-way trading is not flagged two-sided", () => {
    let g = dealGame(new Rng(9), { numBots: 2, numRounds: 3, aceMode: "high" });
    g = addFills(g, [{ side: "buy", price: 10, size: 1, round: 1 }]);
    expect(settle(g).twoSided).toBe(false);
  });
});

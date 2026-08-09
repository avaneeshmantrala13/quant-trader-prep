import { describe, it, expect } from "vitest";
import { Rng } from "@/lib/rng";
import {
  cardValue,
  meanCard,
  maxCardValue,
  evSum,
  sumHand,
  analyzeEdge,
  maxBuySize,
  maxSellSize,
  realizedPnl,
  scoreRound,
  payForFirstCard,
  dealRound,
  gradeOutcome,
  conditionalEvSum,
  makeCenteredQuote,
  dealConditionalRound,
  type Card,
  type Quote,
} from "./engine";

const card = (rank: number, value: number): Card => ({ rank, suit: "♠", value });

describe("card values + EV", () => {
  it("J/Q/K = 11/12/13; ace takes its configured value", () => {
    expect(cardValue(11, 14)).toBe(11);
    expect(cardValue(13, 14)).toBe(13);
    expect(cardValue(14, 14)).toBe(14); // ace-high
    expect(cardValue(14, 1)).toBe(1); // ace-low
  });

  it("mean card is 8 ace-high, 7 ace-low", () => {
    expect(meanCard(14)).toBeCloseTo(8, 10);
    expect(meanCard(1)).toBeCloseTo(7, 10);
  });

  it("EV of 3 cards is 24 ace-high, 21 ace-low", () => {
    expect(evSum(3, 14)).toBeCloseTo(24, 10);
    expect(evSum(3, 1)).toBeCloseTo(21, 10);
  });

  it("max card value tracks the ace setting", () => {
    expect(maxCardValue(14)).toBe(14);
    expect(maxCardValue(1)).toBe(13); // king is largest when ace is low
  });

  it("sums a hand", () => {
    expect(sumHand([card(13, 13), card(12, 12), card(9, 9)])).toBe(34);
  });
});

describe("edge analysis", () => {
  it("buying is correct when ask is below EV", () => {
    const q: Quote = { bid: 17, ask: 19 }; // EV 24
    const a = analyzeEdge(q, 24);
    expect(a.correctAction).toBe("buy");
    expect(a.edgePerLot).toBe(5); // 24 − 19
  });

  it("selling is correct when bid is above EV", () => {
    const q: Quote = { bid: 28, ask: 30 }; // EV 24
    const a = analyzeEdge(q, 24);
    expect(a.correctAction).toBe("sell");
    expect(a.edgePerLot).toBe(4); // 28 − 24
  });

  it("no trade when EV sits inside the spread", () => {
    const q: Quote = { bid: 23, ask: 25 }; // EV 24
    expect(analyzeEdge(q, 24).correctAction).toBe("none");
  });
});

describe("order-size limits (official course)", () => {
  it("max buy = floor(funds / ask)", () => {
    expect(maxBuySize(505, 20)).toBe(25);
  });

  it("max sell = floor(funds / worst-case loss per lot)", () => {
    // bid 29, 3 cards, ace-low king=13 → worst sum 39 → loss 10/lot → 50.
    expect(maxSellSize(505, 29, 3, 1)).toBe(50);
  });
});

describe("realized P&L", () => {
  it("bought N @ ask: (sum − ask)×N", () => {
    // R1 from the doc: bought 5 @ 30, sum 27 → (27−30)×5 = −15.
    expect(realizedPnl("buy", 5, { bid: 28, ask: 30 }, 27)).toBe(-15);
  });

  it("sold N @ bid: (bid − sum)×N", () => {
    expect(realizedPnl("sell", 10, { bid: 29, ask: 31 }, 23)).toBe(60);
  });

  it("no trade is always 0", () => {
    expect(realizedPnl("none", 5, { bid: 10, ask: 12 }, 99)).toBe(0);
  });
});

describe("asymmetric scoring", () => {
  it("correct profit banks +P, correct loss takes −L", () => {
    expect(scoreRound(40, true)).toBe(40);
    expect(scoreRound(-15, true)).toBe(-15);
  });

  it("incorrect profit guess earns 0", () => {
    expect(scoreRound(40, false)).toBe(0);
  });

  it("incorrect loss guess is DOUBLE the loss", () => {
    // R1 doc: −15 loss, wrong guess → −30.
    expect(scoreRound(-15, false)).toBe(-30);
  });
});

describe("value of information — pay for first card", () => {
  it("mid-centered quote ≈ 2.23 in both ace settings", () => {
    // Ace-high EV 24, quote 23 at 25 (mid-centered).
    expect(payForFirstCard({ bid: 23, ask: 25 }, 3, 14)).toBeCloseTo(29 / 13, 2);
    // Ace-low EV 21, quote 20 at 22.
    expect(payForFirstCard({ bid: 20, ask: 22 }, 3, 1)).toBeCloseTo(29 / 13, 2);
  });

  it("is higher when the quote already gives baseline edge", () => {
    const mid = payForFirstCard({ bid: 23, ask: 25 }, 3, 14);
    const skewed = payForFirstCard({ bid: 17, ask: 19 }, 3, 14);
    expect(skewed).toBeGreaterThan(mid);
  });
});

describe("dealRound is well-formed and randomized", () => {
  it("deals N distinct cards summing to the stated sum", () => {
    const r = dealRound(new Rng(42), { numCards: 3, aceValue: 14, replace: false });
    expect(r.cards).toHaveLength(3);
    expect(sumHand(r.cards)).toBe(r.sum);
    expect(r.evSum).toBeCloseTo(24, 10);
    expect(r.quote.ask).toBeGreaterThan(r.quote.bid);
  });

  it("different seeds give different deals", () => {
    const a = dealRound(new Rng(1), { numCards: 3, aceValue: 14, replace: false });
    const b = dealRound(new Rng(2), { numCards: 3, aceValue: 14, replace: false });
    expect(a.sum === b.sum && a.quote.bid === b.quote.bid).toBe(false);
  });
});

describe("conditional updating (value of information)", () => {
  it("conditionalEvSum = revealed sum + hidden count × mean", () => {
    // Reveal an Ace (14) with 2 hidden ace-high → 14 + 2×8 = 30 (prior was 24).
    expect(conditionalEvSum([card(14, 14)], 3, 14)).toBeCloseTo(30, 10);
    // Reveal a 2 → 2 + 16 = 18.
    expect(conditionalEvSum([card(2, 2)], 3, 14)).toBeCloseTo(18, 10);
    // Nothing revealed collapses to the unconditional EV.
    expect(conditionalEvSum([], 3, 14)).toBeCloseTo(evSum(3, 14), 10);
  });

  it("makeCenteredQuote straddles the EV with a small integer spread", () => {
    const q = makeCenteredQuote(new Rng(7), 24);
    expect(q.ask).toBeGreaterThan(q.bid);
    const spread = q.ask - q.bid;
    expect(spread).toBeGreaterThanOrEqual(2);
    expect(spread).toBeLessThanOrEqual(4);
    // Centered: the EV sits inside (or on the edge of) the quoted market.
    expect(q.bid).toBeLessThanOrEqual(24);
    expect(q.ask).toBeGreaterThanOrEqual(24);
  });

  it("dealConditionalRound reveals cards and prices a coherent posterior", () => {
    const r = dealConditionalRound(new Rng(9), { numCards: 3, aceValue: 14, replace: true }, 1);
    expect(r.revealed).toHaveLength(1);
    expect(r.numRevealed).toBe(1);
    expect(r.cards.slice(0, 1)).toEqual(r.revealed);
    expect(r.posteriorEv).toBeCloseTo(
      conditionalEvSum(r.revealed, 3, 14),
      10,
    );
    expect(r.evSum).toBeCloseTo(24, 10);
  });

  it("clamps numRevealed to [0, numCards − 1] so at least one card stays hidden", () => {
    const r = dealConditionalRound(new Rng(3), { numCards: 3, aceValue: 14, replace: true }, 9);
    expect(r.numRevealed).toBe(2);
    expect(r.revealed).toHaveLength(2);
  });
});

describe("gradeOutcome", () => {
  it("marks decision + P&L and applies asymmetric score", () => {
    const round = {
      cards: [card(13, 13), card(12, 12), card(2, 2)],
      sum: 27,
      quote: { bid: 28, ask: 30 } as Quote,
      evSum: 24,
      config: { numCards: 3, aceValue: 14, replace: false },
    };
    // Bought 5 @ 30 → (27−30)×5 = −15. Buying was WRONG (ask 30 > EV 24; sell had edge).
    const wrongGuess = gradeOutcome(round, "buy", 5, 27);
    expect(wrongGuess.actualPnl).toBe(-15);
    expect(wrongGuess.guessCorrect).toBe(false);
    expect(wrongGuess.score).toBe(-30); // double loss
    expect(wrongGuess.decisionCorrect).toBe(false);

    const rightGuess = gradeOutcome(round, "buy", 5, -15);
    expect(rightGuess.guessCorrect).toBe(true);
    expect(rightGuess.score).toBe(-15);
  });
});

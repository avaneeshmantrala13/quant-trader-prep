import { describe, it, expect } from "vitest";
import { Rng } from "@/lib/rng";
import {
  rankValue,
  suitsFor,
  freshDeck,
  remainingCards,
  pHigher,
  pLower,
  pInside,
  pOutside,
  pNewSuit,
  kellyFraction,
  bestOption,
  evaluateHigherLower,
  evaluateInsideOutside,
  evaluateNewSuit,
  resolveBet,
  decideWin,
  sizingScore,
  decisionScore,
  skillScore,
  leaderboardScore,
  dealCycle,
  START_CHIPS,
  type Card,
  type Suit,
  type GameConfig,
  type PlacedBet,
  type RoundDecision,
} from "./engine";

const card = (rank: number, suit: Suit = "♠"): Card => ({ rank, suit });

describe("rankValue", () => {
  it("ace is 1 when low, 14 when high; others unchanged", () => {
    expect(rankValue(14, "low")).toBe(1);
    expect(rankValue(14, "high")).toBe(14);
    expect(rankValue(10, "high")).toBe(10);
    expect(rankValue(11, "low")).toBe(11); // J
    expect(rankValue(13, "high")).toBe(13); // K
  });
});

describe("suits + deck", () => {
  it("suitsFor returns the first N canonical suits", () => {
    expect(suitsFor(1)).toEqual(["♠"]);
    expect(suitsFor(4)).toEqual(["♠", "♥", "♦", "♣"]);
  });

  it("freshDeck has numSuits × 13 cards", () => {
    const oneSuit: GameConfig = { numSuits: 1, aceMode: "high" };
    const fourSuit: GameConfig = { numSuits: 4, aceMode: "high" };
    expect(freshDeck(oneSuit)).toHaveLength(13);
    expect(freshDeck(fourSuit)).toHaveLength(52);
  });

  it("remainingCards removes exactly one occurrence per visible card", () => {
    const deck = freshDeck({ numSuits: 4, aceMode: "high" });
    // Two different suits of rank 5 visible: only those two removed.
    const rem = remainingCards(deck, [card(5, "♠"), card(5, "♥")]);
    expect(rem).toHaveLength(50);
    expect(rem.filter((c) => c.rank === 5)).toHaveLength(2); // ♦ and ♣ still there
    // A card not in the deck is ignored.
    const rem2 = remainingCards(freshDeck({ numSuits: 1, aceMode: "high" }), [
      card(5, "♥"),
    ]);
    expect(rem2).toHaveLength(13);
  });
});

describe("worked example — 1 suit, ace-high, reference 10", () => {
  it("pLower = 8/12 ≈ 0.667 and Kelly ≈ 0.33", () => {
    const deck = freshDeck({ numSuits: 1, aceMode: "high" });
    const reference = card(10, "♠");
    const remaining = remainingCards(deck, [reference]);
    expect(remaining).toHaveLength(12);
    const lower = pLower(reference, remaining, "high");
    expect(lower).toBeCloseTo(8 / 12, 10);
    expect(lower).toBeCloseTo(0.667, 3);
    expect(kellyFraction(lower)).toBeCloseTo(0.33, 10);
    // The higher side: J,Q,K,A = 4/12.
    expect(pHigher(reference, remaining, "high")).toBeCloseTo(4 / 12, 10);
  });
});

describe("higher / lower — ties excluded", () => {
  it("cards equal to the reference count in neither side", () => {
    const reference = card(7, "♠");
    // remaining has two 7s (ties), one 8 (higher), one 3 (lower).
    const remaining = [card(7, "♥"), card(7, "♦"), card(8, "♠"), card(3, "♠")];
    expect(pHigher(reference, remaining, "high")).toBeCloseTo(1 / 4, 10);
    expect(pLower(reference, remaining, "high")).toBeCloseTo(1 / 4, 10);
    // Higher + Lower < 1 because of the ties.
    expect(
      pHigher(reference, remaining, "high") + pLower(reference, remaining, "high"),
    ).toBeCloseTo(0.5, 10);
  });
});

describe("inside / outside range", () => {
  it("inside is strictly between endpoints; boundaries are neither", () => {
    const low = card(5, "♠");
    const high = card(10, "♠");
    // 5 & 10 are boundaries (neither), 7 & 9 inside, 2 & 13 outside.
    const remaining = [card(5, "♥"), card(10, "♥"), card(7, "♠"), card(9, "♠"), card(2, "♠"), card(13, "♠")];
    expect(pInside(low, high, remaining, "high")).toBeCloseTo(2 / 6, 10);
    expect(pOutside(low, high, remaining, "high")).toBeCloseTo(2 / 6, 10);
  });
});

describe("new suit", () => {
  it("favorable = remaining whose suit has not appeared yet", () => {
    const visibleSuits = new Set<Suit>(["♠", "♥"]);
    const remaining = [card(2, "♠"), card(3, "♥"), card(4, "♦"), card(5, "♣")];
    // ♦ and ♣ are new → 2/4.
    expect(pNewSuit(visibleSuits, remaining)).toBeCloseTo(2 / 4, 10);
  });
});

describe("kellyFraction (even money)", () => {
  it("2p − 1, clamped at 0", () => {
    expect(kellyFraction(0.6)).toBeCloseTo(0.2, 10);
    expect(kellyFraction(0.7)).toBeCloseTo(0.4, 10);
    expect(kellyFraction(1)).toBeCloseTo(1, 10);
    expect(kellyFraction(0.5)).toBe(0);
    expect(kellyFraction(0.4)).toBe(0);
  });
});

describe("option evaluators + bestOption", () => {
  it("evaluateHigherLower attaches p and kelly to both sides", () => {
    const reference = card(10, "♠");
    const remaining = remainingCards(freshDeck({ numSuits: 1, aceMode: "high" }), [reference]);
    const opts = evaluateHigherLower(reference, remaining, "high");
    const best = bestOption(opts);
    expect(best.side).toBe("lower");
    expect(best.kelly).toBeCloseTo(0.33, 10);
  });

  it("evaluateInsideOutside returns both sides", () => {
    const opts = evaluateInsideOutside(
      card(2, "♠"),
      card(13, "♠"),
      [card(7, "♠"), card(8, "♠"), card(14, "♠")],
      "high",
    );
    // 7,8 inside (2 of 3); ace-high 14 outside (above K).
    const inside = opts.find((o) => o.side === "inside")!;
    expect(inside.p).toBeCloseTo(2 / 3, 10);
  });

  it("evaluateNewSuit gives new + not-new complementary over remaining", () => {
    const opts = evaluateNewSuit(
      new Set<Suit>(["♠"]),
      [card(2, "♠"), card(3, "♥"), card(4, "♦")],
    );
    const nw = opts.find((o) => o.side === "new")!;
    const not = opts.find((o) => o.side === "not-new")!;
    expect(nw.p).toBeCloseTo(2 / 3, 10);
    expect(not.p).toBeCloseTo(1 / 3, 10);
  });
});

describe("resolveBet + decideWin (even money)", () => {
  it("higher/lower win pays +stake, loss pays −stake", () => {
    const ctx = { aceMode: "high" as const, reference: card(7, "♠") };
    expect(resolveBet("higher-lower", "higher", 100, card(9, "♠"), ctx)).toBe(100);
    expect(resolveBet("higher-lower", "higher", 100, card(3, "♠"), ctx)).toBe(-100);
    // tie: 7 is neither higher nor lower → higher side loses.
    expect(resolveBet("higher-lower", "higher", 100, card(7, "♥"), ctx)).toBe(-100);
  });

  it("inside/outside and new-suit resolve against context", () => {
    const rangeCtx = { aceMode: "high" as const, low: card(4, "♠"), high: card(10, "♠") };
    expect(decideWin("inside-outside", "inside", card(7, "♠"), rangeCtx)).toBe(true);
    expect(decideWin("inside-outside", "outside", card(13, "♠"), rangeCtx)).toBe(true);
    const suitCtx = { aceMode: "high" as const, visibleSuits: new Set<Suit>(["♠"]) };
    expect(decideWin("new-suit", "new", card(2, "♥"), suitCtx)).toBe(true);
    expect(decideWin("new-suit", "new", card(2, "♠"), suitCtx)).toBe(false);
  });

  it("a zero stake (skip) nets 0", () => {
    const ctx = { aceMode: "high" as const, reference: card(7, "♠") };
    expect(resolveBet("higher-lower", "higher", 0, card(9, "♠"), ctx)).toBe(0);
  });
});

describe("sizingScore", () => {
  it("rewards near-Kelly stakes over far ones", () => {
    // One good bet, p=0.7 → kelly 0.4.
    const near: PlacedBet[] = [{ p: 0.7, kelly: 0.4, actualFraction: 0.4, staked: true }];
    const far: PlacedBet[] = [{ p: 0.7, kelly: 0.4, actualFraction: 0.05, staked: true }];
    expect(sizingScore(near)).toBeGreaterThan(sizingScore(far));
    expect(sizingScore(near)).toBeCloseTo(7, 10); // exact Kelly, full coverage
  });

  it("scales down when good bets are left untaken (coverage)", () => {
    const bets: PlacedBet[] = [
      { p: 0.7, kelly: 0.4, actualFraction: 0.4, staked: true },
      { p: 0.6, kelly: 0.2, actualFraction: 0, staked: false }, // good but skipped
    ];
    // Perfect sizing on the one taken, but coverage 1/2 → 3.5.
    expect(sizingScore(bets)).toBeCloseTo(3.5, 10);
  });

  it("returns 0 when no good bets are available", () => {
    const bets: PlacedBet[] = [{ p: 0.4, kelly: 0, actualFraction: 0.1, staked: true }];
    expect(sizingScore(bets)).toBe(0);
  });
});

describe("decisionScore", () => {
  it("is the fraction of +EV rounds bet on, × 3", () => {
    const rounds: RoundDecision[] = [
      { bestP: 0.7, bet: true },
      { bestP: 0.6, bet: false }, // missed a good round
      { bestP: 0.45, bet: false }, // not +EV, ignored — fine
    ];
    expect(decisionScore(rounds)).toBeCloseTo((1 / 2) * 3, 10);
  });

  it("full marks when there are no +EV rounds to miss", () => {
    expect(decisionScore([{ bestP: 0.4, bet: false }])).toBe(3);
  });
});

describe("skill + leaderboard", () => {
  it("skillScore = sizing + decision, 0–10", () => {
    const bets: PlacedBet[] = [{ p: 0.7, kelly: 0.4, actualFraction: 0.4, staked: true }];
    const rounds: RoundDecision[] = [{ bestP: 0.7, bet: true }];
    // sizing 7 + decision 3 = 10.
    expect(skillScore(bets, rounds)).toBeCloseTo(10, 10);
  });

  it("leaderboardScore is balance × skill / 10", () => {
    expect(leaderboardScore(1200, 10)).toBeCloseTo(1200, 10);
    expect(leaderboardScore(1200, 5)).toBeCloseTo(600, 10);
  });
});

describe("dealCycle", () => {
  it("draws two cards, orders low/high, tracks deck and visible", () => {
    const config: GameConfig = { numSuits: 4, aceMode: "high" };
    const deck = freshDeck(config);
    const state = dealCycle(new Rng(7), deck, config);
    expect(state.deck).toHaveLength(50); // two removed
    expect(state.visible).toHaveLength(2);
    expect(rankValue(state.low.rank, "high")).toBeLessThanOrEqual(
      rankValue(state.high.rank, "high"),
    );
  });

  it("is deterministic given the seed and appends to prior visible", () => {
    const config: GameConfig = { numSuits: 4, aceMode: "high" };
    const deck = freshDeck(config);
    const a = dealCycle(new Rng(3), deck, config, [card(2, "♠")]);
    const b = dealCycle(new Rng(3), deck, config, [card(2, "♠")]);
    expect(a.reference).toEqual(b.reference);
    expect(a.visible).toHaveLength(3); // prior 1 + two dealt
  });
});

describe("constants", () => {
  it("starts with 1000 chips", () => {
    expect(START_CHIPS).toBe(1000);
  });
});

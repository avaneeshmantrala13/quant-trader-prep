import { describe, expect, it } from "vitest";
import {
  CATEGORY,
  breakEvenEquity,
  compareHands,
  evaluate7,
  evOfCall,
  parseHand,
  potOddsDecision,
  simulateAllInEquity,
  simulateCallPnL,
  simulateWinRate,
  type Card,
} from "./poker";
import { mean } from "./shared";

// ---- Pot odds / EV of calling --------------------------------------------

describe("evOfCall / breakEvenEquity / potOddsDecision", () => {
  it("EV(call) = w·(pot+bet) − (1−w)·bet", () => {
    // pot 100, bet 50, w 0.5 → 0.5·150 − 0.5·50 = 75 − 25 = 50.
    expect(evOfCall(100, 50, 0.5)).toBeCloseTo(50, 12);
    // w 0 → lose the call.
    expect(evOfCall(100, 50, 0)).toBeCloseTo(-50, 12);
    // w 1 → win pot + bet.
    expect(evOfCall(100, 50, 1)).toBeCloseTo(150, 12);
  });

  it("break-even equity = bet / (pot + 2·bet) and EV is 0 there", () => {
    const pot = 100;
    const bet = 50;
    const be = breakEvenEquity(pot, bet);
    expect(be).toBeCloseTo(50 / 200, 12); // 0.25
    expect(evOfCall(pot, bet, be)).toBeCloseTo(0, 10);
  });

  it("recommends call above break-even, fold below", () => {
    const pot = 100;
    const bet = 50; // break-even 0.25
    expect(potOddsDecision(pot, bet, 0.3)).toBe("call");
    expect(potOddsDecision(pot, bet, 0.2)).toBe("fold");
  });
});

describe("simulateWinRate / simulateCallPnL convergence", () => {
  it("empirical win rate → w within tolerance", () => {
    const out = simulateWinRate(0.35, 20000, 7);
    expect(Math.abs(out[out.length - 1] - 0.35)).toBeLessThan(0.02);
  });

  it("average call P&L → EV(call) within tolerance", () => {
    const [pot, bet, w] = [100, 50, 0.35];
    const out = simulateCallPnL(pot, bet, w, 20000, 9);
    expect(Math.abs(mean(out) - evOfCall(pot, bet, w))).toBeLessThan(3);
  });

  it("is deterministic given the seed", () => {
    expect(simulateWinRate(0.4, 500, 3)).toEqual(simulateWinRate(0.4, 500, 3));
  });
});

// ---- Hand evaluator -------------------------------------------------------

/** Helper: evaluate a 7-card hand written compactly. */
function score(hand: string): number[] {
  return evaluate7(parseHand(hand));
}

describe("evaluate7 category detection", () => {
  it("recognizes each category with the right rank", () => {
    expect(score("As Ks Qs Js Ts 2c 3d")[0]).toBe(CATEGORY.STRAIGHT_FLUSH);
    expect(score("As Ah Ad Ac Kd 2c 3d")[0]).toBe(CATEGORY.QUADS);
    expect(score("As Ah Ad Kc Kd 2c 3d")[0]).toBe(CATEGORY.FULL_HOUSE);
    expect(score("As Ks Qs 2s 7s 9c 3d")[0]).toBe(CATEGORY.FLUSH);
    expect(score("9c 8d 7s 6h 5c 2d Ac")[0]).toBe(CATEGORY.STRAIGHT);
    expect(score("As Ah Ad Kc Qd 2c 3d")[0]).toBe(CATEGORY.TRIPS);
    expect(score("As Ah Kd Kc Qd 2c 3d")[0]).toBe(CATEGORY.TWO_PAIR);
    expect(score("As Ah Kd Qc Jd 2c 3d")[0]).toBe(CATEGORY.PAIR);
    expect(score("As Kh Qd Jc 9d 4c 3d")[0]).toBe(CATEGORY.HIGH_CARD);
  });

  it("recognizes the wheel straight A-2-3-4-5 (high card 5)", () => {
    const s = score("Ad 2c 3s 4h 5d 9c Kh");
    expect(s[0]).toBe(CATEGORY.STRAIGHT);
    expect(s[1]).toBe(5);
  });

  it("picks the best 5 of 7 (a straight embedded among extra cards)", () => {
    const s = score("Ts 9d 8c 7h 6s 2d 2h");
    expect(s[0]).toBe(CATEGORY.STRAIGHT);
    expect(s[1]).toBe(10);
  });
});

describe("hand ordering (compareHands / compareScore)", () => {
  it("straight flush > quads > full house > flush > straight > trips > two pair > pair > high", () => {
    const ladder = [
      "As Ks Qs Js Ts 2c 3d", // straight flush
      "Ah Ad Ac As Kd 2c 3d", // quads
      "Ah Ad Ac Kd Kc 2s 3s", // full house
      "As Ks Qs 2s 7s 9c 3d", // flush
      "9c 8d 7s 6h 5c 2d Ac", // straight
      "As Ah Ad Kc Qd 2c 3d", // trips
      "As Ah Kd Kc Qd 2c 3d", // two pair
      "As Ah Kd Qc Jd 2c 3d", // pair
      "As Kh Qd Jc 9d 4c 3d", // high card
    ];
    for (let i = 0; i < ladder.length - 1; i++) {
      expect(compareHands(parseHand(ladder[i]), parseHand(ladder[i + 1]))).toBe(
        1,
      );
    }
  });

  it("flush beats a straight", () => {
    const flush = parseHand("2s 5s 8s Js Ks 3d 4c");
    const straight = parseHand("9c 8d 7s 6h 5c 2d Ad");
    expect(compareHands(flush, straight)).toBe(1);
  });

  it("higher kicker breaks a tie between equal pairs", () => {
    const a = parseHand("As Ah Kd 7c 4d 2c 3d"); // pair of aces, K kicker
    const b = parseHand("Ac Ad Qd 7h 4s 2h 3h"); // pair of aces, Q kicker
    expect(compareHands(a, b)).toBe(1);
  });

  it("returns a tie when both play the identical board", () => {
    // Both make the same broadway straight off the board; hole cards irrelevant.
    const board = "Ts Jd Qc Kh Ac";
    const a = parseHand(`2d 3c ${board}`);
    const b = parseHand(`2h 3s ${board}`);
    expect(compareHands(a, b)).toBe(0);
  });
});

// ---- All-in equity simulation --------------------------------------------

describe("simulateAllInEquity", () => {
  it("is deterministic given the seed", () => {
    const a = parseHand("As Ah");
    const b = parseHand("Kc Kd");
    const r1 = simulateAllInEquity(a, b, 500, 4);
    const r2 = simulateAllInEquity(a, b, 500, 4);
    expect(r1.equity).toEqual(r2.equity);
    expect([r1.winsA, r1.winsB, r1.ties]).toEqual([
      r2.winsA,
      r2.winsB,
      r2.ties,
    ]);
  });

  it("win/tie/loss counts sum to the number of deals", () => {
    const r = simulateAllInEquity(parseHand("As Ah"), parseHand("Kc Kd"), 3000, 2);
    expect(r.winsA + r.winsB + r.ties).toBe(3000);
  });

  it("AA vs KK preflop: AA equity ≈ 0.82 (accepted value) within tolerance", () => {
    // Accepted heads-up all-in equity for a pair of aces vs a pair of kings is
    // ~82% (ties are rare, ~0.4%). Verified over many random boards.
    const aa: Card[] = parseHand("As Ah");
    const kk: Card[] = parseHand("Kc Kd");
    const r = simulateAllInEquity(aa, kk, 20000, 123);
    const equityA = r.equity[r.equity.length - 1];
    expect(Math.abs(equityA - 0.82)).toBeLessThan(0.03);
  });
});

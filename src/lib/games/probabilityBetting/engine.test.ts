import { describe, it, expect } from "vitest";
import { Rng } from "@/lib/rng";
import {
  impliedProb,
  fairOdds,
  edgePct,
  kellyFraction,
  kellyStake,
  sizingEfficiency,
  settleRound,
  gradeRound,
  skillScore,
  findInsuranceArb,
  type BettingEvent,
  type RoundEvents,
} from "./engine";

const ev = (
  id: string,
  trueProb: number,
  houseOdds: number,
  won: boolean,
): BettingEvent => ({
  id,
  category: "dice",
  label: id,
  trueProb,
  houseOdds,
  settle: () => won,
});

describe("odds ↔ probability", () => {
  it("implied prob of b:1 is 1/(b+1)  (3:1 → 25%)", () => {
    expect(impliedProb(3)).toBeCloseTo(0.25, 10);
    expect(impliedProb(1)).toBeCloseTo(0.5, 10);
  });

  it("fair odds of p is (1−p)/p  (25% → 3:1)", () => {
    expect(fairOdds(0.25)).toBeCloseTo(3, 10);
    expect(fairOdds(0.5)).toBeCloseTo(1, 10);
  });
});

describe("edge % (doc worked examples)", () => {
  it("quote 2.86:1 vs fair 2.60:1 → ~+10%", () => {
    // fair 2.60 → p = 1/3.6. Quote 2.86 → edge ≈ +10%.
    const p = 1 / (2.6 + 1);
    expect(edgePct(2.86, p)).toBeCloseTo((2.86 - 2.6) / 2.6, 4);
    expect(edgePct(2.86, p)).toBeGreaterThan(0.09);
    expect(edgePct(2.86, p)).toBeLessThan(0.11);
  });

  it("quote 4.72:1 vs fair 3.74:1 → ~+26%", () => {
    const p = 1 / (3.74 + 1);
    expect(edgePct(4.72, p)).toBeCloseTo((4.72 - 3.74) / 3.74, 4);
    expect(edgePct(4.72, p)).toBeGreaterThan(0.25);
    expect(edgePct(4.72, p)).toBeLessThan(0.27);
  });

  it("stingy quote below fair → negative edge", () => {
    const p = 0.5; // fair 1:1
    expect(edgePct(0.8, p)).toBeLessThan(0);
  });
});

describe("Kelly", () => {
  it("f* = (bp − q)/b  — 1:1 odds at 60% → 0.20", () => {
    // b=1, p=0.6, q=0.4 → (0.6−0.4)/1 = 0.2.
    expect(kellyFraction(1, 0.6)).toBeCloseTo(0.2, 10);
  });

  it("no edge or negative edge → 0 (don't bet)", () => {
    expect(kellyFraction(1, 0.5)).toBe(0); // exactly fair
    expect(kellyFraction(1, 0.4)).toBe(0); // unfavourable
  });

  it("kelly stake scales with bankroll", () => {
    expect(kellyStake(1, 0.6, 1000)).toBe(200);
    expect(kellyStake(1, 0.6, 50)).toBe(10);
  });
});

describe("sizing efficiency", () => {
  it("exact Kelly → 100%, 2× or 0× Kelly → 0%", () => {
    expect(sizingEfficiency(29, 29)).toBe(1);
    expect(sizingEfficiency(58, 29)).toBe(0);
    expect(sizingEfficiency(0, 29)).toBe(0);
  });

  it("no-edge event: any positive stake is 0%, zero stake is 100%", () => {
    expect(sizingEfficiency(51, 0)).toBe(0);
    expect(sizingEfficiency(0, 0)).toBe(1);
  });
});

describe("round settlement", () => {
  const round: RoundEvents = {
    events: [ev("a", 0.5, 2, true), ev("b", 0.5, 2, false)],
    specials: [
      { id: "ins", kind: "insurance", label: "ins", houseOdds: 1 },
      { id: "bst", kind: "boost", label: "bst", houseOdds: 1 },
    ],
  };

  it("winning bet pays stake×odds, losing bet loses stake", () => {
    const s = settleRound(
      round,
      [{ eventId: "a", amount: 100 }, { eventId: "b", amount: 100 }],
      [],
      new Rng(1),
    );
    // a wins: +100×2 = +200; b loses: −100 → regular net +100.
    expect(s.results[0].net).toBe(200);
    expect(s.results[1].net).toBe(-100);
    expect(s.regularNet).toBe(100);
  });

  it("Boost wins when regular bets net a profit; Insurance loses", () => {
    const s = settleRound(
      round,
      [{ eventId: "a", amount: 100 }], // only the winner → net +200
      [{ specialId: "bst", amount: 50 }, { specialId: "ins", amount: 50 }],
      new Rng(1),
    );
    expect(s.regularNet).toBe(200);
    const boost = s.specials.find((x) => x.special.kind === "boost")!;
    const ins = s.specials.find((x) => x.special.kind === "insurance")!;
    expect(boost.won).toBe(true);
    expect(boost.net).toBe(50); // stake 50 × odds 1
    expect(ins.won).toBe(false);
    expect(ins.net).toBe(-50);
  });

  it("Insurance wins when regular bets net a loss", () => {
    const s = settleRound(
      round,
      [{ eventId: "b", amount: 100 }], // only the loser → net −100
      [{ specialId: "ins", amount: 40 }],
      new Rng(1),
    );
    expect(s.regularNet).toBe(-100);
    const ins = s.specials.find((x) => x.special.kind === "insurance")!;
    expect(ins.won).toBe(true);
    expect(ins.net).toBe(40);
  });
});

describe("grading + skill score", () => {
  it("grades edge, kelly and efficiency per event", () => {
    // p=0.6, fair 0.667:1. Quote 1:1 → strong +edge.
    const round: RoundEvents = { events: [ev("g", 0.6, 1, true)], specials: [] };
    const grades = gradeRound(round, [{ eventId: "g", amount: 200 }], 1000);
    expect(grades[0].goodDecision).toBe(true);
    expect(grades[0].kellyStake).toBe(200); // (0.6−0.4)/1 × 1000
    expect(grades[0].efficiency).toBe(1); // staked exactly Kelly
  });

  it("rewards betting good events well-sized, penalises betting bad ones", () => {
    const good = ev("good", 0.6, 1, true); // +edge
    const bad = ev("bad", 0.4, 1, false); // −edge (fair would be 1.5:1)
    const round: RoundEvents = { events: [good, bad], specials: [] };

    const great = skillScore(
      gradeRound(round, [{ eventId: "good", amount: 200 }], 1000),
    );
    const sloppy = skillScore(
      gradeRound(
        round,
        [{ eventId: "good", amount: 200 }, { eventId: "bad", amount: 100 }],
        1000,
      ),
    );
    expect(great.total).toBeGreaterThan(sloppy.total);
    expect(great.decision).toBeGreaterThan(sloppy.decision);
  });

  it("passing everything scores zero, not negative", () => {
    const round: RoundEvents = {
      events: [ev("good", 0.6, 1, true)],
      specials: [],
    };
    const s = skillScore(gradeRound(round, [], 1000));
    expect(s.total).toBe(0);
  });
});

describe("insurance arbitrage", () => {
  it("finds a lock when a high-odds event pairs with generous insurance", () => {
    const round: RoundEvents = {
      events: [ev("long", 0.1, 12, false)], // 12:1 long shot
      specials: [
        { id: "ins", kind: "insurance", label: "ins", houseOdds: 2 },
        { id: "bst", kind: "boost", label: "bst", houseOdds: 1 },
      ],
    };
    const arb = findInsuranceArb(round, 1000);
    expect(arb).not.toBeNull();
    expect(arb!.guaranteedProfit).toBeGreaterThan(0);
    expect(arb!.eventId).toBe("long");
  });

  it("returns null when no lock exists", () => {
    const round: RoundEvents = {
      events: [ev("even", 0.5, 1, false)],
      specials: [
        { id: "ins", kind: "insurance", label: "ins", houseOdds: 0.5 },
      ],
    };
    expect(findInsuranceArb(round, 1000)).toBeNull();
  });
});

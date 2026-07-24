import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import {
  F,
  bagWinProb,
  hasArbitrage,
  impliedProbabilitySum,
  rigBagsClosedForm,
  rigBagsOptimum,
} from "./puzzles";
import { buildArbitrageInstance, buildRigBagsInstance } from "./generators";

const round2 = (x: number) => Math.round(x * 100) / 100;

/* ========================================================================== */
/*  1. Seed-dataset fixtures — the 4 ORIGINAL Game Puzzle questions.           */
/*     Test-only. No generated/user-facing content reuses these verbatim.      */
/* ========================================================================== */

describe("seed dataset: exact solver reproduces / validates all 4 documented answers", () => {
  it("GP1 Beat the Odds — Match 1 is a locked arbitrage (implied sum < 1)", () => {
    // A 7:4 → payout 11/4 → implied 4/11; B 2:3 → payout 5/3 → implied 3/5.
    const impliedA = F(4, 11);
    const impliedB = F(3, 5);
    const sum = impliedA.add(impliedB);
    expect(sum.equals(F(53, 55))).toBe(true);
    expect(sum.valueOf()).toBeLessThan(1); // arbitrage exists
  });
  it("GP2 Tennis Odds — cross-book Nadal@A(1.29)+Federer@B(4.7) is an arb; single-book is not", () => {
    expect(hasArbitrage(["1.29", "4.70"])).toBe(true); // 0.988 < 1
    expect(hasArbitrage(["1.29", "4.00"])).toBe(false); // Book A alone: 1.0255 > 1
    expect(hasArbitrage(["1.20", "4.70"])).toBe(false); // Book B alone: 1.046 > 1
  });
  it("GP3 Parimutuel — pro-rata pot split (€3 vs Jane's €5 → 3/8 of €300 = €112.50)", () => {
    expect(F(3, 8).mul(300).valueOf()).toBe(112.5);
    expect(F(1, 1).mul(300).valueOf()).toBe(300); // €1 alone on an empty team wins the pot
  });
  it("GP4 Rig the Bags — optimum P(win) = 0.74 (= 37/50), lone-gold trick", () => {
    const closed = rigBagsClosedForm(13, 13);
    expect(closed.equals(F(37, 50))).toBe(true);
    expect(closed.valueOf()).toBe(0.74);
    // Independent brute force over ALL splits agrees, and the optimum isolates a gold token.
    const opt = rigBagsOptimum(13, 13);
    expect(opt.best.equals(F(37, 50))).toBe(true);
    expect(opt.split).toMatchObject({ g1: 1, b1: 0 });
  });
});

/* ========================================================================== */
/*  2. Solver invariants                                                       */
/* ========================================================================== */

describe("solver invariants", () => {
  it("mirror split & full separation both give exactly 1/2 (a coin flip)", () => {
    expect(bagWinProb({ g1: 6, b1: 6, g2: 7, b2: 7 }).equals(F(1, 2))).toBe(true); // mirror
    expect(bagWinProb({ g1: 13, b1: 0, g2: 0, b2: 13 }).equals(F(1, 2))).toBe(true); // full sep
  });
  it("brute-force optimum matches the lone-gold closed form across token counts", () => {
    for (const gold of [6, 8, 11, 13, 16, 21]) {
      const black = 26 - gold;
      expect(rigBagsOptimum(gold, black).best.equals(rigBagsClosedForm(gold, black))).toBe(
        true,
      );
    }
  });
  it("impliedProbabilitySum is exact and detects arbitrage below 1", () => {
    expect(impliedProbabilitySum(["2.00", "2.00"]).equals(F(1))).toBe(true); // fair, no arb
    expect(hasArbitrage(["2.00", "2.00"])).toBe(false);
    expect(hasArbitrage(["2.10", "2.10"])).toBe(true); // 0.952 < 1
  });
});

/* ========================================================================== */
/*  3. Generator re-derivation + distractor taxonomy                           */
/* ========================================================================== */

const SEEDS = Array.from({ length: 150 }, (_, i) => i * 5 + 2);

describe("Rig the Bags numeric: P(win) & common-errors re-derive exactly", () => {
  it("answer = brute-force optimum; distractors traceable to named misconceptions", () => {
    for (const seed of SEEDS) {
      const inst = buildRigBagsInstance(new Rng(seed), "easy");
      const { gold, black } = inst;
      // Independent optimum + closed form agree with the emitted answer.
      const opt = rigBagsOptimum(gold, black).best;
      expect(round2(opt.valueOf())).toBe(inst.numeric.answer);
      expect(round2(rigBagsClosedForm(gold, black).valueOf())).toBe(inst.numeric.answer);

      const candidates = new Set(
        [
          F(1, 2),
          F(gold, gold + black),
          F(gold - 1, gold + black - 1),
          F(gold, 2 * (gold + black - 1)),
        ].map((f) => round2(f.valueOf())),
      );
      const errs = inst.numeric.commonErrors ?? [];
      expect(errs.length).toBeGreaterThanOrEqual(3);
      const vals = errs.map((e) => e.value);
      expect(new Set(vals).size).toBe(vals.length);
      for (const e of errs) {
        expect(e.value).not.toBe(inst.numeric.answer);
        expect(candidates.has(round2(e.value))).toBe(true);
        expect(e.feedback.length).toBeGreaterThan(20);
      }
    }
  });
});

describe("Arbitrage numeric: implied sum & arb flag re-derive exactly", () => {
  it("answer = Σ 1/o; isArb ⇔ sum < 1; distractors traceable", () => {
    for (const seed of SEEDS) {
      const inst = buildArbitrageInstance(new Rng(seed), "hard");
      const sum = impliedProbabilitySum([inst.o1, inst.o2]);
      expect(round2(sum.valueOf())).toBe(inst.numeric.answer);
      expect(inst.isArb).toBe(sum.valueOf() < 1);

      const candidates = new Set(
        [
          F(inst.o1).add(F(inst.o2)), // added the odds
          F(1).div(F(inst.o1).sub(1)).add(F(1).div(F(inst.o2).sub(1))), // net-odds slip
          F(1).div(F(inst.o1)), // favourite only
        ].map((f) => round2(f.valueOf())),
      );
      const errs = inst.numeric.commonErrors ?? [];
      expect(errs.length).toBeGreaterThanOrEqual(2);
      const vals = errs.map((e) => e.value);
      expect(new Set(vals).size).toBe(vals.length);
      for (const e of errs) {
        expect(e.value).not.toBe(inst.numeric.answer);
        expect(candidates.has(round2(e.value))).toBe(true);
        expect(e.feedback.length).toBeGreaterThan(20);
      }
    }
  });
});

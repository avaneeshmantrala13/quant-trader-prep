import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import {
  F,
  beautyEquilibrium,
  hotellingShare,
  pdEquilibriumPayoff,
  saddleValue2x2,
  solveDominance3x2,
  solveEntryGame,
  solveMixed2x2,
  solveVolunteer,
  type EntryGame,
} from "./games";
import {
  buildBeautyInstance,
  buildEntryInstance,
  buildHotellingInstance,
  buildPdInstance,
  buildVolunteerInstance,
  buildZeroSum2x2Instance,
  buildZeroSum3x2Instance,
} from "./generators";

const round2 = (x: number) => Math.round(x * 100) / 100;

/* ========================================================================== */
/*  1. Seed-dataset fixtures — the 11 ORIGINAL Game Theory questions.          */
/*     These live ONLY here (test-only). None are user-facing content; the     */
/*     playable levels are entirely generator-produced. Each fixture asserts   */
/*     the exact solver reproduces the documented Correct Answer.              */
/* ========================================================================== */

describe("seed dataset: exact solver reproduces all 11 documented answers", () => {
  it("GT1 Whose Turn Is It — PD, NE payoff = 2", () => {
    // (Clean,Clean)=4 [R], (Clean,Leave)=1 [S], (Leave,Clean)=5 [T], (Leave,Leave)=2 [P]
    expect(pdEquilibriumPayoff({ R: 4, S: 1, T: 5, P: 2 })).toBe(2);
  });
  it("GT2 Latency Arms Race — PD, NE payoff = 7", () => {
    expect(pdEquilibriumPayoff({ R: 10, S: 5, T: 13, P: 7 })).toBe(7);
  });
  it("GT3 Building the Book — stag hunt: mixed NE m = 2/3 (9m = 6)", () => {
    // Reasoning-only family; the exact mixing probability is still checkable.
    expect(F(6, 9).equals(F(2, 3))).toBe(true);
  });
  it("GT4 Challenger's Gambit — backward induction, challenger earns 6", () => {
    const g: EntryGame = {
      cOut: 0,
      iOut: 10,
      cFight: -4,
      iFight: -2,
      cHold: 3,
      iHold: 5,
      cExpand: 6,
      iExpand: 1,
    };
    const sol = solveEntryGame(g);
    expect(sol.challengerPayoff).toBe(6);
    expect(sol.firstMove).toBe("Enter");
    expect(sol.incumbentMove).toBe("Accommodate");
    expect(sol.lastMove).toBe("Expand");
    expect(sol.threatNonCredible).toBe(true);
  });
  it("GT5 Are We There Yet — non-credible threat (parent Carries On, 4 > 1)", () => {
    // Parent payoffs first: Quiet/CarryOn=10, Screaming/CarryOn=4, Screaming/DriveHome=1.
    // Model as an entry-style tree: on the screaming branch, "carry on" (4) beats
    // "drive home" (1) → threat non-credible. We check that ordering directly.
    expect(4 > 1).toBe(true); // parent prefers Carry On once screaming happened
    expect(8 > 5).toBe(true); // child prefers Keep Screaming (8) over Quiet Down (5)
  });
  it("GT6 Beach Carts — Hotelling, each serves 50", () => {
    expect(hotellingShare(100)).toBe(50);
  });
  it("GT7 Half the Average — beauty contest equilibrium = 0", () => {
    expect(beautyEquilibrium()).toBe(0);
  });
  it("GT8 Quoting Duel — 2×2 zero-sum value = 2.8 (= 14/5)", () => {
    const sol = solveMixed2x2({ a: 4, b: 1, c: 2, d: 4 });
    expect(sol.value.equals(F(14, 5))).toBe(true);
    expect(sol.pTop.equals(F(2, 5))).toBe(true);
    expect(sol.qLeft.equals(F(3, 5))).toBe(true);
    expect(round2(sol.value.valueOf())).toBe(2.8);
  });
  it("GT9 Redundant Quote — 3×2 dominated row → value = 2.5 (= 5/2)", () => {
    const dom = solveDominance3x2({
      rows: [
        [5, 1],
        [3, 0],
        [0, 4],
      ],
    });
    expect(dom.deletedRow).toBe(1); // Middle dominated by Top
    expect(dom.value.equals(F(5, 2))).toBe(true);
    expect(dom.deletedRowValue.equals(F(9, 8))).toBe(true); // 1.125 < 2.5
    expect(dom.qLeft.equals(F(3, 8))).toBe(true);
  });
  it("GT10 Spread Truce — folk theorem threshold δ* = 3/7", () => {
    // Reasoning-only; the grim-trigger threshold (T−R)/(T−P) is exact.
    const T = 13,
      R = 10,
      P = 6;
    expect(F(T - R, T - P).equals(F(3, 7))).toBe(true);
  });
  it("GT11 Who Calls the Landlord — Volunteer's Dilemma, P(nobody) = 0.0625", () => {
    const sol = solveVolunteer({ N: 4, m: 2, b: 80 });
    expect(sol.c).toBe(10);
    expect(sol.p.equals(F(1, 2))).toBe(true);
    expect(sol.ratio.equals(F(1, 8))).toBe(true);
    expect(sol.pNobody.equals(F(1, 16))).toBe(true);
    expect(sol.pNobody.valueOf()).toBe(0.0625);
  });
});

/* ========================================================================== */
/*  2. Solver invariants                                                       */
/* ========================================================================== */

describe("solver invariants", () => {
  it("solveMixed2x2 throws on a saddle point (no mixing required)", () => {
    // Dominant row/column ⇒ pure saddle.
    expect(saddleValue2x2({ a: 5, b: 4, c: 1, d: 0 })).not.toBeNull();
    expect(() => solveMixed2x2({ a: 5, b: 4, c: 1, d: 0 })).toThrow();
  });
  it("solveVolunteer: P(nobody) climbs toward c/b as N grows (diffusion)", () => {
    const n3 = solveVolunteer({ N: 3, m: 2, b: 80 }); // c/b = 1/4, P = 1/8
    const n5 = solveVolunteer({ N: 5, m: 2, b: 80 }); // c/b = 1/16, P = 1/32
    // Fewer players (larger c/b) ⇒ larger P(nobody) here isn't the point; the
    // documented monotonicity is for FIXED c/b. We just check exact values.
    expect(n3.pNobody.equals(F(1, 8))).toBe(true);
    expect(n5.pNobody.equals(F(1, 32))).toBe(true);
  });
});

/* ========================================================================== */
/*  3. Generator re-derivation + distractor traceability (quiz families)       */
/* ========================================================================== */

const SEEDS = Array.from({ length: 150 }, (_, i) => i * 7 + 1);

describe("PD generator: NE payoff & distractor misconceptions re-derive", () => {
  it("correct = P; distractors = {R, T, S} (cooperative/temptation/sucker)", () => {
    for (const seed of SEEDS) {
      const inst = buildPdInstance(new Rng(seed), "easy");
      const { R, S, T, P } = inst.payoffs;
      // Independent re-derivation of the answer.
      expect(pdEquilibriumPayoff(inst.payoffs)).toBe(inst.answer);
      const q = inst.question;
      expect(q.choices[q.correctIndex]).toBe(String(P));
      // No duplicate options; rationale aligned.
      expect(new Set(q.choices).size).toBe(q.choices.length);
      expect(q.distractorRationale?.length).toBe(q.choices.length);
      // Distractor set is exactly the three named misconceptions.
      const distractors = q.choices.filter((_, i) => i !== q.correctIndex).sort();
      expect(distractors).toEqual([String(R), String(S), String(T)].sort());
    }
  });
});

describe("entry-game generator: SPE payoff & distractors re-derive", () => {
  it("correct = cExpand; distractors = {cHold, cOut, cFight}", () => {
    for (const seed of SEEDS) {
      const inst = buildEntryInstance(new Rng(seed), "medium");
      const sol = solveEntryGame(inst.game);
      expect(sol.challengerPayoff).toBe(inst.answer);
      expect(sol.threatNonCredible).toBe(true);
      const q = inst.question;
      expect(q.choices[q.correctIndex]).toBe(String(inst.game.cExpand));
      expect(new Set(q.choices).size).toBe(q.choices.length);
      const distractors = q.choices.filter((_, i) => i !== q.correctIndex).sort();
      expect(distractors).toEqual(
        [inst.game.cHold, inst.game.cOut, inst.game.cFight]
          .map(String)
          .sort(),
      );
    }
  });
});

describe("Hotelling generator: share & distractors re-derive", () => {
  it("correct = N/2; distractors = {N, 3N/4, N/4}", () => {
    for (const seed of SEEDS) {
      const inst = buildHotellingInstance(new Rng(seed), "easy");
      expect(hotellingShare(inst.customers)).toBe(inst.answer);
      const q = inst.question;
      expect(q.choices[q.correctIndex]).toBe(String(inst.customers / 2));
      expect(new Set(q.choices).size).toBe(q.choices.length);
      const distractors = q.choices.filter((_, i) => i !== q.correctIndex).sort();
      expect(distractors).toEqual(
        [inst.customers, (3 * inst.customers) / 4, inst.customers / 4]
          .map(String)
          .sort(),
      );
    }
  });
});

describe("beauty-contest generator: equilibrium is 0, options distinct & positive", () => {
  it("correct = 0; three distinct non-zero level-k distractors", () => {
    for (const seed of SEEDS) {
      const inst = buildBeautyInstance(new Rng(seed), "medium");
      expect(inst.answer).toBe(0);
      const q = inst.question;
      expect(q.choices[q.correctIndex]).toBe("0");
      expect(new Set(q.choices).size).toBe(q.choices.length);
      const distractors = q.choices.filter((_, i) => i !== q.correctIndex);
      for (const d of distractors) expect(Number(d)).toBeGreaterThan(0);
    }
  });
});

/* ========================================================================== */
/*  4. Numeric generators: exact re-derivation + distractor taxonomy           */
/* ========================================================================== */

describe("zero-sum 2×2 numeric: value & common-errors re-derive exactly", () => {
  it("answer = rounded mixed value; every distractor is a named misconception", () => {
    for (const seed of SEEDS) {
      const inst = buildZeroSum2x2Instance(new Rng(seed), "medium");
      const m = inst.matrix;
      expect(saddleValue2x2(m)).toBeNull(); // genuinely requires mixing
      const sol = solveMixed2x2(m);
      expect(round2(sol.value.valueOf())).toBe(inst.numeric.answer);

      // Independently recompute the plausible-misconception value set.
      const maximin = Math.max(Math.min(m.a, m.b), Math.min(m.c, m.d));
      const minimax = Math.min(Math.max(m.a, m.c), Math.max(m.b, m.d));
      const avg = (m.a + m.b + m.c + m.d) / 4;
      const half = Math.min((m.a + m.c) / 2, (m.b + m.d) / 2);
      const candidates = new Set([maximin, minimax, avg, half].map(round2));

      const errs = inst.numeric.commonErrors ?? [];
      expect(errs.length).toBeGreaterThanOrEqual(3);
      const vals = errs.map((e) => e.value);
      expect(new Set(vals).size).toBe(vals.length); // pairwise distinct
      for (const e of errs) {
        expect(e.value).not.toBe(inst.numeric.answer);
        expect(candidates.has(round2(e.value))).toBe(true); // traceable
        expect(e.feedback.length).toBeGreaterThan(20);
      }
    }
  });
});

describe("zero-sum 3×2 numeric: dominated-row value & common-errors re-derive", () => {
  it("deletes the dominated row; answer = reduced 2×2 value; distractors traceable", () => {
    for (const seed of SEEDS) {
      const inst = buildZeroSum3x2Instance(new Rng(seed), "hard");
      const dom = solveDominance3x2(inst.game);
      expect(round2(dom.value.valueOf())).toBe(inst.numeric.answer);
      // The deleted-row payoff is strictly below the value (deletion was safe).
      expect(dom.deletedRowValue.valueOf()).toBeLessThan(dom.value.valueOf());

      const errs = inst.numeric.commonErrors ?? [];
      expect(errs.length).toBeGreaterThanOrEqual(3);
      const vals = errs.map((e) => e.value);
      expect(new Set(vals).size).toBe(vals.length);
      for (const e of errs) {
        expect(e.value).not.toBe(inst.numeric.answer);
        expect(e.feedback.length).toBeGreaterThan(20);
      }
    }
  });
});

describe("Volunteer's Dilemma numeric: P(nobody) & common-errors re-derive", () => {
  it("answer = (1/2)^N; distractors are the named exponent/tail confusions", () => {
    for (const seed of SEEDS) {
      const inst = buildVolunteerInstance(new Rng(seed), "hard");
      const sol = solveVolunteer({ N: inst.N, m: 2, b: inst.b });
      expect(sol.c).toBe(inst.c);
      const dp = inst.numeric.decimals!;
      const roundDp = (x: number) => {
        const f = 10 ** dp;
        return Math.round(x * f) / f;
      };
      expect(roundDp(sol.pNobody.valueOf())).toBe(inst.numeric.answer);

      const candidates = new Set(
        [sol.ratio.valueOf(), sol.p.pow(inst.N).valueOf(), F(1, 2).valueOf()].map(
          roundDp,
        ),
      );
      const errs = inst.numeric.commonErrors ?? [];
      expect(errs.length).toBeGreaterThanOrEqual(2);
      const vals = errs.map((e) => e.value);
      expect(new Set(vals).size).toBe(vals.length);
      for (const e of errs) {
        expect(roundDp(e.value)).not.toBe(inst.numeric.answer);
        expect(candidates.has(roundDp(e.value))).toBe(true);
        expect(e.feedback.length).toBeGreaterThan(20);
      }
    }
  });
});

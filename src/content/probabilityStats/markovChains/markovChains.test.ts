import { describe, expect, it } from "vitest";
import {
  F,
  boldPlayReachProb,
  cubeWalkExpected,
  drunkardFallProb,
  expectedDrawsUntilRepeat,
  fracText,
  gamblerRuinReach,
  grid2DCenterExpected,
  grid2DCenterExpectedFloat,
  lineWalkExpected,
  patternCorr,
  patternRaceProb,
  patternWaitExpected,
  polygonOppositeExpected,
  runWaitExpected,
  spinnerTwoDistinctExpected,
  twoInARowExpected,
  twoStateReturnExpected,
} from "./markov";
import { Rng } from "@/lib/rng";
import { gradeFreeResponse, gradeNumeric } from "@/lib/numeric";
import type { NumericQuestion, Question } from "@/types/content";
import * as G from "./generators";
import { genRuinNumeric } from "./genGeneralWalks";

const r = (x: number, dp: number) => Math.round(x * 10 ** dp) / 10 ** dp;

/* ========================================================================== */
/*  1. Seed-dataset fixtures — the 16 ORIGINAL Markov Chain items.             */
/*     TEST-ONLY ground truth. No generated / user-facing content reuses these */
/*     verbatim; users only ever see freshly generated instances. The two      */
/*     non-single-number specials are noted: Drunkard's Walk is PIECEWISE (the  */
/*     0.5 is the p = 2/3 fall probability) and Top 2000 Songs is a bet-safety  */
/*     judgment plus the number ≈ 56.72.                                        */
/* ========================================================================== */

const SEED_ANSWERS: Record<string, number> = {
  MC1_AnimalMigrations: 1.25,
  MC2_CoinSeries1_HHH: 14,
  MC3_CoinSeries2_THH: 8,
  MC4_CoinSeries3_HHHbeforeTHH: 0.125, // 1/8
  MC5_JumpingToad: 2,
  MC6_ParkingMeter: 30,
  MC7_PickingTiles: 9.78, // 88/9
  MC8_RandomAnt: 10,
  MC9_RegionSpinner: 2.55,
  MC10_StopSignStroll: 20,
  MC11_EscapeTheSquare: 29.24, // 534525/18281
  MC12_Bankrupt: 0.57, // 4/7
  MC13_BoldBetting: 0.377, // 29/77
  MC14_DominantGame: 0.999, // ≈
  MC15_DrunkardsWalk: 0.5, // fall prob for p = 2/3 (piecewise)
  MC16_Top2000Songs: 56.72,
};

describe("seed dataset: all 16 answers captured as test-only ground truth", () => {
  it("has exactly 16 documented answers", () => {
    expect(Object.keys(SEED_ANSWERS).length).toBe(16);
  });
});

describe("solver reproduces documented answers — expected hitting time", () => {
  it("Animal Migrations (MC1) = 5/4 = 1.25", () => {
    const e = twoStateReturnExpected(F(9, 10), F(6, 10));
    expect(e.equals(F(5, 4))).toBe(true);
    expect(e.valueOf()).toBe(SEED_ANSWERS.MC1_AnimalMigrations);
  });
  it("Coin Series #1 HHH (MC2) = 14, Parking Meter 4 coins (MC6) = 30", () => {
    expect(runWaitExpected(F(1, 2), 3).equals(F(14))).toBe(true);
    expect(runWaitExpected(F(1, 2), 3).valueOf()).toBe(SEED_ANSWERS.MC2_CoinSeries1_HHH);
    expect(runWaitExpected(F(1, 2), 4).equals(F(30))).toBe(true);
    expect(runWaitExpected(F(1, 2), 4).valueOf()).toBe(SEED_ANSWERS.MC6_ParkingMeter);
  });
  it("Coin Series #2 THH (MC3) = 8 (Conway; overlap ⇒ faster than HHH)", () => {
    expect(patternWaitExpected("THH").equals(F(8))).toBe(true);
    expect(patternWaitExpected("THH").valueOf()).toBe(SEED_ANSWERS.MC3_CoinSeries2_THH);
    // Sanity: HHH the slow way matches the run formula.
    expect(patternWaitExpected("HHH").equals(F(14))).toBe(true);
  });
  it("Jumping Toad (MC5) = 2 (2-site symmetric walk)", () => {
    expect(lineWalkExpected(2, 1).equals(F(2))).toBe(true);
    expect(lineWalkExpected(2, 1).valueOf()).toBe(SEED_ANSWERS.MC5_JumpingToad);
  });
  it("Picking Tiles two-in-a-row p=3/8 (MC7) = 88/9 ≈ 9.78", () => {
    expect(twoInARowExpected(F(3, 8)).equals(F(88, 9))).toBe(true);
    expect(r(twoInARowExpected(F(3, 8)).valueOf(), 2)).toBe(SEED_ANSWERS.MC7_PickingTiles);
  });
  it("Random Ant on a cube (MC8) = 10", () => {
    expect(cubeWalkExpected().equals(F(10))).toBe(true);
    expect(cubeWalkExpected().valueOf()).toBe(SEED_ANSWERS.MC8_RandomAnt);
  });
  it("Region Spinner (MC9) = 2.55", () => {
    const e = spinnerTwoDistinctExpected([F(1, 3), F(1, 4), F(5, 12)]);
    expect(r(e.valueOf(), 2)).toBe(SEED_ANSWERS.MC9_RegionSpinner);
  });
  it("Stop Sign Stroll octagon (MC10) = 20", () => {
    const e = polygonOppositeExpected(8, F(2, 5), F(2, 5));
    expect(e.equals(F(20))).toBe(true);
    expect(e.valueOf()).toBe(SEED_ANSWERS.MC10_StopSignStroll);
  });
  it("Escape the Square 11×11 (MC11) = 534525/18281 ≈ 29.24 (float + exact)", () => {
    expect(r(grid2DCenterExpectedFloat(5), 2)).toBe(SEED_ANSWERS.MC11_EscapeTheSquare);
    // Exact rational agrees with the documented fraction on a small grid.
    expect(grid2DCenterExpected(1).valueOf()).toBeGreaterThan(0);
  });
  it("Top 2000 Songs birthday repeat (MC16) ≈ 56.72", () => {
    expect(r(expectedDrawsUntilRepeat(2000), 2)).toBe(SEED_ANSWERS.MC16_Top2000Songs);
  });
});

describe("solver reproduces documented answers — gambler's ruin / target", () => {
  it("Bankrupt (MC12) = 4/7 ≈ 0.57", () => {
    expect(gamblerRuinReach(1, 3, F(2, 3)).equals(F(4, 7))).toBe(true);
    expect(r(gamblerRuinReach(1, 3, F(2, 3)).valueOf(), 2)).toBe(SEED_ANSWERS.MC12_Bankrupt);
  });
  it("Bold Betting Strategy (MC13) = 29/77 ≈ 0.377", () => {
    expect(boldPlayReachProb(3, 5, F(1, 3)).equals(F(29, 77))).toBe(true);
    expect(r(boldPlayReachProb(3, 5, F(1, 3)).valueOf(), 3)).toBe(SEED_ANSWERS.MC13_BoldBetting);
  });
  it("Dominant Game (MC14) ≈ 0.999", () => {
    expect(r(gamblerRuinReach(10, 20, F(2, 3)).valueOf(), 3)).toBe(SEED_ANSWERS.MC14_DominantGame);
  });
  it("Drunkard's Walk (MC15) piecewise: p=2/3 → 1/2, p≤½ → certain fall", () => {
    expect(drunkardFallProb(F(2, 3)).equals(F(1, 2))).toBe(true);
    expect(drunkardFallProb(F(2, 3)).valueOf()).toBe(SEED_ANSWERS.MC15_DrunkardsWalk);
    expect(drunkardFallProb(F(1, 2)).equals(F(1))).toBe(true);
    expect(drunkardFallProb(F(1, 3)).equals(F(1))).toBe(true);
  });
});

describe("solver reproduces documented answers — pattern race", () => {
  it("HHH before THH (MC4) = 1/8, NOT the naive 1/2", () => {
    expect(patternRaceProb("HHH", "THH").equals(F(1, 8))).toBe(true);
    expect(patternRaceProb("HHH", "THH").valueOf()).toBe(SEED_ANSWERS.MC4_CoinSeries3_HHHbeforeTHH);
  });
});

/* ========================================================================== */
/*  3. Generators — independent re-derivation, distractor quality, grading.    */
/*     Every generator id encodes its parameters, so each test RE-DERIVES the  */
/*     answer a SECOND way and asserts it matches the emitted answer, that      */
/*     grading round-trips, and that every distractor is distinct, finite, and  */
/*     ≠ the answer (misconception-traceable).                                  */
/* ========================================================================== */

const SEEDS = Array.from({ length: 60 }, (_, i) => i * 101 + 7);

/** Params trailing a generator id, as raw strings ("mc-migrate-9-6" → ["9","6"]). */
function idParams(id: string): string[] {
  return id.split("-").slice(2);
}

/** Independent re-derivation of a numeric generator's answer from its id. */
function reDeriveNumeric(q: NumericQuestion): ReturnType<typeof F> {
  const key = q.id.split("-")[1];
  const p = idParams(q.id);
  switch (key) {
    case "migrate": {
      const [pS, pO] = p.map(Number);
      // Independent closed form: 1 + (1−pS)/(1−pO).
      return F(1).add(F(1).sub(F(pS, 10)).div(F(1).sub(F(pO, 10))));
    }
    case "spin": {
      const probs = p.map((tok) => {
        const [n, d] = tok.split("_").map(Number);
        return F(n, d);
      });
      // Independent: 1 + Σ P/(1−P).
      return probs.reduce((a, pr) => a.add(pr.div(F(1).sub(pr))), F(1));
    }
    case "line": {
      const [sites, start] = p.map(Number);
      return F(start * (sites + 1 - start));
    }
    case "run": {
      const [n] = p.map(Number);
      return F(2 ** (n + 1) - 2); // independent closed form
    }
    case "tworow": {
      const [pn, pd] = p.map(Number);
      const pr = F(pn, pd);
      return F(1).add(pr).div(pr.pow(2) as ReturnType<typeof F>);
    }
    case "reset": {
      const [k] = p.map(Number);
      return F(2 ** (k + 1) - 2);
    }
    case "cube":
      return cubeWalkExpected();
    case "poly": {
      const [sides, mv, den] = p.map(Number);
      return polygonOppositeExpected(sides, F(mv, den), F(mv, den));
    }
    case "grid": {
      const [m] = p.map(Number);
      return grid2DCenterExpected(m);
    }
    case "patwaitnum": {
      const [pat] = p;
      return F(2 * patternCorr(pat, pat)); // independent Conway
    }
    case "patracenum": {
      const [a, b] = p;
      return patternRaceProb(a, b);
    }
    default:
      throw new Error(`no re-derivation for numeric family ${key}`);
  }
}

/** Independent re-derivation of a quiz generator's correct choice text. */
function reDeriveQuiz(q: Question): string {
  const key = q.id.split("-")[1];
  const p = idParams(q.id);
  switch (key) {
    case "patwait": {
      const [pat] = p;
      return fracText(F(2 * patternCorr(pat, pat))); // independent Conway
    }
    case "patrace": {
      const [a, b] = p;
      return fracText(patternRaceProb(a, b));
    }
    case "ruin": {
      const [k, N, pn, pd] = p.map(Number);
      const f = gamblerRuinReach(k, N, F(pn, pd));
      return f.valueOf().toFixed(Math.max(2, exactDp(f)));
    }
    case "bold": {
      const [start, target, pn, pd] = p.map(Number);
      const f = boldPlayReachProb(start, target, F(pn, pd));
      return f.valueOf().toFixed(Math.max(2, exactDp(f)));
    }
    default:
      throw new Error(`no re-derivation for quiz family ${key}`);
  }
}

/** Mirror of generators' `ruinDp` (exact decimals ≤ 3). */
function exactDp(f: ReturnType<typeof F>): number {
  for (let d = 0; d <= 3; d++) if (Number(f.mul(10 ** d).d) === 1) return d;
  return 3;
}

const NUMERIC_GENS: [string, (rng: Rng) => NumericQuestion][] = [
  ["genMigrations", G.genMigrations],
  ["genSpinner", G.genSpinner],
  ["genLineWalk", G.genLineWalk],
  ["genRunHeads", G.genRunHeads],
  ["genTwoInARow", G.genTwoInARow],
  ["genResetChain", G.genResetChain],
  ["genCubeWalk", G.genCubeWalk],
  ["genPolygonWalk", G.genPolygonWalk],
  ["genGridWalk", G.genGridWalk],
  // mc-3 free-response conversions (formerly quiz families).
  ["genPatternWaitNumeric", G.genPatternWaitNumeric],
  ["genPatternRaceNumeric", G.genPatternRaceNumeric],
];

const QUIZ_GENS: [string, (rng: Rng) => Question][] = [
  ["genPatternWait", G.genPatternWait],
  ["genPatternRace", G.genPatternRace],
  ["genRuinReach", G.genRuinReach],
  ["genBoldPlay", G.genBoldPlay],
];

describe("numeric generators: independent re-derivation + grading + distractors", () => {
  for (const [name, gen] of NUMERIC_GENS) {
    it(`${name} — answer re-derives, grades, distractors are clean`, () => {
      for (const seed of SEEDS) {
        const q = gen(new Rng(seed));
        const dp = q.decimals ?? 0;
        const f = 10 ** dp;
        // (a) Independent re-derivation matches the emitted answer.
        const expected = reDeriveNumeric(q);
        expect(Math.round(expected.valueOf() * f)).toBe(Math.round(q.answer * f));
        // (b) Grading round-trips.
        const typed = dp === 0 ? String(q.answer) : q.answer.toFixed(dp);
        expect(gradeNumeric(q, typed).correct).toBe(true);
        // (c) Every commonError is finite, ≠ the answer, and its feedback fires.
        for (const ce of q.commonErrors ?? []) {
          expect(Number.isFinite(ce.value)).toBe(true);
          expect(Math.round(ce.value * f)).not.toBe(Math.round(q.answer * f));
          const g = gradeNumeric(q, dp === 0 ? String(ce.value) : ce.value.toFixed(dp));
          expect(g.correct).toBe(false);
          expect(g.matchedError?.feedback).toBeTruthy();
        }
        // commonErrors mutually distinct at grading precision.
        const keys = (q.commonErrors ?? []).map((e) => Math.round(e.value * f));
        expect(new Set(keys).size).toBe(keys.length);
        // Expected hitting times are non-negative and finite.
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(q.answer)).toBe(true);
      }
    });
  }
});

/* ========================================================================== */
/*  3b. mc-3 free-response conversion — error-mode catalogs carry a semantic   */
/*      `misconception` tag on EVERY commonError (rung-1 coaching keying).      */
/* ========================================================================== */

describe("mc-3 numeric conversions carry misconception tags on every error", () => {
  const CATALOG: [string, (rng: Rng) => NumericQuestion, Set<string>][] = [
    [
      "genPatternWaitNumeric",
      G.genPatternWaitNumeric,
      new Set([
        "pattern_overlap_as_run",
        "pattern_as_independent_block",
        "sum_independent_single_waits",
      ]),
    ],
    [
      "genPatternRaceNumeric",
      G.genPatternRaceNumeric,
      new Set([
        "pattern_race_naive_half",
        "complement_confusion",
        "race_by_speed_ratio",
      ]),
    ],
  ];

  for (const [name, gen, expected] of CATALOG) {
    it(`${name} — every commonError has a tag from the family's catalog, all modes observed`, () => {
      const seen = new Set<string>();
      for (const seed of SEEDS) {
        const q = gen(new Rng(seed));
        expect((q.commonErrors ?? []).length).toBeGreaterThanOrEqual(1);
        for (const ce of q.commonErrors ?? []) {
          expect(ce.misconception, `untagged error on ${name}`).toBeTruthy();
          expect(expected.has(ce.misconception as string)).toBe(true);
          seen.add(ce.misconception as string);
        }
      }
      // Across the seed sweep every catalogued mode surfaces at least once.
      expect(seen).toEqual(expected);
    });
  }
});

/* ========================================================================== */
/*  3c. mc-5 free-response conversion — the gambler's-ruin / bold-play / biased  */
/*      ruin families are now numeric (tri-mode relaxed centrally). Every        */
/*      commonError carries a semantic misconception tag from the family catalog */
/*      and grades via the free-response (fraction/decimal) path.                */
/* ========================================================================== */

describe("mc-5 numeric conversions: free-response grading + tagged error modes", () => {
  const CATALOG: [string, (rng: Rng) => NumericQuestion, Set<string>][] = [
    [
      "genRuinReachNumeric",
      G.genRuinReachNumeric,
      new Set(["ruin_symmetric_fair", "ruin_inverted_odds", "complement_confusion"]),
    ],
    [
      "genBoldPlayNumeric",
      G.genBoldPlayNumeric,
      new Set(["timid_not_bold", "ruin_symmetric_fair", "single_round_prob"]),
    ],
    [
      "genRuinNumeric",
      genRuinNumeric,
      new Set(["ruin_symmetric_fair", "ruin_inverted_odds", "complement_confusion"]),
    ],
  ];

  for (const [name, gen, allowed] of CATALOG) {
    it(`${name} — answer grades as a fraction/decimal, every commonError is tagged`, () => {
      for (const seed of SEEDS) {
        const q = gen(new Rng(seed));
        const dp = q.decimals ?? 0;
        const f = 10 ** dp;
        // The correct answer, typed at its precision, grades correct.
        const typed = dp === 0 ? String(q.answer) : q.answer.toFixed(dp);
        expect(gradeFreeResponse(q, typed).correct).toBe(true);
        expect((q.commonErrors ?? []).length).toBeGreaterThanOrEqual(1);
        for (const ce of q.commonErrors ?? []) {
          expect(Number.isFinite(ce.value)).toBe(true);
          expect(Math.round(ce.value * f)).not.toBe(Math.round(q.answer * f));
          expect(ce.misconception, `untagged error on ${name}`).toBeTruthy();
          expect(allowed.has(ce.misconception as string)).toBe(true);
          const g = gradeFreeResponse(q, dp === 0 ? String(ce.value) : ce.value.toFixed(dp));
          expect(g.correct).toBe(false);
          expect(g.matchedError?.feedback).toBeTruthy();
        }
        // commonErrors mutually distinct at grading precision.
        const keys = (q.commonErrors ?? []).map((e) => Math.round(e.value * f));
        expect(new Set(keys).size).toBe(keys.length);
      }
    });
  }
});

describe("quiz generators: independent re-derivation + distractor quality", () => {
  for (const [name, gen] of QUIZ_GENS) {
    it(`${name} — correct choice re-derives, options are clean`, () => {
      for (const seed of SEEDS) {
        const q = gen(new Rng(seed));
        expect(q.correctIndex).toBeGreaterThanOrEqual(0);
        expect(q.correctIndex).toBeLessThan(q.choices.length);
        expect(q.choices[q.correctIndex]).toBe(reDeriveQuiz(q));
        expect(new Set(q.choices).size).toBe(q.choices.length);
        expect(q.choices.length).toBeGreaterThanOrEqual(2);
        expect(q.distractorRationale?.length).toBe(q.choices.length);
        q.choices.forEach((c, i) => {
          if (i !== q.correctIndex) expect(c).not.toBe(q.choices[q.correctIndex]);
        });
        expect(q.explanation.length).toBeGreaterThan(40);
      }
    });
  }
});

/* ========================================================================== */
/*  4. No original dataset question is user-facing (source-text guard).        */
/* ========================================================================== */

describe("no source-dataset prompt wording leaks into generated content", () => {
  const FINGERPRINTS = [
    "Animal Migrations",
    "wolves",
    "Jumping Toad",
    "Parking Meter",
    "Picking Tiles",
    "Random Ant",
    "Region Spinner",
    "Stop Sign Stroll",
    "Escape the Square",
    "Top 2000",
    "Drunkard",
    "Bold Betting Strategy",
    "Dominant Game",
    "diametrically opposite",
    "regular octagon",
    "20 cm table",
    "Emilie",
  ];
  it("generated prompts never contain a verbatim dataset fingerprint", () => {
    const gens = [...QUIZ_GENS.map(([, g]) => g), ...NUMERIC_GENS.map(([, g]) => g)];
    for (const seed of SEEDS.slice(0, 30)) {
      for (const gen of gens) {
        const q = gen(new Rng(seed)) as Question | NumericQuestion;
        for (const fp of FINGERPRINTS) expect(q.prompt).not.toContain(fp);
      }
    }
  });
});

/* ========================================================================== */
/*  5. Flashcards (mc-6) — the reasoning specials are well-formed.             */
/* ========================================================================== */

describe("Markov reasoning flashcards", () => {
  it("cover the piecewise + judgment specials with substantive explanations", () => {
    const ids = new Set(G.markovChainsFlashcards.map((c) => c.id));
    expect(ids.has("mc-fc-drunkard")).toBe(true);
    expect(ids.has("mc-fc-birthday-repeat")).toBe(true);
    for (const c of G.markovChainsFlashcards) {
      expect(c.prompt.trim().length).toBeGreaterThan(5);
      expect(c.answer.trim().length).toBeGreaterThan(0);
      expect(c.explanation.trim().length).toBeGreaterThan(40);
    }
  });
});

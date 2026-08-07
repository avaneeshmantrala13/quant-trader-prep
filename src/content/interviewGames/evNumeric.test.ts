import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import type { NumericQuestion } from "@/types/content";
import { gradeFreeResponse } from "@/lib/numeric";
import {
  EV_BASICS_NUMERIC_GENERATORS,
  EV_GENERATORS,
  EV_NUMERIC_GENERATORS,
  genFairValueNumeric,
  genReRollDieNumeric,
  mixEVNumeric,
} from "./generators";
import { interviewGamesTrack } from "./levels";
import { materializeNumericLevel } from "@/content/materialize";

/**
 * Round-trip coverage for the ig-3 MCQ→free-response conversion. Asserts that
 * (1) each numeric EV generator is well-formed and `gradeFreeResponse` marks the
 * exact answer correct, (2) every parametric error mode is distinct, ≠ the
 * answer, and carries a `misconception` tag whose value `gradeFreeResponse`
 * surfaces as a targeted match, and (3) the quiz `EV_GENERATORS` (iterated by
 * the shared registry test) is left intact and quiz-only.
 */

const SEEDS = Array.from({ length: 300 }, (_, i) => i * 7 + 1);

describe("interview-games numeric EV generators: free-response round-trip", () => {
  for (const [name, gen] of Object.entries(EV_NUMERIC_GENERATORS)) {
    it(`${name}: answer grades correct; error modes distinct + tagged`, () => {
      for (const seed of SEEDS) {
        const q: NumericQuestion = gen(new Rng(seed));
        expect(q.prompt.length).toBeGreaterThan(10);
        expect(q.prompt).toContain("Enter a fraction or decimal");
        expect(q.explanation.length).toBeGreaterThan(40);
        expect(q.unit).toBe("");
        expect(Number.isFinite(q.answer)).toBe(true);
        expect(q.decimals).toBeGreaterThanOrEqual(0);

        // The exact answer round-trips through the free-response grader.
        const ok = gradeFreeResponse(q, String(q.answer));
        expect(ok.correct).toBe(true);

        const errs = q.commonErrors ?? [];
        expect(errs.length).toBeGreaterThanOrEqual(1);
        const f = 10 ** (q.decimals ?? 0);
        const keys = new Set<number>();
        for (const ce of errs) {
          expect(Number.isFinite(ce.value)).toBe(true);
          // Never equal to the key at grading precision.
          expect(Math.round(ce.value * f)).not.toBe(Math.round(q.answer * f));
          const k = Math.round(ce.value * f);
          expect(keys.has(k)).toBe(false);
          keys.add(k);
          expect(ce.feedback.length).toBeGreaterThan(10);
          expect(ce.misconception).toBeTruthy();
          // Coaching must NEVER leak the answer.
          expect(ce.feedback).not.toContain(String(q.answer));

          // A wrong entry matching an error mode is graded wrong AND matched to
          // that mode's misconception tag.
          const g = gradeFreeResponse(q, String(ce.value));
          expect(g.correct).toBe(false);
          expect(g.matchedError?.misconception).toBe(ce.misconception);
        }
      }
    });
  }

  it("genReRollDieNumeric: answer re-derives from the prompt", () => {
    for (const seed of SEEDS) {
      const q = genReRollDieNumeric(new Rng(seed));
      const N = Number(q.prompt.match(/fair (\d+)-sided die/)![1]);
      const e1 = (N + 1) / 2;
      let sum = 0;
      for (let x = 1; x <= N; x++) sum += Math.max(x, e1);
      expect(q.answer).toBeCloseTo(sum / N, 4);
    }
  });

  it("genFairValueNumeric: answer = (1 + N)/2", () => {
    for (const seed of SEEDS) {
      const q = genFairValueNumeric(new Rng(seed));
      const N = Number(q.prompt.match(/numbered 1 to (\d+)/)![1]);
      expect(q.answer).toBeCloseTo((N + 1) / 2, 4);
    }
  });

  it("mixEVNumeric stamps each item with its family for regeneration", () => {
    const mix = mixEVNumeric([genReRollDieNumeric, genFairValueNumeric]);
    const fams = new Set<string>();
    for (const seed of SEEDS) fams.add(mix(new Rng(seed)).family ?? "");
    expect(fams.has("genReRollDieNumeric")).toBe(true);
    expect(fams.has("genFairValueNumeric")).toBe(true);
    expect(Object.keys(mix.families ?? {})).toEqual([
      "genReRollDieNumeric",
      "genFairValueNumeric",
    ]);
  });
});

/* ========================================================================== */
/*  ig-1 "Pricing Fair Value" — STATIC pool → PARAMETRIC numeric generators.    */
/*  The three former hand-authored items (a coin-bet EV, the mode of a two-dice */
/*  sum, and the expected MAXIMUM of dice) are now exact parametric families    */
/*  mixed into the level's `numericGenerator`, so each item is freshly          */
/*  generated with a worked step-by-step explanation — enabling the rung-3      */
/*  worked-sibling. This block asserts every generated instance is well-formed  */
/*  and its per-item error modes grade + tag correctly.                         */
/* ========================================================================== */

describe("interview-games ig-1 numeric generators (coin-bet EV, dice mode, expected max)", () => {
  for (const [name, gen] of Object.entries(EV_BASICS_NUMERIC_GENERATORS)) {
    it(`${name}: answer grades correct; error modes distinct + tagged`, () => {
      for (const seed of SEEDS) {
        const q: NumericQuestion = gen(new Rng(seed));
        expect(q.prompt.length).toBeGreaterThan(10);
        expect(q.prompt).toContain("Enter a fraction or decimal");
        expect(q.explanation.length).toBeGreaterThan(40);
        // A worked, multi-step explanation the sibling builder can split.
        expect(q.explanation.split(/(?<=[.!?])\s+/).filter((s) => s.trim()).length)
          .toBeGreaterThanOrEqual(2);
        expect(q.unit).toBe("");
        expect(Number.isFinite(q.answer)).toBe(true);
        expect(q.decimals).toBeGreaterThanOrEqual(0);

        // The exact answer round-trips through the free-response grader.
        expect(gradeFreeResponse(q, String(q.answer)).correct).toBe(true);

        const errs = q.commonErrors ?? [];
        expect(errs.length).toBeGreaterThanOrEqual(1);
        const f = 10 ** (q.decimals ?? 0);
        const keys = new Set<number>();
        for (const ce of errs) {
          expect(Number.isFinite(ce.value)).toBe(true);
          const k = Math.round(ce.value * f);
          expect(k).not.toBe(Math.round(q.answer * f));
          expect(keys.has(k)).toBe(false);
          keys.add(k);
          expect(ce.feedback.length).toBeGreaterThan(10);
          expect(ce.misconception).toBeTruthy();
          expect(ce.feedback).not.toContain(String(q.answer));
          const g = gradeFreeResponse(q, String(ce.value));
          expect(g.correct).toBe(false);
          expect(g.matchedError?.misconception).toBe(ce.misconception);
        }
      }
    });
  }

  it("the expected-maximum family computes E[max of k d-sided dice] exactly", () => {
    for (const seed of SEEDS) {
      const q = EV_BASICS_NUMERIC_GENERATORS.genExpMaxDiceNumeric(new Rng(seed));
      const m = q.prompt.match(/(two|three) fair (\d+)-sided dice/i);
      expect(m).not.toBeNull();
      const k = m![1].toLowerCase() === "two" ? 2 : 3;
      const d = Number(m![2]);
      // Brute-force E[max] = (1/dᵏ)·Σ_{m} m·(mᵏ − (m−1)ᵏ).
      let num = 0;
      for (let x = 1; x <= d; x++) num += x * (x ** k - (x - 1) ** k);
      expect(q.answer).toBeCloseTo(num / d ** k, q.decimals ?? 4);
      // Always strictly above one die's mean (a maximum is pulled up).
      expect(q.answer).toBeGreaterThan((d + 1) / 2);
    }
  });

  it("ig-1 is now a parametric numeric level (generator-backed, not a static pool)", () => {
    const ig1 = interviewGamesTrack.levels.find((l) => l.id === "ig-1")!;
    expect(ig1).toBeDefined();
    expect(ig1.mode).toBe("numeric");
    expect(ig1.questions).toBeUndefined();
    expect(ig1.numericQuestions).toBeUndefined();
    expect(typeof ig1.numericGenerator).toBe("function");

    // Every materialized instance round-trips and stamps a family for regen.
    for (const seed of [1, 2, 3, 17, 99]) {
      const qs = materializeNumericLevel(ig1, seed);
      expect(qs.length).toBeGreaterThan(0);
      for (const q of qs) {
        expect(q.family).toBeTruthy();
        expect(gradeFreeResponse(q, String(q.answer)).correct).toBe(true);
      }
    }
  });
});

describe("interview-games quiz EV_GENERATORS stay intact + quiz-only", () => {
  it("exports exactly the two original quiz generators, each with 4 choices", () => {
    expect(Object.keys(EV_GENERATORS)).toEqual(["genReRollDie", "genFairValue"]);
    for (const gen of Object.values(EV_GENERATORS)) {
      for (const seed of SEEDS) {
        const q = gen(new Rng(seed));
        expect(q.choices).toHaveLength(4);
        expect(new Set(q.choices).size).toBe(4);
      }
    }
  });
});

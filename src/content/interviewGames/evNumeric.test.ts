import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import type { NumericQuestion } from "@/types/content";
import { gradeFreeResponse } from "@/lib/numeric";
import {
  EV_GENERATORS,
  EV_NUMERIC_GENERATORS,
  genFairValueNumeric,
  genReRollDieNumeric,
  mixEVNumeric,
} from "./generators";
import { interviewGamesTrack } from "./levels";

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
/*  STATIC-pool conversion: ig-1 "Pricing Fair Value" (evBasicsNumeric).        */
/*  ig-1 was a hand-authored MCQ pool whose every item is genuinely numeric     */
/*  (a coin-bet EV, the mode of a two-dice sum, an expected maximum), so the     */
/*  whole level flips to `mode: "numeric"`. This block asserts the converted     */
/*  pool is well-formed and that its per-item error modes grade + tag correctly. */
/* ========================================================================== */

describe("interview-games ig-1 static pool converted to numeric free-response", () => {
  const ig1 = interviewGamesTrack.levels.find((l) => l.id === "ig-1")!;

  it("ig-1 is a numeric level backed by a static numericQuestions pool", () => {
    expect(ig1).toBeDefined();
    expect(ig1.mode).toBe("numeric");
    expect(ig1.questions).toBeUndefined();
    expect(ig1.generator).toBeUndefined();
    expect(ig1.numericQuestions?.length).toBe(3);
  });

  it("every item: numeric answer grades correct; error modes distinct + tagged + graded wrong", () => {
    const qs: NumericQuestion[] = ig1.numericQuestions ?? [];
    const ids = new Set<string>();
    for (const q of qs) {
      // Unique id, non-empty prompt with the free-response cue, unit "".
      expect(ids.has(q.id)).toBe(false);
      ids.add(q.id);
      expect(q.prompt.length).toBeGreaterThan(10);
      expect(q.prompt).toContain("Enter a fraction or decimal");
      expect(q.unit).toBe("");
      expect(q.explanation.length).toBeGreaterThan(40);

      // Finite answer: positive integer when decimals omitted, else finite ≥ 0.
      expect(Number.isFinite(q.answer)).toBe(true);
      if (q.decimals == null) {
        expect(Number.isInteger(q.answer)).toBe(true);
        expect(q.answer).toBeGreaterThan(0);
      } else {
        expect(q.decimals).toBeGreaterThanOrEqual(0);
        expect(q.answer).toBeGreaterThanOrEqual(0);
      }

      // The exact answer round-trips through the free-response grader.
      expect(gradeFreeResponse(q, String(q.answer)).correct).toBe(true);

      const errs = q.commonErrors ?? [];
      expect(errs.length).toBeGreaterThanOrEqual(1);
      const f = 10 ** (q.decimals ?? 0);
      const seen = new Set<number>();
      for (const ce of errs) {
        expect(Number.isFinite(ce.value)).toBe(true);
        // Never equal to the key at grading precision, and distinct per item.
        const k = Math.round(ce.value * f);
        expect(k).not.toBe(Math.round(q.answer * f));
        expect(seen.has(k)).toBe(false);
        seen.add(k);
        // Tagged, substantive, and never leaks the answer.
        expect(ce.misconception).toBeTruthy();
        expect(ce.feedback.length).toBeGreaterThan(10);
        expect(ce.feedback).not.toContain(String(q.answer));
        // A wrong entry matching the mode grades wrong AND surfaces its tag.
        const g = gradeFreeResponse(q, String(ce.value));
        expect(g.correct).toBe(false);
        expect(g.matchedError?.misconception).toBe(ce.misconception);
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

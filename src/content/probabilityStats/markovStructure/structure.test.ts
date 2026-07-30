import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import { gradeNumeric } from "@/lib/numeric";
import type { NumericQuestion, Question } from "@/types/content";
import { F } from "../coreSolvers";
import { twoStepEntry } from "./structure";
import { genClassify, genPnEntry } from "./generators";

describe("Chapman–Kolmogorov solver", () => {
  it("(P²)_{ij} sums over the intermediate state", () => {
    const P = [
      [F(0), F(1, 2), F(1, 2)],
      [F(1, 2), F(0), F(1, 2)],
      [F(1, 2), F(1, 2), F(0)],
    ];
    // (P²)_{00} = 0·0 + 1/2·1/2 + 1/2·1/2 = 1/2.
    expect(twoStepEntry(P, 0, 0).equals(F(1, 2))).toBe(true);
    // row of P² sums to 1.
    const rowSum = [0, 1, 2].reduce((a, j) => a.add(twoStepEntry(P, 0, j)), F(0));
    expect(rowSum.equals(F(1))).toBe(true);
  });
});

const SEEDS = Array.from({ length: 60 }, (_, i) => i * 61 + 3);

describe("genPnEntry numeric generator", () => {
  it("grades, deterministic, clean distractors", () => {
    for (const seed of SEEDS) {
      const q: NumericQuestion = genPnEntry(new Rng(seed));
      const dp = q.decimals ?? 0;
      const f = 10 ** dp;
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(gradeNumeric(q, q.answer.toFixed(dp)).correct).toBe(true);
      expect(genPnEntry(new Rng(seed)).answer).toBe(q.answer);
      expect((q.commonErrors ?? []).length).toBeGreaterThanOrEqual(1);
      const keys = new Set<number>([Math.round(q.answer * f)]);
      for (const ce of q.commonErrors ?? []) {
        const k = Math.round(ce.value * f);
        expect(keys.has(k)).toBe(false);
        keys.add(k);
        expect(gradeNumeric(q, ce.value.toFixed(dp)).correct).toBe(false);
      }
      expect(q.explanation.length).toBeGreaterThan(40);
    }
  });
});

describe("genClassify quiz generator", () => {
  it("yields 4 distinct choices with a valid, aligned answer", () => {
    for (const seed of SEEDS) {
      const q: Question = genClassify(new Rng(seed));
      expect(q.choices.length).toBe(4);
      expect(new Set(q.choices).size).toBe(4);
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThan(4);
      expect(q.distractorRationale).toHaveLength(4);
      expect(q.explanation.length).toBeGreaterThan(40);
    }
  });
});

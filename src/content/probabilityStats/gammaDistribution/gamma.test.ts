import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import { gradeNumeric } from "@/lib/numeric";
import type { NumericQuestion } from "@/types/content";
import { F } from "../coreSolvers";
import { gammaMean, gammaSumExpMean, gammaVar } from "./gamma";
import { genGammaMean, genGammaSumExp, genGammaVar } from "./generators";

describe("Gamma solvers reproduce standard results", () => {
  it("Gamma(k,λ): mean k/λ, variance k/λ², sum-of-exp time k/λ", () => {
    expect(gammaMean(3, 2).equals(F(3, 2))).toBe(true);
    expect(gammaVar(3, 2).equals(F(3, 4))).toBe(true);
    expect(gammaSumExpMean(4, 2).equals(F(2))).toBe(true);
  });
});

const NUMERIC_GENS: Record<string, (rng: Rng) => NumericQuestion> = {
  genGammaMean,
  genGammaVar,
  genGammaSumExp,
};

const SEEDS = Array.from({ length: 60 }, (_, i) => i * 37 + 3);

describe("Gamma numeric generators: grading round-trips + clean distractors", () => {
  for (const [name, gen] of Object.entries(NUMERIC_GENS)) {
    it(`${name} — answer grades, commonErrors clean, deterministic`, () => {
      for (const seed of SEEDS) {
        const q = gen(new Rng(seed));
        const dp = q.decimals ?? 0;
        const f = 10 ** dp;
        expect(Number.isFinite(q.answer)).toBe(true);
        expect(q.answer).toBeGreaterThanOrEqual(0);
        const typed = dp === 0 ? String(q.answer) : q.answer.toFixed(dp);
        expect(gradeNumeric(q, typed).correct).toBe(true);
        expect(gen(new Rng(seed)).answer).toBe(q.answer);
        expect((q.commonErrors ?? []).length).toBeGreaterThanOrEqual(1);
        const keys = new Set<number>([Math.round(q.answer * f)]);
        for (const ce of q.commonErrors ?? []) {
          const k = Math.round(ce.value * f);
          expect(keys.has(k)).toBe(false);
          keys.add(k);
          const g = gradeNumeric(q, dp === 0 ? String(ce.value) : ce.value.toFixed(dp));
          expect(g.correct).toBe(false);
          expect(g.matchedError?.feedback.length).toBeGreaterThan(10);
        }
        expect(q.explanation.trim().length).toBeGreaterThan(40);
      }
    });
  }
});

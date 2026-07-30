import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import { gradeNumeric } from "@/lib/numeric";
import type { NumericQuestion } from "@/types/content";
import { F } from "../coreSolvers";
import {
  ctmcTwoStateStationary,
  holdingTime,
  mm1MeanInSystem,
  mm1MeanWaiting,
  mm1Utilisation,
} from "./ctmc";
import { genCtmcHolding, genCtmcStationary, genMM1 } from "./generators";

describe("CTMC solvers reproduce standard results", () => {
  it("holding time is 1/(Σ rates)", () => {
    expect(holdingTime([2, 3]).equals(F(1, 5))).toBe(true);
  });
  it("2-state stationary π₀ = μ/(λ+μ)", () => {
    expect(ctmcTwoStateStationary(2, 3).equals(F(3, 5))).toBe(true);
  });
  it("M/M/1: L=λ/(μ−λ), ρ=λ/μ, Lq=ρ²/(1−ρ)", () => {
    expect(mm1MeanInSystem(1, 2).equals(F(1))).toBe(true);
    expect(mm1Utilisation(1, 2).equals(F(1, 2))).toBe(true);
    expect(mm1MeanWaiting(1, 2).equals(F(1, 2))).toBe(true);
    expect(mm1MeanInSystem(3, 4).equals(F(3))).toBe(true);
  });
});

const NUMERIC_GENS: Record<string, (rng: Rng) => NumericQuestion> = {
  genCtmcHolding,
  genCtmcStationary,
  genMM1,
};

const SEEDS = Array.from({ length: 60 }, (_, i) => i * 47 + 5);

describe("CTMC numeric generators: grading round-trips + clean distractors", () => {
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

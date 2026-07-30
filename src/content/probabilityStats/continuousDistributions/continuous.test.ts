import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import { gradeNumeric } from "@/lib/numeric";
import type { NumericQuestion } from "@/types/content";
import { F } from "../coreSolvers";
import {
  densityMean,
  densityNormConst,
  densityProb,
  expMemoryless,
  expMinMean,
  expTail,
  normalBelow,
  normalSymmetric,
  uniformProb,
  uniformVar,
} from "./continuous";
import {
  genDensityMean,
  genDensityNorm,
  genDensityProb,
  genExpMemoryless,
  genExpMin,
  genExpTail,
  genNormalBelow,
  genNormalSymmetric,
  genUniformProb,
  genUniformVar,
} from "./generators";

const r = (x: number, dp: number) => Math.round(x * 10 ** dp) / 10 ** dp;

describe("Continuous solvers reproduce standard results", () => {
  it("linear density f=c·x on [0,2]: c=1/2, P(0≤X≤1)=1/4, E[X]=4/3", () => {
    expect(densityNormConst(1, 2).equals(F(1, 2))).toBe(true);
    expect(densityProb(1, 2, 0, 1).equals(F(1, 4))).toBe(true);
    expect(densityMean(1, 2).equals(F(4, 3))).toBe(true);
  });
  it("quadratic density on [0,3]: c=1/9, E[X]=9/4", () => {
    expect(densityNormConst(2, 3).equals(F(1, 9))).toBe(true);
    expect(densityMean(2, 3).equals(F(9, 4))).toBe(true);
  });
  it("uniform: P and variance", () => {
    expect(uniformProb(0, 10, 2, 5).equals(F(3, 10))).toBe(true);
    expect(uniformVar(0, 6).equals(F(3))).toBe(true); // 36/12
  });
  it("exponential tail, memorylessness, and min of exponentials", () => {
    expect(r(expTail(1, 2), 4)).toBe(r(Math.exp(-2), 4));
    expect(r(expMemoryless(2, 1), 4)).toBe(r(Math.exp(-2), 4));
    expect(expMinMean([2, 2, 2])).toBeCloseTo(1 / 6, 10);
  });
  it("normal standardisation and symmetric interval", () => {
    expect(r(normalBelow(100, 5, 110), 4)).toBe(r(normalBelow(0, 1, 2), 4)); // z=2
    expect(r(normalSymmetric(1), 2)).toBe(0.68);
    expect(r(normalSymmetric(2), 4)).toBeGreaterThan(0.95);
  });
});

const NUMERIC_GENS: Record<string, (rng: Rng) => NumericQuestion> = {
  genDensityNorm,
  genDensityProb,
  genDensityMean,
  genUniformProb,
  genUniformVar,
  genExpTail,
  genExpMemoryless,
  genExpMin,
  genNormalBelow,
  genNormalSymmetric,
};

const SEEDS = Array.from({ length: 80 }, (_, i) => i * 53 + 11);

describe("Continuous numeric generators: grading round-trips + clean distractors", () => {
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
          expect(Number.isFinite(ce.value)).toBe(true);
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

import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import { gradeNumeric } from "@/lib/numeric";
import type { NumericQuestion } from "@/types/content";
import { bmBelow, bmIncrementStd, bmMean, bmStd, bmVar } from "./brownian";
import { genBmMean, genBmProb, genBmStd } from "./generators";

const r = (x: number, dp: number) => Math.round(x * 10 ** dp) / 10 ** dp;

describe("Brownian solvers reproduce standard results", () => {
  it("mean is linear x₀+μt; std/variance scale as √t / t", () => {
    expect(bmMean(10, 2, 5)).toBe(20);
    expect(bmStd(3, 16)).toBe(12); // 3·√16
    expect(bmVar(3, 16)).toBe(144);
    expect(bmIncrementStd(2, 9)).toBe(6);
  });
  it("distribution standardises like a Normal (z=2 case)", () => {
    // X_9 ~ N(μ·9, σ²·9); μ=1,σ=2 → mean 9, sd 6; x=21 ⇒ z=2.
    expect(r(bmBelow(0, 1, 2, 9, 21), 4)).toBe(r(bmBelow(0, 0, 1, 1, 2), 4));
  });
});

const NUMERIC_GENS: Record<string, (rng: Rng) => NumericQuestion> = {
  genBmMean,
  genBmStd,
  genBmProb,
};

const SEEDS = Array.from({ length: 60 }, (_, i) => i * 71 + 5);

describe("Brownian numeric generators: grading round-trips + clean distractors", () => {
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

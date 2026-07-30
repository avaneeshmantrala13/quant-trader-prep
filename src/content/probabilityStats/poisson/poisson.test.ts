import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import { gradeNumeric } from "@/lib/numeric";
import type { NumericQuestion } from "@/types/content";
import {
  poissonAtLeastOne,
  poissonFirstStreamProb,
  poissonPMF,
  poissonProcessMean,
  poissonSuperposedMean,
  poissonThinnedMean,
  poissonVariance,
} from "./poisson";
import {
  genPoissonAtLeastOne,
  genPoissonFirstStream,
  genPoissonInterval,
  genPoissonPmf,
  genPoissonSplit,
  genPoissonSuper,
  genPoissonVariance,
} from "./generators";

const r = (x: number, dp: number) => Math.round(x * 10 ** dp) / 10 ** dp;

describe("Poisson solvers reproduce standard textbook values", () => {
  it("pmf: P(X=2), λ=3 = e^{-3}·9/2 ≈ 0.2240", () => {
    expect(r(poissonPMF(3, 2), 4)).toBe(r((Math.exp(-3) * 9) / 2, 4));
    expect(r(poissonPMF(3, 2), 4)).toBe(0.224);
  });
  it("pmf: P(X=0), λ=2 = e^{-2} ≈ 0.1353", () => {
    expect(r(poissonPMF(2, 0), 4)).toBe(0.1353);
  });
  it("at-least-one: 1−e^{-1} ≈ 0.6321", () => {
    expect(r(poissonAtLeastOne(1), 4)).toBe(0.6321);
  });
  it("variance equals the mean λ", () => {
    expect(poissonVariance(7)).toBe(7);
  });
  it("process mean over t is λt; thinning is λpt; superposition adds rates", () => {
    expect(poissonProcessMean(3, 4)).toBe(12);
    expect(poissonThinnedMean(10, 0.25, 2)).toBe(5);
    expect(poissonSuperposedMean([2, 3], 4)).toBe(20);
  });
  it("which-stream-first is r1/(r1+r2)", () => {
    const s = poissonFirstStreamProb(3, 1);
    expect(s.value).toBe(0.75);
    expect([s.num, s.den]).toEqual([3, 4]);
  });
});

const NUMERIC_GENS: Record<string, (rng: Rng) => NumericQuestion> = {
  genPoissonPmf,
  genPoissonAtLeastOne,
  genPoissonVariance,
  genPoissonInterval,
  genPoissonSplit,
  genPoissonSuper,
  genPoissonFirstStream,
};

const SEEDS = Array.from({ length: 60 }, (_, i) => i * 97 + 3);

describe("Poisson numeric generators: grading round-trips + clean distractors", () => {
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
        // deterministic
        expect(gen(new Rng(seed)).answer).toBe(q.answer);
        // distractors distinct + ≠ answer + graded wrong
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

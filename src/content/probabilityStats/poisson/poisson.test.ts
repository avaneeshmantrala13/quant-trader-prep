import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import { gradeNumeric } from "@/lib/numeric";
import type { NumericQuestion } from "@/types/content";
import {
  compoundPoissonMean,
  poissonAtLeastOne,
  poissonCondUniformKthTime,
  poissonFirstStreamProb,
  poissonInterarrivalMean,
  poissonKthArrivalMean,
  poissonNoEventProb,
  poissonPMF,
  poissonProcessMean,
  poissonSuperposedMean,
  poissonThinnedMean,
  poissonVariance,
} from "./poisson";
import {
  genPoissonAtLeastOne,
  genPoissonCompound,
  genPoissonCondUniform,
  genPoissonFirstStream,
  genPoissonInterarrival,
  genPoissonInterval,
  genPoissonKthArrival,
  genPoissonNoEvent,
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
  it("process depth: interarrival 1/λ, waiting-tail e^{-λt}, Erlang k/λ", () => {
    expect(poissonInterarrivalMean(4)).toEqual({ num: 1, den: 4 });
    expect(r(poissonNoEventProb(1, 2), 4)).toBe(r(Math.exp(-2), 4)); // e^{-2}
    expect(poissonKthArrivalMean(3, 6)).toEqual({ num: 3, den: 6 }); // 1/2
  });
  it("conditional uniformity jT/(n+1) and compound mean λtμ", () => {
    // n=3 arrivals in [0,12], 2nd expected at 2·12/4 = 6
    expect(poissonCondUniformKthTime(2, 3, 12)).toEqual({ num: 24, den: 4 });
    // λ=2, t=3, μ=5/2 ⇒ 2·3·5/2 = 15
    expect(compoundPoissonMean(2, 3, 5, 2)).toEqual({ num: 30, den: 2 });
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
  genPoissonInterarrival,
  genPoissonNoEvent,
  genPoissonKthArrival,
  genPoissonCondUniform,
  genPoissonCompound,
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

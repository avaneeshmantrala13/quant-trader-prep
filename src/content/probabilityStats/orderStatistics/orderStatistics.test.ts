import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import { gradeNumeric } from "@/lib/numeric";
import type { NumericQuestion } from "@/types/content";
import {
  F,
  diagonalDuelProb,
  exponentialMedian,
  minInIntervalProb,
  orderingProb,
} from "../coreSolvers";
import { genExpMedian, genMinInterval, genOrdering } from "./generators";

/**
 * Re-homed from the former `general/general.test.ts`: the order-statistics slice
 * of the original seed fixtures (minimum-in-interval, specific ordering, and the
 * exponential median) plus the generators' round-trip + distractor checks.
 */

const r = (x: number, dp: number) => Math.round(x * 10 ** dp) / 10 ** dp;

const NUMERIC_GENS: Record<string, (rng: Rng) => NumericQuestion> = {
  genMinInterval,
  genOrdering,
  genExpMedian,
};

const SEED_ANSWERS: Record<string, number> = {
  GN45_UniformDist2: 0.297,
  GN46_UniformDist3: 0.296,
  GN47_UniformProfit: 0.167,
  GN63_ExponentialMedian: 0.173,
  GN64_DiagonalDuel: 0.333,
};

describe("solver reproduces documented answers — uniform order statistics", () => {
  it("Uniform Distribution #2 (GN45) = 19/64 ≈ 0.297", () => {
    expect(minInIntervalProb(3, 0, 4, 1, 2).equals(F(19, 64))).toBe(true);
    expect(r(minInIntervalProb(3, 0, 4, 1, 2).valueOf(), 3)).toBe(SEED_ANSWERS.GN45_UniformDist2);
  });
  it("Uniform Distribution #3 (GN46) = 37/125 = 0.296", () => {
    expect(minInIntervalProb(3, 3, 8, 4, 5).equals(F(37, 125))).toBe(true);
    expect(r(minInIntervalProb(3, 3, 8, 4, 5).valueOf(), 3)).toBe(SEED_ANSWERS.GN46_UniformDist3);
  });
  it("Uniformly Distributed Profit (GN47) = 1/6 ≈ 0.167", () => {
    expect(orderingProb(3).equals(F(1, 6))).toBe(true);
    expect(r(orderingProb(3).valueOf(), 3)).toBe(SEED_ANSWERS.GN47_UniformProfit);
  });
  it("Exponential Distribution #2 (GN63) median = ln2/4 ≈ 0.173", () => {
    expect(r(exponentialMedian(4), 3)).toBe(SEED_ANSWERS.GN63_ExponentialMedian);
  });
  it("Diagonal Duel (GN64) continuous exponential comparison = 1/3 ≈ 0.333", () => {
    expect(diagonalDuelProb(F(1, 2)).equals(F(1, 3))).toBe(true);
    expect(r(diagonalDuelProb(F(1, 2)).valueOf(), 3)).toBe(SEED_ANSWERS.GN64_DiagonalDuel);
  });
});

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 131 + 5);

describe("numeric generators: grading round-trips + clean distractors", () => {
  for (const [name, gen] of Object.entries(NUMERIC_GENS)) {
    it(`${name} — answer grades, commonErrors are clean`, () => {
      for (const seed of SEEDS) {
        const q = gen(new Rng(seed));
        const dp = q.decimals ?? 0;
        const f = 10 ** dp;
        expect(Number.isFinite(q.answer)).toBe(true);
        expect(q.answer).toBeGreaterThanOrEqual(0);
        const typed = dp === 0 ? String(q.answer) : q.answer.toFixed(dp);
        expect(gradeNumeric(q, typed).correct).toBe(true);
        const q2 = gen(new Rng(seed));
        expect(q2.answer).toBe(q.answer);
        for (const ce of q.commonErrors ?? []) {
          expect(Number.isFinite(ce.value)).toBe(true);
          expect(Math.round(ce.value * f)).not.toBe(Math.round(q.answer * f));
          const g = gradeNumeric(q, dp === 0 ? String(ce.value) : ce.value.toFixed(dp));
          expect(g.correct).toBe(false);
          expect(g.matchedError?.feedback).toBeTruthy();
        }
        const keys = (q.commonErrors ?? []).map((e) => Math.round(e.value * f));
        expect(new Set(keys).size).toBe(keys.length);
        expect(q.explanation.trim().length).toBeGreaterThan(40);
      }
    });
  }
});

const FINGERPRINTS = ["Uniform Distribution", "Uniformly Distributed Profit", "Exponential Distribution"];

describe("no source-dataset title/wording leaks into generated prompts", () => {
  it("generated prompts never contain a verbatim dataset fingerprint", () => {
    for (const seed of SEEDS) {
      for (const gen of Object.values(NUMERIC_GENS)) {
        const q = gen(new Rng(seed));
        for (const fp of FINGERPRINTS) expect(q.prompt).not.toContain(fp);
      }
    }
  });
});

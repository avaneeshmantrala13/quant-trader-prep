import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import { gradeNumeric } from "@/lib/numeric";
import type { NumericQuestion } from "@/types/content";
import { F } from "../coreSolvers";
import {
  longRunReward,
  stationaryDistribution,
  twoStateStationary,
} from "./stationary";
import {
  genStationaryReward,
  genThreeStateStationary,
  genTwoStateStationary,
} from "./stationaryGenerators";

describe("stationary distribution solver reproduces standard results", () => {
  it("2-state π₀ = b/(a+b), matches the general solver", () => {
    const a = F(1, 4);
    const b = F(1, 3);
    const [p0, p1] = twoStateStationary(a, b);
    expect(p0.equals(F(4, 7))).toBe(true);
    expect(p1.equals(F(3, 7))).toBe(true);
    const P = [
      [F(1).sub(a), a],
      [b, F(1).sub(b)],
    ];
    const pi = stationaryDistribution(P);
    expect(pi[0].equals(F(4, 7))).toBe(true);
    expect(pi[1].equals(F(3, 7))).toBe(true);
  });

  it("stationary vector sums to 1 and satisfies πP=π (3-state)", () => {
    const P = [
      [F(0), F(1, 2), F(1, 2)],
      [F(1, 3), F(0), F(2, 3)],
      [F(2, 3), F(1, 3), F(0)],
    ];
    const pi = stationaryDistribution(P);
    const sum = pi.reduce((a, p) => a.add(p), F(0));
    expect(sum.equals(F(1))).toBe(true);
    // πP == π
    for (let j = 0; j < 3; j++) {
      let v = F(0);
      for (let i = 0; i < 3; i++) v = v.add(pi[i].mul(P[i][j]));
      expect(v.equals(pi[j])).toBe(true);
    }
  });

  it("long-run reward is the π-weighted sum", () => {
    expect(longRunReward([F(4, 7), F(3, 7)], [7, 0]).equals(F(4))).toBe(true);
  });
});

const NUMERIC_GENS: Record<string, (rng: Rng) => NumericQuestion> = {
  genTwoStateStationary,
  genStationaryReward,
  genThreeStateStationary,
};

const SEEDS = Array.from({ length: 80 }, (_, i) => i * 41 + 7);

describe("stationary numeric generators: grading round-trips + clean distractors", () => {
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

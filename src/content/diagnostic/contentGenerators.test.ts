import { describe, expect, it } from "vitest";
import type { NumericQuestion } from "@/types/content";
import { Rng } from "@/lib/rng";
import { gradeFreeResponse } from "@/lib/numeric";
import {
  BM_INCREMENT_FAMILY,
  BRANCHING_MEAN_FAMILY,
  COMB_CHOOSE_FAMILY,
  CONT_COND_UNIFORM_FAMILY,
  CORE_ATLEAST_FAMILY,
  GAME_SYMMETRIC_FAMILY,
  GEOMETRY_DIAGONAL_FAMILY,
  GEO_TRIANGLE_FAMILY,
  MARKOV_TWO_STEP_FAMILY,
  NT_DIVISIBLE_FAMILY,
  POISSON_PMF_FAMILY,
  VAR_SCALE_FAMILY,
  genAtLeastOne,
  genBmIncrement,
  genBranchingMean,
  genCombChoose,
  genCondUniform,
  genDivisibleOr,
  genGeoTriangle,
  genMarkovTwoStep,
  genPoissonPmf,
  genSpaceDiagonal,
  genSymmetricGame,
  genVarScale,
} from "./contentGenerators";

/**
 * Fix 1 (V1 drilling hard-stall): every scored content family now carries a
 * PARAMETRIC, exact-verified floor generator so the drilling bank never runs
 * dry. This suite proves, per family, that the generator is (a) deterministic
 * from a seed, (b) EXACT — the stated answer grades correct through the real
 * `gradeFreeResponse` grader, (c) unambiguous — no `commonErrors` distractor
 * collides with the answer at the grading precision, (d) VARIED — it emits many
 * distinct instances across seeds (the "infinite bank" feel), and (e) carries
 * its stable `family` tag plus well-formed misconception tags for the rung-1
 * directional nudge (V3/V4).
 */

interface GenSpec {
  name: string;
  gen: (rng: Rng) => NumericQuestion;
  family: string;
  /** Lower bound on DISTINCT (prompt+answer) instances over the seed sweep. */
  minDistinct: number;
}

const GENERATORS: GenSpec[] = [
  { name: "genCombChoose", gen: genCombChoose, family: COMB_CHOOSE_FAMILY, minDistinct: 8 },
  { name: "genDivisibleOr", gen: genDivisibleOr, family: NT_DIVISIBLE_FAMILY, minDistinct: 15 },
  { name: "genAtLeastOne", gen: genAtLeastOne, family: CORE_ATLEAST_FAMILY, minDistinct: 10 },
  { name: "genCondUniform", gen: genCondUniform, family: CONT_COND_UNIFORM_FAMILY, minDistinct: 15 },
  { name: "genPoissonPmf", gen: genPoissonPmf, family: POISSON_PMF_FAMILY, minDistinct: 8 },
  { name: "genGeoTriangle", gen: genGeoTriangle, family: GEO_TRIANGLE_FAMILY, minDistinct: 12 },
  { name: "genSpaceDiagonal", gen: genSpaceDiagonal, family: GEOMETRY_DIAGONAL_FAMILY, minDistinct: 14 },
  { name: "genVarScale", gen: genVarScale, family: VAR_SCALE_FAMILY, minDistinct: 15 },
  { name: "genBmIncrement", gen: genBmIncrement, family: BM_INCREMENT_FAMILY, minDistinct: 12 },
  { name: "genSymmetricGame", gen: genSymmetricGame, family: GAME_SYMMETRIC_FAMILY, minDistinct: 10 },
  { name: "genBranchingMean", gen: genBranchingMean, family: BRANCHING_MEAN_FAMILY, minDistinct: 10 },
  { name: "genMarkovTwoStep", gen: genMarkovTwoStep, family: MARKOV_TWO_STEP_FAMILY, minDistinct: 8 },
];

/** The exact string the drill input parses/grades against for `q`'s own answer. */
function typedAnswer(q: NumericQuestion): string {
  return q.decimals != null ? q.answer.toFixed(q.decimals) : String(q.answer);
}

/** Compare two values at the question's grading precision (mirrors the grader). */
function sameAtPrecision(q: NumericQuestion, a: number, b: number): boolean {
  return q.decimals == null
    ? a === b
    : Math.round(a * 10 ** q.decimals) === Math.round(b * 10 ** q.decimals);
}

describe.each(GENERATORS)("content generator · $name", ({ gen, family, minDistinct }) => {
  it("is deterministic from a seed", () => {
    for (const s of [1, 7, 42, 99, 20240808]) {
      expect(gen(new Rng(s))).toEqual(gen(new Rng(s)));
    }
  });

  it("is EXACT — the stated answer grades correct, and is well-formed", () => {
    for (let s = 1; s <= 120; s++) {
      const q = gen(new Rng(s));
      expect(gradeFreeResponse(q, typedAnswer(q)).correct, `${q.id}: ${q.prompt}`).toBe(true);
      expect(q.id.length).toBeGreaterThan(0);
      expect(q.prompt.length).toBeGreaterThan(0);
      expect(q.explanation.length).toBeGreaterThan(0);
      expect(q.family).toBe(family);
      expect(Number.isFinite(q.answer)).toBe(true);
    }
  });

  it("no commonError distractor collides with the answer (grading stays unambiguous)", () => {
    for (let s = 1; s <= 120; s++) {
      const q = gen(new Rng(s));
      const seen = new Set<string>();
      for (const ce of q.commonErrors ?? []) {
        expect(sameAtPrecision(q, ce.value, q.answer), `${q.id} distractor==answer`).toBe(false);
        expect(ce.feedback.length).toBeGreaterThan(0);
        // Distractors are also mutually distinct at the grading precision.
        const key = q.decimals == null ? String(ce.value) : ce.value.toFixed(q.decimals);
        expect(seen.has(key), `${q.id} duplicate distractor ${key}`).toBe(false);
        seen.add(key);
        // When a misconception tag is present it must be a non-empty string.
        if (ce.misconception !== undefined) {
          expect(typeof ce.misconception).toBe("string");
          expect(ce.misconception.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("emits many DISTINCT instances across seeds (infinite-bank feel)", () => {
    const sigs = new Set<string>();
    for (let s = 1; s <= 200; s++) {
      const q = gen(new Rng(s));
      sigs.add(`${q.prompt}\u0001${q.answer}`);
    }
    expect(sigs.size).toBeGreaterThanOrEqual(minDistinct);
  });

  it("tags at least one misconception on a distractor (rung-1 nudge fuel)", () => {
    const q = gen(new Rng(3));
    const tagged = (q.commonErrors ?? []).some((ce) => !!ce.misconception);
    expect(tagged).toBe(true);
  });
});

describe("content generators — independent exactness spot-checks", () => {
  it("genCombChoose answer is C(n,k) and the permutation trap is P(n,k)", () => {
    const q = genCombChoose(new Rng(11));
    const m = /choose a committee of (\d+) people from (\d+)/.exec(q.prompt)!;
    const k = Number(m[1]);
    const n = Number(m[2]);
    const binom = (nn: number, kk: number) => {
      let r = 1;
      for (let i = 0; i < Math.min(kk, nn - kk); i++) r = (r * (nn - i)) / (i + 1);
      return Math.round(r);
    };
    expect(q.answer).toBe(binom(n, k));
  });

  it("genVarScale answer is a²·Var(X)", () => {
    for (let s = 1; s <= 20; s++) {
      const q = genVarScale(new Rng(s));
      const m = /Var\(X\) = (\d+)\. What is Var\((\d+)X\)/.exec(q.prompt)!;
      const v = Number(m[1]);
      const a = Number(m[2]);
      expect(q.answer).toBe(a * a * v);
    }
  });

  it("genBmIncrement answer is the time DIFFERENCE t − s (never t + s)", () => {
    for (let s = 1; s <= 20; s++) {
      const q = genBmIncrement(new Rng(s));
      const m = /Var\(B_(\d+) − B_(\d+)\)/.exec(q.prompt)!;
      const t = Number(m[1]);
      const u = Number(m[2]);
      expect(q.answer).toBe(t - u);
      expect(q.answer).not.toBe(t + u);
    }
  });

  it("genSpaceDiagonal answer squared equals a²+b²+c² (Pythagorean box)", () => {
    for (let s = 1; s <= 20; s++) {
      const q = genSpaceDiagonal(new Rng(s));
      const m = /dimensions (\d+) × (\d+) × (\d+)/.exec(q.prompt)!;
      const [a, b, c] = [Number(m[1]), Number(m[2]), Number(m[3])];
      expect(q.answer * q.answer).toBe(a * a + b * b + c * c);
    }
  });
});

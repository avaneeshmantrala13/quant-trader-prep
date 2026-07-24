import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import { gradeNumeric } from "@/lib/numeric";
import type { NumericQuestion, Question } from "@/types/content";
import { F, beachCoinOptimum, jumpingRobotsRoot, optimalSpread } from "../coreSolvers";
import { genOptimalSpread, genOptimizeAgents } from "./genGeneralAgents";
import { gameTheoryGeneralFlashcards } from "./generalFlashcards";
import { gamePuzzleGeneralFlashcards } from "../gamePuzzle/generalFlashcards";

/**
 * Re-homed from the former `general/general.test.ts`: the optimizing-agents /
 * market-making slice of the original seed fixtures (beach-coin optimum, optimal
 * spread, jumping-robots Newton root) plus the generators' round-trip +
 * distractor checks and the two market/Newton reasoning flashcards.
 */

const r = (x: number, dp: number) => Math.round(x * 10 ** dp) / 10 ** dp;

const NUMERIC_GENS: Record<string, (rng: Rng) => NumericQuestion> = {
  genOptimalSpread,
};

const QUIZ_GENS: Record<string, (rng: Rng) => Question> = {
  genOptimizeAgents,
};

const SEED_ANSWERS: Record<string, number> = {
  GN36_GoingToBeach2: 0.33,
  GN37_OptimalSpread: 0.667,
  GN38_JumpingRobots: 0.114845886,
};

describe("solver reproduces documented answers — game theory / optimizing agents", () => {
  it("Going to the Beach #2 (GN36) p*=2/3, P(beach)=1/3 ≈ 0.33", () => {
    const { pStar, pSuccess } = beachCoinOptimum();
    expect(pStar.equals(F(2, 3))).toBe(true);
    expect(pSuccess.equals(F(1, 3))).toBe(true);
    expect(r(pSuccess.valueOf(), 2)).toBe(SEED_ANSWERS.GN36_GoingToBeach2);
  });
  it("Optimal Spread (GN37) market 0.167 at 0.833, spread 2/3", () => {
    const { spread, bid, ask } = optimalSpread();
    expect(spread.equals(F(2, 3))).toBe(true);
    expect(bid.equals(F(1, 6))).toBe(true);
    expect(ask.equals(F(5, 6))).toBe(true);
    expect(r(spread.valueOf(), 3)).toBe(SEED_ANSWERS.GN37_OptimalSpread);
    expect(r(bid.valueOf(), 3)).toBe(0.167);
    expect(r(ask.valueOf(), 3)).toBe(0.833);
  });
  it("Jumping Robots (GN38) P(score 0) = 0.114845886 at 9dp (Newton root)", () => {
    const { x, pZero } = jumpingRobotsRoot();
    expect(r(x, 6)).toBe(0.416195);
    expect(r(pZero, 9)).toBe(SEED_ANSWERS.GN38_JumpingRobots);
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

describe("quiz generators: valid correct index + distinct, aligned choices", () => {
  for (const [name, gen] of Object.entries(QUIZ_GENS)) {
    it(`${name} — options clean, rationale aligned`, () => {
      for (const seed of SEEDS) {
        const q = gen(new Rng(seed));
        expect(q.correctIndex).toBeGreaterThanOrEqual(0);
        expect(q.correctIndex).toBeLessThan(q.choices.length);
        expect(new Set(q.choices).size).toBe(q.choices.length);
        expect(q.distractorRationale?.length).toBe(q.choices.length);
        expect(q.explanation.trim().length).toBeGreaterThan(40);
      }
    });
  }
});

const FINGERPRINTS = ["Going to the Beach", "Optimal Spread", "Jumping Robots"];

describe("no source-dataset title/wording leaks into generated prompts", () => {
  it("generated prompts never contain a verbatim dataset fingerprint", () => {
    const gens = [
      ...Object.values(NUMERIC_GENS),
      ...Object.values(QUIZ_GENS),
    ] as ((rng: Rng) => { prompt: string })[];
    for (const seed of SEEDS) {
      for (const gen of gens) {
        const q = gen(new Rng(seed));
        for (const fp of FINGERPRINTS) expect(q.prompt).not.toContain(fp);
      }
    }
  });
});

describe("re-homed reasoning flashcards (market + Newton root)", () => {
  it("market special reveals a two-sided quote (bid AND ask)", () => {
    const fc = gamePuzzleGeneralFlashcards.find((c) => c.id === "gen-fc-market")!;
    expect(/0\.167/.test(fc.answer) && /0\.833/.test(fc.answer)).toBe(true);
  });
  it("jumping-robots special reveals 0.114845886 (9 dp)", () => {
    const fc = gameTheoryGeneralFlashcards.find((c) => c.id === "gen-fc-threshold-root")!;
    expect(fc.answer).toContain("0.114845886");
  });
});

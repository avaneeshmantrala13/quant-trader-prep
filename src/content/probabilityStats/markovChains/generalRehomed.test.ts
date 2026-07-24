import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import { gradeNumeric } from "@/lib/numeric";
import type { NumericQuestion, Question } from "@/types/content";
import {
  F,
  INFINITY_SENTINEL,
  allForwardProb,
  deuceWinProb,
  firstSideLosingProb,
  gamblerRuinBust,
  gamblerRuinReach,
  restartGameProbs,
} from "../coreSolvers";
import { genAllForward, genDeuce, genRestart, genRuin } from "./genGeneralWalks";
import { markovGeneralFlashcards } from "./generalFlashcards";

/**
 * Re-homed from the former `general/general.test.ts`: the gambler's-ruin /
 * random-walk / recursion slice of the original seed fixtures plus the
 * generators' round-trip + distractor checks, the biased-ruin second
 * derivation, and the two re-homed reasoning flashcards (divergent first-return
 * expectation, best-of-three decision).
 */

const r = (x: number, dp: number) => Math.round(x * 10 ** dp) / 10 ** dp;

const NUMERIC_GENS: Record<string, (rng: Rng) => NumericQuestion> = {
  genAllForward,
  genDeuce,
  genRestart,
};

const QUIZ_GENS: Record<string, (rng: Rng) => Question> = {
  genRuin,
};

const SEED_ANSWERS: Record<string, number | string> = {
  GN27_GamblerRuin1: 0.8,
  GN28_GamblerRuin2: 0.5,
  GN29_GamblerRuin3: 0.017,
  GN30_WalkingHome1: 0.125,
  GN31_WalkingHome2: 0.875,
  GN32_HowManyChildren: INFINITY_SENTINEL,
  GN33_CoinRace1: 0.25,
  GN34_TennisGame: 0.307,
  GN35_SpinnerDuel: 0.583,
};

describe("solver reproduces documented answers — gambler's ruin", () => {
  it("Gambler's Ruin #1 (GN27) P(bankrupt) = 0.8", () => {
    expect(gamblerRuinBust(20, 100, F(1, 2)).valueOf()).toBe(SEED_ANSWERS.GN27_GamblerRuin1);
  });
  it("Gambler's Ruin #2 (GN28) fair reach = 0.5", () => {
    expect(gamblerRuinReach(10, 20, F(1, 2)).valueOf()).toBe(SEED_ANSWERS.GN28_GamblerRuin2);
  });
  it("Gambler's Ruin #3 (GN29) biased reach ≈ 0.017", () => {
    expect(r(gamblerRuinReach(10, 20, F(2, 5)).valueOf(), 3)).toBe(SEED_ANSWERS.GN29_GamblerRuin3);
  });
});

describe("solver reproduces documented answers — random walk / recursion", () => {
  it("Walking Home #1 (GN30) = 1/8 = 0.125", () => {
    expect(allForwardProb(3).equals(F(1, 8))).toBe(true);
    expect(allForwardProb(3).valueOf()).toBe(SEED_ANSWERS.GN30_WalkingHome1);
  });
  it("Walking Home #2 (GN31) = 7/8 = 0.875", () => {
    expect(F(1).sub(allForwardProb(3)).valueOf()).toBe(SEED_ANSWERS.GN31_WalkingHome2);
  });
  it("How Many Children (GN32) = Infinity sentinel (divergent expectation)", () => {
    expect(INFINITY_SENTINEL).toBe(SEED_ANSWERS.GN32_HowManyChildren);
  });
  it("Coin Race #1 (GN33) = 1/4 = 0.25", () => {
    expect(firstSideLosingProb().equals(F(1, 4))).toBe(true);
    expect(firstSideLosingProb().valueOf()).toBe(SEED_ANSWERS.GN33_CoinRace1);
  });
  it("Tennis Game (GN34) deuce = 4/13 (doc truncates to 0.307)", () => {
    expect(deuceWinProb(F(2, 5)).equals(F(4, 13))).toBe(true);
    expect(Math.floor(deuceWinProb(F(2, 5)).valueOf() * 1e3) / 1e3).toBe(SEED_ANSWERS.GN34_TennisGame);
  });
  it("Spinner Duel (GN35) max = 7/12 ≈ 0.583", () => {
    const [p1, p2] = restartGameProbs(F(3, 10), F(21, 50));
    expect(p1.equals(F(5, 12))).toBe(true);
    expect(p2.equals(F(7, 12))).toBe(true);
    expect(r(p2.valueOf(), 3)).toBe(SEED_ANSWERS.GN35_SpinnerDuel);
  });
});

describe("solver agrees with a second independent derivation", () => {
  it("biased gambler's ruin = normalized geometric partial sums", () => {
    const p = F(2, 5);
    const ratio = F(1).sub(p).div(p); // q/p = 3/2
    const partial = (m: number) => {
      let s = F(0);
      for (let i = 0; i < m; i++) s = s.add(ratio.pow(i) as ReturnType<typeof F>);
      return s;
    };
    expect(gamblerRuinReach(10, 20, p).equals(partial(10).div(partial(20)))).toBe(true);
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

const FINGERPRINTS = [
  "Gambler's Ruin", "Walking Home", "Coin Race", "Tennis Game", "Spinner Duel",
  "How Many Children", "Tennis Match",
];

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

describe("re-homed reasoning flashcards (divergent expectation + best-of-3)", () => {
  it("first-return special reveals a divergent (non-finite) answer", () => {
    const fc = markovGeneralFlashcards.find((c) => c.id === "gen-fc-firstreturn")!;
    expect(/infinit/i.test(fc.answer)).toBe(true);
  });
  it("best-of-three special favours TWO sets via (2p−1)²", () => {
    const fc = markovGeneralFlashcards.find((c) => c.id === "gen-fc-bestof3")!;
    expect(/two/i.test(fc.answer)).toBe(true);
    expect(fc.explanation.trim().length).toBeGreaterThan(40);
  });
});

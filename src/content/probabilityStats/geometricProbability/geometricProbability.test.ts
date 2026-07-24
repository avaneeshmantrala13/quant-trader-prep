import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import { gradeNumeric } from "@/lib/numeric";
import type { NumericQuestion, Question } from "@/types/content";
import {
  F,
  diskInnerProb,
  diskOuterProb,
  glanceCatchProb,
  meetingProb,
} from "../coreSolvers";
import { genGeoArea, genGlance, genMeeting, genTileFit } from "./generators";

/**
 * Re-homed from the former `general/general.test.ts`: the geometric-probability
 * slice of the original seed fixtures (area ratios, overlap windows, glance
 * catches) plus the generators' round-trip + distractor-quality checks.
 */

const r = (x: number, dp: number) => Math.round(x * 10 ** dp) / 10 ** dp;

const NUMERIC_GENS: Record<string, (rng: Rng) => NumericQuestion> = {
  genTileFit,
  genMeeting,
  genGlance,
};

const QUIZ_GENS: Record<string, (rng: Rng) => Question> = {
  genGeoArea,
};

const SEED_ANSWERS: Record<string, number> = {
  GN14_CleanStatue: 0.84,
  GN15_PokerChipDrop: 0.36,
  GN16_MeetingProbability: 0.16,
  GN17_CaughtMidSwitch: 0.15,
};

describe("solver reproduces documented answers — geometric probability", () => {
  it("Clean Statue (GN14) = 21/25 = 0.84", () => {
    expect(diskOuterProb(2, 5).equals(F(21, 25))).toBe(true);
    expect(diskOuterProb(2, 5).valueOf()).toBe(SEED_ANSWERS.GN14_CleanStatue);
  });
  it("Poker Chip Drop (GN15) = 9/25 = 0.36", () => {
    expect(diskInnerProb(3, 5).equals(F(9, 25))).toBe(true);
    expect(diskInnerProb(3, 5).valueOf()).toBe(SEED_ANSWERS.GN15_PokerChipDrop);
  });
  it("Meeting Probability (GN16) = 23/144 ≈ 0.16", () => {
    expect(meetingProb(60, 5).equals(F(23, 144))).toBe(true);
    expect(r(meetingProb(60, 5).valueOf(), 2)).toBe(SEED_ANSWERS.GN16_MeetingProbability);
  });
  it("Caught Mid-Switch (GN17) = 15/100 = 0.15", () => {
    expect(glanceCatchProb(3, 5, 100).valueOf()).toBe(SEED_ANSWERS.GN17_CaughtMidSwitch);
  });
});

describe("solvers agree with a second independent derivation", () => {
  it("disk 'outer' = 1 − inner (area ratio r²/R²)", () => {
    for (const [rr, R] of [[2, 5], [3, 8], [1, 4]] as const) {
      expect(diskOuterProb(rr, R).equals(F(R * R - rr * rr, R * R))).toBe(true);
    }
  });
  it("meeting prob = 1 − (miss area) directly", () => {
    for (const [T, w] of [[60, 5], [45, 10], [90, 15]] as const) {
      const miss = F((T - w) * (T - w), T * T);
      expect(meetingProb(T, w).equals(F(1).sub(miss))).toBe(true);
    }
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

const FINGERPRINTS = ["Clean Statue", "Poker Chip Drop", "Meeting Probability", "Caught Mid-Switch"];

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

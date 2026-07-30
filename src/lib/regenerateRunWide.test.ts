import { describe, expect, it } from "vitest";
import type { Level, QuestionGenerator } from "@/types/content";
import { materializeLevel, materializeNumericLevel } from "@/content/materialize";
import {
  MAX_REGEN_ATTEMPTS,
  generateFreshQuestion,
  generateFreshNumericQuestion,
  questionSignature,
  numericSignature,
} from "@/lib/regenerate";
import { PROB_GENERATORS } from "@/content/probability/generators";
import { mixQuestionGenerators } from "@/content/mixFamilies";
import { conditionalProbabilityLevels } from "@/content/probabilityStats/conditionalProbability/levels";

/**
 * Run-wide dedup: a bonus item must differ from EVERY question in the run — all
 * five materialized originals (including upcoming, not-yet-seen ones) AND every
 * bonus already generated this run — not merely the on-screen item.
 */

const baseLevel = {
  id: "t",
  title: "t",
  subtitle: "",
  blurb: "",
  difficulty: "easy" as const,
  masteryThreshold: 0.8,
  questionCount: 5,
  lesson: { paragraphs: [] },
};

/**
 * Synthetic multi-family QUIZ mix level from the still-quiz PROB_GENERATORS.
 * Core-probability pr-1..3 are now free-response numeric (Phase-2), so the
 * run-wide dedup guard uses this fixture to exercise the same quiz generators.
 */
const probMixQuizLevel: Level = {
  ...baseLevel,
  generator: mixQuestionGenerators([
    PROB_GENERATORS.genUnion,
    PROB_GENERATORS.genIntersectionIndep,
    PROB_GENERATORS.genCombinations,
  ]),
};

describe("bonus never collides with ANY of the round's originals", () => {
  it("small-parameter family (combinations): avoids all 5 originals across seeds", () => {
    const level: Level = { ...baseLevel, generator: PROB_GENERATORS.genCombinations };
    const round = materializeLevel(level, 42); // the 5 originals, up front
    const roundSigs = new Set(round.map(questionSignature));
    // The 5 originals genuinely occupy several distinct concrete items.
    expect(new Set(round.map((q) => q.prompt)).size).toBeGreaterThan(1);

    for (let seed = 1; seed <= 300; seed++) {
      const bonus = generateFreshQuestion(
        level,
        seed,
        round[0].family,
        roundSigs, // run-wide avoid-set (a Set of signatures)
        true,
        round[0],
      )!;
      expect(roundSigs.has(questionSignature(bonus))).toBe(false);
    }
  });

  it("mixQuiz level: button #1 stays in-family AND avoids all originals", () => {
    const level = probMixQuizLevel; // mix([...]) multi-family
    const round = materializeLevel(level, 77);
    const roundSigs = new Set(round.map(questionSignature));
    const current = round[0];

    for (let seed = 1; seed <= 300; seed++) {
      const bonus = generateFreshQuestion(
        level,
        seed,
        current.family,
        roundSigs,
        true,
        current,
      )!;
      expect(bonus.family).toBe(current.family); // family-locked
      expect(roundSigs.has(questionSignature(bonus))).toBe(false); // never a round item
    }
  });

  it("accepts an ARRAY of items as the avoid-set too", () => {
    const level = probMixQuizLevel;
    const round = materializeLevel(level, 5);
    const sigs = new Set(round.map(questionSignature));
    for (let seed = 1; seed <= 100; seed++) {
      const bonus = generateFreshQuestion(level, seed, undefined, round, false, round[0])!;
      expect(sigs.has(questionSignature(bonus))).toBe(false);
    }
  });

  it("probabilityStats multi-family numeric level (converted): bonus avoids all originals", () => {
    // Conditional Probability's rich multi-family levels are now free-response
    // numeric (Phase-2 conversion), so the run-wide dedup guarantee is verified
    // on the numeric regeneration path. (cp-5 stays quiz but is a limited-variety
    // Russian-Roulette decision family, unsuited to this collision-free assertion.)
    const level = conditionalProbabilityLevels.find(
      (l) => Object.keys(l.numericGenerator?.families ?? {}).length >= 2,
    )!;
    const round = materializeNumericLevel(level, 31);
    const roundSigs = new Set(round.map(numericSignature));
    const current = round[0];
    for (let seed = 1; seed <= 200; seed++) {
      const bonus = generateFreshNumericQuestion(
        level,
        seed,
        current.family,
        roundSigs,
        true,
        current,
      )!;
      expect(roundSigs.has(numericSignature(bonus))).toBe(false);
    }
  });
});

describe("successive bonuses in a run don't repeat earlier bonuses", () => {
  it("accumulates each new bonus into the avoid-set (button #2 whole-mix)", () => {
    const level = probMixQuizLevel;
    const round = materializeLevel(level, 7);
    // Mirror LessonPage: start from the round signatures, accumulate bonuses.
    const avoid = new Set(round.map(questionSignature));
    const bonusSigs: string[] = [];
    for (let i = 0; i < 15; i++) {
      const bonus = generateFreshQuestion(
        level,
        1000 + i,
        undefined,
        avoid,
        false,
        round[0],
      )!;
      const sig = questionSignature(bonus);
      expect(avoid.has(sig)).toBe(false); // differs from round + all earlier bonuses
      avoid.add(sig);
      bonusSigs.push(sig);
    }
    expect(new Set(bonusSigs).size).toBe(bonusSigs.length); // all mutually distinct
  });
});

describe("cap/fallback still exercised when the space is exhausted", () => {
  it("retries MAX_REGEN_ATTEMPTS then returns the freshest attempt (no hang/crash)", () => {
    let calls = 0;
    const constGen: QuestionGenerator = () => {
      calls++;
      return {
        id: "only",
        prompt: "the one and only",
        choices: ["1", "2", "3", "4"],
        correctIndex: 0,
        explanation: "e",
        difficulty: "easy",
      };
    };
    const level: Level = { ...baseLevel, generator: constGen };
    const source = generateFreshQuestion(level, 1)!;
    const avoid = new Set([questionSignature(source)]);

    calls = 0;
    const regen = generateFreshQuestion(level, 2, undefined, avoid, false, source)!;
    expect(calls).toBe(MAX_REGEN_ATTEMPTS);
    expect(regen).not.toBeNull();
    expect(questionSignature(regen)).toBe(questionSignature(source)); // graceful repeat
  });
});

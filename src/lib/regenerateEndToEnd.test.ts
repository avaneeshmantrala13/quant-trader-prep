import { describe, expect, it } from "vitest";
import type { Level, Question } from "@/types/content";
import { materializeLevel } from "@/content/materialize";
import { generateFreshQuestion } from "@/lib/regenerate";
import { PROB_GENERATORS } from "@/content/probability/generators";
import { mixQuestionGenerators } from "@/content/mixFamilies";
import { conditionalProbabilityLevels } from "@/content/probabilityStats/conditionalProbability/levels";

/**
 * A synthetic multi-family QUIZ mix level built from the (still quiz-only)
 * PROB_GENERATORS. Core-probability levels pr-1..3 are now free-response numeric
 * (Phase-2), so this decouples the button-#1 family-lock guard from content mode
 * while exercising the exact same quiz generators (genUnion / genIntersectionIndep
 * / genCombinations) the leak regression was about.
 */
const probMixQuizLevel: Level = {
  id: "prob-mix-quiz",
  title: "Probability mix (quiz)",
  subtitle: "",
  blurb: "probability mix quiz fixture",
  difficulty: "easy",
  masteryThreshold: 0.8,
  questionCount: 5,
  lesson: { paragraphs: [] },
  generator: mixQuestionGenerators([
    PROB_GENERATORS.genUnion,
    PROB_GENERATORS.genIntersectionIndep,
    PROB_GENERATORS.genCombinations,
  ]),
};

/**
 * END-TO-END regression guard for the button #1 family leak.
 *
 * The isolated `regenerate.ts` tests passed while the LIVE UI still leaked:
 * button #1 ("Generate another like this") jumped from a Combinations item to a
 * sibling "P(A and B)" item. Root cause: the on-screen quiz item can reach the
 * handler WITHOUT a resolvable `family` tag (e.g. a level attempt resumed from
 * storage saved before the family mechanism existed). The handler then passed
 * `current.family === undefined`, which was indistinguishable from button #2, so
 * regenerate silently used the whole-level mix and leaked.
 *
 * These tests mirror the REAL call path: materialize the level exactly like
 * `LessonPage`, take a rendered item, and invoke the SAME regenerate call the
 * button #1 handler makes — including the "legacy item with no family tag" case.
 */

/** Materialize like LessonPage and return the first item matching `pred`. */
function renderedItem(level: Level, pred: (q: Question) => boolean): Question {
  for (let seed = 1; seed <= 800; seed++) {
    for (const q of materializeLevel(level, seed)) if (pred(q)) return q;
  }
  throw new Error("no matching rendered item found");
}

/** EXACTLY what `QuizPractice`'s button #1 handler calls. */
function pressButton1(
  level: Level,
  current: Question,
  seed: number,
  onScreen: Question | null = null,
): Question {
  return generateFreshQuestion(
    level,
    seed,
    current.family,
    onScreen ?? current,
    true,
  )!;
}

/** EXACTLY what the AI "✨ Fresh variant" (button #2) handler calls. */
function pressButton2(level: Level, current: Question, seed: number): Question {
  return generateFreshQuestion(level, seed, undefined, current, false)!;
}

describe("END-TO-END: button #1 is strictly family-locked (probability mix level)", () => {
  const level = probMixQuizLevel; // mix([genUnion, genIntersectionIndep, genCombinations])

  it("a rendered Combinations item regenerates ONLY to Combinations (never a sibling)", () => {
    const combos = renderedItem(level, (q) => q.family === "genCombinations");
    expect(combos.prompt.toLowerCase()).toContain("committee"); // sanity: it IS the combos family

    const seen = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      const fresh = pressButton1(level, combos, seed);
      seen.add(fresh.family ?? "UNDEF");
      expect(fresh.family).toBe("genCombinations");
      expect(fresh.family).not.toBe("genIntersectionIndep"); // the leaked family
      expect(fresh.family).not.toBe("genUnion");
    }
    expect([...seen]).toEqual(["genCombinations"]);
  });

  it("LEGACY item with NO family tag STILL locks to Combinations (inference)", () => {
    const combos = renderedItem(level, (q) => q.family === "genCombinations");
    // Simulate a resumed/legacy item that predates the family mechanism.
    const stale: Question = { ...combos, family: undefined };
    expect(stale.family).toBeUndefined();

    for (let seed = 1; seed <= 300; seed++) {
      const fresh = pressButton1(level, stale, seed);
      expect(fresh.family).toBe("genCombinations");
    }
  });

  it("button #2 (whole-level mix) still varies across sibling families", () => {
    const combos = renderedItem(level, (q) => q.family === "genCombinations");
    const seen = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      seen.add(pressButton2(level, combos, seed).family ?? "UNDEF");
    }
    expect(seen.size).toBeGreaterThanOrEqual(2); // intentional variety
  });
});

describe("END-TO-END: button #1 is strictly family-locked (probabilityStats mixQuiz level)", () => {
  const level = conditionalProbabilityLevels.find(
    (l) => Object.keys(l.generator?.families ?? {}).length >= 2,
  )!;

  it("every rendered family regenerates ONLY to itself (tagged AND legacy/untagged)", () => {
    const famKeys = Object.keys(level.generator!.families!);
    expect(famKeys.length).toBeGreaterThanOrEqual(2);

    for (const fam of famKeys) {
      const item = renderedItem(level, (q) => q.family === fam);

      // Tagged path.
      for (let seed = 1; seed <= 80; seed++) {
        expect(pressButton1(level, item, seed).family).toBe(fam);
      }
      // Legacy/untagged path (inferred from id-prefix / concept).
      const stale: Question = { ...item, family: undefined };
      for (let seed = 1; seed <= 80; seed++) {
        expect(pressButton1(level, stale, seed).family).toBe(fam);
      }
    }
  });
});

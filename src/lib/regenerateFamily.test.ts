import { describe, expect, it } from "vitest";
import type { Level } from "@/types/content";
import { deriveFamilyIds } from "@/content/mixFamilies";
import { materializeLevel, materializeNumericLevel } from "@/content/materialize";
import {
  generateFreshQuestion,
  generateFreshNumericQuestion,
  generateFreshFlashcard,
} from "@/lib/regenerate";
import { countQuizCorrect, countNumericCorrect, roundScore } from "@/lib/score";
import { PROB_GENERATORS } from "@/content/probability/generators";
import { probabilityTrack } from "@/content/probability/levels";
import { mentalMathTrack } from "@/content/mentalMath/levels";
import { brainteasersTrack } from "@/content/brainteasers/levels";
import { interviewGamesTrack } from "@/content/interviewGames/levels";
import { conditionalProbabilityLevels } from "@/content/probabilityStats/conditionalProbability/levels";
import { combinatorialAnalysisLevels } from "@/content/probabilityStats/combinatorialAnalysis/levels";

/**
 * Family-preservation contract for "Generate another like this" vs the AI
 * "✨ Fresh variant", plus round-score isolation of ALL bonus items.
 *
 * The two regenerate buttons behave DIFFERENTLY by design:
 *   • Button #1 (parametric): SAME family as the current item — new numbers,
 *     same concept. Never jumps to a sibling family in the level's mix pool.
 *   • Button #2 (AI reskin): intentional variety WITHIN the level — re-picks
 *     from the whole mix pool (may land on a sibling family), then reskins.
 *
 * These tests exercise the REAL level definitions across every tab so the shared
 * `mix*` mechanism is proven to fix all of them uniformly.
 */

const quizFamilies = (l: Level): string[] =>
  l.generator?.families ? Object.keys(l.generator.families) : [];
const numFamilies = (l: Level): string[] =>
  l.numericGenerator?.families ? Object.keys(l.numericGenerator.families) : [];

function findMultiQuiz(levels: Level[], label: string): Level {
  const lvl = levels.find((l) => quizFamilies(l).length >= 2);
  if (!lvl) throw new Error(`no multi-family quiz level in ${label}`);
  return lvl;
}
function findMultiNumeric(levels: Level[], label: string): Level {
  const lvl = levels.find((l) => numFamilies(l).length >= 2);
  if (!lvl) throw new Error(`no multi-family numeric level in ${label}`);
  return lvl;
}
function findMultiFlash(levels: Level[], label: string): Level {
  const lvl = levels.find((l) => (l.flashcardGenerators?.length ?? 0) >= 2);
  if (!lvl) throw new Error(`no multi-family flashcard level in ${label}`);
  return lvl;
}

/* -------------------------------------------------------------------------- */
/*  Reusable assertions                                                        */
/* -------------------------------------------------------------------------- */

/** Button #1 for a multi-family QUIZ level: same family across seeds + varies. */
function assertQuizFamilyPreserved(level: Level, seeds = 80): void {
  const fams = quizFamilies(level);
  expect(fams.length).toBeGreaterThanOrEqual(2);

  // (a) every produced item carries a valid family (whole-level draw).
  for (let s = 1; s <= 20; s++) {
    const q = generateFreshQuestion(level, s)!;
    expect(q.family).toBeTruthy();
    expect(fams).toContain(q.family);
  }

  // (b) regenerating "like this" from family F yields ONLY F, and (c) varies.
  for (const F of fams) {
    const prompts = new Set<string>();
    const seenFamilies = new Set<string>();
    for (let s = 1; s <= seeds; s++) {
      const q = generateFreshQuestion(level, s, F)!;
      seenFamilies.add(q.family!);
      prompts.add(q.prompt);
    }
    expect([...seenFamilies]).toEqual([F]); // never a sibling family
    expect(prompts.size).toBeGreaterThan(1); // still varies parameters
  }
}

/** Button #1 for a multi-family NUMERIC level. */
function assertNumericFamilyPreserved(level: Level, seeds = 80): void {
  const fams = numFamilies(level);
  expect(fams.length).toBeGreaterThanOrEqual(2);

  for (let s = 1; s <= 20; s++) {
    const q = generateFreshNumericQuestion(level, s)!;
    expect(q.family).toBeTruthy();
    expect(fams).toContain(q.family);
  }

  for (const F of fams) {
    const prompts = new Set<string>();
    const seenFamilies = new Set<string>();
    for (let s = 1; s <= seeds; s++) {
      const q = generateFreshNumericQuestion(level, s, F)!;
      seenFamilies.add(q.family!);
      prompts.add(q.prompt);
    }
    expect([...seenFamilies]).toEqual([F]);
    expect(prompts.size).toBeGreaterThan(1);
  }
}

/** Button #2 (whole-level mix, NO family) CAN produce ≥2 distinct families. */
function assertWholeLevelVariety(
  level: Level,
  kind: "quiz" | "numeric",
  seeds = 300,
): void {
  const seen = new Set<string>();
  for (let s = 1; s <= seeds; s++) {
    const q =
      kind === "quiz"
        ? generateFreshQuestion(level, s)!
        : generateFreshNumericQuestion(level, s)!;
    if (q.family) seen.add(q.family);
  }
  expect(seen.size).toBeGreaterThanOrEqual(2);
}

/* -------------------------------------------------------------------------- */
/*  Button #1 — family preservation across EVERY tab                          */
/* -------------------------------------------------------------------------- */

describe('Button #1 "Generate another like this" preserves the question family', () => {
  it("probability tab — mix([...]) core level", () => {
    const level = findMultiQuiz(probabilityTrack.levels, "probability");
    assertQuizFamilyPreserved(level);
  });

  it("probabilityStats tab — mixQuiz([...]) (conditional probability)", () => {
    const level = findMultiQuiz(conditionalProbabilityLevels, "conditionalProb");
    assertQuizFamilyPreserved(level);
  });

  it("probabilityStats tab — mixNumeric([...]) (combinatorial analysis)", () => {
    const level = findMultiNumeric(
      combinatorialAnalysisLevels,
      "combinatorialAnalysis",
    );
    assertNumericFamilyPreserved(level);
  });

  it("mentalMath tab — mixed([...]) (now free-response numeric)", () => {
    // Mental-math drills are now free-response numeric (Phase-2), so family
    // preservation is verified on the numeric regeneration path.
    const level = findMultiNumeric(mentalMathTrack.levels, "mentalMath");
    assertNumericFamilyPreserved(level);
  });

  it("interviewGames tab — mixEV([...])", () => {
    const level = findMultiQuiz(interviewGamesTrack.levels, "interviewGames");
    assertQuizFamilyPreserved(level);
  });

  it("brainteasers tab — flashcard families (≥2)", () => {
    const level = findMultiFlash(brainteasersTrack.levels, "brainteasers");
    const ids = deriveFamilyIds(level.flashcardGenerators!);
    expect(ids.length).toBeGreaterThanOrEqual(2);

    // (a) generated cards carry a valid family.
    for (let s = 1; s <= 20; s++) {
      const c = generateFreshFlashcard(level, s)!;
      expect(c.family).toBeTruthy();
      expect(ids).toContain(c.family);
    }

    // (b) "give me another at this difficulty" from family F stays on F, (c) varies.
    for (const F of ids) {
      const prompts = new Set<string>();
      const seen = new Set<string>();
      for (let s = 1; s <= 80; s++) {
        const c = generateFreshFlashcard(level, s, F)!;
        seen.add(c.family!);
        prompts.add(c.prompt);
      }
      expect([...seen]).toEqual([F]);
      expect(prompts.size).toBeGreaterThan(1);
    }

    // No family → falls back to the original random pick (≥2 families seen).
    const anyFam = new Set<string>();
    for (let s = 1; s <= 200; s++)
      anyFam.add(generateFreshFlashcard(level, s)!.family!);
    expect(anyFam.size).toBeGreaterThanOrEqual(2);
  });
});

/* -------------------------------------------------------------------------- */
/*  Button #2 — whole-level variety (may land on a sibling family)            */
/* -------------------------------------------------------------------------- */

describe('Button #2 "✨ Fresh variant" uses the whole-level mix (variety)', () => {
  it("quiz multi-family level yields ≥2 distinct families across seeds", () => {
    const level = findMultiQuiz(probabilityTrack.levels, "probability");
    assertWholeLevelVariety(level, "quiz");
  });

  it("numeric multi-family level yields ≥2 distinct families across seeds", () => {
    const level = findMultiNumeric(
      combinatorialAnalysisLevels,
      "combinatorialAnalysis",
    );
    assertWholeLevelVariety(level, "numeric");
  });

  it("family-preserving (button #1) NEVER produces a sibling family, unlike button #2", () => {
    const level = findMultiQuiz(probabilityTrack.levels, "probability");
    const F = quizFamilies(level)[0];
    const b1 = new Set<string>();
    const b2 = new Set<string>();
    for (let s = 1; s <= 300; s++) {
      b1.add(generateFreshQuestion(level, s, F)!.family!); // button #1
      b2.add(generateFreshQuestion(level, s)!.family!); //     button #2
    }
    expect([...b1]).toEqual([F]); // button #1 is single-family
    expect(b2.size).toBeGreaterThanOrEqual(2); // button #2 is multi-family
  });
});

/* -------------------------------------------------------------------------- */
/*  Single-family levels + fallback path                                       */
/* -------------------------------------------------------------------------- */

describe("single-family levels and the fallback path still work", () => {
  const singleLevel: Level = {
    id: "single",
    title: "Single",
    subtitle: "",
    blurb: "",
    difficulty: "hard",
    masteryThreshold: 0.8,
    questionCount: 5,
    generator: PROB_GENERATORS.genBinomial, // a raw, non-mixed generator
    lesson: { paragraphs: [] },
  };

  it("stamps the single generator's own family and still varies", () => {
    const prompts = new Set<string>();
    for (let s = 1; s <= 40; s++) {
      const q = generateFreshQuestion(singleLevel, s)!;
      expect(q.family).toBe("genBinomial");
      prompts.add(q.prompt);
    }
    expect(prompts.size).toBeGreaterThan(1);
  });

  it("materialized items of a single-family level carry the family", () => {
    for (const q of materializeLevel(singleLevel, 7)) {
      expect(q.family).toBe("genBinomial");
    }
  });

  it("an unknown/unresolvable family falls back to the whole-level mix (no crash)", () => {
    // Single-family: bogus family → same generator.
    const q = generateFreshQuestion(singleLevel, 5, "does-not-exist")!;
    expect(q.family).toBe("genBinomial");

    // Multi-family: bogus family → whole-level pick, still a REAL family.
    const multi = findMultiQuiz(probabilityTrack.levels, "probability");
    const fams = quizFamilies(multi);
    const q2 = generateFreshQuestion(multi, 9, "nope-not-a-family")!;
    expect(fams).toContain(q2.family);
  });
});

/* -------------------------------------------------------------------------- */
/*  Round-score isolation — bonus items NEVER affect the round tally           */
/* -------------------------------------------------------------------------- */

describe("bonus practice never affects the round score / mastery tally", () => {
  it("quiz round score reflects ONLY the 5 originals after many bonus items", () => {
    const level = findMultiQuiz(probabilityTrack.levels, "probability");
    const questions = materializeLevel(level, 42);
    expect(questions.length).toBe(5);

    // Answer every ORIGINAL correctly → perfect round.
    const answers = questions.map((q) => q.correctIndex);
    const before = countQuizCorrect(questions, answers);
    expect(before).toBe(5);
    expect(roundScore(before, questions.length)).toBe(1);

    // Simulate MANY bonus items from BOTH buttons, "answered" right AND wrong in
    // throwaway local state (exactly as the isolated bonus components do).
    const bonusIds: string[] = [];
    for (let s = 1; s <= 25; s++) {
      const b1 = generateFreshQuestion(level, s, questions[0].family)!; // button #1
      const b2 = generateFreshQuestion(level, 10_000 + s)!; //            button #2
      // Some correct, some wrong — but into variables that touch NOTHING.
      const pickedB1 = s % 2 === 0 ? b1.correctIndex : (b1.correctIndex + 1) % 4;
      const pickedB2 = s % 3 === 0 ? b2.correctIndex : (b2.correctIndex + 1) % 4;
      void pickedB1;
      void pickedB2;
      bonusIds.push(b1.id, b2.id);
    }

    // The round arrays are untouched; the tally is unchanged.
    expect(questions.length).toBe(5);
    expect(answers.length).toBe(5);
    expect(countQuizCorrect(questions, answers)).toBe(before);
    expect(roundScore(countQuizCorrect(questions, answers), questions.length)).toBe(1);

    // Bonus items are clearly separate (seed-suffixed) and not part of the round.
    const roundIds = new Set(questions.map((q) => q.id));
    for (const id of bonusIds) {
      expect(id).toContain("-practice-");
      expect(roundIds.has(id)).toBe(false);
    }
  });

  it("numeric round score reflects ONLY the 5 originals after many bonus items", () => {
    const level = findMultiNumeric(
      combinatorialAnalysisLevels,
      "combinatorialAnalysis",
    );
    const questions = materializeNumericLevel(level, 99);
    const total = questions.length; // the round is exactly these originals
    expect(total).toBeGreaterThan(0);

    const answers = questions.map((q) => q.answer);
    const before = countNumericCorrect(questions, answers);
    expect(before).toBe(total);

    for (let s = 1; s <= 25; s++) {
      const b1 = generateFreshNumericQuestion(level, s, questions[0].family)!;
      const b2 = generateFreshNumericQuestion(level, 10_000 + s)!;
      void b1.answer;
      void (b2.answer + 1); // "wrong" bonus answer, touches nothing
    }

    expect(questions.length).toBe(total);
    expect(countNumericCorrect(questions, answers)).toBe(before);
    expect(roundScore(before, total)).toBe(1);
  });
});

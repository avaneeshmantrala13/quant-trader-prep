import { describe, expect, it } from "vitest";
import type {
  FlashcardGenerator,
  Level,
  NumericQuestionGenerator,
  Question,
  QuestionGenerator,
} from "@/types/content";
import { PROB_GENERATORS } from "@/content/probability/generators";
import { probabilityTrack } from "@/content/probability/levels";
import {
  MAX_REGEN_ATTEMPTS,
  generateFreshFlashcard,
  generateFreshNumericQuestion,
  generateFreshQuestion,
} from "@/lib/regenerate";

/**
 * "Never regenerate the SAME item" contract. Reseeding alone can redraw the
 * exact item the learner is looking at when a family's parameter space is small
 * (the reported "committee of 2 from 6 → committee of 2 from 6" bug). The
 * regenerate helpers must keep reseeding until the content differs from the
 * passed `avoid`, capping at `MAX_REGEN_ATTEMPTS` and falling back gracefully.
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

/* -------------------------------------------------------------------------- */
/*  Quiz — the reported small-space family (combinations "committee of k / n") */
/* -------------------------------------------------------------------------- */

describe("quiz regeneration never returns the current item (small space)", () => {
  // genCombinations has only ~10 (n, k) pairs — a classic small space.
  const level: Level = { ...baseLevel, generator: PROB_GENERATORS.genCombinations };

  it("without dedup, the tiny space DOES redraw the source (proves the bug exists)", () => {
    const source = generateFreshQuestion(level, 12345)!;
    let repeats = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const q = generateFreshQuestion(level, seed, source.family)!;
      if (q.prompt === source.prompt) repeats++;
    }
    expect(repeats).toBeGreaterThan(0);
  });

  it("with the on-screen item as `avoid`, it NEVER redraws it, yet still varies", () => {
    const source = generateFreshQuestion(level, 12345)!;
    const prompts = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      const q = generateFreshQuestion(level, seed, source.family, source)!;
      expect(q.prompt).not.toBe(source.prompt); // never the current item
      prompts.add(q.prompt);
    }
    expect(prompts.size).toBeGreaterThan(1); // still genuinely varies
  });

  it("is deterministic per starting seed (reproducible for tests)", () => {
    const source = generateFreshQuestion(level, 12345)!;
    const a = generateFreshQuestion(level, 7, source.family, source)!;
    const b = generateFreshQuestion(level, 7, source.family, source)!;
    expect(a.prompt).toBe(b.prompt);
    expect(a.choices).toEqual(b.choices);
  });
});

/* -------------------------------------------------------------------------- */
/*  Whole-level mix (button #2) also never repeats the current item           */
/* -------------------------------------------------------------------------- */

describe("whole-level (button #2) regeneration never returns the current item", () => {
  const level = probabilityTrack.levels[0]; // mix([...]) — multiple families

  it("with `avoid`, no seed reproduces the source content", () => {
    const source = generateFreshQuestion(level, 555)!;
    const sig = (q: Question) => `${q.prompt}\u0001${q.choices[q.correctIndex]}`;
    const sourceSig = sig(source);
    for (let seed = 1; seed <= 300; seed++) {
      const q = generateFreshQuestion(level, seed, undefined, source)!;
      expect(sig(q)).not.toBe(sourceSig);
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  Cap / fallback path — a family that can ONLY produce one item              */
/* -------------------------------------------------------------------------- */

describe("cap/fallback: a single-item family can't loop forever or crash", () => {
  it("quiz: retries exactly MAX_REGEN_ATTEMPTS then returns the freshest attempt", () => {
    let calls = 0;
    const constGen: QuestionGenerator = () => {
      calls++;
      return {
        id: "only",
        prompt: "the one and only question",
        choices: ["1", "2", "3", "4"],
        correctIndex: 0,
        explanation: "e",
        difficulty: "easy",
      };
    };
    const level: Level = { ...baseLevel, generator: constGen };

    const source = generateFreshQuestion(level, 1)!; // 1 draw (no avoid)
    expect(calls).toBe(1);

    calls = 0;
    const regen = generateFreshQuestion(level, 2, undefined, source)!;
    // Exhausted the cap trying to differ, then fell back to a (repeat) item.
    expect(calls).toBe(MAX_REGEN_ATTEMPTS);
    expect(regen).not.toBeNull();
    expect(regen.prompt).toBe(source.prompt); // graceful repeat, no crash/hang
  });
});

/* -------------------------------------------------------------------------- */
/*  Numeric + flashcard regeneration honor the same contract                   */
/* -------------------------------------------------------------------------- */

describe("numeric regeneration never returns the current item (small space)", () => {
  const smallNumeric: NumericQuestionGenerator = (rng) => {
    const n = rng.int(1, 3);
    return {
      id: `pick-${n}`,
      prompt: `Enter ${n}`,
      answer: n,
      difficulty: "easy",
      explanation: `It is ${n}.`,
    };
  };
  const level: Level = {
    ...baseLevel,
    mode: "numeric",
    numericGenerator: smallNumeric,
  };

  it("with `avoid`, no seed reproduces the source", () => {
    const source = generateFreshNumericQuestion(level, 5)!;
    for (let seed = 1; seed <= 300; seed++) {
      const q = generateFreshNumericQuestion(level, seed, source.family, source)!;
      expect(q.answer).not.toBe(source.answer);
    }
  });
});

describe("flashcard regeneration never returns the current card (small space)", () => {
  const smallFlash: FlashcardGenerator = (rng) => {
    const n = rng.int(1, 3);
    return {
      id: `card-${n}`,
      prompt: `Card number ${n}`,
      answer: `${n}`,
      difficulty: "easy",
      explanation: `Because ${n}.`,
    };
  };
  const level: Level = {
    ...baseLevel,
    mode: "flashcard",
    masteryThreshold: 1,
    flashcardGenerators: [smallFlash],
  };

  it("with `avoid`, no seed reproduces the source card", () => {
    const source = generateFreshFlashcard(level, 3)!;
    for (let seed = 1; seed <= 300; seed++) {
      const c = generateFreshFlashcard(level, seed, source.family, source)!;
      expect(c.prompt).not.toBe(source.prompt);
    }
  });
});
